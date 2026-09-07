import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import type { PortfolioState } from './types.js';

const FILE = process.env.DEMKINN_STATE_FILE ?? 'demkinn-state.json';

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
    return parsed as PortfolioState;
  } catch { return initialState(startingEquitySol); }
}

export function saveState(state: PortfolioState): void {
  const tmp = `${FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2), { mode: 0o600 });
  renameSync(tmp, FILE);
}
