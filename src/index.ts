import { alert } from './alerts.js';
import { config } from './config.js';
import { getCandidates } from './jupiter.js';
import { log, warn } from './logger.js';
import { appendJsonl, performanceSnapshot, scanRecord } from './metrics.js';
import { dailyLossPct, equitySol, tradingAllowed } from './risk.js';
import { rejectionCounts, rank } from './strategy.js';
import { loadState, saveState } from './state.js';
import { managePaperPosition, openPaperPosition, portfolioSnapshot } from './trader.js';

const state = loadState(config.startingEquitySol);
const today = () => new Date().toISOString().slice(0, 10);
const scansFile = process.env.DEMKINN_SCANS_FILE ?? 'demkinn-scans.jsonl';
const performanceFile = process.env.DEMKINN_PERFORMANCE_FILE ?? 'demkinn-performance.jsonl';
let shuttingDown = false;

function rollDay(): void {
  const d = today();
  if (state.dayStart !== d) {
    state.dayStart = d;
    state.dayStartEquitySol = equitySol(state);
    state.tradesToday = 0;
    state.consecutiveFailures = 0;
    state.paused = false;
    saveState(state);
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
  const rejections = rejectionCounts(tokens);
  appendJsonl(scansFile, scanRecord(ranked, tokens.length, rejections));
  appendJsonl(performanceFile, performanceSnapshot(state));
  log(`${config.botName}: scanned=${tokens.length} qualified=${ranked.length} rejects=${JSON.stringify(rejections)} ${portfolioSnapshot(state)}`);
  if (best && best.score >= config.entryScoreMin && tradingAllowed(state)) {
    log(`SETUP ${best.symbol ?? best.id.slice(0, 8)} score=${best.score}`, best.reasons);
    await openPaperPosition(best, state);
  }
  state.lastScanAt = Date.now();
  state.consecutiveFailures = 0;
  saveState(state);
}

function installShutdownHandlers(): void {
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    saveState(state);
    log(`DEMКINN shutdown via ${signal}; state persisted.`);
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('uncaughtException', (error) => {
    state.consecutiveFailures += 1;
    warn('Uncaught exception', error.stack ?? String(error));
    saveState(state);
  });
  process.once('unhandledRejection', (error) => {
    state.consecutiveFailures += 1;
    warn('Unhandled rejection', String(error));
    saveState(state);
  });
}

async function main(): Promise<void> {
  installShutdownHandlers();
  await alert(`DEMКINN ONLINE\nMode: PAPER ONLY\nStarting equity: ${config.startingEquitySol} SOL\nEntry score: ${config.entryScoreMin}`);
  while (!shuttingDown) {
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
    if (!shuttingDown) await new Promise((resolve) => setTimeout(resolve, config.scanIntervalMs));
  }
}

void main();
