import test from 'node:test';
import assert from 'node:assert/strict';
import { runBacktest } from '../src/backtest.js';

test('replay engine captures a winning TP path', () => {
  const { report, trades } = runBacktest([{ id: '1', symbol: 'WIN', entryPrice: 1, prices: [1.1, 1.25, 1.6] }], 0.1);
  assert.equal(trades.length, 1);
  assert.ok(trades[0].pnlPct > 0);
  assert.equal(report.wins, 1);
});

test('replay engine captures a stop loss', () => {
  const { report, trades } = runBacktest([{ id: '2', symbol: 'LOSS', entryPrice: 1, prices: [0.95, 0.88] }], 0.1);
  assert.equal(report.losses, 1);
  assert.ok(trades[0].pnlPct < 0);
  assert.equal(trades[0].reason.split(' ')[0], 'STOP');
});
