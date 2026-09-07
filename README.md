# Demkinn — Solana Memecoin Trading Bot

Demkinn is a risk-first, momentum-based Solana memecoin trader. It discovers candidates from Jupiter Tokens V2, scores them using liquidity/flow/organic activity/security signals, and executes swaps through Jupiter Swap V2.

> **Important:** this is trading software, not a profit guarantee. Memecoins can lose most or all of their value extremely quickly. The default mode is `paper` and should stay that way until the strategy is tested extensively.

## Strategy profile

| Component | Default |
|---|---:|
| Risk per trade | 0.75% |
| Max simultaneous positions | 3 |
| Daily loss kill-switch | 4% |
| Max position | 1.5% of equity |
| Minimum liquidity | $75k |
| Minimum organic score | 55/100 |
| Minimum 5m volume | $25k |
| Minimum 5m momentum | +3% |
| Maximum 5m momentum | +35% |
| Minimum 5m net buyers | 12 |
| Minimum buy/sell volume ratio | 1.20 |
| Entry score | 78/100 |
| Hard stop | -12% |
| TP1 | +25%, sell 40% |
| TP2 | +60%, sell 30% |
| Trailing stop | 15% from high |
| Time stop | 45 minutes |

No trade is a valid trade. These are disciplined starting parameters, not claims of guaranteed optimality.

## Architecture

```text
Jupiter Tokens V2 → Candidate scanner → Safety gates + scoring
                                   ↓
                             Risk manager
                                   ↓
                     Paper broker / Jupiter Swap V2
                                   ↓
                         Position manager
                                   ↓
                         Persistent JSON state
                                   ↓
                           Telegram alerts
```

## Install

1. Install Node.js 22+.
2. Copy `.env.example` to `.env`.
3. Add a Jupiter API key.
4. Leave `TRADING_MODE=paper`.
5. Run:

```bash
npm install
npm run build
npm start
```

## Going live

Only after extensive paper testing:

```env
TRADING_MODE=live
WALLET_PRIVATE_KEY=...
```

Use a dedicated hot wallet containing only funds you can afford to lose. Never put a seed phrase or private key in GitHub. Never commit `.env`.

## APIs

Demkinn uses Jupiter's Swap V2 `/order` + `/execute` flow and Jupiter Tokens V2 for token discovery and market/security signals.

Official docs:

- https://developers.jup.ag/docs/swap/order-and-execute
- https://developers.jup.ag/docs/guides/how-to-get-token-information
- https://solana.com/docs/clients/official/javascript

## Next upgrades

1. SQLite/Postgres trade journal and PnL reconciliation.
2. Historical snapshot replay and backtesting.
3. Second independent price source.
4. Chain-level wallet/PnL reconciliation.
5. Execution-failure circuit breaker.
6. Telegram `/pause`, `/resume`, `/status`, `/positions` commands.
7. Shadow-mode comparison of multiple strategy variants.
