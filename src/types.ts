export interface TokenStats {
  priceChange?: number;
  buyVolume?: number;
  sellVolume?: number;
  numBuys?: number;
  numSells?: number;
  numTraders?: number;
  numNetBuyers?: number;
  buyOrganicVolume?: number;
  sellOrganicVolume?: number;
}

export interface TokenAudit {
  isSus?: boolean;
  mintAuthorityDisabled?: boolean;
  freezeAuthorityDisabled?: boolean;
  topHoldersPercentage?: number;
  devBalancePercentage?: number;
}

export interface MemeToken {
  id: string;
  name?: string;
  symbol?: string;
  decimals: number;
  usdPrice?: number;
  mcap?: number;
  liquidity?: number;
  holderCount?: number;
  organicScore?: number;
  organicScoreLabel?: string;
  isVerified?: boolean | null;
  verification?: string;
  audit?: TokenAudit | null;
  createdAt?: string;
  firstPool?: { id: string; createdAt: string } | null;
  stats5m?: TokenStats | null;
  stats1h?: TokenStats | null;
  stats24h?: TokenStats | null;
}

export interface Candidate extends MemeToken {
  score: number;
  reasons: string[];
  ageMinutes: number;
  buySellRatio: number;
  netBuyers5m: number;
  volume5m: number;
  momentum5m: number;
}

export interface Position {
  id: string;
  mint: string;
  symbol: string;
  entryPrice: number;
  lastPrice: number;
  highPrice: number;
  tokenQty: number;
  remainingCostSol: number;
  originalCostSol: number;
  openedAt: number;
  scoreAtEntry: number;
  tp1Done: boolean;
  tp2Done: boolean;
}

export interface Trade {
  id: string;
  mint: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  reason: string;
  price: number;
  tokenQty: number;
  grossSol: number;
  feeSol: number;
  slippageSol: number;
  pnlSol: number;
  timestamp: number;
}

export interface PortfolioState {
  version: 2;
  cashSol: number;
  realizedPnlSol: number;
  feesSol: number;
  slippageSol: number;
  dayStartEquitySol: number;
  dayStart: string;
  tradesToday: number;
  winningTrades: number;
  losingTrades: number;
  consecutiveFailures: number;
  paused: boolean;
  positions: Position[];
  trades: Trade[];
  lastScanAt: number;
}
