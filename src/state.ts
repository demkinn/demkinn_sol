import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import type { PortfolioState, Position, Trade } from './types.js';

const FILE = process.env.DEMKINN_STATE_FILE ?? 'demkinn-state.json';

const finiteNonNegative = (value: unknown, fallback = 0): number => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;

function validPosition(value: unknown): value is Position {
  if (!value || typeof value !== 'object') return false;
  const p = value as Position;
  return typeof p.id === 'string' && typeof p.mint === 'string' && typeof p.symbol === 'string'
    && Number.isFinite(p.entryPrice) && p.entryPrice > 0
    && Number.isFinite(p.lastPrice) && p.lastPrice > 0
    && Number.isFinite(p.highPrice) && p.highPrice >= p.entryPrice
    && Number.isFinite(p.tokenQty) && p.tokenQty > 0
    && Number.isFinite(p.remainingCostSol) && p.remainingCostSol > 0
    && Number.isFinite(p.originalCostSol) && p.originalCostSol >= p.remainingCostSol
    && Number.isFinite(p.openedAt) && p.openedAt > 0
    && Number.isFinite(p.scoreAtEntry) && p.scoreAtEntry >= 0 && p.scoreAtEntry <= 100
    && typeof p.tp1Done === 'boolean' && typeof p.tp2Done === 'boolean';
}

function validTrade(value: unknown): value is Trade {
  if (!value || typeof value !== 'object') return false;
  const t = value as Trade;
  return typeof t.id === 'string' && typeof t.mint === 'string' && typeof t.symbol === 'string'
    && (t.side === 'BUY' || t.side === 'SELL') && typeof t.reason === 'string'
    && Number.isFinite(t.price) && t.price > 0 && Number.isFinite(t.tokenQty) && t.tokenQty >= 0
    && Number.isFinite(t.grossSol) && t.grossSol >= 0 && Number.isFinite(t.feeSol) && t.feeSol >= 0
    && Number.isFinite(t.slippageSol) && t.slippageSol >= 0 && Number.isFinite(t.pnlSol)
    && Number.isFinite(t.timestamp) && t.timestamp > 0;
}

export function initialState(startingEquitySol: number): PortfolioState {
  return {
    version: 2, cashSol: startingEquitySol, realizedPnlSol: 0, feesSol: 0, slippageSol: 0,
    dayStartEquitySol: startingEquitySol, dayStart: new Date().toISOString().slice(0, 10),
    tradesToday: 0, winningTrades: 0, losingTrades: 0, consecutiveFailures: 0, paused: false,
    positions: [], trades: [], lastScanAt: 0,
  };
}

export function loadState(startingEquitySol: number): PortfolioState {
  if (!existsSync(FILE)) return initialState(startingEquitySol);
  try {
    const parsed = JSON.parse(readFileSync(FILE, 'utf8')) as Partial<PortfolioState>;
    if (parsed.version !== 2 || !Array.isArray(parsed.positions) || !Array.isArray(parsed.trades)) return initialState(startingEquitySol);
    const positions = parsed.positions.filter(validPosition);
    const trades = parsed.trades.filter(validTrade).slice(-1000);
    if (positions.length !== parsed.positions.length) console.warn('[WARN] Invalid persisted positions were discarded.');
    if (trades.length !== parsed.trades.length) console.warn('[WARN] Invalid persisted trades were discarded.');
    return {
      version: 2,
      cashSol: finiteNonNegative(parsed.cashSol, startingEquitySol),
      realizedPnlSol: typeof parsed.realizedPnlSol === 'number' && Number.isFinite(parsed.realizedPnlSol) ? parsed.realizedPnlSol : 0,
      feesSol: finiteNonNegative(parsed.feesSol),
      slippageSol: finiteNonNegative(parsed.slippageSol),
      dayStartEquitySol: finiteNonNegative(parsed.dayStartEquitySol, startingEquitySol) || startingEquitySol,
      dayStart: typeof parsed.dayStart === 'string' ? parsed.dayStart : new Date().toISOString().slice(0, 10),
      tradesToday: Math.floor(finiteNonNegative(parsed.tradesToday)),
      winningTrades: Math.floor(finiteNonNegative(parsed.winningTrades)),
      losingTrades: Math.floor(finiteNonNegative(parsed.losingTrades)),
      consecutiveFailures: Math.floor(finiteNonNegative(parsed.consecutiveFailures)),
      paused: parsed.paused === true,
      positions,
      trades,
      lastScanAt: finiteNonNegative(parsed.lastScanAt),
    };
  } catch (error) {
    console.warn(`[WARN] State file could not be loaded; starting clean: ${String(error)}`);
    return initialState(startingEquitySol);
  }
}

export function saveState(state: PortfolioState): void {
  const tmp = `${FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2), { mode: 0o600 });
  renameSync(tmp, FILE);
}
