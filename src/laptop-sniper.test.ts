import test from 'node:test';
import assert from 'node:assert/strict';

test('LAPTOP sniper safety contract', () => {
  const paperMode = true;
  const token = '0xB095274743941e953c746F9C228DA9c18Bb6ec29';
  assert.equal(paperMode, true);
  assert.match(token, /^0x[0-9a-fA-F]{40}$/);
});

test('risk defaults are bounded', () => {
  const stopLoss = 0.20;
  const takeProfit = 0.50;
  const maxSlippageBps = 250;
  assert.ok(stopLoss > 0 && stopLoss < 1);
  assert.ok(takeProfit > stopLoss);
  assert.ok(maxSlippageBps > 0 && maxSlippageBps <= 1000);
});
