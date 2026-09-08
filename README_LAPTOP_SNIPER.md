# $LAPTOP Base Sniper V1

A narrowly scoped **paper-mode** sniper for the Base $LAPTOP token. It polls DexScreener, selects the highest-liquidity Base pair, applies liquidity/flow/volume gates, then simulates an entry and manages TP/SL.

## Run

```bash
npm run build
node dist/src/laptop-sniper.js
```

Optional environment variables:

```text
LAPTOP_TOKEN=0xB095274743941e953c746F9C228DA9c18Bb6ec29
SNIPER_POLL_MS=1500
PAPER_ENTRY_USD=100
MIN_LIQUIDITY_USD=25000
MAX_ENTRY_LIQUIDITY_USD=500000
MAX_SLIPPAGE_BPS=250
TAKE_PROFIT_PCT=0.50
STOP_LOSS_PCT=0.20
PAPER_MODE=true
```

**Important:** this V1 has no private-key handling, transaction signing, swap construction, or live execution. `PAPER_MODE=false` deliberately throws an error. The implementation is for monitoring and paper-testing the setup, not a guarantee of profitability.
