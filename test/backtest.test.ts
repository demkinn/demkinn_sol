import test from 'node:test';
import assert from 'node:assert/strict';
import { runBacktest } from '../src/backtest.js';

test('replay engine captures a winning TP path with costs', () => {
  const { report, trades } = runBacktest([{ id: '1', symbol: 'WIN', entryPrice: 1, prices: [1.1, 1.25, 1.6] }], 0.1);
  assert.equal(trades.length, 1);
  const trade = trades[0];
  assert.ok(trade);
  assert.ok(trade.pnlPct > 0);
  assert.ok(trade.feesSol > 0);
  assert.ok(trade.slippageSol > 0);
  assert.equal(report.wins, 1);
});

test('replay engine captures a stop loss', () => {
  const { report, trades } = runBacktest([{ id: '2', symbol: 'LOSS', entryPrice: 1, prices: [0.95, 0.88] }], 0.1);
  assert.equal(report.losses, 1);
  const trade = trades[0];
  assert.ok(trade);
  assert.ok(trade.pnlPct < 0);
  assert.equal(trade.reason.split(' ')[0], 'STOP');
});

test('timestamp-aware replay uses elapsed minutes for the time stop', () => {
  const start = Date.parse('2026-09-08T12:00:00Z');
  const timestampsMs = Array.from({ length: 46 }, (_, i) => start + i * 60_000);
  const prices = Array.from({ length: 46 }, () => 1.02);
  const { trades } = runBacktest([{ id: '3', symbol: 'TIME', entryPrice: 1, prices, timestampsMs }], 0.1);
  assert.equal(trades.length, 1);
  assert.equal(trades[0]?.reason.split(' ')[0], 'TIME');
  assert.equal(trades[0]?.holdMinutes, 45);
});

test('invalid stake is rejected', () => {
  assert.throws(() => runBacktest([], 0), /stake must be > 0/);
});
