import 'dotenv/config';

const num = (name: string, fallback: number): number => {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`Invalid numeric env ${name}`);
  return value;
};

const bool = (name: string, fallback: boolean): boolean => {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  if (!['true', 'false'].includes(raw.toLowerCase())) throw new Error(`Invalid boolean env ${name}`);
  return raw.toLowerCase() === 'true';
};

export const config = {
  botName: process.env.BOT_NAME ?? 'Demkinn',
  mode: 'paper' as const,
  jupiterApiKey: process.env.JUPITER_API_KEY ?? '',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
  telegramChatId: process.env.TELEGRAM_CHAT_ID ?? '',
  scanIntervalMs: num('SCAN_INTERVAL_MS', 15_000),
  apiMinIntervalMs: num('API_MIN_INTERVAL_MS', 1_150),
  startingEquitySol: num('STARTING_EQUITY_SOL', 10),
  riskPerTradePct: num('RISK_PER_TRADE_PCT', 0.75),
  maxPositionPct: num('MAX_POSITION_PCT', 1.50),
  maxOpenPositions: Math.floor(num('MAX_OPEN_POSITIONS', 3)),
  maxDailyLossPct: num('MAX_DAILY_LOSS_PCT', 4),
  minTradeSol: num('MIN_TRADE_SOL', 0.05),
  maxTradeSol: num('MAX_TRADE_SOL', 0.50),
  minLiquidityUsd: num('MIN_LIQUIDITY_USD', 75_000),
  maxLiquidityUsd: num('MAX_LIQUIDITY_USD', 15_000_000),
  minMarketCapUsd: num('MIN_MARKET_CAP_USD', 100_000),
  maxMarketCapUsd: num('MAX_MARKET_CAP_USD', 30_000_000),
  minHolders: num('MIN_HOLDERS', 250),
  minOrganicScore: num('MIN_ORGANIC_SCORE', 55),
  maxTopHoldersPct: num('MAX_TOP_HOLDERS_PCT', 25),
  maxDevBalancePct: num('MAX_DEV_BALANCE_PCT', 5),
  minBuySellRatio: num('MIN_BUY_SELL_RATIO', 1.20),
  minNetBuyers5m: num('MIN_NET_BUYERS_5M', 12),
  minVolume5mUsd: num('MIN_VOLUME_5M_USD', 25_000),
  minMomentum5mPct: num('MIN_MOMENTUM_5M_PCT', 3),
  maxMomentum5mPct: num('MAX_MOMENTUM_5M_PCT', 35),
  minTokenAgeMin: num('MIN_TOKEN_AGE_MIN', 5),
  maxTokenAgeHours: num('MAX_TOKEN_AGE_HOURS', 168),
  entryScoreMin: num('ENTRY_SCORE_MIN', 78),
  stopLossPct: num('STOP_LOSS_PCT', 12),
  tp1Pct: num('TP1_PCT', 25),
  tp1SellPct: num('TP1_SELL_PCT', 40),
  tp2Pct: num('TP2_PCT', 60),
  tp2SellPct: num('TP2_SELL_PCT', 30),
  trailingStopPct: num('TRAILING_STOP_PCT', 15),
  trailingActivationPct: num('TRAILING_ACTIVATION_PCT', 12),
  timeStopMin: num('TIME_STOP_MIN', 45),
  paperFeeBps: num('PAPER_FEE_BPS', 10),
  paperMaxSlippageBps: num('PAPER_MAX_SLIPPAGE_BPS', 80),
  paperMinFillRatio: num('PAPER_MIN_FILL_RATIO', 0.70),
  requireMintAuthorityDisabled: bool('REQUIRE_MINT_AUTHORITY_DISABLED', true),
  requireFreezeAuthorityDisabled: bool('REQUIRE_FREEZE_AUTHORITY_DISABLED', true),
  rejectSuspicious: bool('REJECT_SUSPICIOUS', true),
} as const;

const positive = [
  ['SCAN_INTERVAL_MS', config.scanIntervalMs], ['API_MIN_INTERVAL_MS', config.apiMinIntervalMs],
  ['STARTING_EQUITY_SOL', config.startingEquitySol], ['MIN_TRADE_SOL', config.minTradeSol],
  ['MAX_TRADE_SOL', config.maxTradeSol], ['MIN_LIQUIDITY_USD', config.minLiquidityUsd],
  ['MAX_LIQUIDITY_USD', config.maxLiquidityUsd], ['MIN_MARKET_CAP_USD', config.minMarketCapUsd],
  ['MAX_MARKET_CAP_USD', config.maxMarketCapUsd], ['MIN_HOLDERS', config.minHolders],
  ['MIN_VOLUME_5M_USD', config.minVolume5mUsd], ['MIN_TOKEN_AGE_MIN', config.minTokenAgeMin],
  ['MAX_TOKEN_AGE_HOURS', config.maxTokenAgeHours], ['ENTRY_SCORE_MIN', config.entryScoreMin],
  ['STOP_LOSS_PCT', config.stopLossPct], ['TP1_PCT', config.tp1Pct], ['TP2_PCT', config.tp2Pct],
  ['TRAILING_STOP_PCT', config.trailingStopPct], ['TRAILING_ACTIVATION_PCT', config.trailingActivationPct],
  ['TIME_STOP_MIN', config.timeStopMin],
] as const;
for (const [name, value] of positive) if (value <= 0) throw new Error(`${name} must be > 0`);

if (config.maxTradeSol < config.minTradeSol) throw new Error('MAX_TRADE_SOL must be >= MIN_TRADE_SOL');
if (config.maxLiquidityUsd <= config.minLiquidityUsd) throw new Error('MAX_LIQUIDITY_USD must exceed MIN_LIQUIDITY_USD');
if (config.maxMarketCapUsd <= config.minMarketCapUsd) throw new Error('MAX_MARKET_CAP_USD must exceed MIN_MARKET_CAP_USD');
if (config.maxOpenPositions < 1) throw new Error('MAX_OPEN_POSITIONS must be >= 1');
if (config.riskPerTradePct <= 0 || config.riskPerTradePct > 100) throw new Error('RISK_PER_TRADE_PCT must be in (0,100]');
if (config.maxPositionPct <= 0 || config.maxPositionPct > 100) throw new Error('MAX_POSITION_PCT must be in (0,100]');
if (config.maxDailyLossPct <= 0 || config.maxDailyLossPct > 100) throw new Error('MAX_DAILY_LOSS_PCT must be in (0,100]');
if (config.minBuySellRatio <= 0) throw new Error('MIN_BUY_SELL_RATIO must be > 0');
if (config.minMomentum5mPct < -100 || config.maxMomentum5mPct <= config.minMomentum5mPct) throw new Error('Momentum bounds are invalid');
if (config.minTokenAgeMin >= config.maxTokenAgeHours * 60) throw new Error('Token age bounds are invalid');
if (config.entryScoreMin > 100) throw new Error('ENTRY_SCORE_MIN must be <= 100');
if (config.tp1SellPct <= 0 || config.tp1SellPct >= 100 || config.tp2SellPct <= 0 || config.tp2SellPct >= 100 || config.tp1SellPct + config.tp2SellPct >= 100) {
  throw new Error('TP sell fractions must be in (0,100) and leave some position for stops');
}
if (config.tp2Pct <= config.tp1Pct) throw new Error('TP2_PCT must exceed TP1_PCT');
if (config.trailingActivationPct <= 0 || config.trailingStopPct <= 0) throw new Error('Trailing thresholds must be > 0');
if (config.paperFeeBps < 0 || config.paperMaxSlippageBps < 0) throw new Error('Paper fee/slippage cannot be negative');
if (config.paperMinFillRatio <= 0 || config.paperMinFillRatio > 1) throw new Error('PAPER_MIN_FILL_RATIO must be in (0,1]');

if (!config.jupiterApiKey) console.warn('[WARN] JUPITER_API_KEY is missing. Paper scanner will not receive live candidates.');
