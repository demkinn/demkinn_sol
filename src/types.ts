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
  mint: string;
  symbol: string;
  entryPrice: number;
  quantity: number;
  costSol: number;
  openedAt: number;
  highPrice: number;
  tp1Done: boolean;
  tp2Done: boolean;
}

export interface PortfolioState {
  equitySol: number;
  cashSol: number;
  dayStartEquitySol: number;
  dayStart: string;
  positions: Position[];
  realizedPnlSol: number;
  tradesToday: number;
  consecutiveFailures: number;
}
