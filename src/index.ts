import { alert } from './alerts.js';
import { config } from './config.js';
import { getCandidates } from './jupiter.js';
import { log, warn } from './logger.js';
import { dailyLossPct, equitySol, tradingAllowed } from './risk.js';
import { rank } from './strategy.js';
import { loadState, saveState } from './state.js';
import { managePaperPosition, openPaperPosition, portfolioSnapshot } from './trader.js';

const state = loadState(config.startingEquitySol);
const today = () => new Date().toISOString().slice(0, 10);

function rollDay(): void {
  const d = today();
  if (state.dayStart !== d) {
    state.dayStart = d;
    state.dayStartEquitySol = equitySol(state);
    state.tradesToday = 0;
    state.consecutiveFailures = 0;
    state.paused = false;
  }
}

async function tick(): Promise<void> {
  rollDay();
  if (dailyLossPct(state) >= config.maxDailyLossPct) {
    if (!state.paused) await alert(`DEMКINN PAUSED\nDaily loss limit reached: ${dailyLossPct(state).toFixed(2)}%`);
    state.paused = true;
  }

  const tokens = await getCandidates();
  const byMint = new Map(tokens.map((t) => [t.id, t]));
  for (const pos of [...state.positions]) {
    const live = byMint.get(pos.mint);
    if (live?.usdPrice) await managePaperPosition(pos, state, live.usdPrice);
  }

  const ranked = rank(tokens);
  const best = ranked[0];
  log(`${config.botName}: scanned=${tokens.length} qualified=${ranked.length} ${portfolioSnapshot(state)}`);
  if (best && best.score >= config.entryScoreMin && tradingAllowed(state)) {
    log(`SETUP ${best.symbol ?? best.id.slice(0, 8)} score=${best.score}`, best.reasons);
    await openPaperPosition(best, state);
  }
  state.lastScanAt = Date.now();
  saveState(state);
}

async function main(): Promise<void> {
  await alert(`DEMКINN ONLINE\nMode: PAPER ONLY\nStarting equity: ${config.startingEquitySol} SOL\nEntry score: ${config.entryScoreMin}`);
  while (true) {
    try { await tick(); }
    catch (error) {
      state.consecutiveFailures += 1;
      warn('Main loop error', String(error));
      saveState(state);
      if (state.consecutiveFailures >= 3) {
        state.paused = true;
        await alert('DEMКINN PAUSED\n3 consecutive system failures. Review logs before restart.');
      } else await alert(`DEMКINN ERROR\n${String(error).slice(0, 350)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, config.scanIntervalMs));
  }
}

void main();
