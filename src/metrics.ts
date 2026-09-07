import { appendFileSync } from 'node:fs';
import type { Candidate, PortfolioState } from './types.js';
import type { RejectionReason } from './strategy.js';

export interface ScanRecord {
  timestamp: number;
  scanned: number;
  qualified: number;
  rejectionReasons: Partial<Record<RejectionReason, number>>;
  best?: { mint: string; symbol: string; score: number; price?: number; liquidity?: number; momentum5m: number; buySellRatio: number; netBuyers5m: number };
}

export interface PerformanceSnapshot {
  timestamp: number;
  equitySol: number;
  cashSol: number;
  unrealizedPnlSol: number;
  realizedPnlSol: number;
  feesSol: number;
  slippageSol: number;
  openPositions: number;
  tradesToday: number;
  winRatePct: number;
  paused: boolean;
  consecutiveFailures: number;
}

export function unrealizedPnlSol(state: PortfolioState): number {
  return state.positions.reduce((sum, p) => sum + (p.tokenQty * p.lastPrice - p.remainingCostSol), 0);
}

export function performanceSnapshot(state: PortfolioState): PerformanceSnapshot {
  const closed = state.winningTrades + state.losingTrades;
  return {
    timestamp: Date.now(),
    equitySol: state.cashSol + state.positions.reduce((sum, p) => sum + p.tokenQty * p.lastPrice, 0),
    cashSol: state.cashSol,
    unrealizedPnlSol: unrealizedPnlSol(state),
    realizedPnlSol: state.realizedPnlSol,
    feesSol: state.feesSol,
    slippageSol: state.slippageSol,
    openPositions: state.positions.length,
    tradesToday: state.tradesToday,
    winRatePct: closed ? (state.winningTrades / closed) * 100 : 0,
    paused: state.paused,
    consecutiveFailures: state.consecutiveFailures,
  };
}

export function scanRecord(tokens: Candidate[], scanned: number, rejectionReasons: Partial<Record<RejectionReason, number>> = {}): ScanRecord {
  const best = tokens[0];
  return {
    timestamp: Date.now(), scanned, qualified: tokens.length, rejectionReasons,
    best: best ? { mint: best.id, symbol: best.symbol ?? best.id.slice(0, 8), score: best.score,
      price: best.usdPrice, liquidity: best.liquidity, momentum5m: best.momentum5m,
      buySellRatio: best.buySellRatio, netBuyers5m: best.netBuyers5m } : undefined,
  };
}

export function appendJsonl(file: string, value: unknown): void {
  appendFileSync(file, `${JSON.stringify(value)}\n`, { mode: 0o600 });
}
