import { config } from './config.js';
import type { PortfolioState } from './types.js';

export function equitySol(state: PortfolioState): number {
  return state.cashSol + state.positions.reduce((sum, p) => sum + (p.tokenQty * p.lastPrice), 0);
}

export function dailyLossPct(state: PortfolioState): number {
  if (state.dayStartEquitySol <= 0) return 0;
  return Math.max(0, ((state.dayStartEquitySol - equitySol(state)) / state.dayStartEquitySol) * 100);
}

export function tradingAllowed(state: PortfolioState): boolean {
  return !state.paused && dailyLossPct(state) < config.maxDailyLossPct && state.positions.length < config.maxOpenPositions && state.consecutiveFailures < 3;
}

export function positionSizeSol(state: PortfolioState): number {
  const equity = equitySol(state);
  const riskBudget = equity * (config.riskPerTradePct / 100);
  const riskSize = riskBudget / (config.stopLossPct / 100);
  const cap = equity * (config.maxPositionPct / 100);
  const size = Math.min(config.maxTradeSol, riskSize, cap, state.cashSol);
  return size >= config.minTradeSol ? Math.round(size * 1e6) / 1e6 : 0;
}
