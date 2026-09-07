import { existsSync, readFileSync } from 'node:fs';
import { runBacktest, type ReplayCase } from './backtest.js';

const file = process.argv[2] ?? 'replay-cases.json';
if (!existsSync(file)) {
  console.error(`Replay file not found: ${file}`);
  console.error('Usage: npm run backtest -- replay-cases.json');
  process.exit(1);
}

const parsed = JSON.parse(readFileSync(file, 'utf8')) as ReplayCase[];
if (!Array.isArray(parsed)) throw new Error('Replay input must be a JSON array');

const { report } = runBacktest(parsed);
console.log(JSON.stringify(report, null, 2));
