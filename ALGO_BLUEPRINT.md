# THE COMPLETE ALGO BLUEPRINT
## Version 2.0 — Kunaal's 10x Trading System

> **Goal**: 5L -> 50L by Dec 2026 | **Risk**: 2% per trade | **Compound**: ~29% monthly
> **Last Updated**: 2026-03-28

---

## TABLE OF CONTENTS
1. [System Architecture](#1-system-architecture)
2. [Complete Strategy Library](#2-complete-strategy-library)
3. [Entry Decision Flowchart](#3-entry-decision-flowchart)
4. [Exit & Trade Management](#4-exit--trade-management)
5. [Risk Management Rules](#5-risk-management-rules)
6. [Monte Carlo Arbitration](#6-monte-carlo-arbitration)
7. [Market Regime Detection](#7-market-regime-detection)
8. [Daily Routine & Kill Zones](#8-daily-routine--kill-zones)
9. [Capital Allocation & Scaling](#9-capital-allocation--scaling)
10. [Options Strategy Layer](#10-options-strategy-layer)
11. [Broker Execution Pipeline](#11-broker-execution-pipeline)
12. [Tuning Parameters (Change These)](#12-tuning-parameters)
13. [Changelog](#13-changelog)

---

## 1. SYSTEM ARCHITECTURE

```
                          ┌─────────────────────────────────────┐
                          │           MARKET DATA FEED          │
                          │  Fyers WS / Yahoo / Groww fallback  │
                          └──────────────┬──────────────────────┘
                                         │
                          ┌──────────────▼──────────────────────┐
                          │        PRE-PROCESSING LAYER         │
                          │  • Indicators (ATR, RSI, MACD, BB)  │
                          │  • Volume Profile (POC, VAH, VAL)   │
                          │  • VWAP + std dev bands             │
                          │  • Market Structure (HH/HL/LH/LL)  │
                          │  • PDC / PDH / PDL levels           │
                          └──────────────┬──────────────────────┘
                                         │
          ┌──────────────────────────────▼──────────────────────────────┐
          │                     MOTHER ALGO ORCHESTRATOR                │
          │                                                            │
          │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐  │
          │  │Sister 1│ │Sister 2│ │Sister 3│ │Sister 4│ │Sister 5│  │
          │  │MeanRev │ │MA Cross│ │PDC/PDH │ │1Hr H/L │ │VolProf │  │
          │  └───┬────┘ └───┬────┘ └───┬────┘ └───┬────┘ └───┬────┘  │
          │  ┌───┴────┐ ┌───┴────┐ ┌───┴────┐ ┌───┴────┐ ┌───┴────┐  │
          │  │Sister 6│ │Sister 7│ │Sister 8│ │Sister 9│ │Sister10│  │
          │  │Momentum│ │VWAP Rev│ │  ORB   │ │  ICT   │ │Triple-A│  │
          │  └───┬────┘ └───┬────┘ └───┬────┘ └───┬────┘ └───┬────┘  │
          │      └────┬─────┴────┬─────┴────┬─────┴─────┬────┘       │
          │           │   ALL SIGNALS       │                          │
          │           ▼                     ▼                          │
          │  ┌──────────────────────────────────────────────────────┐  │
          │  │              MONTE CARLO ENGINE                     │  │
          │  │  • 10,000 simulations per signal                    │  │
          │  │  • Fat-tail distribution (Student's t, df=5)        │  │
          │  │  • P(profit), E[return], Sharpe, VaR, Kelly         │  │
          │  │  • Composite score ranking                          │  │
          │  └────────────────────┬─────────────────────────────────┘  │
          │                      │ RANKED TRADES                       │
          │                      ▼                                     │
          │  ┌──────────────────────────────────────────────────────┐  │
          │  │              RISK MANAGER GATE                      │  │
          │  │  • Half-Kelly position sizing                       │  │
          │  │  • Drawdown scaling (auto-reduce when DD > 10%)     │  │
          │  │  • Correlation check (max sector exposure 35%)      │  │
          │  │  • Daily/weekly/total loss limits                   │  │
          │  │  • Consecutive loss scaling                         │  │
          │  └────────────────────┬─────────────────────────────────┘  │
          │                      │ APPROVED TRADE                      │
          │                      ▼                                     │
          │  ┌──────────────────────────────────────────────────────┐  │
          │  │           EXECUTION ENGINE                          │  │
          │  │  • Fyers API (primary) / Groww (fallback)           │  │
          │  │  • Smart Exit flows (alert / auto-exit / recovery)  │  │
          │  │  • Slippage model (5 bps default)                   │  │
          │  │  • Commission tracking (₹20/order)                  │  │
          │  └──────────────────────────────────────────────────────┘  │
          └────────────────────────────────────────────────────────────┘
```

---

## 2. COMPLETE STRATEGY LIBRARY

### EXISTING SISTERS (Implemented)

#### Sister 1: Mean Reversion
| Parameter | Value | Tunable? |
|-----------|-------|----------|
| Z-score threshold | > 2.0 std devs | YES |
| RSI confirmation | < 30 (buy) / > 70 (sell) | YES |
| Bollinger Band | Touch required | YES |
| Exit | Z-score reverts to 0.5 | YES |
| Best markets | BankNifty (0.85), Nifty (0.82) | - |
| Timeframe | 15m, 1hr | YES |
| Win rate | 58-65% | - |
| R:R | 1.5-2.5:1 | - |
| When to use | ADX < 20, range-bound days | - |
| When to SKIP | ADX > 35, strong trend days | - |

#### Sister 2: MA Crossover
| Parameter | Value | Tunable? |
|-----------|-------|----------|
| Fast EMA | 9 | YES |
| Slow EMA | 21 | YES |
| ADX filter | > 20 | YES |
| MACD confirm | Required | YES |
| Volume spike | Required | YES |
| SL | 1.5x ATR | YES |
| TP | 3x ATR | YES |
| Best markets | BTC (0.82), Gold (0.80), ETH (0.80) | - |
| Timeframe | 1hr, 4hr | YES |
| Win rate | 45-55% | - |

#### Sister 3: PDC/PDH (HIGHEST EDGE)
| Parameter | Value | Tunable? |
|-----------|-------|----------|
| PDH breakout + retest | Long entry | - |
| PDL breakdown + retest | Short entry | - |
| PDC bounce | Trade in VWAP direction | - |
| PDC rejection | Reversal trade | - |
| Best markets | BankNifty (0.90), Nifty (0.88) | - |
| Timeframe | 5m, 15m | YES |
| Win rate | 55-62% | - |
| R:R | 2-2.5:1 | - |
| Why #1 | FII/DII use PDC as anchor | - |

#### Sister 4: 1-Hour High/Low
| Parameter | Value | Tunable? |
|-----------|-------|----------|
| ORB window | 9:15 - 10:15 IST | YES |
| Breakout confirm | Volume > 1.5x avg | YES |
| Range filter | 0.3% - 1.5% of price | YES |
| SL | Opposite end of range | - |
| Best markets | BankNifty (0.88), Nifty (0.85) | - |
| Timeframe | 5m, 15m | YES |
| Trigger time | After 10:15 IST | - |

#### Sister 5: Volume Profile
| Parameter | Value | Tunable? |
|-----------|-------|----------|
| Lookback | 50 bars | YES |
| Resolution | 24 price levels | YES |
| POC reversion | Price far from POC → revert | - |
| LVN breakout | Fast move to next HVN | - |
| VAH/VAL bounce | Reversal at value edges | - |
| Best markets | Stock Futures (0.85), BankNifty (0.82) | - |
| Timeframe | 15m, 30m | YES |

#### Sister 6: Momentum
| Parameter | Value | Tunable? |
|-----------|-------|----------|
| RSI threshold | > 60 | YES |
| MACD | Accelerating | - |
| ADX | > 25 | YES |
| Volume spike | Required | YES |
| SL | 2x ATR | YES |
| TP | 5x ATR | YES |
| Best markets | BTC (0.88), ETH (0.85), Crude (0.80) | - |
| Timeframe | 1hr, 4hr | YES |
| Win rate | 42-50% (but BIG winners) | - |

#### Sister 7: VWAP Reversion
| Parameter | Value | Tunable? |
|-----------|-------|----------|
| Distance from VWAP | > 1.5 std devs | YES |
| RSI confirmation | Required | YES |
| TP | At VWAP | - |
| Best markets | BankNifty (0.86), Nifty (0.84) | - |
| Active window | 9:30 AM - 2:30 PM IST | YES |
| Win rate | 58-65% | - |

#### Sister 8: Opening Range Breakout (ORB)
| Parameter | Value | Tunable? |
|-----------|-------|----------|
| ORB window | First 15 minutes | YES |
| Breakout | Price breaks OR high/low | - |
| Volume confirm | Required | YES |
| SL | Opposite end of OR | - |
| Gap filter | Skip if gap > 1.5% | YES |
| Range filter | Skip if too narrow/wide | YES |
| Best markets | BankNifty (0.85), Nifty (0.82) | - |

---

### NEW SISTERS (To Implement)

#### Sister 9: ICT (Inner Circle Trader)

**Core Concepts:**

| Concept | Detection Logic | Usage |
|---------|----------------|-------|
| **Order Block (Bullish)** | Last bearish candle before bullish move: `C[i].close < C[i].open AND C[i+1].close > C[i+1].open AND C[i+1].close > C[i].open` | Entry zone on retrace |
| **Order Block (Bearish)** | Last bullish candle before bearish move (inverse of above) | Entry zone on retrace |
| **Fair Value Gap (Bullish)** | `C[i+2].low > C[i].high` → gap between candle 1 high and candle 3 low | Price tends to fill |
| **Fair Value Gap (Bearish)** | `C[i+2].high < C[i].low` → gap between candle 1 low and candle 3 high | Price tends to fill |
| **Liquidity Sweep (High)** | `C[i].high > swing_high AND C[i].close < swing_high` | Trade reversal AFTER sweep |
| **Liquidity Sweep (Low)** | `C[i].low < swing_low AND C[i].close > swing_low` | Trade reversal AFTER sweep |
| **BOS** | Break of Structure → trend continuation | Confirm direction |
| **CHoCH** | Change of Character → potential reversal | Reversal signal |
| **Breaker Block** | Failed OB → strong S/R | High-probability entry |

**Power of Three (PO3) — Session Model:**
1. **Accumulation** → Asian session / pre-market (smart money builds position)
2. **Manipulation** → Early London / opening 15 min (fake move to sweep liquidity)
3. **Distribution** → London/NY / main session (real move in intended direction)

**Optimal Trade Entry (OTE):**
- After: displacement + market structure shift + FVG formation
- Entry: 61.8% to 78.6% Fibonacci retracement of expansion range
- SL: Below/above the swing that created the displacement
- TP: -27% or -62% Fibonacci extension

**ICT Kill Zones (IST):**
| Kill Zone | IST Time | What Happens |
|-----------|----------|--------------|
| Indian Open | 9:15 - 10:30 AM | Gap fill, ORB, first hour range |
| Indian Close | 2:00 - 3:15 PM | End-of-day moves, position squaring |
| London Open | 12:30 - 3:30 PM | Major reversals, PO3 manipulation |
| NY AM | 7:00 - 9:30 PM | Highest volume, biggest moves |

**ICT Entry Checklist:**
```
□ 1. Identify higher-timeframe bias (HTF structure: bullish or bearish?)
□ 2. Mark key liquidity pools (equal highs/lows, swing points)
□ 3. Wait for liquidity sweep (price takes out stops)
□ 4. Look for CHoCH or BOS on lower timeframe
□ 5. Identify Order Block or FVG in the displacement
□ 6. Entry at OB/FVG zone (ideally at 62-79% fib of displacement)
□ 7. SL below/above the sweep candle
□ 8. TP at opposite liquidity pool or -27% fib extension
```

**Best markets:** BankNifty (kill zones align), Nifty, NQ futures
**Timeframes:** 15m HTF bias → 5m or 3m entry
**Expected edge:** 50-60% win rate, 2-3:1 R:R

---

#### Sister 10: Fabervaale Triple-A (Order Flow Scalping)

**The Triple-A Model:**

```
PHASE 1: ABSORPTION
├── Volume > Average Volume x 2.0
├── Candle Range < ATR x 0.3
├── Meaning: Big players absorbing supply/demand
└── Visual: Fat volume bar, tiny candle body

         ↓ (wait)

PHASE 2: ACCUMULATION
├── 2-5 candles of range contraction
├── Decreasing volume (drying up)
├── Tight consolidation near absorption zone
└── Visual: Small candles clustering

         ↓ (trigger)

PHASE 3: AGGRESSION (ENTRY)
├── Breakout candle with volume > 1.5x avg
├── Close beyond accumulation range
├── Direction confirmed by absorption context
└── ENTER on close of aggression candle
```

**Entry Types:**

| Type | Setup | Entry | SL | TP |
|------|-------|-------|-----|-----|
| **Triple-A Breakout** | Absorption → Accumulation → Aggression | Close of aggression candle | Below accumulation low (long) / above high (short) | 2x risk (ATR-based) |
| **ORB + Triple-A** | Opening range forms → Triple-A within ORB range → breakout | Break of ORB with volume | Opposite ORB boundary | 2-3x risk |
| **Value Area Bounce** | Price at VAH/VAL → absorption detected → reversal | After absorption + reversal candle | Beyond VAH/VAL by 0.5x ATR | POC (middle of value area) |

**Absorption Detection Code:**
```python
def detect_absorption(candles, atr, avg_volume, vol_mult=2.0, range_mult=0.3):
    for i, c in enumerate(candles):
        candle_range = c.high - c.low
        if c.volume > avg_volume * vol_mult and candle_range < atr * range_mult:
            return i  # absorption at index i
    return None
```

**Risk Management (Fabervaale-specific):**
| Parameter | Value | Tunable? |
|-----------|-------|----------|
| Risk per trade | 1% of account (conservative for scalping) | YES |
| SL | ATR-based | YES |
| R:R | 2:1 default | YES |
| Trailing stop | 1.5x ATR | YES |
| Daily loss limit | 3 consecutive losses → stop | YES |
| Best timeframe | 5m (learning), 2m (balanced), 1m (advanced) | YES |
| Best markets | NQ, ES, BTC/ETH, liquid large-caps | - |

---

## 3. ENTRY DECISION FLOWCHART

```
                    NEW CANDLE ARRIVES
                          │
                    ┌─────▼─────┐
                    │ Kill Zone │──── NO ──→ SKIP (no trades outside kill zones)
                    │  Active?  │
                    └─────┬─────┘
                          │ YES
                    ┌─────▼─────┐
                    │  Market   │
                    │  Regime?  │
                    └─────┬─────┘
                          │
            ┌─────────────┼─────────────┐
            │             │             │
       TRENDING     RANGE-BOUND    VOLATILE
            │             │             │
     ┌──────▼──────┐ ┌───▼────┐  ┌────▼─────┐
     │ Momentum    │ │MeanRev │  │ ORB      │
     │ MA Cross    │ │VWAP Rev│  │ 1Hr H/L  │
     │ ICT (trend) │ │VolProf │  │ Momentum │
     │ Triple-A    │ │PDC/PDH │  │ Triple-A │
     └──────┬──────┘ └───┬────┘  └────┬─────┘
            │             │             │
            └─────────────┼─────────────┘
                          │
                    ┌─────▼─────┐
                    │  Signals  │
                    │ Generated │
                    └─────┬─────┘
                          │
                   ┌──────▼──────┐
              YES ◄┤  Multiple   ├► NO (single signal)
                   │  Signals?   │
                   └──────┬──────┘
                          │
                   ┌──────▼──────┐          ┌──────────────┐
                   │ Monte Carlo │          │  MC Validate  │
                   │ Rank All    │          │  (still run   │
                   │ 10K sims    │          │   10K sims)   │
                   └──────┬──────┘          └──────┬───────┘
                          │                        │
                   ┌──────▼──────┐                 │
                   │ Composite   ◄─────────────────┘
                   │ Score > 0.55│──── NO ──→ NO TRADE
                   └──────┬──────┘
                          │ YES
                   ┌──────▼──────┐
                   │Risk Manager │
                   │ • 2% max    │
                   │ • DD check  │──── REJECTED ──→ Try next ranked
                   │ • Corr chk  │
                   │ • Daily lim │
                   └──────┬──────┘
                          │ APPROVED
                   ┌──────▼──────┐
                   │  EXECUTE    │
                   │  via Fyers  │
                   └─────────────┘
```

---

## 4. EXIT & TRADE MANAGEMENT

### Exit Rules (Priority Order)

```
1. HARD STOP LOSS HIT         → Immediate exit, no questions
2. DAILY LOSS LIMIT HIT       → Close ALL positions, stop trading
3. TAKE PROFIT HIT            → Exit (or partial exit if trailing)
4. TRAILING STOP TRIGGERED    → Exit remaining position
5. TIME-BASED EXIT            → Close if held > max hold period
6. SIGNAL REVERSAL            → Sister algo generates opposite signal
7. END OF DAY (3:15 PM IST)   → Close all intraday positions
```

### Trailing Stop Logic
```
IF trade is in profit by > 1x risk:
    Move SL to breakeven

IF trade is in profit by > 1.5x risk:
    Trail SL at 1x ATR behind price

IF trade is in profit by > 2x risk:
    Trail SL at 0.75x ATR behind price (tighter)

IF trade is in profit by > 3x risk:
    Take 50% profit, trail rest at 0.5x ATR
```

### Partial Exit Strategy
```
At 1:1 R:R  → Exit 25% of position, move SL to breakeven
At 2:1 R:R  → Exit another 25%, trail remaining 50%
At 3:1 R:R  → Exit 25% more, trail final 25% tight
Runner      → Let final 25% ride with 0.5x ATR trail
```

### Fyers Smart Exit Integration
```
Type 1 (Alert Only)    → For monitoring, no auto-action
Type 2 (Exit + Alert)  → For hard SL/TP — immediate execution
Type 3 (Exit + Wait)   → For trailing — wait for recovery before exit
```

---

## 5. RISK MANAGEMENT RULES

### Position Sizing: Half-Kelly

```
Kelly% = (p × b - q) / b
Position = Kelly% × 0.5 × current_capital

Where:
  p = win probability (from MC simulation)
  b = avg_win / avg_loss ratio
  q = 1 - p
```

### Hard Limits (NON-NEGOTIABLE)

| Rule | Limit | Action When Hit |
|------|-------|-----------------|
| Max risk per trade | 2% of capital | Cap position size |
| Max daily loss | 5% of capital | STOP all trading for the day |
| Max weekly loss | 10% of capital | STOP all trading for the week |
| Max total drawdown | 25% of peak | PAUSE entire system, re-evaluate |
| Max concurrent trades | 5 | Queue new signals |
| Max single position | 20% of capital | Cap position size |
| Max sector exposure | 35% of capital | Diversification enforced |
| Min R:R ratio | 1.5:1 | Reject lower R:R trades |
| Min MC P(profit) | 60% | Reject low-probability trades |
| Min MC composite score | 0.55 | Reject low-score trades |
| Consecutive losses | 3 in a row | Reduce size by 10% per additional loss (floor 50%) |

### Drawdown-Scaled Sizing
```
IF current_drawdown > 10%:
    scale = 1 - (drawdown% - 10%) × 2
    scale = max(scale, 0.30)  # Never go below 30% size
    position_size *= scale

IF current_drawdown > 20%:
    position_size *= 0.30  # Survival mode

IF current_drawdown > 25%:
    HALT SYSTEM — manual intervention required
```

---

## 6. MONTE CARLO ARBITRATION

### Composite Score Weights

| Factor | Weight | What It Measures |
|--------|--------|-----------------|
| Probability of Profit | 30% | % of 10K sims that hit TP before SL |
| Expected Return (₹) | 25% | Mean return across all simulations |
| Sharpe Ratio | 15% | Risk-adjusted return of simulated outcomes |
| Max Drawdown Risk | 15% | Inverse of worst-case drawdown in sims |
| Strategy-Market Affinity | 10% | Historical fit from backtest data |
| Market Regime Fit | 5% | How well strategy matches current regime |
| **Bonus**: Algo confidence | +15% | Sister algo's own confidence score |

### Minimum Thresholds
```
P(profit)       >= 60%   (or reject)
Composite score  >= 0.55  (or reject)
Kelly fraction   >= 0.05  (or reject — edge too small)
Expected return  >  0     (or reject)
```

### Permutation Mode (Multi-Trade)
When capital allows multiple concurrent trades, test all C(N,k) combinations:
- Find portfolio with highest combined Sharpe
- Enforce correlation limits between positions
- Max 5 concurrent positions

---

## 7. MARKET REGIME DETECTION

### Regime Classification

| Regime | ADX | Returns | Volatility | Detection |
|--------|-----|---------|------------|-----------|
| **Trending Up** | > 30 | > +2% (20-day) | Normal | ADX high + positive slope |
| **Trending Down** | > 30 | < -2% (20-day) | Normal | ADX high + negative slope |
| **Mean Reverting** | < 20 | Flat (±1%) | Low (< 0.8x normal) | Low ADX + range-bound |
| **Volatile** | Any | Any | > 1.5x normal | ATR spike, VIX > 20 |
| **Quiet** | < 20 | Flat | < 0.8x normal | Low everything |

### Strategy-Regime Matrix

| Strategy | Trending | Range-Bound | Volatile | Quiet |
|----------|----------|-------------|----------|-------|
| Mean Reversion | AVOID | BEST | OK | OK |
| MA Crossover | BEST | AVOID | OK | AVOID |
| PDC/PDH | OK | BEST | OK | OK |
| 1Hr High/Low | OK | OK | BEST | AVOID |
| Volume Profile | OK | BEST | OK | BEST |
| Momentum | BEST | AVOID | BEST | AVOID |
| VWAP Reversion | AVOID | BEST | OK | OK |
| ORB | OK | OK | BEST | AVOID |
| ICT | BEST | OK | OK | AVOID |
| Triple-A | BEST | OK | BEST | AVOID |

---

## 8. DAILY ROUTINE & KILL ZONES

### Pre-Market (8:30 - 9:15 AM IST)
```
□ Load overnight data (US futures close, crypto moves, SGX Nifty)
□ Calculate gap vs PDC for Nifty & BankNifty
□ Detect current regime for each market
□ Compute volume profiles from previous day
□ Mark ICT liquidity levels (equal highs/lows, swing points)
□ Set alerts for PDH, PDL, PDC levels
□ Check economic calendar for high-impact events
□ Review India VIX level (> 18 = volatile regime)
```

### Indian Market Session

| Time (IST) | Phase | Active Strategies | Notes |
|------------|-------|-------------------|-------|
| 9:15 - 9:30 | Opening Range | Observe only | Capture ORB range, watch gap fill |
| 9:30 - 10:15 | Early Trade | ORB, PDC/PDH, Triple-A | ORB triggers, PDC reactions |
| 10:15 - 10:30 | 1Hr Range Set | 1Hr H/L arms | First hour range complete |
| 10:30 - 12:30 | Mid-Morning | All sisters active | Highest signal density |
| 12:30 - 2:00 | Lunch Lull | Volume Profile, ICT | Lower volume, mean reversion |
| 2:00 - 3:00 | Power Hour | Momentum, PDC/PDH | End-of-day moves, squaring |
| 3:00 - 3:15 | Exit Window | Exit only | Close all intraday positions |
| 3:15 - 3:30 | Post Close | No trading | Log results, reset |

### Global Sessions (for crypto/commodities)

| Session | IST Time | Markets | Best Strategies |
|---------|----------|---------|-----------------|
| London Open | 12:30 - 3:30 PM | Gold, Crude, EUR/USD | ICT PO3, Momentum |
| NY AM | 7:00 - 9:30 PM | NQ, ES, Crude, BTC | All active |
| Crypto Night | 11 PM - 2 AM | BTC, ETH | Momentum, MA Cross |

---

## 9. CAPITAL ALLOCATION & SCALING

### Strategy Allocation

| Strategy Bucket | % of Capital | Purpose |
|-----------------|-------------|---------|
| Fabervaale Triple-A scalping | 40% | High frequency, small wins, compounds fast |
| ORB / Momentum breakout | 30% | Fewer trades, bigger R:R |
| Theta decay (short straddle/strangle) | 20% | Consistent income |
| Mean reversion / VAH-VAL bounce | 10% | Opportunistic |

### Scaling Plan (Position Sizes Grow With Equity)

| Capital Level | Risk Per Trade (2%) | Lot Size (BankNifty) | Notes |
|--------------|--------------------|-----------------------|-------|
| ₹5,00,000 | ₹10,000 | 1 lot (15 qty) | Starting — conservative |
| ₹10,00,000 | ₹20,000 | 2 lots | Proving phase complete |
| ₹15,00,000 | ₹30,000 | 2-3 lots | Comfortable scaling |
| ₹20,00,000 | ₹40,000 | 3-4 lots | Intermediate target |
| ₹30,00,000 | ₹60,000 | 4-5 lots | Strong equity curve |
| ₹50,00,000 | ₹1,00,000 | 6-7 lots | TARGET ACHIEVED |

### Compounding Rule
```
After each profitable WEEK:
    Recalculate 2% risk based on NEW capital (not starting capital)

After each losing WEEK:
    Keep position sizes same (don't reduce on normal losses)
    Only reduce if drawdown rules trigger (see Section 5)
```

---

## 10. OPTIONS STRATEGY LAYER

> This is the 10x accelerator. Futures alone can do 3-5x. Weekly options are where 10x happens.

### Options Strategies to Layer On Top

| Strategy | When to Use | Setup | Max Risk |
|----------|------------|-------|----------|
| **Weekly ATM Buy** | MC score > 0.70 + strong directional signal | Buy ATM CE/PE on BankNifty weekly | 2% of capital |
| **Bull/Bear Spread** | MC score 0.55-0.70 + directional bias | Buy ATM, sell OTM (3 strikes away) | 3% of capital |
| **Short Straddle** | Regime = quiet/range-bound, VIX > 16 | Sell ATM CE + PE, hedge with OTM wings | 5% of capital |
| **Iron Condor** | Regime = quiet, VIX 14-18 | Sell OTM CE+PE, buy further OTM | 3% of capital |
| **0DTE Scalp** | Triple-A signal on expiry day | Buy ATM option, exit within 15-30 min | 1% of capital |

### Options Greeks to Monitor
```
Delta: > 0.5 for directional trades (ATM), < 0.3 for theta trades
Gamma: Watch on expiry day — high gamma = violent moves
Theta: Must be positive for theta strategies
Vega: Sell when VIX high, buy when VIX low
IV: Compare current IV vs 20-day mean. Sell if IV > 1.2x mean
```

### Fyers Options Chain Integration
```
GET /data/options-chain-v3?symbol=NSE:NIFTY&strikecount=5
→ Returns: CE/PE with ltp, oi, oi_change, volume per strike
→ Use OI data to identify: support (high PE OI), resistance (high CE OI)
→ Max pain = strike with highest total OI (CE + PE)
```

---

## 11. BROKER EXECUTION PIPELINE

### Order Flow

```
SIGNAL APPROVED
      │
      ▼
┌─────────────┐     ┌──────────────┐
│ Check Fyers │──►  │ Place Order  │
│ Connection  │     │ (LIMIT/MKT)  │
└─────────────┘     └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │ Attach Smart │
                    │ Exit Flow    │
                    │ (Type 2/3)   │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │ Monitor      │
                    │ Position     │
                    │ (WebSocket)  │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
         SL HIT       TP HIT      TRAIL TRIGGERED
              │            │            │
              ▼            ▼            ▼
         LOG LOSS     LOG WIN     PARTIAL EXIT
```

### Fyers API Flow
```python
# 1. Place order
order = fyers.place_order({
    "symbol": "NSE:BANKNIFTY25MARFUT",
    "qty": 15,
    "type": 2,           # LIMIT
    "side": 1,           # BUY
    "limitPrice": entry,
    "validity": "DAY",
    "productType": "INTRADAY"
})

# 2. Attach smart exit
smart_exit = fyers.smart_exit({
    "name": "MC_Trade_001",
    "type": 2,            # Exit with alert
    "profitRate": tp_pct,
    "lossRate": sl_pct
})

# 3. Fallback: Groww for quotes if Fyers down
ltp = groww.get_ltp(segment="CASH", exchange_trading_symbols=("NSE_NIFTY",))
```

---

## 12. TUNING PARAMETERS

> **These are the knobs you turn to optimize the system. Change one at a time, backtest, compare.**

### Global Parameters
```yaml
# ── Risk ──
MAX_RISK_PER_TRADE: 0.02          # 2% of capital
MAX_DAILY_LOSS: 0.05              # 5% of capital
MAX_WEEKLY_LOSS: 0.10             # 10% of capital
MAX_DRAWDOWN: 0.25                # 25% — halt system
MAX_CONCURRENT_TRADES: 5
MIN_RR_RATIO: 1.5
CONSECUTIVE_LOSS_REDUCTION: 0.10  # Reduce by 10% per loss after 3

# ── Monte Carlo ──
MC_SIMULATIONS: 10000
MC_MIN_PROB_PROFIT: 0.60          # 60% minimum
MC_MIN_COMPOSITE_SCORE: 0.55
MC_DISTRIBUTION_DF: 5             # Student's t degrees of freedom
MC_FORWARD_DAYS: 5                # Simulate 5 days forward

# ── Execution ──
SLIPPAGE_BPS: 5                   # 5 basis points
COMMISSION_PER_ORDER: 20          # ₹20 per order
DEFAULT_TRAILING_ATR_MULT: 1.5
```

### Per-Strategy Parameters
```yaml
# ── Mean Reversion ──
MEAN_REV_ZSCORE_THRESHOLD: 2.0
MEAN_REV_RSI_OVERSOLD: 30
MEAN_REV_RSI_OVERBOUGHT: 70
MEAN_REV_EXIT_ZSCORE: 0.5

# ── MA Crossover ──
MA_FAST_PERIOD: 9
MA_SLOW_PERIOD: 21
MA_ADX_THRESHOLD: 20
MA_SL_ATR_MULT: 1.5
MA_TP_ATR_MULT: 3.0

# ── PDC/PDH ──
PDC_RETEST_TOLERANCE: 0.001      # 0.1% tolerance for retest detection

# ── Volume Profile ──
VP_LOOKBACK: 50
VP_RESOLUTION: 24
VP_VALUE_AREA_PCT: 0.70          # 70% of volume

# ── Momentum ──
MOM_RSI_THRESHOLD: 60
MOM_ADX_THRESHOLD: 25
MOM_SL_ATR_MULT: 2.0
MOM_TP_ATR_MULT: 5.0

# ── VWAP Reversion ──
VWAP_STD_DEVS: 1.5

# ── ORB ──
ORB_WINDOW_MINUTES: 15
ORB_GAP_FILTER: 0.015            # Skip if gap > 1.5%
ORB_MIN_RANGE_PCT: 0.003         # 0.3% min range
ORB_MAX_RANGE_PCT: 0.015         # 1.5% max range

# ── ICT ──
ICT_OTE_FIB_LOW: 0.618
ICT_OTE_FIB_HIGH: 0.786
ICT_SWING_LOOKBACK: 20           # Bars to find swing points

# ── Fabervaale Triple-A ──
TRIPLE_A_VOL_MULT: 2.0           # Volume > avg × this
TRIPLE_A_RANGE_MULT: 0.3         # Range < ATR × this
TRIPLE_A_ACCUM_CANDLES: 5        # Max candles for accumulation
TRIPLE_A_AGGRESSION_VOL: 1.5     # Breakout volume > avg × this
TRIPLE_A_SL_ATR_MULT: 1.0
TRIPLE_A_TP_ATR_MULT: 2.0
TRIPLE_A_TRAIL_ATR_MULT: 1.5
```

---

## 13. CHANGELOG

| Date | Change | Reason |
|------|--------|--------|
| 2026-03-28 | v2.0 — Added ICT (Sister 9) and Fabervaale Triple-A (Sister 10) | Incorporate advanced order flow + smart money concepts |
| 2026-03-28 | Added options strategy layer | 10x requires leveraged options, not just futures |
| 2026-03-28 | Added Fyers smart exit integration | Automated SL/TP management via broker API |
| 2026-03-28 | Created tuning parameters section | Easy reference for backtesting iterations |
| | | |
| | | |
| | | |

---

## QUICK REFERENCE CARD

```
ENTRY CHECKLIST:
  □ Kill zone active?
  □ Regime identified?
  □ Signal from sister algo?
  □ MC score > 0.55?
  □ P(profit) > 60%?
  □ R:R > 1.5:1?
  □ Within daily loss limit?
  □ < 5 concurrent positions?
  □ Position size = Half-Kelly, max 2% risk?

EXIT CHECKLIST:
  □ Hard SL in place (non-negotiable)?
  □ Smart exit attached via Fyers?
  □ Trailing stop logic active after 1x profit?
  □ Partial exits at 1:1, 2:1, 3:1?
  □ EOD exit for intraday positions by 3:15 PM?

DAILY DISCIPLINE:
  □ No trading before 9:30 AM IST
  □ No new positions after 2:30 PM IST (intraday)
  □ Stop after 3 consecutive losses
  □ Never move SL further away
  □ Log every trade (win or loss)
  □ Weekly review every Sunday
```
