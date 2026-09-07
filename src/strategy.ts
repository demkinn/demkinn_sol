import { config } from './config.js';
import type { Candidate, MemeToken } from './types.js';

function ageMinutes(token: MemeToken): number {
  const raw = token.firstPool?.createdAt ?? token.createdAt;
  if (!raw) return Number.POSITIVE_INFINITY;
  return Math.max(0, (Date.now() - Date.parse(raw)) / 60_000);
}

export function evaluate(token: MemeToken): Candidate | null {
  const s = token.stats5m;
  const audit = token.audit;
  const age = ageMinutes(token);
  const liquidity = token.liquidity ?? 0;
  const mcap = token.mcap ?? 0;
  const holders = token.holderCount ?? 0;
  const organic = token.organicScore ?? 0;
  const momentum = s?.priceChange ?? 0;
  const buyVol = s?.buyVolume ?? 0;
  const sellVol = s?.sellVolume ?? 0;
  const volume = buyVol + sellVol;
  const ratio = sellVol > 0 ? buyVol / sellVol : buyVol > 0 ? 99 : 0;
  const netBuyers = s?.numNetBuyers ?? ((s?.numBuys ?? 0) - (s?.numSells ?? 0));

  if (token.verification === 'banned') return null;
  if (config.rejectSuspicious && audit?.isSus === true) return null;
  if (config.requireMintAuthorityDisabled && audit?.mintAuthorityDisabled !== true) return null;
  if (config.requireFreezeAuthorityDisabled && audit?.freezeAuthorityDisabled !== true) return null;
  if (liquidity < config.minLiquidityUsd || liquidity > config.maxLiquidityUsd) return null;
  if (mcap < config.minMarketCapUsd || mcap > config.maxMarketCapUsd) return null;
  if (holders < config.minHolders || organic < config.minOrganicScore) return null;
  if (audit?.topHoldersPercentage !== undefined && audit.topHoldersPercentage > config.maxTopHoldersPct) return null;
  if (audit?.devBalancePercentage !== undefined && audit.devBalancePercentage > config.maxDevBalancePct) return null;
  if (age < config.minTokenAgeMin || age > config.maxTokenAgeHours * 60) return null;
  if (momentum < config.minMomentum5mPct || momentum > config.maxMomentum5mPct) return null;
  if (volume < config.minVolume5mUsd || ratio < config.minBuySellRatio || netBuyers < config.minNetBuyers5m) return null;

  let score = 0;
  const reasons: string[] = [];
  const momentumScore = Math.min(30, Math.max(0, ((momentum - 3) / 20) * 30));
  score += momentumScore;
  if (momentumScore >= 20) reasons.push(`clean momentum ${momentum.toFixed(1)}%/5m`);

  const flowScore = Math.min(20, Math.max(0, ((ratio - 1.2) / 1.3) * 12 + Math.min(netBuyers, 80) / 80 * 8));
  score += flowScore;
  if (flowScore >= 14) reasons.push(`buyers lead ${ratio.toFixed(2)}x`);

  const liquidityScore = Math.min(15, Math.max(0, Math.log10(Math.max(liquidity, 1) / config.minLiquidityUsd + 1) * 15));
  score += liquidityScore;
  if (liquidityScore >= 10) reasons.push(`liquidity $${Math.round(liquidity).toLocaleString()}`);

  const organicScore = Math.min(15, organic / 100 * 15);
  score += organicScore;
  if (organic >= 75) reasons.push(`organic score ${organic.toFixed(0)}`);

  const holderScore = Math.min(10, Math.max(0, Math.log10(Math.max(holders, 1) / config.minHolders + 1) * 10));
  score += holderScore;

  const concentration = audit?.topHoldersPercentage ?? 20;
  const dev = audit?.devBalancePercentage ?? 3;
  const safetyScore = Math.min(10, Math.max(0, (1 - concentration / 35) * 6 + (1 - dev / 8) * 4));
  score += safetyScore;
  if (safetyScore >= 8) reasons.push('healthy holder/dev distribution');

  return {
    ...token,
    score: Math.round(score * 100) / 100,
    reasons,
    ageMinutes: age,
    buySellRatio: ratio,
    netBuyers5m: netBuyers,
    volume5m: volume,
    momentum5m: momentum,
  };
}

export function rank(tokens: MemeToken[]): Candidate[] {
  return tokens.map(evaluate).filter((x): x is Candidate => x !== null).sort((a, b) => b.score - a.score);
}
