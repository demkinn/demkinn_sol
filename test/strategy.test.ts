import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, rank } from '../src/strategy.js';
import type { MemeToken } from '../src/types.js';

const base = (): MemeToken => ({
  id: 'Mint111111111111111111111111111111111111111', decimals: 9, symbol: 'TEST', usdPrice: 1,
  liquidity: 1_000_000, mcap: 3_000_000, holderCount: 5000, organicScore: 95,
  firstPool: { id: 'Pool1', createdAt: new Date(Date.now() - 30 * 60_000).toISOString() },
  audit: { isSus: false, mintAuthorityDisabled: true, freezeAuthorityDisabled: true, topHoldersPercentage: 12, devBalancePercentage: 2 },
  stats5m: { priceChange: 25, buyVolume: 120_000, sellVolume: 40_000, numBuys: 180, numSells: 70, numNetBuyers: 80 }
});

test('accepts a strong setup', () => {
  const c = evaluate(base());
  if (!c) throw new Error('expected candidate');
  assert.ok(c.score >= 78);
});

test('rejects suspicious tokens', () => {
  const t = base();
  t.audit = { ...t.audit, isSus: true };
  assert.equal(evaluate(t), null);
});

test('rank orders highest score first', () => {
  const a = base();
  const b = { ...base(), id: 'Mint222222222222222222222222222222222222222', organicScore: 60, stats5m: { ...base().stats5m, priceChange: 4 } };
  const ranked = rank([b, a]);
  assert.equal(ranked[0]?.id, a.id);
});
