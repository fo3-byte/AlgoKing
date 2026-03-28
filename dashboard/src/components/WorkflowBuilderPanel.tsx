"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import {
  Play, Pause, Plus, Trash2, Copy, Save, ChevronDown, ChevronRight,
  Clock, TrendingUp, TrendingDown, BarChart3, Bell, ShoppingCart,
  GitBranch, Timer, Square, Zap, Settings, X, GripVertical, ArrowRight,
  Eye, Code, Layers, Search, Filter, Activity, AlertTriangle, Rocket,
  RefreshCw, Target, Shield, DollarSign, Repeat,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

type NodeType = "trigger" | "condition" | "action" | "logic" | "wait" | "stop";

interface WorkflowNode {
  id: string;
  type: NodeType;
  subtype: string;
  label: string;
  x: number;
  y: number;
  config: Record<string, string | number | boolean>;
  outputs: string[]; // connected node ids
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  status: "draft" | "active" | "paused" | "stopped";
  createdAt: string;
  tags: string[];
  complexity: "Basic" | "Intermediate" | "Advanced";
}

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  complexity: "Basic" | "Intermediate" | "Advanced";
  updated: string;
  nodes: WorkflowNode[];
}

// ── Node palette ───────────────────────────────────────────────────────────

const NODE_PALETTE: { type: NodeType; subtype: string; label: string; icon: typeof Clock; color: string; desc: string }[] = [
  { type: "trigger", subtype: "time", label: "Time Trigger", icon: Clock, color: "#7c3aed", desc: "Run at specific time daily" },
  { type: "trigger", subtype: "price", label: "Price Trigger", icon: TrendingUp, color: "#7c3aed", desc: "When price crosses a level" },
  { type: "trigger", subtype: "volume", label: "Volume Trigger", icon: BarChart3, color: "#7c3aed", desc: "On volume spike" },
  { type: "trigger", subtype: "indicator", label: "Indicator Trigger", icon: Activity, color: "#7c3aed", desc: "RSI, MACD, EMA crossover" },
  { type: "condition", subtype: "range_breakout", label: "Range Breakout", icon: Target, color: "#059669", desc: "Opening range breakout check" },
  { type: "condition", subtype: "price_check", label: "Price Check", icon: TrendingUp, color: "#059669", desc: "If price > / < level" },
  { type: "condition", subtype: "indicator_check", label: "Indicator Check", icon: Activity, color: "#059669", desc: "RSI > 70, MACD crossover" },
  { type: "condition", subtype: "oi_check", label: "OI Check", icon: Layers, color: "#059669", desc: "Options OI change filter" },
  { type: "condition", subtype: "pnl_check", label: "P&L Check", icon: DollarSign, color: "#059669", desc: "If MTM P&L crosses threshold" },
  { type: "logic", subtype: "any", label: "ANY (OR)", icon: GitBranch, color: "#6366f1", desc: "If ANY condition is true" },
  { type: "logic", subtype: "all", label: "ALL (AND)", icon: GitBranch, color: "#6366f1", desc: "If ALL conditions are true" },
  { type: "action", subtype: "place_order", label: "Place Order", icon: ShoppingCart, color: "#2563eb", desc: "Buy/Sell equity or F&O" },
  { type: "action", subtype: "place_spread", label: "Place Spread", icon: Layers, color: "#2563eb", desc: "Bull/Bear call/put spread" },
  { type: "action", subtype: "alert", label: "Send Alert", icon: Bell, color: "#2563eb", desc: "Telegram / Email / Webhook" },
  { type: "action", subtype: "webhook", label: "Webhook", icon: Code, color: "#2563eb", desc: "Call external API" },
  { type: "action", subtype: "modify_order", label: "Modify Order", icon: Settings, color: "#2563eb", desc: "Modify SL / Target" },
  { type: "action", subtype: "square_off", label: "Square Off", icon: X, color: "#2563eb", desc: "Close position" },
  { type: "wait", subtype: "wait_time", label: "Wait Till", icon: Timer, color: "#d97706", desc: "Wait until specific time" },
  { type: "wait", subtype: "wait_duration", label: "Wait Duration", icon: Clock, color: "#d97706", desc: "Wait N minutes/seconds" },
  { type: "wait", subtype: "wait_candle", label: "Wait Candles", icon: BarChart3, color: "#d97706", desc: "Wait N candle closes" },
  { type: "stop", subtype: "stop", label: "Stop Automation", icon: Square, color: "#dc2626", desc: "Stop and square off all" },
  { type: "stop", subtype: "continue", label: "Continue", icon: ArrowRight, color: "#dc2626", desc: "Continue to next action" },
];

// ── Templates ──────────────────────────────────────────────────────────────

const CATEGORIES = ["All", "Mother Algo", "Breakout", "Theta Decay", "Alerts & Monitoring", "High Volatility", "Execution Algos", "Arbitrage", "Trend Following", "Reversal"] as const;

const TEMPLATES: Template[] = [
  {
    id: "m1", name: "Mother Algo — Full Pipeline", category: "Mother Algo",
    description: "Complete Mother Algo: 10 sister strategies scan markets → Monte Carlo ranks signals → Risk Manager gates → execute best trade via Fyers.",
    tags: ["Index F&O", "Intraday", "Multi-Strategy", "2Lac+"], complexity: "Advanced", updated: "28 Mar 2026",
    nodes: [
      { id: "n1", type: "trigger", subtype: "time", label: "Market Open 09:14 AM", x: 450, y: 30, config: { time: "09:14" }, outputs: ["n2"] },
      { id: "n2", type: "logic", subtype: "any", label: "ANY Sister Signal", x: 450, y: 140, config: {}, outputs: ["n3", "n4", "n5", "n6", "n7"] },
      { id: "n3", type: "condition", subtype: "range_breakout", label: "ORB Breakout (Sister 8)", x: 80, y: 270, config: { symbol: "NSE:NIFTY50-INDEX", direction: "Up/Down", rangeStart: "09:15", rangeEnd: "09:30" }, outputs: ["n8"] },
      { id: "n4", type: "condition", subtype: "price_check", label: "PDC/PDH Retest (Sister 3)", x: 320, y: 270, config: { symbol: "NSE:BANKNIFTY-INDEX", check: "Price at PDC/PDH level" }, outputs: ["n8"] },
      { id: "n5", type: "condition", subtype: "indicator_check", label: "Mean Rev Z>2 (Sister 1)", x: 560, y: 270, config: { indicator: "Z-Score", threshold: "2.0", rsi: "< 30 or > 70" }, outputs: ["n8"] },
      { id: "n6", type: "condition", subtype: "indicator_check", label: "Momentum ADX>25 (Sister 6)", x: 800, y: 270, config: { indicator: "ADX", threshold: "25", rsi: "> 60" }, outputs: ["n8"] },
      { id: "n7", type: "condition", subtype: "indicator_check", label: "ICT Liquidity Sweep (#9)", x: 1040, y: 270, config: { indicator: "Liquidity Sweep", check: "CHoCH + FVG entry" }, outputs: ["n8"] },
      { id: "n8", type: "logic", subtype: "all", label: "Monte Carlo 10K Sims", x: 450, y: 420, config: { simulations: "10000", minProbProfit: "60%", minScore: "0.55" }, outputs: ["n9"] },
      { id: "n9", type: "condition", subtype: "pnl_check", label: "Risk Manager Gate", x: 450, y: 540, config: { maxRisk: "2%", maxDailyLoss: "5%", maxDrawdown: "25%", sizing: "Half-Kelly" }, outputs: ["n10", "n11"] },
      { id: "n10", type: "action", subtype: "place_order", label: "Execute Best Trade", x: 300, y: 670, config: { broker: "Fyers", orderType: "LIMIT", smartExit: "Type 2" }, outputs: ["n12"] },
      { id: "n11", type: "action", subtype: "alert", label: "Alert: Trade Rejected", x: 600, y: 670, config: { channel: "Telegram", message: "Risk Manager rejected" }, outputs: [] },
      { id: "n12", type: "action", subtype: "modify_order", label: "Attach Smart Exit", x: 200, y: 790, config: { profitRate: "TP from signal", lossRate: "SL from signal", type: "Type 2 - Exit+Alert" }, outputs: ["n13"] },
      { id: "n13", type: "wait", subtype: "wait_time", label: "Wait till 03:15 PM", x: 450, y: 790, config: { time: "15:15" }, outputs: ["n14"] },
      { id: "n14", type: "stop", subtype: "stop", label: "Square Off All", x: 450, y: 900, config: {}, outputs: [] },
    ],
  },
  {
    id: "m2", name: "Mother Algo — ICT Power of Three", category: "Mother Algo",
    description: "ICT-specific workflow: Pre-market liquidity mapping → Asian accumulation → London manipulation sweep → NY distribution entry at OTE fib (62-79%).",
    tags: ["Index F&O", "Intraday", "Smart Money", "50k-2Lac"], complexity: "Advanced", updated: "28 Mar 2026",
    nodes: [
      { id: "n1", type: "trigger", subtype: "time", label: "Pre-Market 08:30 AM", x: 400, y: 30, config: { time: "08:30" }, outputs: ["n2"] },
      { id: "n2", type: "condition", subtype: "price_check", label: "Mark Liquidity Pools", x: 400, y: 150, config: { check: "Equal highs/lows, swing points", lookback: "20 bars" }, outputs: ["n3"] },
      { id: "n3", type: "wait", subtype: "wait_time", label: "Wait for Kill Zone", x: 400, y: 270, config: { time: "09:15" }, outputs: ["n4"] },
      { id: "n4", type: "condition", subtype: "price_check", label: "Liquidity Sweep Detected", x: 250, y: 390, config: { check: "Price sweeps above/below pool then reverses" }, outputs: ["n5"] },
      { id: "n5", type: "condition", subtype: "indicator_check", label: "CHoCH + FVG Formed", x: 250, y: 510, config: { check: "Change of Character on LTF + Fair Value Gap" }, outputs: ["n6"] },
      { id: "n6", type: "condition", subtype: "price_check", label: "OTE Entry Zone (62-79% Fib)", x: 250, y: 630, config: { fibLow: "0.618", fibHigh: "0.786", zone: "Order Block / FVG" }, outputs: ["n7"] },
      { id: "n7", type: "action", subtype: "place_order", label: "Enter at OB/FVG", x: 250, y: 750, config: { symbol: "NSE:BANKNIFTY-INDEX", sl: "Below sweep candle", tp: "Opposite liquidity pool" }, outputs: ["n9"] },
      { id: "n8", type: "wait", subtype: "wait_time", label: "Wait till 03:15 PM", x: 550, y: 510, config: { time: "15:15" }, outputs: ["n10"] },
      { id: "n9", type: "action", subtype: "modify_order", label: "Trail at 0.75x ATR", x: 250, y: 870, config: { trailATR: "0.75" }, outputs: ["n8"] },
      { id: "n10", type: "stop", subtype: "stop", label: "Square Off All", x: 550, y: 630, config: {}, outputs: [] },
    ],
  },
  {
    id: "m3", name: "Mother Algo — Triple-A Scalper", category: "Mother Algo",
    description: "Fabervaale Triple-A: Detects absorption (high vol + low range) → accumulation (consolidation) → aggression breakout entry. 2:1 R:R with ATR stops.",
    tags: ["Index F&O", "Scalping", "Order Flow", "10k-50k"], complexity: "Intermediate", updated: "28 Mar 2026",
    nodes: [
      { id: "n1", type: "trigger", subtype: "time", label: "Session Start 09:20 AM", x: 400, y: 30, config: { time: "09:20" }, outputs: ["n2"] },
      { id: "n2", type: "condition", subtype: "indicator_check", label: "Detect Absorption", x: 400, y: 150, config: { check: "Volume > 2x Avg AND Range < 0.3x ATR", indicator: "Volume + ATR" }, outputs: ["n3"] },
      { id: "n3", type: "wait", subtype: "wait_candle", label: "Wait 2-5 Candles", x: 400, y: 270, config: { candles: "2-5", check: "Range contraction" }, outputs: ["n4"] },
      { id: "n4", type: "condition", subtype: "indicator_check", label: "Accumulation Confirmed", x: 400, y: 390, config: { check: "Tight consolidation near absorption zone", volumeDecreasing: "true" }, outputs: ["n5"] },
      { id: "n5", type: "condition", subtype: "range_breakout", label: "Aggression Breakout", x: 400, y: 510, config: { check: "Breakout candle Vol > 1.5x avg", direction: "Beyond accumulation range" }, outputs: ["n6", "n7"] },
      { id: "n6", type: "action", subtype: "place_order", label: "Enter Long (Breakout Up)", x: 250, y: 640, config: { sl: "Below accumulation low", tp: "2x ATR", trail: "1.5x ATR" }, outputs: ["n8"] },
      { id: "n7", type: "action", subtype: "place_order", label: "Enter Short (Breakdown)", x: 550, y: 640, config: { sl: "Above accumulation high", tp: "2x ATR", trail: "1.5x ATR" }, outputs: ["n8"] },
      { id: "n8", type: "condition", subtype: "pnl_check", label: "3 Consecutive Losses?", x: 400, y: 770, config: { check: "Stop trading if 3 losses in row" }, outputs: ["n9"] },
      { id: "n9", type: "stop", subtype: "stop", label: "Stop & Review", x: 400, y: 880, config: {}, outputs: [] },
    ],
  },
  {
    id: "m4", name: "Mother Algo — MC Signal Scanner", category: "Mother Algo",
    description: "Continuous market scanner: All 10 sisters generate signals every candle → Monte Carlo ranks → top signal with score > 0.55 triggers alert/order.",
    tags: ["Multi-Market", "Continuous", "All Strategies"], complexity: "Advanced", updated: "28 Mar 2026",
    nodes: [
      { id: "n1", type: "trigger", subtype: "indicator", label: "Every New 5m Candle", x: 400, y: 30, config: { interval: "5m", markets: "NIFTY, BANKNIFTY, BTC, GOLD" }, outputs: ["n2"] },
      { id: "n2", type: "logic", subtype: "any", label: "Run All 10 Sisters", x: 400, y: 150, config: { sisters: "MeanRev, MACross, PDC, 1HrHL, VolProf, Mom, VWAP, ORB, ICT, TripleA" }, outputs: ["n3"] },
      { id: "n3", type: "condition", subtype: "indicator_check", label: "Signals Generated?", x: 400, y: 270, config: { check: "Any sister produced a valid signal" }, outputs: ["n4", "n7"] },
      { id: "n4", type: "logic", subtype: "all", label: "MC Rank (10K sims each)", x: 400, y: 390, config: { simulations: "10000" }, outputs: ["n5"] },
      { id: "n5", type: "condition", subtype: "pnl_check", label: "Score > 0.55 & P(profit) > 60%", x: 400, y: 510, config: { minScore: "0.55", minProb: "60%" }, outputs: ["n6", "n7"] },
      { id: "n6", type: "action", subtype: "alert", label: "Alert: Top Signal Found", x: 250, y: 640, config: { channel: "Telegram + Dashboard", details: "Strategy, market, entry, SL, TP, MC score" }, outputs: ["n8"] },
      { id: "n7", type: "wait", subtype: "wait_candle", label: "Wait Next Candle", x: 600, y: 510, config: { candles: "1" }, outputs: ["n1"] },
      { id: "n8", type: "action", subtype: "place_order", label: "Auto-Execute (if enabled)", x: 250, y: 770, config: { autoTrade: "configurable", sizing: "Half-Kelly" }, outputs: [] },
    ],
  },
  {
    id: "t1", name: "Opening Range Breakout Spread", category: "Breakout",
    description: "Deploys a bull call or bear put spread on opening range breakout with ±₹3,000 P&L and 3:25 PM square-off.",
    tags: ["Index F&O", "Intraday", "Hedged", "10k-50k"], complexity: "Basic", updated: "16 Mar 2026",
    nodes: [
      { id: "n1", type: "trigger", subtype: "time", label: "Daily at 09:14 AM", x: 400, y: 40, config: { time: "09:14" }, outputs: ["n2"] },
      { id: "n2", type: "logic", subtype: "any", label: "ANY", x: 400, y: 150, config: {}, outputs: ["n3", "n4"] },
      { id: "n3", type: "condition", subtype: "range_breakout", label: "Range Breakout Up", x: 250, y: 260, config: { symbol: "NSE:NIFTY50-INDEX", direction: "Up", rangeStart: "09:15", rangeEnd: "09:30" }, outputs: ["n5"] },
      { id: "n4", type: "condition", subtype: "range_breakout", label: "Range Breakout Down", x: 550, y: 260, config: { symbol: "NSE:NIFTY50-INDEX", direction: "Down", rangeStart: "09:15", rangeEnd: "09:30" }, outputs: ["n6"] },
      { id: "n5", type: "action", subtype: "place_order", label: "Buy ATM CE", x: 200, y: 400, config: { symbol: "NSE:NIFTY50-INDEX", strike: "ATM", optionType: "CE", qty: 1, side: "BUY" }, outputs: ["n7"] },
      { id: "n6", type: "action", subtype: "place_order", label: "Buy ATM PE", x: 600, y: 400, config: { symbol: "NSE:NIFTY50-INDEX", strike: "ATM", optionType: "PE", qty: 1, side: "BUY" }, outputs: ["n8"] },
      { id: "n7", type: "action", subtype: "place_order", label: "Sell OTM4 CE", x: 200, y: 530, config: { symbol: "Dynamic", strike: "OTM4", optionType: "CE", qty: 1, side: "SELL" }, outputs: ["n9"] },
      { id: "n8", type: "action", subtype: "place_order", label: "Sell OTM4 PE", x: 600, y: 530, config: { symbol: "Dynamic", strike: "OTM4", optionType: "PE", qty: 1, side: "SELL" }, outputs: ["n9"] },
      { id: "n9", type: "wait", subtype: "wait_time", label: "Wait till 03:25 PM", x: 700, y: 260, config: { time: "15:25" }, outputs: ["n10"] },
      { id: "n10", type: "stop", subtype: "stop", label: "Stop & Square Off", x: 700, y: 380, config: {}, outputs: [] },
    ],
  },
  {
    id: "t2", name: "Opening Range High Breakout Call Ratio Spread", category: "Breakout",
    description: "Deploys a call ratio spread on Nifty when the 9:15–9:30 AM range breaks upwards, with P&L and 3:25 PM square-off control.",
    tags: ["Index F&O", "Intraday", "Hedged", "10k-50k"], complexity: "Basic", updated: "16 Mar 2026",
    nodes: [],
  },
  {
    id: "t3", name: "Opening Range Low Breakout Put Ratio Spread", category: "Breakout",
    description: "Deploys a put ratio spread on Nifty when the 9:15–9:30 AM opening range low is broken.",
    tags: ["Index F&O", "Intraday", "Hedged", "2Lac+"], complexity: "Basic", updated: "16 Mar 2026",
    nodes: [],
  },
  {
    id: "t4", name: "Rolling 1-Hour Range Break Directional Spread", category: "Breakout",
    description: "Deploys a bull call or bear put spread based on rolling 1-hour range breakout, with ±₹3,000 P&L and 3:25 PM stop control.",
    tags: ["Intraday", "Hedged", "2Lac+", "Index F&O"], complexity: "Basic", updated: "05 Mar 2026",
    nodes: [],
  },
  {
    id: "t5", name: "Price + Volume Confirmed Breakout Spread", category: "Breakout",
    description: "Deploys a bull call or bear put spread on confirmed price and volume breakout, with ±₹3,000 P&L and time-based stop.",
    tags: ["Commodity F&O", "Intraday", "Hedged", "Index F&O"], complexity: "Basic", updated: "28 Feb 2026",
    nodes: [],
  },
  {
    id: "t6", name: "52-Week High Breakout With 5-Day Cooldown", category: "Breakout",
    description: "Buys the equity when price trades at or above its 52-week high, with a 5-day re-entry cooldown.",
    tags: ["Equity", "Overnight", "0-10k", "Bullish"], complexity: "Basic", updated: "28 Feb 2026",
    nodes: [],
  },
  {
    id: "t7", name: "Iron Condor Weekly Theta", category: "Theta Decay",
    description: "Sells OTM CE + PE spreads on NIFTY weekly expiry. Targets theta decay with max ±₹2,000 SL per leg.",
    tags: ["Index F&O", "Intraday", "Hedged", "50k-2Lac"], complexity: "Intermediate", updated: "10 Mar 2026",
    nodes: [],
  },
  {
    id: "t8", name: "Short Straddle With Adjustment", category: "Theta Decay",
    description: "Sells ATM straddle at market open with delta-based adjustment triggers and time-based exit at 3:20 PM.",
    tags: ["Index F&O", "Intraday", "Hedged", "2Lac+"], complexity: "Advanced", updated: "12 Mar 2026",
    nodes: [],
  },
  {
    id: "t9", name: "NIFTY 9:20 AM Straddle Sell", category: "Theta Decay",
    description: "Sells ATM straddle at 9:20 AM, SL at 25% premium increase per leg. Square off at 3:15 PM.",
    tags: ["Index F&O", "Intraday", "Hedged", "50k-2Lac"], complexity: "Basic", updated: "08 Mar 2026",
    nodes: [],
  },
  {
    id: "t10", name: "VIX Spike Alert", category: "Alerts & Monitoring",
    description: "Sends Telegram alert when India VIX crosses 18 or drops below 12. Monitors every 5 minutes.",
    tags: ["Alert", "Monitoring", "No Capital"], complexity: "Basic", updated: "15 Mar 2026",
    nodes: [],
  },
  {
    id: "t11", name: "FII Flow Alert", category: "Alerts & Monitoring",
    description: "Monitors FII daily cash market data and alerts if net selling exceeds ₹3,000 Cr in a session.",
    tags: ["Alert", "Macro", "No Capital"], complexity: "Basic", updated: "14 Mar 2026",
    nodes: [],
  },
  {
    id: "t12", name: "OI Buildup Scanner", category: "Alerts & Monitoring",
    description: "Scans NIFTY options chain every 3 minutes for significant OI changes (>10% in single strike). Sends alert with strike details.",
    tags: ["Alert", "Options", "No Capital"], complexity: "Intermediate", updated: "12 Mar 2026",
    nodes: [],
  },
  {
    id: "t13", name: "Long Straddle on VIX Expansion", category: "High Volatility",
    description: "Buys ATM straddle when VIX rises 15%+ intraday. Exits at 2x premium or 3:20 PM.",
    tags: ["Index F&O", "Intraday", "Bullish Vol", "50k-2Lac"], complexity: "Intermediate", updated: "10 Mar 2026",
    nodes: [],
  },
  {
    id: "t14", name: "TWAP Execution 10-Min Slices", category: "Execution Algos",
    description: "Splits large order into 10-minute TWAP slices to minimize market impact. Supports equity and F&O.",
    tags: ["Execution", "Equity", "F&O", "10k-50k"], complexity: "Intermediate", updated: "05 Mar 2026",
    nodes: [],
  },
  {
    id: "t15", name: "52-Week Low Reversal With Confirmation", category: "Reversal",
    description: "Buys equity when price bounces from 52-week low with volume confirmation and RSI > 30 filter.",
    tags: ["Equity", "Overnight", "0-10k", "Bullish"], complexity: "Basic", updated: "28 Feb 2026",
    nodes: [],
  },
  {
    id: "t16", name: "EMA Crossover Trend Follower", category: "Trend Following",
    description: "Buys on 9/21 EMA bullish crossover, sells on bearish crossover. Intraday with SL at swing low.",
    tags: ["Equity", "Intraday", "Bullish", "0-10k"], complexity: "Basic", updated: "01 Mar 2026",
    nodes: [],
  },
  {
    id: "t17", name: "Cash-Futures Arbitrage", category: "Arbitrage",
    description: "Monitors cash-futures premium and triggers buy cash + sell future when premium exceeds 0.5%. Exits on convergence.",
    tags: ["Index F&O", "Overnight", "Hedged", "2Lac+"], complexity: "Advanced", updated: "25 Feb 2026",
    nodes: [],
  },
  {
    id: "t18", name: "Day High Breakout 5-Min Confirmation", category: "Breakout",
    description: "Triggers an intraday buy when price trades above day high and confirms breakout of the previous 5-minute range.",
    tags: ["Equity", "0-10k", "Intraday", "Bullish"], complexity: "Basic", updated: "28 Feb 2026",
    nodes: [],
  },
];

// ── Node colors ────────────────────────────────────────────────────────────

const NODE_COLORS: Record<NodeType, { bg: string; border: string; text: string; icon: string; dot: string }> = {
  trigger: { bg: "bg-purple-500/15", border: "border-purple-500/40", text: "text-purple-300", icon: "text-purple-400", dot: "bg-purple-400" },
  condition: { bg: "bg-emerald-500/15", border: "border-emerald-500/40", text: "text-emerald-300", icon: "text-emerald-400", dot: "bg-emerald-400" },
  action: { bg: "bg-blue-500/15", border: "border-blue-500/40", text: "text-blue-300", icon: "text-blue-400", dot: "bg-blue-400" },
  logic: { bg: "bg-indigo-500/15", border: "border-indigo-500/40", text: "text-indigo-300", icon: "text-indigo-400", dot: "bg-indigo-400" },
  wait: { bg: "bg-amber-500/15", border: "border-amber-500/40", text: "text-amber-300", icon: "text-amber-400", dot: "bg-amber-400" },
  stop: { bg: "bg-red-500/15", border: "border-red-500/40", text: "text-red-300", icon: "text-red-400", dot: "bg-red-400" },
};

function getNodeIcon(subtype: string) {
  return NODE_PALETTE.find(p => p.subtype === subtype)?.icon || Zap;
}

let _idCounter = 100;
function genId() { return `n${_idCounter++}`; }

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────

export default function WorkflowBuilderPanel() {
  const [view, setView] = useState<"canvas" | "explore">("explore");
  const [workflow, setWorkflow] = useState<Workflow>({
    id: "wf1", name: "Untitled Workflow", description: "", nodes: [], status: "draft", createdAt: new Date().toISOString(), tags: [], complexity: "Basic",
  });
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ nodeId: string; offX: number; offY: number } | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [category, setCategory] = useState<typeof CATEGORIES[number]>("All");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  // ── Dhan integration state ──
  const [dhanConnected, setDhanConnected] = useState(false);
  const [dhanClientId, setDhanClientId] = useState("");
  const [dhanModal, setDhanModal] = useState(false);
  const [dhanTokenInput, setDhanTokenInput] = useState("");
  const [dhanClientInput, setDhanClientInput] = useState("");
  const [dhanConnecting, setDhanConnecting] = useState(false);
  const [dhanError, setDhanError] = useState("");
  const [executionLog, setExecutionLog] = useState<{ nodeId: string; status: "running" | "done" | "error"; message: string }[]>([]);
  const [deploying, setDeploying] = useState(false);

  // Check Dhan connection on mount
  useEffect(() => {
    fetch("/api/dhan?action=status").then(r => r.json()).then(d => {
      setDhanConnected(d.connected);
      if (d.clientId) setDhanClientId(d.clientId);
    }).catch(() => {});
  }, []);

  const connectDhan = async () => {
    setDhanConnecting(true);
    setDhanError("");
    try {
      const res = await fetch("/api/dhan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set-token", accessToken: dhanTokenInput, clientId: dhanClientInput }),
      });
      const data = await res.json();
      if (data.connected) {
        setDhanConnected(true);
        setDhanClientId(dhanClientInput);
        setDhanModal(false);
        setDhanTokenInput("");
        setDhanClientInput("");
      } else {
        setDhanError(data.error || "Connection failed");
      }
    } catch (e) { setDhanError(String(e)); }
    setDhanConnecting(false);
  };

  const disconnectDhan = async () => {
    await fetch("/api/dhan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "disconnect" }) });
    setDhanConnected(false);
    setDhanClientId("");
  };

  // ── Workflow execution via Dhan ──
  const deployWorkflow = async () => {
    if (!dhanConnected) { setDhanModal(true); return; }
    if (workflow.nodes.length === 0) return;

    setDeploying(true);
    setWorkflow(w => ({ ...w, status: "active" }));
    setExecutionLog([]);

    // Walk nodes from trigger → children
    const nodeMap = new Map(workflow.nodes.map(n => [n.id, n]));
    const triggers = workflow.nodes.filter(n => n.type === "trigger");
    if (triggers.length === 0) { setDeploying(false); return; }

    const executeNode = async (nodeId: string) => {
      const node = nodeMap.get(nodeId);
      if (!node) return;

      setExecutionLog(prev => [...prev, { nodeId, status: "running", message: `Executing ${node.label}...` }]);

      try {
        if (node.type === "action" && (node.subtype === "place_order" || node.subtype === "place_spread")) {
          // Use Super Order if SL/TP are configured, otherwise regular order
          const hasSLTP = node.config.sl || node.config.target;
          const action = hasSLTP ? "place-super-order" : "place-order";

          const orderBody: Record<string, unknown> = {
            action,
            transactionType: node.config.side || "BUY",
            exchangeSegment: node.config.segment?.toString().includes("Equity") ? "NSE_EQ" : "NSE_FNO",
            productType: hasSLTP ? "CNC" : "INTRADAY",
            orderType: node.config.orderType === "MARKET" ? "MARKET" : "LIMIT",
            securityId: node.config.securityId || node.config.symbol || "",
            quantity: node.config.qty || 15,
            price: node.config.price || 0,
            correlationId: `wf_${workflow.id}_${node.id}`,
          };

          // Super Order fields
          if (hasSLTP) {
            if (node.config.target) orderBody.targetPrice = Number(node.config.target);
            if (node.config.sl) orderBody.stopLossPrice = Number(node.config.sl);
            if (node.config.trailingJump) orderBody.trailingJump = Number(node.config.trailingJump);
          }

          const res = await fetch("/api/dhan", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(orderBody),
          });
          const data = await res.json();
          const orderType = hasSLTP ? "Super Order" : "Order";
          setExecutionLog(prev => prev.map(l => l.nodeId === nodeId ? { ...l, status: data.success ? "done" : "error", message: data.success ? `${orderType} placed: ${data.orderId || "OK"}` : `Failed: ${data.error || JSON.stringify(data)}` } : l));
        } else if (node.type === "stop" && node.subtype === "stop") {
          const res = await fetch("/api/dhan", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "square-off-all" }),
          });
          const data = await res.json();
          setExecutionLog(prev => prev.map(l => l.nodeId === nodeId ? { ...l, status: "done", message: data.message || "Squared off" } : l));
        } else {
          // For triggers, conditions, logic, wait — just mark as done (visual only)
          setExecutionLog(prev => prev.map(l => l.nodeId === nodeId ? { ...l, status: "done", message: `${node.type}: ${node.label} ✓` } : l));
        }
      } catch (e) {
        setExecutionLog(prev => prev.map(l => l.nodeId === nodeId ? { ...l, status: "error", message: String(e) } : l));
      }

      // Execute children
      for (const childId of node.outputs) {
        await new Promise(r => setTimeout(r, 500)); // Visual delay between nodes
        await executeNode(childId);
      }
    };

    // Start from all trigger nodes
    for (const trigger of triggers) {
      await executeNode(trigger.id);
    }

    setDeploying(false);
  };

  // ── Drag handlers ──
  const handleMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    const node = workflow.nodes.find(n => n.id === nodeId);
    if (!node) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDragging({ nodeId, offX: e.clientX - rect.left - node.x, offY: e.clientY - rect.top - node.y });
    setSelectedNode(nodeId);
  }, [workflow.nodes]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(0, e.clientX - rect.left - dragging.offX);
    const y = Math.max(0, e.clientY - rect.top - dragging.offY);
    setWorkflow(prev => ({
      ...prev,
      nodes: prev.nodes.map(n => n.id === dragging.nodeId ? { ...n, x, y } : n),
    }));
  }, [dragging]);

  const handleMouseUp = useCallback(() => { setDragging(null); }, []);

  // ── Node operations ──
  const addNode = (paletteItem: typeof NODE_PALETTE[0]) => {
    const id = genId();
    const newNode: WorkflowNode = {
      id, type: paletteItem.type, subtype: paletteItem.subtype,
      label: paletteItem.label, x: 300 + Math.random() * 200, y: 100 + workflow.nodes.length * 80,
      config: getDefaultConfig(paletteItem.subtype), outputs: [],
    };
    setWorkflow(prev => ({ ...prev, nodes: [...prev.nodes, newNode] }));
    setSelectedNode(id);
    setPaletteOpen(false);
    setConfigOpen(true);
  };

  const deleteNode = (nodeId: string) => {
    setWorkflow(prev => ({
      ...prev,
      nodes: prev.nodes.filter(n => n.id !== nodeId).map(n => ({
        ...n, outputs: n.outputs.filter(o => o !== nodeId),
      })),
    }));
    if (selectedNode === nodeId) { setSelectedNode(null); setConfigOpen(false); }
  };

  const connectNodes = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    setWorkflow(prev => ({
      ...prev,
      nodes: prev.nodes.map(n =>
        n.id === fromId && !n.outputs.includes(toId) ? { ...n, outputs: [...n.outputs, toId] } : n
      ),
    }));
  };

  const loadTemplate = (template: Template) => {
    setWorkflow({
      id: genId(), name: template.name, description: template.description,
      nodes: template.nodes.length > 0 ? JSON.parse(JSON.stringify(template.nodes)) : [],
      status: "draft", createdAt: new Date().toISOString(), tags: template.tags, complexity: template.complexity,
    });
    setView("canvas");
  };

  const updateNodeConfig = (nodeId: string, key: string, value: string | number | boolean) => {
    setWorkflow(prev => ({
      ...prev,
      nodes: prev.nodes.map(n => n.id === nodeId ? { ...n, config: { ...n.config, [key]: value } } : n),
    }));
  };

  const updateNodeLabel = (nodeId: string, label: string) => {
    setWorkflow(prev => ({
      ...prev,
      nodes: prev.nodes.map(n => n.id === nodeId ? { ...n, label } : n),
    }));
  };

  const selectedNodeData = workflow.nodes.find(n => n.id === selectedNode);

  // ── Template counts ──
  const catCounts: Record<string, number> = { All: TEMPLATES.length };
  for (const t of TEMPLATES) catCounts[t.category] = (catCounts[t.category] || 0) + 1;

  const filteredTemplates = category === "All" ? TEMPLATES : TEMPLATES.filter(t => t.category === category);

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div className="bg-[#333333] rounded-xl border border-[#3a3a3a] flex flex-col h-full overflow-hidden">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#3a3a3a] flex-shrink-0">
        <div className="flex items-center gap-3">
          <Zap className="w-4 h-4 text-orange-400" />
          <h2 className="text-[12px] font-black text-white tracking-wide">WORKFLOW AUTOMATION</h2>
          <div className="flex items-center gap-0 ml-2">
            {(["explore", "canvas"] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`text-[9px] px-3 py-1 font-bold border border-[#3a3a3a] first:rounded-l last:rounded-r transition ${view === v ? "bg-orange-500/20 text-orange-400 border-orange-500/40" : "text-slate-500 hover:text-slate-300"}`}>
                {v === "explore" ? "Explore" : "Canvas"}
              </button>
            ))}
          </div>
          {view === "canvas" && (
            <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold ml-2 ${
              workflow.status === "active" ? "bg-green-500/15 text-green-400" :
              workflow.status === "paused" ? "bg-amber-500/15 text-amber-400" :
              workflow.status === "draft" ? "bg-slate-500/15 text-slate-400" :
              "bg-red-500/15 text-red-400"
            }`}>{workflow.status.toUpperCase()}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {view === "canvas" && (
            <>
              <button className="text-[9px] px-2.5 py-1 rounded bg-[#333333] text-slate-400 hover:text-white font-semibold flex items-center gap-1 transition" onClick={() => setPaletteOpen(!paletteOpen)}>
                <Plus className="w-3 h-3" /> Add Node
              </button>
              <button className="text-[9px] px-2.5 py-1 rounded bg-[#333333] text-slate-400 hover:text-white font-semibold flex items-center gap-1 transition">
                <Save className="w-3 h-3" /> Save
              </button>
              {/* Dhan connection indicator */}
              <div className={`text-[8px] px-2 py-1 rounded flex items-center gap-1 ${dhanConnected ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${dhanConnected ? "bg-green-400" : "bg-red-400"}`} />
                {dhanConnected ? `Dhan: ${dhanClientId}` : "Dhan: Off"}
              </div>
              {dhanConnected ? (
                <button onClick={() => disconnectDhan()} className="text-[8px] px-1.5 py-0.5 rounded text-slate-500 hover:text-red-400 transition">×</button>
              ) : (
                <button onClick={() => setDhanModal(true)} className="text-[8px] px-2 py-1 rounded bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 font-semibold transition">
                  Connect Dhan
                </button>
              )}
              {workflow.status === "draft" || workflow.status === "paused" ? (
                <button onClick={deployWorkflow} disabled={deploying}
                  className={`text-[9px] px-2.5 py-1 rounded font-bold flex items-center gap-1 transition ${deploying ? "bg-amber-500/20 text-amber-400 animate-pulse" : "bg-green-500/20 text-green-400 hover:bg-green-500/30"}`}>
                  {deploying ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                  {deploying ? "Deploying..." : dhanConnected ? "Deploy to Dhan" : "Deploy"}
                </button>
              ) : (
                <button onClick={() => { setWorkflow(w => ({ ...w, status: "paused" })); setDeploying(false); }}
                  className="text-[9px] px-2.5 py-1 rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 font-bold flex items-center gap-1 transition">
                  <Pause className="w-3 h-3" /> Pause
                </button>
              )}
            </>
          )}
          {view === "explore" && (
            <button onClick={() => { setWorkflow({ id: genId(), name: "Untitled Workflow", description: "", nodes: [], status: "draft", createdAt: new Date().toISOString(), tags: [], complexity: "Basic" }); setView("canvas"); }}
              className="text-[9px] px-3 py-1.5 rounded bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 font-bold flex items-center gap-1.5 transition">
              <Plus className="w-3 h-3" /> Create Automation
            </button>
          )}
        </div>
      </div>

      {/* ══ EXPLORE VIEW ══ */}
      {view === "explore" && (
        <div className="flex-1 min-h-0 overflow-auto">
          {/* Category tabs */}
          <div className="flex items-center gap-1 px-4 py-2 border-b border-[#3a3a3a] flex-wrap">
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setCategory(c)}
                className={`text-[9px] px-2.5 py-1 rounded font-semibold transition ${category === c ? "bg-orange-500/20 text-orange-400" : "text-slate-500 hover:text-slate-300"}`}>
                {c} ({catCounts[c] || 0})
              </button>
            ))}
          </div>

          {/* Template grid */}
          <div className="grid grid-cols-3 gap-3 p-4">
            {filteredTemplates.map(t => (
              <button key={t.id} onClick={() => loadTemplate(t)} className="text-left bg-[#262626] rounded-xl border border-[#3a3a3a] p-4 hover:border-orange-500/40 hover:bg-[#2e2e2e] transition group">
                <h3 className="text-[11px] font-bold text-white mb-1 group-hover:text-orange-300 transition leading-snug">{t.name}</h3>
                <p className="text-[9px] text-slate-500 mb-3 leading-relaxed line-clamp-2">{t.description}</p>
                <div className="flex flex-wrap gap-1 mb-3">
                  {t.tags.map(tag => (
                    <span key={tag} className="text-[7px] px-1.5 py-0.5 rounded bg-[#333333] text-slate-400 font-medium">{tag}</span>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-[8px] text-slate-600">
                    <span className="text-slate-500">Complexity</span>{" "}
                    <span className={`font-bold ${t.complexity === "Basic" ? "text-green-400" : t.complexity === "Intermediate" ? "text-amber-400" : "text-red-400"}`}>{t.complexity}</span>
                  </div>
                  <div className="text-[8px] text-slate-600">Updated <span className="text-slate-400">{t.updated}</span></div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ══ CANVAS VIEW ══ */}
      {view === "canvas" && (
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* ── Node palette drawer ── */}
          {paletteOpen && (
            <div className="w-56 border-r border-[#3a3a3a] bg-[#333333] overflow-y-auto flex-shrink-0">
              <div className="px-3 py-2 border-b border-[#3a3a3a] flex items-center justify-between">
                <span className="text-[10px] font-bold text-white">Node Palette</span>
                <button onClick={() => setPaletteOpen(false)} className="text-slate-500 hover:text-white"><X className="w-3 h-3" /></button>
              </div>
              {(["trigger", "condition", "logic", "action", "wait", "stop"] as NodeType[]).map(type => (
                <div key={type} className="border-b border-[#3a3a3a]/50">
                  <div className="px-3 py-1.5 text-[8px] font-bold uppercase tracking-wider text-slate-600">{type}s</div>
                  {NODE_PALETTE.filter(p => p.type === type).map(p => {
                    const Icon = p.icon;
                    const colors = NODE_COLORS[p.type];
                    return (
                      <button key={p.subtype} onClick={() => addNode(p)}
                        className={`w-full px-3 py-2 flex items-center gap-2 hover:bg-[#2e2e2e] transition text-left`}>
                        <div className={`w-6 h-6 rounded-md ${colors.bg} ${colors.border} border flex items-center justify-center`}>
                          <Icon className={`w-3 h-3 ${colors.icon}`} />
                        </div>
                        <div>
                          <div className="text-[9px] font-semibold text-white">{p.label}</div>
                          <div className="text-[7px] text-slate-600">{p.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {/* ── Canvas ── */}
          <div className="flex-1 min-w-0 relative overflow-auto bg-[#0a0f1a]"
            ref={canvasRef} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}
            onClick={() => { setSelectedNode(null); setConnecting(null); }}>

            {/* Grid background */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ minWidth: 1200, minHeight: 800 }}>
              <defs>
                <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
                  <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#222222" strokeWidth="0.3" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />

              {/* Connection lines */}
              {workflow.nodes.map(node =>
                node.outputs.map(outId => {
                  const target = workflow.nodes.find(n => n.id === outId);
                  if (!target) return null;
                  const x1 = node.x + 100;
                  const y1 = node.y + 50;
                  const x2 = target.x + 100;
                  const y2 = target.y;
                  const midY = (y1 + y2) / 2;
                  return (
                    <g key={`${node.id}-${outId}`}>
                      <path
                        d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                        fill="none" stroke="#334155" strokeWidth="2" strokeDasharray="6,3"
                      />
                      {/* Arrowhead */}
                      <circle cx={x2} cy={y2} r="3" fill="#334155" />
                    </g>
                  );
                })
              )}
            </svg>

            {/* Nodes */}
            <div className="relative" style={{ minWidth: 1200, minHeight: 800 }}>
              {workflow.nodes.map(node => {
                const colors = NODE_COLORS[node.type];
                const Icon = getNodeIcon(node.subtype);
                const isSelected = selectedNode === node.id;
                return (
                  <div key={node.id}
                    className={`absolute cursor-move select-none group ${isSelected ? "z-20" : "z-10"}`}
                    style={{ left: node.x, top: node.y, width: 200 }}
                    onMouseDown={(e) => handleMouseDown(e, node.id)}
                    onClick={(e) => { e.stopPropagation(); setSelectedNode(node.id); setConfigOpen(true); }}>

                    <div className={`rounded-lg border-2 ${colors.bg} ${isSelected ? "border-white/40 shadow-lg shadow-white/5" : colors.border} transition overflow-hidden`}>
                      {/* Node header */}
                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-white/5">
                        <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                        <span className={`text-[8px] font-bold uppercase tracking-wider ${colors.text}`}>{node.type}</span>
                        {node.subtype && <span className="text-[7px] text-slate-600">#{node.subtype}</span>}
                      </div>
                      {/* Node body */}
                      <div className="px-2.5 py-2">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Icon className={`w-3.5 h-3.5 ${colors.icon}`} />
                          <span className="text-[10px] font-bold text-white">{node.label}</span>
                        </div>
                        {/* Config preview */}
                        <div className="space-y-0.5">
                          {Object.entries(node.config).slice(0, 3).map(([k, v]) => (
                            <div key={k} className="text-[8px] text-slate-500">
                              <span className="text-slate-600">{k}:</span> <span className="text-slate-400">{String(v)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Output dots */}
                      <div className="flex items-center justify-center gap-1.5 py-1 border-t border-white/5">
                        <button onClick={(e) => { e.stopPropagation(); setConnecting(connecting === node.id ? null : node.id); }}
                          className={`w-2.5 h-2.5 rounded-full border transition ${connecting === node.id ? "bg-green-400 border-green-300 scale-125" : "bg-blue-500 border-blue-400 hover:scale-110"}`}
                          title="Click to connect, then click target node" />
                        {node.outputs.length > 0 && (
                          <span className="text-[7px] text-green-400 font-semibold">{node.outputs.length} connected</span>
                        )}
                      </div>
                    </div>

                    {/* Delete button on hover */}
                    <button onClick={(e) => { e.stopPropagation(); deleteNode(node.id); }}
                      className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500/80 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition hover:bg-red-400">
                      <X className="w-2.5 h-2.5" />
                    </button>

                    {/* Connect target zone */}
                    {connecting && connecting !== node.id && (
                      <button onClick={(e) => { e.stopPropagation(); connectNodes(connecting, node.id); setConnecting(null); }}
                        className="absolute inset-0 rounded-lg border-2 border-dashed border-green-400/60 bg-green-400/5 z-30 flex items-center justify-center">
                        <span className="text-[9px] text-green-400 font-bold">Connect Here</span>
                      </button>
                    )}
                  </div>
                );
              })}

              {/* Empty state */}
              {workflow.nodes.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <Zap className="w-8 h-8 text-slate-700 mb-3" />
                  <p className="text-[12px] text-slate-600 font-semibold mb-1">Empty Canvas</p>
                  <p className="text-[10px] text-slate-700 mb-4">Add nodes from the palette or load a template</p>
                  <div className="flex gap-2">
                    <button onClick={() => setPaletteOpen(true)}
                      className="text-[9px] px-3 py-1.5 rounded bg-orange-500/20 text-orange-400 font-bold flex items-center gap-1 hover:bg-orange-500/30 transition">
                      <Plus className="w-3 h-3" /> Add Node
                    </button>
                    <button onClick={() => setView("explore")}
                      className="text-[9px] px-3 py-1.5 rounded bg-[#333333] text-slate-400 font-bold flex items-center gap-1 hover:text-white transition">
                      <Search className="w-3 h-3" /> Browse Templates
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Config panel ── */}
          {configOpen && selectedNodeData && (
            <div className="w-72 border-l border-[#3a3a3a] bg-[#333333] overflow-y-auto flex-shrink-0">
              <div className="px-3 py-2 border-b border-[#3a3a3a] flex items-center justify-between">
                <span className="text-[10px] font-bold text-white">Node Config</span>
                <button onClick={() => setConfigOpen(false)} className="text-slate-500 hover:text-white"><X className="w-3 h-3" /></button>
              </div>

              <div className="p-3 space-y-3">
                {/* Node type badge */}
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${NODE_COLORS[selectedNodeData.type].dot}`} />
                  <span className={`text-[9px] font-bold uppercase ${NODE_COLORS[selectedNodeData.type].text}`}>{selectedNodeData.type}</span>
                  <span className="text-[8px] text-slate-600">#{selectedNodeData.subtype}</span>
                </div>

                {/* Label */}
                <div>
                  <label className="text-[8px] text-slate-600 font-semibold uppercase tracking-wider">Label</label>
                  <input value={selectedNodeData.label} onChange={(e) => updateNodeLabel(selectedNodeData.id, e.target.value)}
                    className="w-full mt-1 px-2 py-1.5 rounded bg-[#2e2e2e] border border-[#3a3a3a] text-[10px] text-white focus:border-orange-500/40 outline-none" />
                </div>

                {/* Dynamic config fields */}
                {selectedNodeData.type === "trigger" && selectedNodeData.subtype === "time" && (
                  <>
                    <ConfigField label="Trigger Time" value={selectedNodeData.config.time} onChange={(v) => updateNodeConfig(selectedNodeData.id, "time", v)} placeholder="09:14" />
                    <ConfigSelect label="Frequency" value={selectedNodeData.config.frequency} options={["Daily", "Weekdays Only", "Mon/Wed/Fri", "Once"]} onChange={(v) => updateNodeConfig(selectedNodeData.id, "frequency", v)} />
                  </>
                )}
                {selectedNodeData.type === "trigger" && selectedNodeData.subtype === "price" && (
                  <>
                    <ConfigField label="Symbol" value={selectedNodeData.config.symbol} onChange={(v) => updateNodeConfig(selectedNodeData.id, "symbol", v)} placeholder="NSE:NIFTY50-INDEX" />
                    <ConfigSelect label="Condition" value={selectedNodeData.config.condition} options={["Crosses Above", "Crosses Below", "Equals"]} onChange={(v) => updateNodeConfig(selectedNodeData.id, "condition", v)} />
                    <ConfigField label="Price Level" value={selectedNodeData.config.priceLevel} onChange={(v) => updateNodeConfig(selectedNodeData.id, "priceLevel", v)} placeholder="24500" />
                  </>
                )}
                {selectedNodeData.type === "trigger" && selectedNodeData.subtype === "indicator" && (
                  <>
                    <ConfigField label="Symbol" value={selectedNodeData.config.symbol} onChange={(v) => updateNodeConfig(selectedNodeData.id, "symbol", v)} placeholder="NSE:NIFTY50-INDEX" />
                    <ConfigSelect label="Indicator" value={selectedNodeData.config.indicator} options={["RSI", "MACD", "EMA Crossover", "Bollinger Band", "SuperTrend", "VWAP"]} onChange={(v) => updateNodeConfig(selectedNodeData.id, "indicator", v)} />
                    <ConfigField label="Timeframe" value={selectedNodeData.config.timeframe} onChange={(v) => updateNodeConfig(selectedNodeData.id, "timeframe", v)} placeholder="5m" />
                    <ConfigField label="Threshold" value={selectedNodeData.config.threshold} onChange={(v) => updateNodeConfig(selectedNodeData.id, "threshold", v)} placeholder="70" />
                  </>
                )}
                {selectedNodeData.type === "condition" && selectedNodeData.subtype === "range_breakout" && (
                  <>
                    <ConfigField label="Symbol" value={selectedNodeData.config.symbol} onChange={(v) => updateNodeConfig(selectedNodeData.id, "symbol", v)} placeholder="NSE:NIFTY50-INDEX" />
                    <ConfigSelect label="Direction" value={selectedNodeData.config.direction} options={["Up", "Down"]} onChange={(v) => updateNodeConfig(selectedNodeData.id, "direction", v)} />
                    <ConfigField label="Range Start" value={selectedNodeData.config.rangeStart} onChange={(v) => updateNodeConfig(selectedNodeData.id, "rangeStart", v)} placeholder="09:15" />
                    <ConfigField label="Range End" value={selectedNodeData.config.rangeEnd} onChange={(v) => updateNodeConfig(selectedNodeData.id, "rangeEnd", v)} placeholder="09:30" />
                  </>
                )}
                {selectedNodeData.type === "condition" && selectedNodeData.subtype === "price_check" && (
                  <>
                    <ConfigField label="Symbol" value={selectedNodeData.config.symbol} onChange={(v) => updateNodeConfig(selectedNodeData.id, "symbol", v)} placeholder="NSE:SBIN-EQ" />
                    <ConfigSelect label="Operator" value={selectedNodeData.config.operator} options={["> (Above)", "< (Below)", ">= (At or Above)", "<= (At or Below)"]} onChange={(v) => updateNodeConfig(selectedNodeData.id, "operator", v)} />
                    <ConfigField label="Value" value={selectedNodeData.config.value} onChange={(v) => updateNodeConfig(selectedNodeData.id, "value", v)} placeholder="600" />
                  </>
                )}
                {selectedNodeData.type === "condition" && selectedNodeData.subtype === "oi_check" && (
                  <>
                    <ConfigField label="Symbol" value={selectedNodeData.config.symbol} onChange={(v) => updateNodeConfig(selectedNodeData.id, "symbol", v)} placeholder="NSE:NIFTY50-INDEX" />
                    <ConfigSelect label="Option Type" value={selectedNodeData.config.optionType} options={["CE", "PE", "Both"]} onChange={(v) => updateNodeConfig(selectedNodeData.id, "optionType", v)} />
                    <ConfigField label="OI Change %" value={selectedNodeData.config.oiChange} onChange={(v) => updateNodeConfig(selectedNodeData.id, "oiChange", v)} placeholder="10" />
                    <ConfigField label="Strike" value={selectedNodeData.config.strike} onChange={(v) => updateNodeConfig(selectedNodeData.id, "strike", v)} placeholder="ATM" />
                  </>
                )}
                {selectedNodeData.type === "condition" && selectedNodeData.subtype === "pnl_check" && (
                  <>
                    <ConfigSelect label="P&L Type" value={selectedNodeData.config.pnlType} options={["MTM", "Realized", "Total"]} onChange={(v) => updateNodeConfig(selectedNodeData.id, "pnlType", v)} />
                    <ConfigSelect label="Condition" value={selectedNodeData.config.condition} options={["Profit Exceeds", "Loss Exceeds"]} onChange={(v) => updateNodeConfig(selectedNodeData.id, "condition", v)} />
                    <ConfigField label="Amount (₹)" value={selectedNodeData.config.amount} onChange={(v) => updateNodeConfig(selectedNodeData.id, "amount", v)} placeholder="3000" />
                  </>
                )}
                {selectedNodeData.type === "action" && (selectedNodeData.subtype === "place_order" || selectedNodeData.subtype === "place_spread") && (
                  <>
                    <ConfigField label="Symbol" value={selectedNodeData.config.symbol} onChange={(v) => updateNodeConfig(selectedNodeData.id, "symbol", v)} placeholder="NSE:NIFTY50-INDEX" />
                    <ConfigSelect label="Segment" value={selectedNodeData.config.segment} options={["Equity", "F&O - Futures", "F&O - Options", "Commodity"]} onChange={(v) => updateNodeConfig(selectedNodeData.id, "segment", v)} />
                    <ConfigSelect label="Side" value={selectedNodeData.config.side} options={["BUY", "SELL"]} onChange={(v) => updateNodeConfig(selectedNodeData.id, "side", v)} />
                    <ConfigField label="Qty / Lots" value={selectedNodeData.config.qty} onChange={(v) => updateNodeConfig(selectedNodeData.id, "qty", v)} placeholder="1" />
                    <ConfigSelect label="Order Type" value={selectedNodeData.config.orderType} options={["MARKET", "LIMIT", "SL-MARKET", "SL-LIMIT"]} onChange={(v) => updateNodeConfig(selectedNodeData.id, "orderType", v)} />
                    {selectedNodeData.subtype === "place_order" && (
                      <>
                        <ConfigSelect label="Option Type" value={selectedNodeData.config.optionType} options={["CE", "PE", "FUT", "EQ"]} onChange={(v) => updateNodeConfig(selectedNodeData.id, "optionType", v)} />
                        <ConfigSelect label="Strike Selection" value={selectedNodeData.config.strike} options={["ATM", "ITM1", "ITM2", "OTM1", "OTM2", "OTM3", "OTM4", "Custom"]} onChange={(v) => updateNodeConfig(selectedNodeData.id, "strike", v)} />
                        <ConfigSelect label="Expiry" value={selectedNodeData.config.expiry} options={["Current Weekly", "Next Weekly", "Current Monthly", "Next Monthly"]} onChange={(v) => updateNodeConfig(selectedNodeData.id, "expiry", v)} />
                      </>
                    )}
                    <ConfigField label="Stoploss (₹)" value={selectedNodeData.config.sl} onChange={(v) => updateNodeConfig(selectedNodeData.id, "sl", v)} placeholder="Optional" />
                    <ConfigField label="Target (₹)" value={selectedNodeData.config.target} onChange={(v) => updateNodeConfig(selectedNodeData.id, "target", v)} placeholder="Optional" />
                  </>
                )}
                {selectedNodeData.type === "action" && selectedNodeData.subtype === "alert" && (
                  <>
                    <ConfigSelect label="Channel" value={selectedNodeData.config.channel} options={["Telegram", "Email", "Webhook", "Push Notification"]} onChange={(v) => updateNodeConfig(selectedNodeData.id, "channel", v)} />
                    <ConfigField label="Message" value={selectedNodeData.config.message} onChange={(v) => updateNodeConfig(selectedNodeData.id, "message", v)} placeholder="Alert: {{symbol}} triggered" />
                  </>
                )}
                {selectedNodeData.type === "action" && selectedNodeData.subtype === "webhook" && (
                  <>
                    <ConfigField label="URL" value={selectedNodeData.config.url} onChange={(v) => updateNodeConfig(selectedNodeData.id, "url", v)} placeholder="https://..." />
                    <ConfigSelect label="Method" value={selectedNodeData.config.method} options={["POST", "GET", "PUT"]} onChange={(v) => updateNodeConfig(selectedNodeData.id, "method", v)} />
                    <ConfigField label="Payload" value={selectedNodeData.config.payload} onChange={(v) => updateNodeConfig(selectedNodeData.id, "payload", v)} placeholder='{"key": "value"}' />
                  </>
                )}
                {selectedNodeData.type === "wait" && selectedNodeData.subtype === "wait_time" && (
                  <ConfigField label="Wait Until" value={selectedNodeData.config.time} onChange={(v) => updateNodeConfig(selectedNodeData.id, "time", v)} placeholder="15:25" />
                )}
                {selectedNodeData.type === "wait" && selectedNodeData.subtype === "wait_duration" && (
                  <>
                    <ConfigField label="Duration" value={selectedNodeData.config.duration} onChange={(v) => updateNodeConfig(selectedNodeData.id, "duration", v)} placeholder="5" />
                    <ConfigSelect label="Unit" value={selectedNodeData.config.unit} options={["seconds", "minutes", "hours"]} onChange={(v) => updateNodeConfig(selectedNodeData.id, "unit", v)} />
                  </>
                )}
                {selectedNodeData.type === "wait" && selectedNodeData.subtype === "wait_candle" && (
                  <>
                    <ConfigField label="Candle Count" value={selectedNodeData.config.count} onChange={(v) => updateNodeConfig(selectedNodeData.id, "count", v)} placeholder="3" />
                    <ConfigSelect label="Timeframe" value={selectedNodeData.config.timeframe} options={["1m", "3m", "5m", "15m", "1h"]} onChange={(v) => updateNodeConfig(selectedNodeData.id, "timeframe", v)} />
                  </>
                )}

                {/* Connection info */}
                <div className="border-t border-[#3a3a3a] pt-3 mt-3">
                  <div className="text-[8px] text-slate-600 font-semibold uppercase tracking-wider mb-1">Connections</div>
                  <div className="text-[9px] text-slate-500">
                    Outputs: {selectedNodeData.outputs.length === 0 ? "None" : selectedNodeData.outputs.map(o => workflow.nodes.find(n => n.id === o)?.label || o).join(", ")}
                  </div>
                  {selectedNodeData.outputs.length > 0 && (
                    <button onClick={() => setWorkflow(prev => ({ ...prev, nodes: prev.nodes.map(n => n.id === selectedNodeData.id ? { ...n, outputs: [] } : n) }))}
                      className="text-[8px] text-red-400 mt-1 hover:text-red-300">Clear all connections</button>
                  )}
                </div>

                {/* Delete */}
                <button onClick={() => deleteNode(selectedNodeData.id)}
                  className="w-full mt-2 text-[9px] px-2.5 py-1.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 font-bold flex items-center justify-center gap-1 transition">
                  <Trash2 className="w-3 h-3" /> Delete Node
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {/* ── Dhan Connection Modal ── */}
      {dhanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setDhanModal(false)}>
          <div className="bg-[#1e1e1e] rounded-2xl border border-[#3a3a3a] p-6 w-[400px] shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center"><Zap className="w-4 h-4 text-blue-400" /></div>
                <div>
                  <h3 className="text-[14px] font-bold text-white">Connect Dhan</h3>
                  <p className="text-[10px] text-[#888]">Enter your Dhan API credentials</p>
                </div>
              </div>
              <button onClick={() => setDhanModal(false)} className="text-[#666] hover:text-white"><X className="w-4 h-4" /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-[#888] font-semibold">Client ID</label>
                <input value={dhanClientInput} onChange={e => setDhanClientInput(e.target.value)} placeholder="Your Dhan Client ID"
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-[#2a2a2a] border border-[#3a3a3a] text-[12px] text-white placeholder:text-[#555] focus:border-blue-500/40 outline-none" />
              </div>
              <div>
                <label className="text-[10px] text-[#888] font-semibold">Access Token (JWT)</label>
                <input value={dhanTokenInput} onChange={e => setDhanTokenInput(e.target.value)} placeholder="Your Dhan access token" type="password"
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-[#2a2a2a] border border-[#3a3a3a] text-[12px] text-white placeholder:text-[#555] focus:border-blue-500/40 outline-none" />
                <p className="text-[9px] text-[#666] mt-1">Get your token from api.dhan.co → Generate Access Token</p>
              </div>

              {dhanError && (
                <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-[10px] text-red-400">{dhanError}</div>
              )}

              <button onClick={connectDhan} disabled={dhanConnecting || !dhanTokenInput || !dhanClientInput}
                className="w-full py-2.5 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 font-bold text-[12px] transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {dhanConnecting ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Connecting...</> : "Connect & Verify"}
              </button>

              <p className="text-[8px] text-[#555] text-center">Dhan API is only used for workflow Deploy. Kite & Fyers remain separate.</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Execution Log (bottom panel) ── */}
      {executionLog.length > 0 && (
        <div className="border-t border-[#3a3a3a] bg-[#1a1a1a] max-h-32 overflow-auto flex-shrink-0">
          <div className="px-3 py-1.5 flex items-center justify-between border-b border-[#3a3a3a]">
            <span className="text-[9px] font-bold text-[#888]">EXECUTION LOG</span>
            <button onClick={() => setExecutionLog([])} className="text-[8px] text-[#666] hover:text-white">Clear</button>
          </div>
          <div className="px-3 py-1 space-y-0.5">
            {executionLog.map((log, i) => (
              <div key={i} className="flex items-center gap-2 text-[9px]">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${log.status === "running" ? "bg-amber-400 animate-pulse" : log.status === "done" ? "bg-green-400" : "bg-red-400"}`} />
                <span className="text-[#888] font-mono">{workflow.nodes.find(n => n.id === log.nodeId)?.label || log.nodeId}</span>
                <span className="text-[#666]">—</span>
                <span className={log.status === "error" ? "text-red-400" : "text-[#999]"}>{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helper components ──────────────────────────────────────────────────────

function ConfigField({ label, value, onChange, placeholder }: { label: string; value: string | number | boolean | undefined; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div>
      <label className="text-[8px] text-slate-600 font-semibold uppercase tracking-wider">{label}</label>
      <input value={String(value || "")} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full mt-1 px-2 py-1.5 rounded bg-[#2e2e2e] border border-[#3a3a3a] text-[10px] text-white placeholder:text-slate-700 focus:border-orange-500/40 outline-none" />
    </div>
  );
}

function ConfigSelect({ label, value, options, onChange }: { label: string; value: string | number | boolean | undefined; options: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[8px] text-slate-600 font-semibold uppercase tracking-wider">{label}</label>
      <select value={String(value || "")} onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1 px-2 py-1.5 rounded bg-[#2e2e2e] border border-[#3a3a3a] text-[10px] text-white focus:border-orange-500/40 outline-none">
        <option value="">Select...</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function getDefaultConfig(subtype: string): Record<string, string> {
  switch (subtype) {
    case "time": return { time: "09:14", frequency: "Weekdays Only" };
    case "price": return { symbol: "NSE:NIFTY50-INDEX", condition: "Crosses Above", priceLevel: "" };
    case "volume": return { symbol: "NSE:NIFTY50-INDEX", threshold: "200", timeframe: "5m" };
    case "indicator": return { symbol: "NSE:NIFTY50-INDEX", indicator: "RSI", timeframe: "5m", threshold: "70" };
    case "range_breakout": return { symbol: "NSE:NIFTY50-INDEX", direction: "Up", rangeStart: "09:15", rangeEnd: "09:30" };
    case "price_check": return { symbol: "", operator: "> (Above)", value: "" };
    case "indicator_check": return { symbol: "", indicator: "RSI", condition: "> (Above)", value: "70" };
    case "oi_check": return { symbol: "NSE:NIFTY50-INDEX", optionType: "CE", oiChange: "10", strike: "ATM" };
    case "pnl_check": return { pnlType: "MTM", condition: "Loss Exceeds", amount: "3000" };
    case "place_order": return { symbol: "NSE:NIFTY50-INDEX", segment: "F&O - Options", side: "BUY", qty: "1", orderType: "MARKET", optionType: "CE", strike: "ATM", expiry: "Current Weekly", sl: "", target: "" };
    case "place_spread": return { symbol: "NSE:NIFTY50-INDEX", segment: "F&O - Options", side: "BUY", qty: "1", orderType: "MARKET" };
    case "alert": return { channel: "Telegram", message: "" };
    case "webhook": return { url: "", method: "POST", payload: "{}" };
    case "modify_order": return { symbol: "", newSl: "", newTarget: "" };
    case "square_off": return { symbol: "", type: "All Positions" };
    case "wait_time": return { time: "15:25" };
    case "wait_duration": return { duration: "5", unit: "minutes" };
    case "wait_candle": return { count: "3", timeframe: "5m" };
    case "stop": return {};
    case "continue": return {};
    default: return {};
  }
}
