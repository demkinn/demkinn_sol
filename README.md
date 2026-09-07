# Demkinn SOL — V1.3 Paper Memecoin Trader

Demkinn is a **paper-only Solana memecoin trading engine**. It watches configured Jupiter Tokens V2 feeds, filters candidates, scores momentum/flow/liquidity/organic activity, simulates fills with fees + slippage, manages positions, persists state, records telemetry, and includes a replay backtest engine.

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
| TP1 | +25%, close 40% of original position |
| TP2 | +60%, close 30% of original position |
| Trailing | activates +12%, exits on 15% pullback |
| Time stop | 45 min if still below +10% |
| Paper fee model | 10 bps |

These values are a **starting hypothesis, not a claim of optimality or profitability**. Memecoins are exceptionally risky.

## V1.3 additions

### Deterministic strategy diagnostics
Every rejected token can now be attributed to a first failing gate such as liquidity, organic score, momentum, buy/sell ratio, concentration, or authority status. Scan telemetry records these rejection counts alongside the best qualified setup.

### Mark-to-market risk
Open positions are valued using their latest observed market price. Daily loss and position sizing therefore see unrealized PnL instead of treating open positions as if they were still worth their entry cost.

### Safer persistence
Persisted state is validated before use. Invalid positions/trades are discarded rather than blindly trusted, and state writes remain atomic through a temporary file + rename.

### Graceful shutdown
SIGINT/SIGTERM persist state before exit. Unexpected exceptions/rejections are recorded as system failures so the existing three-failure pause mechanism remains effective.

### Replay realism
`src/backtest.ts` now models entry/exit fees and slippage, reports average winner/loser and total execution costs, and accepts optional millisecond timestamps. Timestamped replay cases use elapsed time for the time-stop instead of assuming every array element represents one minute.

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
    "prices": [0.00105, 0.0012, 0.0014, 0.0011],
    "timestampsMs": [1725796800000, 1725796860000, 1725796920000, 1725796980000]
  }
]
```

`timestampsMs` is optional for backwards compatibility. Without it, replay steps are treated as one-minute intervals. Replay slippage is controlled by `BACKTEST_SLIPPAGE_BPS` and capped by the paper slippage ceiling.

This is a **replay simulator**, not a claim of historical profitability. Results depend entirely on supplied data and still cannot model every market microstructure, routing, MEV, or liquidity effect.

## V1 architecture

```text
Jupiter Tokens V2
      ↓
4 paced market feeds
      ↓
Safety gates + rejection diagnostics
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
Telemetry + validated persistent JSON state
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

## Runtime outputs

The bot keeps runtime files local and out of Git:

- `demkinn-state.json` — cash, open positions, realized PnL, costs, wins/losses and pause state.
- `demkinn-scans.jsonl` — scan count, qualified count, best candidate and rejection reasons.
- `demkinn-performance.jsonl` — periodic equity/PnL/cost snapshots.

These files are useful as the raw dataset for future threshold analysis and replay.

## Safety boundary

V1.x is paper-only. There is no wallet signer, transaction builder, swap submission, or live-order execution module in this release. Do not interpret paper results as evidence of profitability.

The recommended progression is: collect a meaningful sample of forward paper data → replay/backtest it with costs → examine expectancy, drawdown and exit reasons → retest after parameter changes → only then evaluate whether a separate, explicitly gated execution layer should ever be designed.
