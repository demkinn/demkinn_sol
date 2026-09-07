import { config } from './config.js';

export interface ReplayCase {
  id: string;
  symbol: string;
  entryPrice: number;
  prices: number[];
  score?: number;
}

export interface ReplayTrade {
  id: string;
  symbol: string;
  pnlPct: number;
  pnlSol: number;
  reason: string;
  holdSteps: number;
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
  profitFactor: number;
  maxDrawdownPct: number;
  bestTradePct: number;
  worstTradePct: number;
  tradesByReason: Record<string, number>;
}

function exitOne(entry: number, prices: number[]): { pnlPct: number; reason: string; holdSteps: number } {
  let high = entry;
  let remaining = 1;
  let realized = 0;
  let tp1 = false;
  let tp2 = false;

  const sell = (price: number, fraction: number, reason: string, step: number) => {
    const pnl = ((price - entry) / entry) * fraction;
    realized += pnl;
    remaining -= fraction;
    return { pnl, reason, step };
  };

  for (let i = 0; i < prices.length; i += 1) {
    const price = prices[i];
    if (!Number.isFinite(price) || price <= 0) continue;
    high = Math.max(high, price);
    const pnlPct = ((price - entry) / entry) * 100;
    const ddPct = ((high - price) / high) * 100;

    if (!tp1 && pnlPct >= config.tp1Pct) {
      tp1 = true;
      sell(price, config.tp1SellPct / 100, `TP1 +${pnlPct.toFixed(1)}%`, i);
    }
    if (!tp2 && pnlPct >= config.tp2Pct) {
      tp2 = true;
      sell(price, config.tp2SellPct / 100, `TP2 +${pnlPct.toFixed(1)}%`, i);
    }
    if (pnlPct <= -config.stopLossPct) {
      const r = sell(price, remaining, `STOP ${pnlPct.toFixed(1)}%`, i);
      return { pnlPct: realized * 100, reason: r.reason, holdSteps: i + 1 };
    }
    if (high > entry * (1 + config.trailingActivationPct / 100) && ddPct >= config.trailingStopPct) {
      const r = sell(price, remaining, `TRAIL -${ddPct.toFixed(1)}%`, i);
      return { pnlPct: realized * 100, reason: r.reason, holdSteps: i + 1 };
    }
    if (i + 1 >= config.timeStopMin && pnlPct < 10) {
      const r = sell(price, remaining, `TIME ${i + 1} steps`, i);
      return { pnlPct: realized * 100, reason: r.reason, holdSteps: i + 1 };
    }
    if (remaining <= 0.000001) return { pnlPct: realized * 100, reason: 'TARGETS', holdSteps: i + 1 };
  }

  const last = prices[prices.length - 1];
  const final = Number.isFinite(last) && last > 0 ? ((last - entry) / entry) * remaining : 0;
  realized += final;
  return { pnlPct: realized * 100, reason: 'END', holdSteps: prices.length };
}

export function runBacktest(cases: ReplayCase[], stakeSol = 0.1): { report: BacktestReport; trades: ReplayTrade[] } {
  const trades: ReplayTrade[] = [];
  let equity = 1;
  let peak = 1;
  let maxDrawdown = 0;

  for (const c of cases) {
    if (!c.id || !c.symbol || !Number.isFinite(c.entryPrice) || c.entryPrice <= 0 || c.prices.length === 0) continue;
    const result = exitOne(c.entryPrice, c.prices);
    const pnlSol = stakeSol * result.pnlPct / 100;
    equity += pnlSol;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, ((peak - equity) / peak) * 100);
    trades.push({ id: c.id, symbol: c.symbol, pnlPct: result.pnlPct, pnlSol, reason: result.reason, holdSteps: result.holdSteps });
  }

  const wins = trades.filter((t) => t.pnlSol > 0);
  const losses = trades.filter((t) => t.pnlSol < 0);
  const grossWin = wins.reduce((s, t) => s + t.pnlSol, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnlSol, 0));
  const netPnlSol = trades.reduce((s, t) => s + t.pnlSol, 0);
  const byReason: Record<string, number> = {};
  for (const t of trades) byReason[t.reason.split(' ')[0]] = (byReason[t.reason.split(' ')[0]] ?? 0) + 1;

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
      profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Number.POSITIVE_INFINITY : 0,
      maxDrawdownPct: maxDrawdown,
      bestTradePct: trades.length ? Math.max(...trades.map((t) => t.pnlPct)) : 0,
      worstTradePct: trades.length ? Math.min(...trades.map((t) => t.pnlPct)) : 0,
      tradesByReason: byReason,
    },
  };
}
