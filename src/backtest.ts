import { config } from './config.js';

export interface ReplayCase {
  id: string;
  symbol: string;
  entryPrice: number;
  prices: number[];
  timestampsMs?: number[];
  score?: number;
}

export interface ReplayTrade {
  id: string;
  symbol: string;
  pnlPct: number;
  pnlSol: number;
  feesSol: number;
  slippageSol: number;
  reason: string;
  holdSteps: number;
  holdMinutes: number;
}

export interface BacktestReport {
  cases: number;
  trades: number;
  wins: number;
  losses: number;
  winRatePct: number;
  netPnlSol: number;
  avgPnlSol: number;
  expectancySol: number;
  avgWinnerSol: number;
  avgLoserSol: number;
  profitFactor: number;
  maxDrawdownPct: number;
  bestTradePct: number;
  worstTradePct: number;
  totalFeesSol: number;
  totalSlippageSol: number;
  tradesByReason: Record<string, number>;
}

interface ExitResult {
  pnlPct: number;
  pnlSol: number;
  feesSol: number;
  slippageSol: number;
  reason: string;
  holdSteps: number;
  holdMinutes: number;
}

function elapsedMinutes(timestampsMs: number[] | undefined, index: number): number {
  if (!timestampsMs || timestampsMs.length !== index + 1) return index + 1;
  const first = timestampsMs[0];
  const current = timestampsMs[index];
  if (!Number.isFinite(first) || !Number.isFinite(current) || current < first) return index + 1;
  return (current - first) / 60_000;
}

function exitOne(entry: number, prices: number[], timestampsMs: number[] | undefined, stakeSol: number): ExitResult {
  const entrySlip = config.backtestSlippageBps / 10_000;
  const feeRate = config.paperFeeBps / 10_000;
  const executionEntry = entry * (1 + entrySlip);
  const entryFee = stakeSol * feeRate;
  const tokenQty = Math.max(0, (stakeSol - entryFee) / executionEntry);

  let high = entry;
  let remaining = 1;
  let realizedSol = 0;
  let feesSol = entryFee;
  let slippageSol = stakeSol * entrySlip;
  let tp1 = false;
  let tp2 = false;
  let lastIndex = 0;
  let lastMinutes = 0;

  const sell = (price: number, fraction: number, reason: string) => {
    const qty = tokenQty * fraction;
    const gross = qty * price;
    const slip = gross * entrySlip;
    const fee = (gross - slip) * feeRate;
    const proceeds = Math.max(0, gross - slip - fee);
    const costBasis = stakeSol * fraction;
    const pnl = proceeds - costBasis;
    realizedSol += pnl;
    feesSol += fee;
    slippageSol += slip;
    remaining = Math.max(0, remaining - fraction);
    return { pnl, reason };
  };

  for (let i = 0; i < prices.length; i += 1) {
    const price = prices[i];
    if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) continue;
    lastIndex = i;
    lastMinutes = elapsedMinutes(timestampsMs, i);
    high = Math.max(high, price);
    const pnlPct = ((price - entry) / entry) * 100;
    const ddPct = ((high - price) / high) * 100;

    if (!tp1 && pnlPct >= config.tp1Pct) {
      tp1 = true;
      sell(price, config.tp1SellPct / 100, `TP1 +${pnlPct.toFixed(1)}%`);
    }
    if (!tp2 && pnlPct >= config.tp2Pct) {
      tp2 = true;
      sell(price, config.tp2SellPct / 100, `TP2 +${pnlPct.toFixed(1)}%`);
    }
    if (pnlPct <= -config.stopLossPct) {
      const r = sell(price, remaining, `STOP ${pnlPct.toFixed(1)}%`);
      return { pnlPct: (realizedSol / stakeSol) * 100, pnlSol: realizedSol, feesSol, slippageSol, reason: r.reason, holdSteps: i + 1, holdMinutes: lastMinutes };
    }
    if (high > entry * (1 + config.trailingActivationPct / 100) && ddPct >= config.trailingStopPct) {
      const r = sell(price, remaining, `TRAIL -${ddPct.toFixed(1)}%`);
      return { pnlPct: (realizedSol / stakeSol) * 100, pnlSol: realizedSol, feesSol, slippageSol, reason: r.reason, holdSteps: i + 1, holdMinutes: lastMinutes };
    }
    if (lastMinutes >= config.timeStopMin && pnlPct < 10) {
      const r = sell(price, remaining, `TIME ${lastMinutes.toFixed(0)}m`);
      return { pnlPct: (realizedSol / stakeSol) * 100, pnlSol: realizedSol, feesSol, slippageSol, reason: r.reason, holdSteps: i + 1, holdMinutes: lastMinutes };
    }
    if (remaining <= 0.000001) return { pnlPct: (realizedSol / stakeSol) * 100, pnlSol: realizedSol, feesSol, slippageSol, reason: 'TARGETS', holdSteps: i + 1, holdMinutes: lastMinutes };
  }

  const last = prices.at(-1);
  if (typeof last === 'number' && Number.isFinite(last) && last > 0) {
    const r = sell(last, remaining, 'END');
    return { pnlPct: (realizedSol / stakeSol) * 100, pnlSol: realizedSol, feesSol, slippageSol, reason: r.reason, holdSteps: lastIndex + 1, holdMinutes: lastMinutes };
  }
  return { pnlPct: 0, pnlSol: 0, feesSol, slippageSol, reason: 'INVALID', holdSteps: lastIndex + 1, holdMinutes: lastMinutes };
}

export function runBacktest(cases: ReplayCase[], stakeSol = 0.1): { report: BacktestReport; trades: ReplayTrade[] } {
  if (!Number.isFinite(stakeSol) || stakeSol <= 0) throw new Error('Backtest stake must be > 0');
  const trades: ReplayTrade[] = [];
  let equity = 1;
  let peak = 1;
  let maxDrawdown = 0;

  for (const c of cases) {
    if (!c.id || !c.symbol || !Number.isFinite(c.entryPrice) || c.entryPrice <= 0 || !Array.isArray(c.prices) || c.prices.length === 0) continue;
    const timestamps = c.timestampsMs && c.timestampsMs.length === c.prices.length ? c.timestampsMs : undefined;
    const result = exitOne(c.entryPrice, c.prices, timestamps, stakeSol);
    equity += result.pnlSol;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, ((peak - equity) / peak) * 100);
    trades.push({ id: c.id, symbol: c.symbol, pnlPct: result.pnlPct, pnlSol: result.pnlSol, feesSol: result.feesSol, slippageSol: result.slippageSol, reason: result.reason, holdSteps: result.holdSteps, holdMinutes: result.holdMinutes });
  }

  const wins = trades.filter((t) => t.pnlSol > 0);
  const losses = trades.filter((t) => t.pnlSol < 0);
  const grossWin = wins.reduce((s, t) => s + t.pnlSol, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnlSol, 0));
  const netPnlSol = trades.reduce((s, t) => s + t.pnlSol, 0);
  const byReason: Record<string, number> = {};
  for (const t of trades) {
    const reasonKey = t.reason.split(' ')[0] ?? 'UNKNOWN';
    byReason[reasonKey] = (byReason[reasonKey] ?? 0) + 1;
  }
  const avgWinnerSol = wins.length ? grossWin / wins.length : 0;
  const avgLoserSol = losses.length ? -grossLoss / losses.length : 0;

  return {
    trades,
    report: {
      cases: cases.length,
      trades: trades.length,
      wins: wins.length,
      losses: losses.length,
      winRatePct: trades.length ? wins.length / trades.length * 100 : 0,
      netPnlSol,
      avgPnlSol: trades.length ? netPnlSol / trades.length : 0,
      expectancySol: trades.length ? netPnlSol / trades.length : 0,
      avgWinnerSol,
      avgLoserSol,
      profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Number.POSITIVE_INFINITY : 0,
      maxDrawdownPct: maxDrawdown,
      bestTradePct: trades.length ? Math.max(...trades.map((t) => t.pnlPct)) : 0,
      worstTradePct: trades.length ? Math.min(...trades.map((t) => t.pnlPct)) : 0,
      totalFeesSol: trades.reduce((s, t) => s + t.feesSol, 0),
      totalSlippageSol: trades.reduce((s, t) => s + t.slippageSol, 0),
      tradesByReason: byReason,
    },
  };
}
