# Demkinn SOL — V1.2 Paper Memecoin Trader

Demkinn is a **paper-only Solana memecoin trading engine**. It watches Jupiter Tokens V2 feeds, filters candidates, scores momentum/flow/liquidity/organic activity, simulates fills with fees + slippage, manages positions, persists state, records telemetry, and includes a replay backtest engine.

This release deliberately contains **no live-order execution path**.

## Strategy

Demkinn is designed as a selective momentum/flow system, not a "buy every green candle" bot.

| Rule | Default |
|---|---:|
| Starting paper equity | 10 SOL |
| Risk budget | 0.75% equity/trade |
| Max position | 1.50% equity |
| Max open positions | 3 |
| Daily kill switch | -4% |
| Min liquidity | $75k |
| Market cap | $100k–$30M |
| Min holders | 250 |
| Min organic score | 55 |
| 5m volume | $25k+ |
| 5m buy/sell ratio | 1.20x+ |
| 5m net buyers | 12+ |
| 5m momentum | +3% to +35% |
| Token age | 5 min to 7 days |
| Entry score | 78/100 |
| Stop | -12% |
| TP1 | +25%, close 40% |
| TP2 | +60%, close 30% |
| Trailing | activates +12%, exits on 15% pullback |
| Time stop | 45 min if still below +10% |
| Paper fee model | 10 bps |

These values are a **starting hypothesis, not a claim of optimality or profitability**. Memecoins are exceptionally risky.

## V1.2 additions

### Mark-to-market risk
Open positions are valued using their latest observed market price. Daily loss and position sizing therefore see unrealized PnL instead of treating open positions as if they were still worth their entry cost.

### Telemetry
`src/metrics.ts` provides performance snapshots and JSONL append helpers. The intended telemetry fields include equity, cash, unrealized/realized PnL, fees, slippage, open positions, trades, win rate, and best candidate per scan.

### Replay engine
`src/backtest.ts` replays a candidate's entry price against a supplied sequence of later prices using the same core TP/SL/trailing/time-stop logic. It reports win rate, net PnL, expectancy, profit factor, max drawdown, best/worst trade and exit-reason counts.

Run it with:

```bash
npm run backtest -- replay-cases.json
```

Input format:

```json
[
  {
    "id": "mint-address",
    "symbol": "MEME",
    "entryPrice": 0.001,
    "prices": [0.00105, 0.0012, 0.0014, 0.0011]
  }
]
```

This is a **replay simulator**, not a claim of historical profitability. Results depend entirely on the supplied price path and do not model every market microstructure effect.

## V1 architecture

```text
Jupiter Tokens V2
      ↓
4 paced market feeds
      ↓
Safety gates
      ↓
Demkinn Score (0–100)
      ↓
Risk manager + mark-to-market equity
      ↓
Paper broker
  • virtual fills
  • fees
  • slippage
  • real token quantities
      ↓
Position manager
      ↓
Telemetry + persistent JSON state
      ↓
Telegram alerts

Historical snapshots → Replay engine → performance report
```

## Setup

1. Install Node.js 22+.
2. Copy `.env.example` to `.env`.
3. Create a Jupiter Developer Platform API key.
4. Keep the default 10 SOL paper balance until there are enough observations.
5. Install/build:

```bash
npm install
npm test
npm run build
npm start
```

## State and data

The bot persists to `demkinn-state.json` by default. It records cash, realized PnL, fees, simulated slippage, open positions, entry/exit trades, wins/losses, daily risk state, and pause state. Runtime state is ignored by Git.

For research, retain the candidate snapshots/price paths separately so the replay engine can be used for parameter analysis without changing the live paper strategy.

## Evaluation

Do not optimize for the biggest single winner. Track expectancy, win rate, average winner vs average loser, profit factor, maximum drawdown, trade frequency, exit reasons, and how often entries reverse immediately.

The recommended progression is: collect data → replay/backtest → tune thresholds → forward paper test again → only then consider any live execution work.
