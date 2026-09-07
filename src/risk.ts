import { config } from './config.js';
import type { PortfolioState } from './types.js';

export function dailyLossPct(state: PortfolioState): number {
  if (state.dayStartEquitySol <= 0) return 0;
  return Math.max(0, (-state.realizedPnlSol / state.dayStartEquitySol) * 100);
}

export function tradingAllowed(state: PortfolioState): boolean {
  return dailyLossPct(state) < config.maxDailyLossPct && state.positions.length < config.maxOpenPositions && state.consecutiveFailures < 3;
}

export function positionSizeSol(equitySol: number): number {
  const riskBudget = equitySol * (config.riskPerTradePct / 100);
  const stopFraction = config.stopLossPct / 100;
  const raw = riskBudget / stopFraction;
  const cap = equitySol * (config.maxPositionPct / 100);
  const size = Math.min(config.maxTradeSol, raw, cap);
  return size >= config.minTradeSol ? size : 0;
}
