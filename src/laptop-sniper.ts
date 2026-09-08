import 'dotenv/config';

const CHAIN = 'base';
const TOKEN = (process.env.LAPTOP_TOKEN || '0xB095274743941e953c746F9C228DA9c18Bb6ec29').toLowerCase();
const POLL_MS = Math.max(500, Number(process.env.SNIPER_POLL_MS || 1500));
const ENTRY_USD = Math.max(1, Number(process.env.PAPER_ENTRY_USD || 100));
const MAX_LIQUIDITY_USD = Number(process.env.MAX_ENTRY_LIQUIDITY_USD || 500_000);
const MIN_LIQUIDITY_USD = Number(process.env.MIN_LIQUIDITY_USD || 25_000);
const MAX_SLIPPAGE_BPS = Math.max(1, Number(process.env.MAX_SLIPPAGE_BPS || 250));
const TAKE_PROFIT_PCT = Number(process.env.TAKE_PROFIT_PCT || 0.50);
const STOP_LOSS_PCT = Number(process.env.STOP_LOSS_PCT || 0.20);
const PAPER_MODE = (process.env.PAPER_MODE ?? 'true') !== 'false';

if (!PAPER_MODE) {
  throw new Error('Live execution is intentionally disabled in V1. Set PAPER_MODE=true.');
}

interface Pair {
  dexId?: string;
  url?: string;
  pairAddress?: string;
  baseToken?: { address?: string; symbol?: string };
  quoteToken?: { address?: string; symbol?: string };
  priceUsd?: string;
  liquidity?: { usd?: number; base?: number; quote?: number };
  volume?: { h24?: number; h6?: number; h1?: number; m5?: number };
  txns?: { m5?: { buys?: number; sells?: number } };
  pairCreatedAt?: number;
}

interface DexResponse {
  pairs?: Pair[] | null;
}

interface Position {
  pairAddress: string;
  dexId: string;
  entryPrice: number;
  lastPrice: number;
  entryAt: number;
  liquidityUsd: number;
  url: string;
}

let position: Position | null = null;
let lastPairAddress = '';

async function fetchPairs(): Promise<Pair[]> {
  const url = `https://api.dexscreener.com/latest/dex/tokens/${TOKEN}`;
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`DexScreener ${res.status}`);
  const json = (await res.json()) as DexResponse;
  return (json.pairs ?? [])
    .filter((p) => p.baseToken?.address?.toLowerCase() === TOKEN || p.quoteToken?.address?.toLowerCase() === TOKEN)
    .filter((p) => p.priceUsd && p.pairAddress);
}

function tokenIsBase(pair: Pair): boolean {
  return pair.baseToken?.address?.toLowerCase() === TOKEN;
}

function priceOf(pair: Pair): number {
  const raw = Number(pair.priceUsd || 0);
  return tokenIsBase(pair) ? raw : raw > 0 ? 1 / raw : 0;
}

function qualifies(pair: Pair): { ok: boolean; reason: string } {
  const liq = Number(pair.liquidity?.usd || 0);
  const price = priceOf(pair);
  const buys = Number(pair.txns?.m5?.buys || 0);
  const sells = Number(pair.txns?.m5?.sells || 0);
  const m5Vol = Number(pair.volume?.m5 || 0);

  if (!pair.pairAddress) return { ok: false, reason: 'no pair address' };
  if (!price || !Number.isFinite(price)) return { ok: false, reason: 'no usable price' };
  if (liq < MIN_LIQUIDITY_USD) return { ok: false, reason: `liquidity $${liq.toFixed(0)} < $${MIN_LIQUIDITY_USD}` };
  if (liq > MAX_LIQUIDITY_USD) return { ok: false, reason: `liquidity $${liq.toFixed(0)} > $${MAX_LIQUIDITY_USD}` };
  if (buys === 0) return { ok: false, reason: 'no buys in 5m' };
  if (buys < sells) return { ok: false, reason: `sell pressure ${buys}/${sells}` };
  if (m5Vol < ENTRY_USD * 2) return { ok: false, reason: `5m volume $${m5Vol.toFixed(0)} too thin` };
  return { ok: true, reason: 'entry gates passed' };
}

function logPair(pair: Pair): void {
  const liq = Number(pair.liquidity?.usd || 0);
  const buys = Number(pair.txns?.m5?.buys || 0);
  const sells = Number(pair.txns?.m5?.sells || 0);
  const vol = Number(pair.volume?.m5 || 0);
  const price = priceOf(pair);
  const ageSec = pair.pairCreatedAt ? Math.max(0, (Date.now() - pair.pairCreatedAt) / 1000) : NaN;
  console.log(`[${new Date().toISOString()}] ${pair.dexId || 'dex'} price=$${price.toPrecision(7)} liq=$${liq.toFixed(0)} m5vol=$${vol.toFixed(0)} buys/sells=${buys}/${sells} age=${Number.isFinite(ageSec) ? ageSec.toFixed(0) + 's' : 'n/a'}`);
}

function paperBuy(pair: Pair): void {
  const price = priceOf(pair);
  if (!price || !pair.pairAddress) return;
  position = {
    pairAddress: pair.pairAddress,
    dexId: pair.dexId || 'unknown',
    entryPrice: price,
    lastPrice: price,
    entryAt: Date.now(),
    liquidityUsd: Number(pair.liquidity?.usd || 0),
    url: pair.url || ''
  };
  console.log(`🚀 PAPER SNIPE $${ENTRY_USD.toFixed(2)} @ $${price.toPrecision(10)} | ${position.dexId} | ${position.url}`);
}

function managePosition(pair: Pair): void {
  if (!position || pair.pairAddress !== position.pairAddress) return;
  const price = priceOf(pair);
  if (!price) return;
  position.lastPrice = price;
  const pnl = price / position.entryPrice - 1;
  if (pnl >= TAKE_PROFIT_PCT || pnl <= -STOP_LOSS_PCT) {
    const side = pnl >= 0 ? 'TP' : 'SL';
    console.log(`🏁 PAPER ${side} ${ (pnl * 100).toFixed(2) }% | entry=$${position.entryPrice.toPrecision(10)} exit=$${price.toPrecision(10)}`);
    position = null;
  }
}

async function tick(): Promise<void> {
  const pairs = await fetchPairs();
  if (!pairs.length) {
    console.log(`[${new Date().toISOString()}] no Base pair found for ${TOKEN}`);
    return;
  }
  pairs.sort((a, b) => Number(b.liquidity?.usd || 0) - Number(a.liquidity?.usd || 0));
  const pair = pairs[0];
  logPair(pair);
  managePosition(pair);

  if (position) return;
  if (pair.pairAddress === lastPairAddress) return;

  const gate = qualifies(pair);
  console.log(`  → ${gate.ok ? 'QUALIFIED' : 'REJECTED'}: ${gate.reason}`);
  if (gate.ok) paperBuy(pair);
  lastPairAddress = pair.pairAddress || '';
}

console.log(`
Demkinn $LAPTOP Base Sniper V1 — PAPER MODE ONLY
Token: ${TOKEN}
Poll: ${POLL_MS}ms | Entry: $${ENTRY_USD} | Min LP: $${MIN_LIQUIDITY_USD} | Max slip guard: ${MAX_SLIPPAGE_BPS} bps
TP: ${(TAKE_PROFIT_PCT * 100).toFixed(0)}% | SL: ${(STOP_LOSS_PCT * 100).toFixed(0)}%
`);

await tick();
setInterval(() => {
  tick().catch((error: unknown) => console.error('[tick error]', error));
}, POLL_MS);
