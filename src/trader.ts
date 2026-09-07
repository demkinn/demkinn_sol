import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { config } from './config.js';
import { alert } from './alerts.js';
import { executeOrder, getOrder, SOL_MINT } from './jupiter.js';
import { log } from './logger.js';
import type { Candidate, PortfolioState, Position } from './types.js';
import { positionSizeSol, tradingAllowed } from './risk.js';

export function loadWallet(): Keypair | null {
  if (!config.walletPrivateKey) return null;
  try {
    const raw = config.walletPrivateKey.trim();
    if (raw.startsWith('[')) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw) as number[]));
    return Keypair.fromSecretKey(bs58.decode(raw));
  } catch (error) {
    throw new Error(`Could not load WALLET_PRIVATE_KEY: ${String(error)}`);
  }
}

export async function openPosition(candidate: Candidate, state: PortfolioState, wallet: Keypair | null): Promise<Position | null> {
  if (candidate.score < config.entryScoreMin || !tradingAllowed(state)) return null;
  if (state.positions.some((p) => p.mint === candidate.id)) return null;

  const sizeSol = positionSizeSol(state.equitySol);
  if (sizeSol <= 0) return null;

  if (config.mode === 'paper') {
    const price = candidate.usdPrice ?? 0;
    const position: Position = {
      mint: candidate.id,
      symbol: candidate.symbol ?? candidate.id.slice(0, 6),
      entryPrice: price,
      quantity: 1,
      costSol: sizeSol,
      openedAt: Date.now(),
      highPrice: price,
      tp1Done: false,
      tp2Done: false,
    };
    state.positions.push(position);
    state.cashSol -= sizeSol;
    state.tradesToday += 1;
    await alert(`DEMKINN PAPER BUY\n${position.symbol} | score ${candidate.score}\nsize ${sizeSol.toFixed(3)} SOL\n${candidate.reasons.join(' • ')}`);
    return position;
  }

  if (!wallet) throw new Error('Live mode requires wallet');
  const lamports = Math.floor(sizeSol * 1_000_000_000);
  const order = await getOrder(SOL_MINT, candidate.id, String(lamports), wallet.publicKey.toBase58());
  if (!order.transaction) throw new Error('No Jupiter transaction returned for entry');
  const result = await executeOrder(order, wallet);
  if (result.status !== 'Success') throw new Error(result.error ?? 'Jupiter entry failed');

  const position: Position = {
    mint: candidate.id,
    symbol: candidate.symbol ?? candidate.id.slice(0, 6),
    entryPrice: candidate.usdPrice ?? 0,
    quantity: Number(result.outputAmountResult ?? order.outAmount),
    costSol: sizeSol,
    openedAt: Date.now(),
    highPrice: candidate.usdPrice ?? 0,
    tp1Done: false,
    tp2Done: false,
  };
  state.positions.push(position);
  state.cashSol -= sizeSol;
  state.tradesToday += 1;
  await alert(`DEMKINN LIVE BUY\n${position.symbol} | score ${candidate.score}\nsize ${sizeSol.toFixed(3)} SOL\nTX: https://solscan.io/tx/${result.signature ?? ''}`);
  return position;
}

export async function closePosition(position: Position, state: PortfolioState, wallet: Keypair | null, reason: string, sellFraction = 1): Promise<void> {
  if (config.mode === 'paper') {
    const current = position.highPrice;
    const pnlPct = position.entryPrice > 0 ? ((current - position.entryPrice) / position.entryPrice) * 100 : 0;
    const soldCost = position.costSol * sellFraction;
    const pnlSol = soldCost * (pnlPct / 100);
    state.realizedPnlSol += pnlSol;
    state.cashSol += soldCost + pnlSol;
    state.equitySol += pnlSol;
    if (sellFraction >= 0.999) {
      state.positions = state.positions.filter((p) => p.mint !== position.mint);
    } else {
      position.costSol -= soldCost;
      position.quantity *= (1 - sellFraction);
    }
    await alert(`DEMKINN PAPER SELL\n${position.symbol} | ${reason}\nPnL est ${pnlSol.toFixed(4)} SOL`);
    return;
  }
  if (!wallet) throw new Error('Live mode requires wallet');
  const amount = Math.floor(position.quantity * sellFraction);
  const order = await getOrder(position.mint, SOL_MINT, String(amount), wallet.publicKey.toBase58());
  const result = await executeOrder(order, wallet);
  if (result.status !== 'Success') throw new Error(result.error ?? 'Jupiter exit failed');
  const proceedsSol = Number(result.outputAmountResult ?? 0) / 1_000_000_000;
  const soldCost = position.costSol * sellFraction;
  const realized = proceedsSol - soldCost;
  state.realizedPnlSol += realized;
  state.equitySol += realized;
  state.cashSol += proceedsSol;
  if (sellFraction >= 0.999) state.positions = state.positions.filter((p) => p.mint !== position.mint);
  else { position.quantity -= amount; position.costSol *= (1 - sellFraction); }
  await alert(`DEMKINN LIVE SELL\n${position.symbol} | ${reason}\nTX: https://solscan.io/tx/${result.signature ?? ''}`);
}

export function updatePositionPrice(position: Position, price: number) {
  if (price > position.highPrice) position.highPrice = price;
}

export async function managePosition(position: Position, state: PortfolioState, wallet: Keypair | null, price: number): Promise<void> {
  if (!price || !position.entryPrice) return;
  updatePositionPrice(position, price);
  const pnlPct = ((price - position.entryPrice) / position.entryPrice) * 100;
  const drawdownFromHigh = ((position.highPrice - price) / position.highPrice) * 100;
  const ageMin = (Date.now() - position.openedAt) / 60_000;

  if (!position.tp1Done && pnlPct >= config.tp1Pct) {
    position.tp1Done = true;
    await closePosition(position, state, wallet, `TP1 +${pnlPct.toFixed(1)}%`, config.tp1SellPct / 100);
    return;
  }
  if (!position.tp2Done && pnlPct >= config.tp2Pct) {
    position.tp2Done = true;
    await closePosition(position, state, wallet, `TP2 +${pnlPct.toFixed(1)}%`, config.tp2SellPct / 100);
    return;
  }
  if (pnlPct <= -config.stopLossPct) {
    await closePosition(position, state, wallet, `STOP ${pnlPct.toFixed(1)}%`);
    return;
  }
  if (position.highPrice > position.entryPrice * 1.1 && drawdownFromHigh >= config.trailingStopPct) {
    await closePosition(position, state, wallet, `TRAIL ${drawdownFromHigh.toFixed(1)}% from high`);
    return;
  }
  if (ageMin >= config.timeStopMin && pnlPct < 10) {
    await closePosition(position, state, wallet, `TIME ${ageMin.toFixed(0)}m`);
  }
}
