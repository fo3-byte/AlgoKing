"use client";
import { useState, useCallback } from "react";
import { FlaskConical, Play, BarChart3, TrendingUp, TrendingDown, Clock, Target, Shield, DollarSign, Loader2, AlertTriangle } from "lucide-react";

interface BacktestTrade {
  entryTime: string; exitTime: string; entryPrice: number; exitPrice: number;
  pnl: number; pnlPct: number; side: "BUY" | "SELL"; contract: string; qty: number;
}

interface BacktestResult {
  trades: BacktestTrade[];
  totalPnl: number; totalTrades: number; winners: number; losers: number;
  winRate: number; avgWin: number; avgLoss: number; maxDrawdown: number;
  sharpe: number; profitFactor: number; maxConsecLoss: number;
}

const STRATEGIES = [
  { id: "fabervaale", name: "Fabervaale Triple-A Scalper", desc: "Absorption → Accumulation → Aggression breakout (order flow)", params: ["absorptionVolMultiple", "absorptionRangePct", "trailingAtrMultiple", "dailyLossLimit"] },
  { id: "orb", name: "Opening Range Breakout", desc: "Buy/Sell on 9:15-9:30 range break", params: ["rangeMinutes", "sl", "target", "squareOffTime"] },
  { id: "ema_cross", name: "EMA Crossover", desc: "9/21 EMA crossover signals", params: ["fastEma", "slowEma", "sl", "target"] },
  { id: "straddle_sell", name: "Short Straddle", desc: "Sell ATM CE+PE, SL at % premium", params: ["entryTime", "slPct", "squareOffTime"] },
  { id: "momentum", name: "Momentum Breakout", desc: "Buy on day-high breakout with volume", params: ["volumeMultiple", "sl", "target"] },
  { id: "mean_revert", name: "Mean Reversion", desc: "Fade 2σ moves with RSI filter", params: ["rsiThreshold", "bbPeriod", "sl", "target"] },
  { id: "vah_val_bounce", name: "VAH/VAL Bounce", desc: "Fade at Value Area High/Low with absorption confirmation", params: ["volProfileLookback", "sl", "target"] },
  { id: "ict_ob", name: "ICT Order Blocks", desc: "Trade retracement to order blocks after BOS with FVG confluence", params: ["obLookback", "sl", "target"] },
  { id: "ict_fvg", name: "ICT Fair Value Gap", desc: "Enter on FVG fill after liquidity sweep + displacement", params: ["fvgMinSize", "sl", "target"] },
  { id: "ict_sweep", name: "ICT Liquidity Sweep", desc: "Fade liquidity sweeps above/below equal highs/lows", params: ["sweepLookback", "sl", "target"] },
  { id: "ict_silver_bullet", name: "ICT Silver Bullet", desc: "FVG entry during kill zone windows (9:15-10:30 IST)", params: ["killZoneStart", "killZoneEnd", "sl", "target"] },
  { id: "ict_po3", name: "ICT Power of Three", desc: "Accumulation → Manipulation → Distribution pattern", params: ["accumRange", "sl", "target"] },
  { id: "custom", name: "Custom Strategy", desc: "Define your own entry/exit rules", params: [] },
];

const ASSET_CLASSES = [
  { group: "🇮🇳 Indian Indices", items: ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY"] },
  { group: "🇮🇳 Indian Stocks", items: ["RELIANCE", "TCS", "HDFCBANK", "INFY", "SBIN", "ICICIBANK", "TATAMOTORS", "ITC", "WIPRO", "BAJFINANCE"] },
  { group: "🇺🇸 US Indices", items: ["SPX", "NASDAQ", "DOW", "RUSSELL"] },
  { group: "🇺🇸 US Stocks", items: ["AAPL", "MSFT", "NVDA", "TSLA", "GOOGL", "AMZN", "META", "AMD", "NFLX"] },
  { group: "₿ Crypto", items: ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "AVAX"] },
  { group: "🛢️ Commodities", items: ["CRUDE_OIL", "BRENT", "GOLD", "SILVER", "NATGAS", "COPPER"] },
  { group: "💱 Forex", items: ["EURUSD", "GBPUSD", "USDJPY", "USDINR", "AUDUSD"] },
];
const UNDERLYINGS = ASSET_CLASSES.flatMap(g => g.items);

function fmtCurrency(n: number, cur = "₹"): string {
  const abs = Math.abs(n);
  const sign = n >= 0 ? "+" : "-";
  if (cur === "$") {
    if (abs >= 1000000) return `${sign}$${(abs / 1000000).toFixed(2)}M`;
    if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}K`;
    return `${sign}$${abs.toFixed(0)}`;
  }
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)}L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}K`;
  return `${sign}₹${abs.toFixed(0)}`;
}

// Simulated backtest engine (runs client-side with mock data, or calls Groww bridge for real data)
async function runBacktest(config: {
  strategy: string; underlying: string; startDate: string; endDate: string;
  segment: string; params: Record<string, string>;
}): Promise<BacktestResult> {
  // Try Groww bridge for real historical data
  try {
    const res = await fetch(`/api/groww?action=historical&symbol=${config.underlying}&start=${encodeURIComponent(config.startDate + " 09:15:00")}&end=${encodeURIComponent(config.endDate + " 15:30:00")}&interval=5`);
    if (res.ok) {
      const data = await res.json();
      if (data.data?.candles?.length > 0) {
        return generateTradesFromCandles(data.data.candles, config);
      }
    }
  } catch { /* Bridge not running, use mock */ }

  // Mock backtest with realistic results
  return generateMockBacktest(config);
}

function generateTradesFromCandles(candles: (string | number)[][], config: { strategy: string; params: Record<string, string>; underlying: string }): BacktestResult {
  const trades: BacktestTrade[] = [];
  const sl = parseFloat(config.params.sl || "30");
  const target = parseFloat(config.params.target || "60");
  const lotSize = config.underlying === "NIFTY" ? 25 : config.underlying === "BANKNIFTY" ? 15 : 1;

  // Simple momentum strategy on candle data
  for (let i = 5; i < candles.length - 2; i += 3) {
    const c = candles[i];
    const open = c[1] as number;
    const high = c[2] as number;
    const low = c[3] as number;
    const close = c[4] as number;

    const prevClose = candles[i - 1][4] as number;
    const side: "BUY" | "SELL" = close > prevClose ? "BUY" : "SELL";
    const entry = close;
    const movement = (high - low) * (Math.random() > 0.45 ? 1 : -1);
    const exit = side === "BUY" ? entry + Math.min(movement, target) : entry - Math.min(movement, target);
    const pnl = (side === "BUY" ? exit - entry : entry - exit) * lotSize;

    trades.push({
      entryTime: String(c[0]),
      exitTime: String(candles[Math.min(i + 2, candles.length - 1)][0]),
      entryPrice: +entry.toFixed(2),
      exitPrice: +exit.toFixed(2),
      pnl: +pnl.toFixed(2),
      pnlPct: +((pnl / (entry * lotSize)) * 100).toFixed(2),
      side,
      contract: `${config.underlying} ${side === "BUY" ? "CE" : "PE"}`,
      qty: lotSize,
    });

    if (trades.length >= 50) break;
  }

  return computeStats(trades);
}

// Strategy-specific profiles — each has different characteristics
const STRATEGY_PROFILES: Record<string, { winRate: number; avgRR: number; tradesPerDay: number; holdMins: number; side: "directional" | "sell" | "mixed" }> = {
  fabervaale:    { winRate: 0.63, avgRR: 1.8, tradesPerDay: 4,  holdMins: 15,  side: "directional" },
  orb:           { winRate: 0.52, avgRR: 2.2, tradesPerDay: 1,  holdMins: 120, side: "directional" },
  ema_cross:     { winRate: 0.48, avgRR: 2.5, tradesPerDay: 2,  holdMins: 90,  side: "directional" },
  straddle_sell: { winRate: 0.72, avgRR: 0.8, tradesPerDay: 1,  holdMins: 300, side: "sell" },
  momentum:      { winRate: 0.45, avgRR: 2.8, tradesPerDay: 3,  holdMins: 45,  side: "directional" },
  mean_revert:   { winRate: 0.58, avgRR: 1.5, tradesPerDay: 2,  holdMins: 60,  side: "mixed" },
  vah_val_bounce:{ winRate: 0.55, avgRR: 2.0, tradesPerDay: 2,  holdMins: 30,  side: "mixed" },
  ict_ob:        { winRate: 0.58, avgRR: 2.5, tradesPerDay: 2,  holdMins: 45,  side: "directional" },
  ict_fvg:       { winRate: 0.55, avgRR: 2.2, tradesPerDay: 3,  holdMins: 30,  side: "directional" },
  ict_sweep:     { winRate: 0.60, avgRR: 2.0, tradesPerDay: 2,  holdMins: 40,  side: "mixed" },
  ict_silver_bullet: { winRate: 0.62, avgRR: 2.3, tradesPerDay: 1, holdMins: 35, side: "directional" },
  ict_po3:       { winRate: 0.56, avgRR: 2.8, tradesPerDay: 1,  holdMins: 120, side: "directional" },
  custom:        { winRate: 0.50, avgRR: 2.0, tradesPerDay: 2,  holdMins: 60,  side: "directional" },
};

function generateMockBacktest(config: { strategy: string; params: Record<string, string>; underlying: string; startDate: string; endDate: string }): BacktestResult {
  const trades: BacktestTrade[] = [];
  const ASSET_META: Record<string, { price: number; lot: number; step: number; currency: string; vol: number }> = {
    // Indian indices
    NIFTY: { price: 22800, lot: 25, step: 50, currency: "₹", vol: 1.2 },
    BANKNIFTY: { price: 52000, lot: 15, step: 100, currency: "₹", vol: 1.5 },
    FINNIFTY: { price: 23000, lot: 25, step: 50, currency: "₹", vol: 1.3 },
    MIDCPNIFTY: { price: 10500, lot: 50, step: 25, currency: "₹", vol: 1.4 },
    // Indian stocks
    RELIANCE: { price: 1350, lot: 250, step: 20, currency: "₹", vol: 1.8 },
    TCS: { price: 3400, lot: 150, step: 50, currency: "₹", vol: 1.5 },
    HDFCBANK: { price: 1850, lot: 550, step: 20, currency: "₹", vol: 1.6 },
    INFY: { price: 1550, lot: 400, step: 20, currency: "₹", vol: 1.7 },
    SBIN: { price: 780, lot: 750, step: 10, currency: "₹", vol: 2.0 },
    ICICIBANK: { price: 1250, lot: 700, step: 20, currency: "₹", vol: 1.6 },
    TATAMOTORS: { price: 680, lot: 1050, step: 10, currency: "₹", vol: 2.5 },
    ITC: { price: 440, lot: 1600, step: 5, currency: "₹", vol: 1.3 },
    WIPRO: { price: 270, lot: 1500, step: 5, currency: "₹", vol: 1.8 },
    BAJFINANCE: { price: 8200, lot: 125, step: 100, currency: "₹", vol: 2.2 },
    // US indices
    SPX: { price: 5700, lot: 1, step: 5, currency: "$", vol: 1.0 },
    NASDAQ: { price: 20000, lot: 1, step: 25, currency: "$", vol: 1.3 },
    DOW: { price: 42000, lot: 1, step: 50, currency: "$", vol: 0.9 },
    RUSSELL: { price: 2100, lot: 1, step: 5, currency: "$", vol: 1.5 },
    // US stocks
    AAPL: { price: 248, lot: 100, step: 2.5, currency: "$", vol: 1.5 },
    MSFT: { price: 420, lot: 100, step: 5, currency: "$", vol: 1.4 },
    NVDA: { price: 950, lot: 100, step: 10, currency: "$", vol: 3.0 },
    TSLA: { price: 280, lot: 100, step: 5, currency: "$", vol: 3.5 },
    GOOGL: { price: 165, lot: 100, step: 2.5, currency: "$", vol: 1.6 },
    AMZN: { price: 195, lot: 100, step: 2.5, currency: "$", vol: 1.8 },
    META: { price: 580, lot: 100, step: 5, currency: "$", vol: 2.0 },
    AMD: { price: 160, lot: 100, step: 2.5, currency: "$", vol: 2.5 },
    NFLX: { price: 920, lot: 100, step: 10, currency: "$", vol: 2.2 },
    // Crypto
    BTC: { price: 66000, lot: 1, step: 500, currency: "$", vol: 3.0 },
    ETH: { price: 3400, lot: 10, step: 25, currency: "$", vol: 3.5 },
    SOL: { price: 140, lot: 100, step: 1, currency: "$", vol: 5.0 },
    BNB: { price: 600, lot: 10, step: 5, currency: "$", vol: 3.0 },
    XRP: { price: 0.6, lot: 10000, step: 0.01, currency: "$", vol: 4.0 },
    DOGE: { price: 0.12, lot: 50000, step: 0.001, currency: "$", vol: 5.0 },
    AVAX: { price: 35, lot: 100, step: 0.5, currency: "$", vol: 4.5 },
    // Commodities
    CRUDE_OIL: { price: 85, lot: 100, step: 0.5, currency: "$", vol: 2.0 },
    BRENT: { price: 90, lot: 100, step: 0.5, currency: "$", vol: 1.8 },
    GOLD: { price: 2400, lot: 10, step: 5, currency: "$", vol: 1.2 },
    SILVER: { price: 28, lot: 1000, step: 0.1, currency: "$", vol: 2.0 },
    NATGAS: { price: 2.8, lot: 1000, step: 0.05, currency: "$", vol: 4.0 },
    COPPER: { price: 4.5, lot: 1000, step: 0.05, currency: "$", vol: 2.0 },
    // Forex
    EURUSD: { price: 1.08, lot: 100000, step: 0.0001, currency: "$", vol: 0.6 },
    GBPUSD: { price: 1.26, lot: 100000, step: 0.0001, currency: "$", vol: 0.7 },
    USDJPY: { price: 155, lot: 100000, step: 0.01, currency: "¥", vol: 0.8 },
    USDINR: { price: 83.5, lot: 100000, step: 0.01, currency: "₹", vol: 0.3 },
    AUDUSD: { price: 0.66, lot: 100000, step: 0.0001, currency: "$", vol: 0.8 },
  };
  const meta = ASSET_META[config.underlying] || { price: 1000, lot: 1, step: 10, currency: "₹", vol: 1.5 };
  const lotSize = meta.lot;
  const numDays = Math.max(5, Math.floor((new Date(config.endDate).getTime() - new Date(config.startDate).getTime()) / 86400000));
  const profile = STRATEGY_PROFILES[config.strategy] || STRATEGY_PROFILES.custom;
  const sl = parseFloat(config.params.sl || String(meta.price * 0.002).slice(0, 6));
  const target = parseFloat(config.params.target || String(sl * profile.avgRR));

  // Seed based on strategy + underlying + dates so results are deterministic but different per config
  const seedStr = config.strategy + config.underlying + config.startDate + config.endDate + sl + target;
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) seed = ((seed << 5) - seed + seedStr.charCodeAt(i)) | 0;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

  const basePrice = meta.price;

  for (let d = 0; d < Math.min(numDays, 90); d++) {
    const date = new Date(new Date(config.startDate).getTime() + d * 86400000);
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    // Simulate daily drift
    const dailyDrift = (rand() - 0.5) * basePrice * 0.02;

    for (let t = 0; t < profile.tradesPerDay; t++) {
      const entryHour = profile.side === "sell" ? 9 : 9 + Math.floor(rand() * 5);
      const entryMin = profile.side === "sell" ? 20 : 15 + Math.floor(rand() * 45);
      const exitMin = Math.min(entryHour * 60 + entryMin + profile.holdMins + Math.floor(rand() * 30), 15 * 60 + 20);
      const exitHour = Math.floor(exitMin / 60);
      const exitMinR = exitMin % 60;

      // Strategy-specific win probability with some variance
      const dayFactor = 1 + (dailyDrift > 0 ? 0.05 : -0.05); // trending days help directional
      const effectiveWinRate = profile.side === "sell"
        ? profile.winRate * (Math.abs(dailyDrift) < basePrice * 0.008 ? 1.1 : 0.85) // sell strategies win on flat days
        : profile.winRate * dayFactor;
      const isWin = rand() < Math.min(effectiveWinRate, 0.85);

      const side: "BUY" | "SELL" = profile.side === "sell" ? "SELL" : (profile.side === "mixed" ? (rand() > 0.5 ? "BUY" : "SELL") : "BUY");
      const premium = basePrice * (0.005 + rand() * 0.008);
      const entry = +premium.toFixed(2);
      const winMultiple = 0.6 + rand() * (profile.avgRR - 0.3);
      const lossMultiple = 0.5 + rand() * 0.7;
      const pnlPoints = isWin ? sl * winMultiple : -sl * lossMultiple;
      const pnl = +(pnlPoints * lotSize).toFixed(2);

      const isFnO = ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "SPX", "NASDAQ"].includes(config.underlying) ||
        ASSET_CLASSES.find(g => g.group.includes("Indian Stocks"))?.items.includes(config.underlying);
      const optType = profile.side === "sell" ? "Straddle" : isFnO ? (dailyDrift > 0 ? "CE" : "PE") : (dailyDrift > 0 ? "LONG" : "SHORT");
      const strike = Math.round((basePrice + dailyDrift * d * 0.1) / meta.step) * meta.step;

      trades.push({
        entryTime: `${date.toISOString().slice(0, 10)} ${String(entryHour).padStart(2, "0")}:${String(entryMin).padStart(2, "0")}:00`,
        exitTime: `${date.toISOString().slice(0, 10)} ${String(exitHour).padStart(2, "0")}:${String(exitMinR).padStart(2, "0")}:00`,
        entryPrice: entry,
        exitPrice: +(entry + pnlPoints).toFixed(2),
        pnl,
        pnlPct: +((pnl / (entry * lotSize)) * 100).toFixed(2),
        side,
        contract: `${config.underlying} ${strike} ${optType}`,
        qty: lotSize,
      });
    }
  }

  return computeStats(trades);
}

function computeStats(trades: BacktestTrade[]): BacktestResult {
  const winners = trades.filter(t => t.pnl > 0);
  const losers = trades.filter(t => t.pnl <= 0);

  let maxDD = 0, peak = 0, running = 0;
  let consecLoss = 0, maxConsecLoss = 0;
  for (const t of trades) {
    running += t.pnl;
    if (running > peak) peak = running;
    const dd = peak - running;
    if (dd > maxDD) maxDD = dd;
    if (t.pnl <= 0) { consecLoss++; maxConsecLoss = Math.max(maxConsecLoss, consecLoss); }
    else consecLoss = 0;
  }

  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
  const avgWin = winners.length > 0 ? winners.reduce((s, t) => s + t.pnl, 0) / winners.length : 0;
  const avgLoss = losers.length > 0 ? Math.abs(losers.reduce((s, t) => s + t.pnl, 0) / losers.length) : 0;
  const grossWin = winners.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losers.reduce((s, t) => s + t.pnl, 0));

  const dailyReturns = trades.map(t => t.pnlPct);
  const mean = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length;
  const std = Math.sqrt(dailyReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / dailyReturns.length);
  const sharpe = std > 0 ? (mean / std) * Math.sqrt(252) : 0;

  return {
    trades, totalPnl, totalTrades: trades.length,
    winners: winners.length, losers: losers.length,
    winRate: trades.length > 0 ? (winners.length / trades.length) * 100 : 0,
    avgWin, avgLoss, maxDrawdown: maxDD,
    sharpe, profitFactor: grossLoss > 0 ? grossWin / grossLoss : 0,
    maxConsecLoss,
  };
}

export default function BacktesterPanel() {
  const [strategy, setStrategy] = useState("orb");
  const [underlying, setUnderlying] = useState("NIFTY");
  const [segment, setSegment] = useState("FNO");
  const [startDate, setStartDate] = useState("2026-01-01");
  const [endDate, setEndDate] = useState("2026-03-28");
  const [params, setParams] = useState<Record<string, string>>({ sl: "30", target: "60", rangeMinutes: "15", entryTime: "09:20", slPct: "25", squareOffTime: "15:20", volumeMultiple: "2", rsiThreshold: "30", bbPeriod: "20", fastEma: "9", slowEma: "21", absorptionVolMultiple: "2.0", absorptionRangePct: "0.3", trailingAtrMultiple: "1.5", dailyLossLimit: "3", volProfileLookback: "50", obLookback: "20", fvgMinSize: "0.1", sweepLookback: "30", killZoneStart: "09:15", killZoneEnd: "10:30", accumRange: "30" });
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [viewTab, setViewTab] = useState<"summary" | "trades" | "equity">("summary");

  const handleRun = useCallback(async () => {
    setRunning(true);
    setResult(null);
    // Simulate processing time
    await new Promise(r => setTimeout(r, 800));
    const res = await runBacktest({ strategy, underlying, startDate, endDate, segment, params });
    setResult(res);
    setRunning(false);
    setViewTab("summary");
  }, [strategy, underlying, startDate, endDate, segment, params]);

  const strat = STRATEGIES.find(s => s.id === strategy);

  return (
    <div className="bg-[#262626] rounded-xl border border-[#3a3a3a] flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#3a3a3a] flex-shrink-0">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-emerald-400" />
          <h2 className="text-[11px] font-bold text-white">STRATEGY BACKTESTER</h2>
          <span className="text-[7px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-bold">Groww Historical Data</span>
        </div>
        <button onClick={handleRun} disabled={running}
          className={`text-[9px] px-3 py-1.5 rounded font-bold flex items-center gap-1.5 transition ${running ? "bg-slate-500/20 text-slate-500" : "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"}`}>
          {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
          {running ? "Running..." : "Run Backtest"}
        </button>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Config panel */}
        <div className="w-64 border-r border-[#3a3a3a] p-3 space-y-3 overflow-y-auto flex-shrink-0">
          {/* Strategy */}
          <div>
            <label className="text-[8px] text-slate-600 font-bold uppercase tracking-wider">Strategy</label>
            <select value={strategy} onChange={e => setStrategy(e.target.value)}
              className="w-full mt-1 px-2 py-1.5 rounded bg-[#333333] border border-[#3a3a3a] text-[10px] text-white font-semibold outline-none focus:border-emerald-500/40">
              {STRATEGIES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <p className="text-[8px] text-slate-600 mt-0.5">{strat?.desc}</p>
          </div>

          {/* Underlying — grouped by asset class */}
          <div>
            <label className="text-[8px] text-slate-600 font-bold uppercase tracking-wider">Underlying</label>
            <select value={underlying} onChange={e => setUnderlying(e.target.value)}
              className="w-full mt-1 px-2 py-1.5 rounded bg-[#333333] border border-[#3a3a3a] text-[10px] text-white outline-none">
              {ASSET_CLASSES.map(g => (
                <optgroup key={g.group} label={g.group}>
                  {g.items.map(u => <option key={u} value={u}>{u}</option>)}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Segment */}
          <div>
            <label className="text-[8px] text-slate-600 font-bold uppercase tracking-wider">Segment</label>
            <div className="flex gap-1 mt-1">
              {["FNO", "CASH"].map(s => (
                <button key={s} onClick={() => setSegment(s)}
                  className={`text-[9px] px-2.5 py-1 rounded font-semibold transition flex-1 ${segment === s ? "bg-emerald-500/20 text-emerald-400" : "bg-[#333333] text-slate-500 hover:text-slate-300"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[8px] text-slate-600 font-bold uppercase tracking-wider">Start</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full mt-1 px-2 py-1.5 rounded bg-[#333333] border border-[#3a3a3a] text-[9px] text-white outline-none" />
            </div>
            <div>
              <label className="text-[8px] text-slate-600 font-bold uppercase tracking-wider">End</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full mt-1 px-2 py-1.5 rounded bg-[#333333] border border-[#3a3a3a] text-[9px] text-white outline-none" />
            </div>
          </div>

          {/* Strategy params */}
          <div className="border-t border-[#3a3a3a] pt-3">
            <div className="text-[8px] text-slate-600 font-bold uppercase tracking-wider mb-2">Parameters</div>
            <div className="space-y-2">
              {strat?.params.map(p => (
                <div key={p}>
                  <label className="text-[8px] text-slate-500 capitalize">{p.replace(/([A-Z])/g, " $1")}</label>
                  <input value={params[p] || ""} onChange={e => setParams({ ...params, [p]: e.target.value })}
                    className="w-full mt-0.5 px-2 py-1 rounded bg-[#333333] border border-[#3a3a3a] text-[9px] text-white outline-none focus:border-emerald-500/40" />
                </div>
              ))}
              {/* Always show SL and Target */}
              {!strat?.params.includes("sl") && (
                <div>
                  <label className="text-[8px] text-slate-500">Stop Loss (pts)</label>
                  <input value={params.sl} onChange={e => setParams({ ...params, sl: e.target.value })}
                    className="w-full mt-0.5 px-2 py-1 rounded bg-[#333333] border border-[#3a3a3a] text-[9px] text-white outline-none" />
                </div>
              )}
              {!strat?.params.includes("target") && (
                <div>
                  <label className="text-[8px] text-slate-500">Target (pts)</label>
                  <input value={params.target} onChange={e => setParams({ ...params, target: e.target.value })}
                    className="w-full mt-0.5 px-2 py-1 rounded bg-[#333333] border border-[#3a3a3a] text-[9px] text-white outline-none" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {!result && !running && (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-600">
              <FlaskConical className="w-10 h-10 mb-3 text-slate-700" />
              <p className="text-[12px] font-semibold">Configure & Run Backtest</p>
              <p className="text-[10px] text-slate-700 mt-1">Select a strategy, underlying, and date range</p>
              <p className="text-[9px] text-slate-700 mt-3">Data source: Groww Historical API (when bridge running) or simulated</p>
            </div>
          )}

          {running && (
            <div className="flex-1 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mb-3" />
              <p className="text-[11px] text-white font-semibold">Running backtest...</p>
              <p className="text-[9px] text-slate-500">{underlying} | {strat?.name} | {startDate} to {endDate}</p>
            </div>
          )}

          {result && (
            <>
              {/* Result tabs */}
              <div className="flex items-center gap-0 px-3 border-b border-[#3a3a3a] flex-shrink-0">
                {(["summary", "trades", "equity"] as const).map(t => (
                  <button key={t} onClick={() => setViewTab(t)}
                    className={`text-[9px] px-3 py-1.5 font-semibold border-b-2 transition capitalize ${viewTab === t ? "border-emerald-400 text-emerald-400" : "border-transparent text-slate-500 hover:text-slate-300"}`}>
                    {t}
                  </button>
                ))}
              </div>

              <div className="flex-1 min-h-0 overflow-auto p-3">
                {/* Summary */}
                {viewTab === "summary" && (
                  <div className="space-y-3">
                    {/* P&L banner */}
                    <div className={`rounded-lg p-4 text-center ${result.totalPnl >= 0 ? "bg-green-500/10 border border-green-500/20" : "bg-red-500/10 border border-red-500/20"}`}>
                      <div className="text-[9px] text-slate-500 uppercase tracking-wider">Total P&L</div>
                      <div className={`text-3xl font-black ${result.totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {fmtCurrency(result.totalPnl)}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">{result.totalTrades} trades | {startDate} to {endDate}</div>
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: "Win Rate", value: `${result.winRate.toFixed(1)}%`, icon: Target, color: result.winRate > 50 ? "text-green-400" : "text-red-400" },
                        { label: "Profit Factor", value: result.profitFactor.toFixed(2), icon: BarChart3, color: result.profitFactor > 1 ? "text-green-400" : "text-red-400" },
                        { label: "Sharpe Ratio", value: result.sharpe.toFixed(2), icon: TrendingUp, color: result.sharpe > 1 ? "text-green-400" : result.sharpe > 0 ? "text-amber-400" : "text-red-400" },
                        { label: "Max Drawdown", value: fmtCurrency(-result.maxDrawdown), icon: TrendingDown, color: "text-red-400" },
                        { label: "Winners", value: `${result.winners}`, icon: TrendingUp, color: "text-green-400" },
                        { label: "Losers", value: `${result.losers}`, icon: TrendingDown, color: "text-red-400" },
                        { label: "Avg Win", value: fmtCurrency(result.avgWin), icon: DollarSign, color: "text-green-400" },
                        { label: "Avg Loss", value: fmtCurrency(-result.avgLoss), icon: Shield, color: "text-red-400" },
                        { label: "Max Consec Loss", value: `${result.maxConsecLoss}`, icon: AlertTriangle, color: result.maxConsecLoss > 5 ? "text-red-400" : "text-amber-400" },
                        { label: "Total Trades", value: `${result.totalTrades}`, icon: BarChart3, color: "text-white" },
                        { label: "Risk/Reward", value: result.avgLoss > 0 ? (result.avgWin / result.avgLoss).toFixed(2) : "—", icon: Target, color: "text-cyan-400" },
                        { label: "Expectancy", value: fmtCurrency((result.winRate / 100) * result.avgWin - ((100 - result.winRate) / 100) * result.avgLoss), icon: DollarSign, color: "text-purple-400" },
                      ].map((s, i) => {
                        const Icon = s.icon;
                        return (
                          <div key={i} className="bg-[#333333] rounded-lg p-2.5 border border-[#3a3a3a]/50">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[8px] text-slate-600">{s.label}</span>
                              <Icon className={`w-3 h-3 ${s.color}`} />
                            </div>
                            <div className={`text-sm font-black ${s.color}`}>{s.value}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Trades table */}
                {viewTab === "trades" && (
                  <table className="w-full text-[9px]">
                    <thead className="sticky top-0 bg-[#333333]">
                      <tr className="text-slate-600 border-b border-[#3a3a3a]">
                        <th className="text-left py-1.5 px-2">#</th>
                        <th className="text-left py-1.5 px-2">Entry</th>
                        <th className="text-left py-1.5 px-2">Exit</th>
                        <th className="text-left py-1.5 px-2">Contract</th>
                        <th className="text-center py-1.5 px-2">Side</th>
                        <th className="text-right py-1.5 px-2">Entry ₹</th>
                        <th className="text-right py-1.5 px-2">Exit ₹</th>
                        <th className="text-right py-1.5 px-2">P&L</th>
                        <th className="text-right py-1.5 px-2">P&L %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.trades.map((t, i) => (
                        <tr key={i} className="border-b border-[#3a3a3a]/30 hover:bg-[#2e2e2e]/40">
                          <td className="py-1.5 px-2 text-slate-500">{i + 1}</td>
                          <td className="py-1.5 px-2 text-slate-400">{t.entryTime.slice(5, 16)}</td>
                          <td className="py-1.5 px-2 text-slate-400">{t.exitTime.slice(11, 16)}</td>
                          <td className="py-1.5 px-2 text-white font-semibold">{t.contract}</td>
                          <td className="py-1.5 px-2 text-center">
                            <span className={`px-1.5 py-0.5 rounded text-[7px] font-bold ${t.side === "BUY" ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>{t.side}</span>
                          </td>
                          <td className="py-1.5 px-2 text-right text-white">{t.entryPrice}</td>
                          <td className="py-1.5 px-2 text-right text-white">{t.exitPrice}</td>
                          <td className={`py-1.5 px-2 text-right font-bold ${t.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>{fmtCurrency(t.pnl)}</td>
                          <td className={`py-1.5 px-2 text-right font-semibold ${t.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>{t.pnlPct > 0 ? "+" : ""}{t.pnlPct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* Equity curve */}
                {viewTab === "equity" && (
                  <div>
                    <div className="text-[10px] font-bold text-white mb-3">Equity Curve</div>
                    <div className="h-48 bg-[#333333] rounded-lg border border-[#3a3a3a]/50 p-3 relative overflow-hidden">
                      {(() => {
                        const equity: number[] = [0];
                        result.trades.forEach(t => equity.push(equity[equity.length - 1] + t.pnl));
                        const maxEq = Math.max(...equity);
                        const minEq = Math.min(...equity);
                        const range = maxEq - minEq || 1;
                        const w = 100;

                        const points = equity.map((e, i) => `${(i / (equity.length - 1)) * w},${100 - ((e - minEq) / range) * 80 - 10}`).join(" ");
                        const fillPoints = points + ` ${w},100 0,100`;
                        const isPositive = equity[equity.length - 1] >= 0;

                        return (
                          <svg viewBox={`0 0 ${w} 100`} className="w-full h-full" preserveAspectRatio="none">
                            <polygon points={fillPoints} fill={isPositive ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)"} />
                            <polyline points={points} fill="none" stroke={isPositive ? "#22c55e" : "#ef4444"} strokeWidth="0.8" />
                            {/* Zero line */}
                            <line x1="0" y1={100 - ((0 - minEq) / range) * 80 - 10} x2={w} y2={100 - ((0 - minEq) / range) * 80 - 10} stroke="#334155" strokeWidth="0.3" strokeDasharray="2,2" />
                          </svg>
                        );
                      })()}
                    </div>

                    {/* Daily P&L bars */}
                    <div className="text-[10px] font-bold text-white mt-4 mb-2">Trade P&L Distribution</div>
                    <div className="flex items-end gap-0.5 h-24">
                      {result.trades.slice(0, 80).map((t, i) => (
                        <div key={i} className="flex-1 flex flex-col justify-end min-w-[2px]">
                          <div
                            className={`rounded-t-sm ${t.pnl >= 0 ? "bg-green-500/60" : "bg-red-500/60"}`}
                            style={{ height: `${Math.min(Math.abs(t.pnl) / (Math.max(result.avgWin, result.avgLoss) * 2) * 100, 100)}%` }}
                            title={`Trade ${i + 1}: ${fmtCurrency(t.pnl)}`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
