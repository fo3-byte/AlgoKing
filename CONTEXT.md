# AlgoKing — Full Project Context (for new Claude conversations)

> **CRITICAL: Read this ENTIRE file before doing anything. Everything described here is ALREADY BUILT and DEPLOYED. Do NOT rebuild or redeploy anything unless specifically asked to modify it.**

---

## WHO IS THE USER

- **Name**: Kunaal (GitHub: fo3-byte, Vercel: kunaals-projects-9065bb3a)
- **Lost ₹12L** in markets total. Fresh ₹2L capital on Dhan. $118 on Delta Exchange.
- **Goal**: ₹2L → ₹50L by Dec 2026 (Indian markets) + $118 → $10K+ (crypto options)
- **Broker (India)**: Dhan — Super Orders only. Client ID: 1105206730
- **Broker (Crypto)**: Delta Exchange India — API Key: 0LotjhrNCvz27CNibX16e4kBBpQazY
- **Max 5 trades/day**. Only A+ setups (score > 65%). No more capital to add.

---

## WHAT IS ALREADY BUILT & DEPLOYED

### 1. Dashboard (Next.js)
- **Live URL**: https://algomaster-pro.vercel.app
- **Local**: `cd ~/Desktop/Trading\ Algo/dashboard && npm run dev` → localhost:3000
- **GitHub**: https://github.com/fo3-byte/AlgoKing
- **Vercel project**: kunaals-projects-9065bb3a/dashboard
- **Push command**: Use GitHub PAT from `.env.local` or memory files
- **Alias command**: `npx vercel alias <deployment-url> algomaster-pro.vercel.app`
- **Webhook**: `curl -s "https://algomaster-pro.vercel.app/api/telegram?action=setup-webhook"`

### 2. 25+ Dashboard Panels
All implemented in `dashboard/src/components/`:
- OverviewPanel, BlueprintPanel, WorkflowBuilderPanel, AlgoSignalsPanel
- OptionsChainPanel, HeatmapPanel (treemap), EquityTrackerPanel
- ChatPanel (AI), Sidebar, MarketTicker (Dhan-powered)
- And many more — all working

### 3. API Routes (all at `dashboard/src/app/api/`)

| Route | What it does |
|-------|-------------|
| `/api/dhan` | Dhan broker: orders, super orders, positions, funds, LTP, OHLC, option chain, historical |
| `/api/delta` | Delta Exchange: orders, bracket orders, positions, wallet, option chain |
| `/api/delta-scanner` | **5-layer crypto algo engine** — scans BTC+ETH options, auto-executes if score >65% |
| `/api/india-scanner` | **5-layer India algo engine** — scans NIFTY, BANKNIFTY, 209 F&O stocks |
| `/api/telegram` | Two-way Telegram bot with trade execution + AI chat |
| `/api/chat` | Anthropic Claude API for AI analysis (accepts `systemOverride` param) |
| `/api/prices` | Yahoo Finance quotes |
| `/api/oi` | Options chain (Groww → Fyers → mock fallback) |
| `/api/oi-spurt` | NSE OI spurt data |
| `/api/heatmap` | Stock heatmap data |
| `/api/kite` | Zerodha Kite (legacy) |
| `/api/fyers-auth` | Fyers OAuth |
| `/api/groww` | Groww bridge proxy |

### 4. Telegram Bot
- **Bot**: @AlgoKingAlerts_bot
- **Token/Chat ID**: stored in telegram route.ts constants
- **Webhook**: Points to https://algomaster-pro.vercel.app/api/telegram
- **Commands**: /help, /status, /crypto, /delta, /scan, /buy, /sell, /closeall, /positions, /orders, /funds, /pnl, /market, /squareoff
- **Natural language**: Calls Anthropic API directly with full account context (positions, wallet, prices, signals)
- **Auto-execute**: AI responses containing /buy or /sell are auto-executed on Delta

### 5. The 5-Layer Algo Engine
Both scanners (crypto + India) use this framework:

| Layer | What it checks | Weight |
|-------|---------------|--------|
| **Statistical Arbitrage** | IV vs realized vol mispricing | 15-20% |
| **Mean Reversion** | RSI, Z-score extremes | 25-30% |
| **Momentum** | SMA crossover, ADX, 24h change | 20-25% |
| **Volatility Arbitrage** | IV percentile (cheap vs expensive) | 15-20% |
| **Flow Analysis** | OI, funding rate, volume spikes | 15% |

Composite score threshold: **>0.60 to alert, >0.65 to auto-execute**

### 6. Automated Scanning
- **UptimeRobot**: Pings `/api/delta-scanner?action=scan&auto=true` every 5 minutes, 24/7
- **UptimeRobot**: configured and active
- **Mac crontab**: 3 crypto scans (5:30 AM, 7 PM, 11 PM IST)
- **Scheduled tasks** (Claude Code): morning-crypto-scan, evening-crypto-scan, india-market-preopen, dhan-token-reminder

### 7. Python Backend
- `mother_algo.py` — 10 sister strategies orchestrator with Monte Carlo
- `strategies/` — 8 implemented: mean_reversion, ma_crossover, pdc_pdh, one_hr_hl, volume_profile, momentum, vwap_reversion, orb
- `engines/` — monte_carlo.py (10K sims), risk_manager.py (Kelly criterion), backtester.py
- `dhan_auto_login.py` — TOTP-based auto token refresh
- `fyers_auto_login.py` — Fyers auto login

### 8. F&O Stock List
- **File**: `dashboard/src/lib/fno-stocks.ts`
- **Count**: 209 stocks + 4 indices = 213 instruments
- **Data**: symbol, Yahoo Finance symbol, lot size for each

---

## CREDENTIALS
All stored in `dashboard/.env.local` — read from there, do NOT ask user to paste again.
Dhan token expires daily. Delta Exchange uses HMAC-SHA256: `method + timestamp + path + body`.

---

## WHAT NEEDS TO BE DONE NEXT

### Priority 1: Wire India Scanner to Dhan API (NOT Yahoo)
The India scanner currently uses Yahoo Finance for quotes. User wants Dhan's own data APIs:
- `POST /v2/marketfeed/ltp` — batch LTP for all 209 F&O stocks
- `POST /v2/marketfeed/ohlc` — batch OHLC with volume
- `POST /v2/marketfeed/quote` — market depth + OI
- `POST /v2/optionchain` — full chain with Greeks, OI, security IDs per strike
- `POST /v2/optionchain/expirylist` — available expiry dates
- `POST /v2/charts/intraday` — intraday candles for RSI/SMA

All these Dhan APIs are **tested and working** from this session. Headers needed:
```
access-token: <JWT token>
client-id: 1105206730
Content-Type: application/json
```

Dhan security IDs for indices: NIFTY=13 (IDX_I segment), BANKNIFTY=25
Dhan security IDs for stocks: found via option chain response (e.g., NIFTY 22350 CE = 40726)

### Priority 2: Dhan token expires every 24 hours
User updates manually each morning. When token is set via `POST /api/dhan {action: "set-token"}`, it auto-triggers the India scanner and sends Telegram alert.

### Priority 3: Static IP for Dhan orders from Vercel
Dhan requires IP whitelisting for order APIs. Vercel has dynamic IPs. Current workaround: run `npm run dev` locally for order execution. For remote: need Vercel Pro ($20/mo) or proxy service.

### Priority 4: Make the Telegram bot smarter
The bot calls Anthropic API directly (not via /api/chat) with a system prompt containing live account data. It can auto-execute /buy and /sell commands from AI responses. But it needs:
- Better understanding of which option contracts are available
- Ability to fetch Dhan option chain and suggest specific security IDs
- Memory across messages (currently each message is stateless)

---

## KEY ARCHITECTURE DECISIONS

1. **Dashboard on Vercel** (free tier) — everything except Dhan orders works from Vercel
2. **Dhan orders need localhost** — because of static IP requirement
3. **Delta Exchange orders work from Vercel** — user whitelisted the IPv6
4. **Telegram bot runs on Vercel** — webhook at /api/telegram, 24/7
5. **UptimeRobot** pings crypto scanner every 5 min for autonomous trading
6. **All state is in-memory** — tokens, positions are stored in route-level variables, reset on cold start
7. **GitHub**: fo3-byte/AlgoKing — use classic PAT (algoking-push) stored locally

---

## FILES STRUCTURE

```
/Users/kunaalxg_/Desktop/Trading Algo/
├── dashboard/                    # Next.js app
│   ├── src/app/api/             # All API routes
│   │   ├── dhan/route.ts        # Dhan broker (orders, data, super orders)
│   │   ├── delta/route.ts       # Delta Exchange (crypto)
│   │   ├── delta-scanner/route.ts # 5-layer crypto algo engine
│   │   ├── india-scanner/route.ts # 5-layer India algo engine
│   │   ├── telegram/route.ts    # Two-way Telegram bot
│   │   ├── chat/route.ts        # AI chat (Anthropic)
│   │   ├── prices/route.ts      # Yahoo Finance
│   │   ├── oi/route.ts          # Options chain
│   │   ├── oi-spurt/route.ts    # NSE OI spurt
│   │   └── ...more
│   ├── src/components/          # 25+ React panels
│   ├── src/lib/
│   │   ├── fno-stocks.ts        # All 209 F&O stocks + lot sizes
│   │   ├── data.ts              # Data types, ViewId
│   │   └── paperTrading.ts
│   ├── .env.local               # All credentials
│   ├── vercel.json              # Cron config
│   └── package.json
├── strategies/                   # Python algo strategies
├── engines/                      # Monte Carlo, Risk Manager, Backtester
├── config/                       # Settings
├── mother_algo.py               # Main orchestrator
├── dhan_auto_login.py           # Auto token refresh
├── fyers_auto_login.py          # Fyers auto login
├── ALGO_BLUEPRINT.md            # Complete strategy document
├── STRATEGY_PLAYBOOK.md         # Trading playbook
├── AlgoKing_5L_to_50L_Gameplan.xlsx
└── .gitignore
```

---

## DO NOT DO THESE THINGS

1. **Do NOT rebuild the dashboard** — it's deployed and working
2. **Do NOT recreate API routes** — they all exist
3. **Do NOT set up Telegram bot again** — it's connected and working
4. **Do NOT push to fo1-oss/Algoking** — use fo3-byte/AlgoKing
5. **Do NOT create new Vercel projects** — use existing `dashboard` project
6. **Do NOT install Fixie/QuotaGuard** — didn't work, user runs locally for Dhan orders
7. **Do NOT ask user to paste credentials again** — they're in .env.local

---

## MEMORY FILES

Check `/Users/kunaalxg_/.claude/projects/-Users-kunaalxg--Desktop-Trading-Algo/memory/` for:
- `project_capital_update.md` — ₹12L loss history, ₹2L fresh capital
- `project_goal.md` — 2L→50L target
- `reference_ict_strategy.md` — ICT trading concepts
- `reference_fabervaale_strategy.md` — Triple-A scalping
- `reference_fyers_api.md` — Broker API reference
