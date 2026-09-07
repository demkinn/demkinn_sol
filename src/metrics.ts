import { writeFileSync } from 'node:fs';
import type { Candidate, PortfolioState } from './types.js';

export interface ScanRecord {
  timestamp: number;
  scanned: number;
  qualified: number;
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
  };
}

export function appendJsonl(file: string, value: unknown): void {
  writeFileSync(file, '', { flag: 'a', mode: 0o600 });
  writeFileSync(file, `${JSON.stringify(value)}\n`, { flag: 'a', mode: 0o600 });
}
