import { config } from './config.js';
import { alert } from './alerts.js';
import { getCandidates } from './jupiter.js';
import { log, warn } from './logger.js';
import { rank } from './strategy.js';
import { openPosition, loadWallet, managePosition } from './trader.js';
import type { PortfolioState } from './types.js';
import { loadState, saveState } from './state.js';

const today = () => new Date().toISOString().slice(0, 10);
const state: PortfolioState = loadState() ?? {
  equitySol: config.startingEquitySol,
  cashSol: config.startingEquitySol,
  dayStartEquitySol: config.startingEquitySol,
  dayStart: today(),
  positions: [],
  realizedPnlSol: 0,
  tradesToday: 0,
  consecutiveFailures: 0,
};

const wallet = loadWallet();
if (config.mode === 'live' && wallet) log(`${config.botName} wallet ${wallet.publicKey.toBase58()}`);

async function tick() {
  if (state.dayStart !== today()) {
    state.dayStart = today();
    state.dayStartEquitySol = state.equitySol;
    state.tradesToday = 0;
    state.consecutiveFailures = 0;
  }

  const tokens = await getCandidates();
  const ranked = rank(tokens);
  log(`${config.botName}: scanned ${tokens.length}, passed ${ranked.length}`);

  for (const position of [...state.positions]) {
    const token = tokens.find((t) => t.id === position.mint);
    const price = token?.usdPrice ?? 0;
    if (price) await managePosition(position, state, wallet, price);
  }

  const best = ranked[0];
  if (best && best.score >= config.entryScoreMin) {
    log(`Top setup ${best.symbol ?? best.id.slice(0, 6)} score=${best.score}`, best.reasons);
    try {
      await openPosition(best, state, wallet);
      state.consecutiveFailures = 0;
      saveState(state);
    } catch (error) {
      state.consecutiveFailures += 1;
      warn(`Entry failed (${state.consecutiveFailures}/3)`, String(error));
      await alert(`DEMКINN ERROR\nEntry failed: ${String(error).slice(0, 400)}`);
      saveState(state);
    }
  }
}

async function main() {
  await alert(`DEMКINN ONLINE\nMode: ${config.mode}\nScan: ${config.scanIntervalMs / 1000}s`);
  while (true) {
    try { await tick(); }
    catch (error) {
      warn('Main loop error', String(error));
      await alert(`DEMКINN ERROR\n${String(error).slice(0, 400)}`);
      saveState(state);
    }
    saveState(state);
    await new Promise((resolve) => setTimeout(resolve, config.scanIntervalMs));
  }
}

void main();
