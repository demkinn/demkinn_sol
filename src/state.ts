import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import type { PortfolioState } from './types.js';

const FILE = 'demkinn-state.json';

export function loadState(): PortfolioState | null {
  if (!existsSync(FILE)) return null;
  try {
    const state = JSON.parse(readFileSync(FILE, 'utf8')) as PortfolioState;
    if (!Number.isFinite(state.cashSol)) state.cashSol = state.equitySol;
    return state;
  } catch { return null; }
}

export function saveState(state: PortfolioState): void {
  writeFileSync(FILE, JSON.stringify(state, null, 2), { mode: 0o600 });
}
