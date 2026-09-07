import crypto from 'node:crypto';
import { config } from './config.js';
import { alert } from './alerts.js';
import { positionSizeSol, tradingAllowed, equitySol } from './risk.js';
import type { Candidate, PortfolioState, Position, Trade } from './types.js';

const id = () => crypto.randomUUID();
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

function estimatedSlipBps(candidate: Candidate, sizeSol: number): number {
  const liq = Math.max(candidate.liquidity ?? 0, 1);
  return clamp(15 + ((sizeSol * 150) / liq) * 10_000, 15, config.paperMaxSlippageBps);
}

function recordTrade(state: PortfolioState, trade: Trade): void {
  state.trades.push(trade);
  if (state.trades.length > 1000) state.trades.splice(0, state.trades.length - 1000);
  state.feesSol += trade.feeSol;
  state.slippageSol += trade.slippageSol;
}

export async function openPaperPosition(candidate: Candidate, state: PortfolioState): Promise<Position | null> {
  if (candidate.score < config.entryScoreMin || !tradingAllowed(state) || state.positions.some((p) => p.mint === candidate.id)) return null;
  if (!candidate.usdPrice || candidate.usdPrice <= 0) return null;
  const sizeSol = positionSizeSol(state);
  if (!sizeSol) return null;

  const slipBps = estimatedSlipBps(candidate, sizeSol);
  const feeSol = sizeSol * config.paperFeeBps / 10_000;
  const effectivePrice = candidate.usdPrice * (1 + slipBps / 10_000);
  const tokenQty = Math.max(0, (sizeSol - feeSol) / effectivePrice);
  const slippageSol = sizeSol * slipBps / 10_000;
  const now = Date.now();
  const position: Position = {
    id: id(), mint: candidate.id, symbol: candidate.symbol ?? candidate.id.slice(0, 8),
    entryPrice: effectivePrice, lastPrice: effectivePrice, highPrice: effectivePrice,
    tokenQty, remainingCostSol: sizeSol, originalCostSol: sizeSol, openedAt: now,
    scoreAtEntry: candidate.score, tp1Done: false, tp2Done: false,
  };
  state.positions.push(position);
  state.cashSol -= sizeSol;
  state.tradesToday += 1;
  state.consecutiveFailures = 0;
  recordTrade(state, { id: id(), mint: position.mint, symbol: position.symbol, side: 'BUY', reason: 'ENTRY', price: effectivePrice, tokenQty, grossSol: sizeSol, feeSol, slippageSol, pnlSol: 0, timestamp: now });
  await alert(`DEMКINN PAPER BUY\n${position.symbol} | score ${candidate.score}\nsize ${sizeSol.toFixed(4)} SOL\nfill ${effectivePrice.toExponential(4)}\nslip ${slipBps.toFixed(1)} bps\n${candidate.reasons.join(' • ')}`);
  return position;
}

export async function closePaperPosition(position: Position, state: PortfolioState, price: number, reason: string, sellFraction = 1): Promise<void> {
  const fraction = clamp(sellFraction, 0.01, 1);
  const qty = position.tokenQty * fraction;
  const grossSol = qty * price;
  const feeSol = grossSol * config.paperFeeBps / 10_000;
  const slipBps = Math.min(config.paperMaxSlippageBps, 20 + (config.minTradeSol / Math.max(position.remainingCostSol, 0.000001)) * 10);
  const slippageSol = grossSol * slipBps / 10_000;
  const proceeds = Math.max(0, grossSol - feeSol - slippageSol);
  const costBasis = position.remainingCostSol * fraction;
  const pnlSol = proceeds - costBasis;
  const closingFully = fraction >= 0.999;

  state.cashSol += proceeds;
  state.realizedPnlSol += pnlSol;
  recordTrade(state, { id: id(), mint: position.mint, symbol: position.symbol, side: 'SELL', reason, price, tokenQty: qty, grossSol, feeSol, slippageSol, pnlSol, timestamp: Date.now() });
  position.tokenQty = Math.max(0, position.tokenQty - qty);
  position.remainingCostSol = Math.max(0, position.remainingCostSol - costBasis);

  if (closingFully || position.tokenQty <= 0.000000000001) {
    if (pnlSol >= 0) state.winningTrades += 1; else state.losingTrades += 1;
    state.positions = state.positions.filter((p) => p.id !== position.id);
  }
  await alert(`DEMКINN PAPER SELL\n${position.symbol} | ${reason}\nPnL ${pnlSol >= 0 ? '+' : ''}${pnlSol.toFixed(4)} SOL\nprice ${price.toExponential(4)}`);
}

function originalFractionToRemaining(position: Position, originalFraction: number): number {
  if (position.remainingCostSol <= 0) return 1;
  return clamp((position.originalCostSol * originalFraction) / position.remainingCostSol, 0.01, 1);
}

export async function managePaperPosition(position: Position, state: PortfolioState, price: number): Promise<void> {
  if (!Number.isFinite(price) || price <= 0) return;
  position.lastPrice = price;
  position.highPrice = Math.max(position.highPrice, price);
  const pnlPct = ((price - position.entryPrice) / position.entryPrice) * 100;
  const drawdownFromHigh = ((position.highPrice - price) / position.highPrice) * 100;
  const ageMin = (Date.now() - position.openedAt) / 60_000;

  if (!position.tp1Done && pnlPct >= config.tp1Pct) {
    position.tp1Done = true;
    await closePaperPosition(position, state, price, `TP1 +${pnlPct.toFixed(1)}%`, originalFractionToRemaining(position, config.tp1SellPct / 100));
    return;
  }
  if (!position.tp2Done && pnlPct >= config.tp2Pct && state.positions.some((p) => p.id === position.id)) {
    position.tp2Done = true;
    await closePaperPosition(position, state, price, `TP2 +${pnlPct.toFixed(1)}%`, originalFractionToRemaining(position, config.tp2SellPct / 100));
    return;
  }
  if (pnlPct <= -config.stopLossPct) {
    await closePaperPosition(position, state, price, `STOP ${pnlPct.toFixed(1)}%`);
    return;
  }
  if (position.highPrice > position.entryPrice * (1 + config.trailingActivationPct / 100) && drawdownFromHigh >= config.trailingStopPct) {
    await closePaperPosition(position, state, price, `TRAIL -${drawdownFromHigh.toFixed(1)}% from high`);
    return;
  }
  if (ageMin >= config.timeStopMin && pnlPct < 10) await closePaperPosition(position, state, price, `TIME ${ageMin.toFixed(0)}m`);
}

export function markToMarket(state: PortfolioState): number {
  return equitySol(state);
}

export function portfolioSnapshot(state: PortfolioState): string {
  const eq = markToMarket(state);
  const total = state.winningTrades + state.losingTrades;
  const winRate = total ? (state.winningTrades / total) * 100 : 0;
  return `equity=${eq.toFixed(4)} SOL cash=${state.cashSol.toFixed(4)} SOL pnl=${state.realizedPnlSol.toFixed(4)} SOL trades=${state.tradesToday} winrate=${winRate.toFixed(1)}% open=${state.positions.length}`;
}
