import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../src/state.js';
import { managePaperPosition, openPaperPosition } from '../src/trader.js';
import type { Candidate } from '../src/types.js';

const candidate = (): Candidate => ({
  id: 'Mint444444444444444444444444444444444444444', decimals: 9, symbol: 'TRDR', usdPrice: 1,
  liquidity: 1_000_000, mcap: 3_000_000, holderCount: 5000, organicScore: 95,
  firstPool: { id: 'Pool4', createdAt: new Date(Date.now() - 30 * 60_000).toISOString() },
  audit: { isSus: false, mintAuthorityDisabled: true, freezeAuthorityDisabled: true, topHoldersPercentage: 12, devBalancePercentage: 2 },
  stats5m: { priceChange: 25, buyVolume: 120_000, sellVolume: 40_000, numBuys: 180, numSells: 70, numNetBuyers: 80 },
  score: 90, reasons: ['fixture'], ageMinutes: 30, buySellRatio: 3, netBuyers5m: 80, volume5m: 160_000, momentum5m: 25,
});

test('partial TP accounting keeps remaining cost basis correct', async () => {
  const state = initialState(10);
  const position = await openPaperPosition(candidate(), state);
  if (!position) throw new Error('expected paper position');
  const originalCost = position.originalCostSol;
  const initialQty = position.tokenQty;
  await managePaperPosition(position, state, position.entryPrice * 1.25);
  assert.equal(state.positions.length, 1);
  assert.equal(position.tp1Done, true);
  assert.ok(position.tokenQty < initialQty);
  assert.ok(Math.abs(position.remainingCostSol - originalCost * 0.6) < 1e-9);

  await managePaperPosition(position, state, position.entryPrice * 1.6);
  assert.equal(state.positions.length, 1);
  assert.equal(position.tp2Done, true);
  assert.ok(Math.abs(position.remainingCostSol - originalCost * 0.3) < 1e-9);
});

test('duplicate mint cannot be opened twice', async () => {
  const state = initialState(10);
  const first = await openPaperPosition(candidate(), state);
  const second = await openPaperPosition(candidate(), state);
  assert.ok(first);
  assert.equal(second, null);
  assert.equal(state.positions.length, 1);
});
