# AlgoMaster Pro — Complete Trading Algo Logic

## Goal: ₹5,00,000 → ₹50,00,000 by December 2026

---

## Strategy Allocation

| Strategy | Capital % | Style | Win Rate | R:R | Trades/Day |
|---|---|---|---|---|---|
| Fabervaale Triple-A | 25% | Scalping (order flow) | ~63% | 1.8:1 | 4 |
| ICT Order Blocks | 20% | Swing (smart money) | ~58% | 2.5:1 | 2 |
| ICT FVG + Liquidity Sweep | 15% | Swing (smart money) | ~57% | 2.2:1 | 2 |
| Opening Range Breakout | 15% | Intraday directional | ~52% | 2.2:1 | 1 |
| Short Straddle (Theta) | 15% | Premium selling | ~72% | 0.8:1 | 1 |
| Mean Reversion / VAH-VAL | 10% | Counter-trend | ~55% | 2.0:1 | 2 |

---

## Risk Management Rules

```
MAX_RISK_PER_TRADE = 2% of current capital
DAILY_LOSS_LIMIT   = 5% of capital
WEEKLY_DD_LIMIT    = 10%
MAX_CONSEC_LOSSES  = 3 (then stop for the day)
POSITION_SIZING    = Risk Amount / (SL points × Lot Size)
```

### Position Sizing Example (₹5L capital):
- Risk per trade: ₹10,000 (2%)
- NIFTY SL = 30 pts → Lots = 10,000 / (30 × 25) = 1.3 → **1 lot**
- BANKNIFTY SL = 100 pts → Lots = 10,000 / (100 × 15) = 0.67 → **1 lot**

### Compounding:
- As capital grows, position size increases
- At ₹10L: Risk = ₹20,000/trade → 2-3 lots NIFTY
- At ₹20L: Risk = ₹40,000/trade → 5+ lots NIFTY

---

## Strategy 1: Fabervaale Triple-A (Scalping)

### Entry Rules:
1. **Absorption**: Volume > 2x average AND candle range < 0.3x ATR
2. **Accumulation**: 3-5 candles of range contraction after absorption
3. **Aggression**: Breakout candle with volume > 1.5x average → ENTER

### Exit Rules:
- SL: 1x ATR from entry (or below absorption zone)
- Target: 1.8x SL (R:R = 1.8:1)
- Trailing stop: 1.5x ATR

### Filters:
- Only trade during 9:15-11:30 AM and 1:30-3:15 PM (kill zones)
- Skip if VIX > 20 (too volatile for scalping)
- Timeframe: 5m chart

### Workflow:
```
[Time Trigger: 9:14 AM]
    → [Check VIX < 20]
    → [Scan for Absorption: Vol > 2x avg AND Range < 0.3x ATR]
    → [Wait for Accumulation: 3-5 tight range candles]
    → [Detect Aggression: Breakout + volume spike]
    → [Place Order: BUY CE/PE at ATM, SL = 1 ATR, Target = 1.8 ATR]
    → [Trail Stop at 1.5 ATR]
    → [Wait till 3:20 PM → Square off]
```

---

## Strategy 2: ICT Order Blocks

### Entry Rules:
1. Identify **swing high/low** on 15m chart
2. Mark the **last opposite candle** before the move (= Order Block)
3. Wait for **Break of Structure (BOS)** — price breaks previous swing
4. Wait for **retracement to OB zone**
5. Confirm with **FVG** (Fair Value Gap) inside or near the OB
6. Enter at OB zone with SL below/above the OB

### Exit Rules:
- SL: Below OB low (bullish) or above OB high (bearish)
- Target 1: 1:1 R:R (move SL to breakeven)
- Target 2: Next liquidity pool (equal highs/lows)

### Workflow:
```
[Market Open Trigger]
    → [Scan 15m chart for BOS]
    → [Identify Order Block (last opposite candle)]
    → [Check FVG confluence near OB]
    → [Wait for price to retrace to OB zone]
    → [Place Order at OB + FVG overlap]
    → [SL below OB, Target at next liquidity]
    → [Move SL to BE after 1:1]
```

---

## Strategy 3: ICT Fair Value Gap + Liquidity Sweep

### Entry Rules:
1. Identify **equal highs/lows** (liquidity pools)
2. Wait for **sweep** — price takes out the pool then reverses
3. After sweep, look for **displacement** (strong opposite move)
4. Mark the **FVG** created by the displacement
5. Enter when price **fills the FVG** (retraces to the gap)
6. Use **OTE** (Optimal Trade Entry) at 62-78% fib

### Exit Rules:
- SL: Beyond the sweep high/low
- Target: Opposite liquidity pool
- R:R typically 2-3:1

### Workflow:
```
[Scan for Equal Highs/Lows]
    → [ANY: Sweep detected above highs OR below lows]
    → [Check: Displacement candle (>2x ATR)]
    → [Mark FVG in displacement]
    → [Wait for FVG fill at 62-78% fib]
    → [Place Order at FVG zone]
    → [SL beyond sweep, Target at opposite liquidity]
```

---

## Strategy 4: Opening Range Breakout (ORB)

### Entry Rules:
1. Record **high and low** of 9:15-9:30 AM (15-min range)
2. Wait for **breakout** above high or below low
3. Confirm with **volume > 1.5x average**
4. Enter on breakout candle close

### Exit Rules:
- SL: Opposite end of the range
- Target: Range height × 2 (or next support/resistance)
- Square off at 3:20 PM if target not hit

### Workflow:
```
[Time Trigger: 9:14 AM]
    → [Record Range: 9:15-9:30 High/Low]
    → [ANY: Price breaks above High OR below Low]
    → [Check Volume > 1.5x average]
    → [Place Order: direction of breakout]
    → [SL = opposite end of range]
    → [Wait till target OR 3:20 PM]
    → [Stop: Square off all]
```

---

## Strategy 5: Short Straddle (Theta Decay)

### Entry Rules:
1. VIX > 13 (enough premium to sell)
2. Enter at **9:20 AM** — sell ATM CE + PE
3. Combined premium collected

### Exit Rules:
- SL: 25% increase in combined premium
- Target: 25% decay in premium
- Square off at 3:15 PM
- **Adjustment**: If one leg hits 1.5x premium, shift strikes

### Workflow:
```
[Time Trigger: 9:20 AM]
    → [Check VIX > 13]
    → [Sell ATM CE + ATM PE]
    → [Monitor combined premium]
    → [IF premium increases 25% → SL hit, exit both legs]
    → [IF premium decays 25% → Target hit, exit both legs]
    → [Wait till 3:15 PM → Square off]
```

---

## Strategy 6: ICT Power of Three

### Entry Rules:
1. **Accumulation** (Asian session / pre-market): Tight range
2. **Manipulation** (first 30 min): Fake breakout sweeping liquidity
3. **Distribution** (main session): Real move in opposite direction

### Entry: After manipulation sweep reverses, enter with:
- FVG or Order Block in the reversal zone
- CHoCH (Change of Character) confirmation

### Workflow:
```
[Pre-market: Identify accumulation range]
    → [9:15-9:45: Watch for manipulation sweep]
    → [Detect: Price sweeps one side then reverses]
    → [Confirm: CHoCH on 5m chart]
    → [Enter at FVG/OB in reversal]
    → [SL beyond manipulation high/low]
    → [Target: 2-3x the accumulation range]
```

---

## Daily Routine

```
08:30 AM — Auto-login (TOTP), token refresh
08:45 AM — Review overnight global markets, VIX, crude
09:00 AM — Check FII/DII flows, sector rotation
09:14 AM — Algo starts scanning
09:15 AM — ORB range recording begins
09:20 AM — Straddle entry (if VIX > 13)
09:30 AM — ORB range set, breakout watch starts
09:15-10:30 — Kill Zone 1: ICT + Fabervaale signals
10:30-01:30 — Reduced activity, only high-confidence setups
01:30-03:15 — Kill Zone 2: Afternoon momentum
03:15 PM — Begin square-off
03:20 PM — All intraday positions closed
03:30 PM — Log trades in journal, review equity curve
```

---

## Key Metrics to Track

| Metric | Target | Current |
|---|---|---|
| Monthly Return | 29%+ | — |
| Win Rate (overall) | >55% | — |
| Average R:R | >1.8:1 | — |
| Max Drawdown | <15% | — |
| Sharpe Ratio | >2.0 | — |
| Profit Factor | >2.0 | — |
| Daily Trade Count | 5-12 | — |
| Capital Growth | ₹5L → ₹50L | ₹5L |
