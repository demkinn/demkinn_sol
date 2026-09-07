# Demkinn SOL — V1 Paper Memecoin Trader

Demkinn is a **paper-only Solana memecoin trading engine**. V1 watches Jupiter Tokens V2 feeds, filters candidates, scores momentum/flow/liquidity/organic activity, simulates fills with fees + slippage, manages positions, persists state, and sends optional Telegram alerts.

This release deliberately contains **no live-order execution path**. That keeps the first iteration testable without risking real funds.

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
| Max liquidity | $15M |
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
Risk manager
      ↓
Paper broker
  • virtual fills
  • fees
  • slippage
  • real token quantities
      ↓
Position manager
      ↓
Persistent JSON state
      ↓
Telegram alerts
```

## Why the V1 paper broker matters

The earlier prototype used an artificial quantity of `1` and could value a position at its historical high. V1 fixes both problems. Every simulated buy creates a real virtual token quantity based on the candidate price and trade size; exits use the current observed price, and PnL is tracked from realized proceeds after fees/slippage.

## Current Jupiter integration

Jupiter documents `https://api.jup.ag` as the current Developer Platform base URL. Tokens V2 exposes recent tokens plus category feeds for `toptrending`, `toptraded`, and `toporganicscore` across intervals including `5m`. Jupiter's documentation also notes that `/recent` is ordered by first pool creation time, not mint creation time. V1 uses those feeds and deliberately paces requests so a free API key does not burst four calls at once.

References:
- https://developers.jup.ag/docs/api-reference/tokens/recent
- https://developers.jup.ag/docs/guides/how-to-get-token-information
- https://developers.jup.ag/changelog/developer-platform

## Setup

1. Install Node.js 22+.
2. Copy `.env.example` to `.env`.
3. Create a Jupiter Developer Platform API key.
4. Keep the default 10 SOL paper balance until you have enough observations.
5. Install/build:

```bash
npm install
npm test
npm run build
npm start
```

## State

The bot persists to `demkinn-state.json` by default. It records cash, realized PnL, fees, simulated slippage, open positions, entry/exit trades, wins/losses, daily risk state, and pause state. The file is ignored by Git.

## What to evaluate during paper testing

Do not optimize for the biggest single winner. Track expectancy, win rate, average winner vs average loser, maximum drawdown, number of trades, and how often the model enters after a sharp move that immediately reverses.

A sensible next research step is a replay/backtest dataset built from historical candidate snapshots. Only after that should live execution be considered.
