"use client";
import { useState } from "react";
import { ChevronDown, ChevronRight, Settings2, Target, TrendingUp, Shield, Zap, Brain, Clock, DollarSign, BarChart3, AlertTriangle, CheckCircle2, Layers } from "lucide-react";

// ─── Data ───────────────────────────────────────────────────────

const SISTERS = [
  { id: 1, name: "Mean Reversion", status: "active", markets: "BankNifty (0.85), Nifty (0.82)", tf: "15m, 1hr", wr: "58-65%", rr: "1.5-2.5:1", desc: "Z-score > 2.0 + RSI oversold/overbought + BB touch → revert to mean", regime: "Range-Bound", params: [
    { key: "Z-score Threshold", value: "2.0", tunable: true },
    { key: "RSI Oversold", value: "30", tunable: true },
    { key: "RSI Overbought", value: "70", tunable: true },
    { key: "Exit Z-score", value: "0.5", tunable: true },
  ]},
  { id: 2, name: "MA Crossover", status: "active", markets: "BTC (0.82), Gold (0.80), ETH (0.80)", tf: "1hr, 4hr", wr: "45-55%", rr: "2-3:1", desc: "EMA 9/21 cross + MACD confirm + ADX > 20 + volume spike", regime: "Trending", params: [
    { key: "Fast EMA", value: "9", tunable: true },
    { key: "Slow EMA", value: "21", tunable: true },
    { key: "ADX Filter", value: "> 20", tunable: true },
    { key: "SL (ATR mult)", value: "1.5x", tunable: true },
    { key: "TP (ATR mult)", value: "3.0x", tunable: true },
  ]},
  { id: 3, name: "PDC/PDH", status: "active", markets: "BankNifty (0.90), Nifty (0.88)", tf: "5m, 15m", wr: "55-62%", rr: "2-2.5:1", desc: "Previous Day Close/High/Low — FII/DII anchor. Breakout+retest or bounce", regime: "All", badge: "HIGHEST EDGE", params: [
    { key: "Retest Tolerance", value: "0.1%", tunable: true },
    { key: "PDH Breakout", value: "Long entry", tunable: false },
    { key: "PDL Breakdown", value: "Short entry", tunable: false },
    { key: "PDC Bounce", value: "Trade VWAP direction", tunable: false },
  ]},
  { id: 4, name: "1-Hour High/Low", status: "active", markets: "BankNifty (0.88), Nifty (0.85)", tf: "5m, 15m", wr: "52-60%", rr: "2:1", desc: "First hour = 40-60% of daily range. Breakout after 10:15 IST", regime: "Volatile", params: [
    { key: "ORB Window", value: "9:15-10:15 IST", tunable: true },
    { key: "Volume Confirm", value: "> 1.5x avg", tunable: true },
    { key: "Range Filter", value: "0.3%-1.5%", tunable: true },
  ]},
  { id: 5, name: "Volume Profile", status: "active", markets: "Stock Futures (0.85), BankNifty (0.82)", tf: "15m, 30m", wr: "55-63%", rr: "1.5-2.5:1", desc: "POC reversion, LVN breakout, VAH/VAL bounce", regime: "Range-Bound", params: [
    { key: "Lookback", value: "50 bars", tunable: true },
    { key: "Resolution", value: "24 levels", tunable: true },
    { key: "Value Area %", value: "70%", tunable: true },
  ]},
  { id: 6, name: "Momentum", status: "active", markets: "BTC (0.88), ETH (0.85), Crude (0.80)", tf: "1hr, 4hr", wr: "42-50%", rr: "3-5:1", desc: "RSI > 60 + MACD accelerating + ADX > 25. Low win rate, BIG winners", regime: "Trending", params: [
    { key: "RSI Threshold", value: "60", tunable: true },
    { key: "ADX Threshold", value: "25", tunable: true },
    { key: "SL (ATR mult)", value: "2.0x", tunable: true },
    { key: "TP (ATR mult)", value: "5.0x", tunable: true },
  ]},
  { id: 7, name: "VWAP Reversion", status: "active", markets: "BankNifty (0.86), Nifty (0.84)", tf: "5m, 15m", wr: "58-65%", rr: "1.5-2:1", desc: "Price 1.5+ std devs from VWAP → reverts. Active 9:30 AM-2:30 PM", regime: "Range-Bound", params: [
    { key: "Std Dev Distance", value: "1.5", tunable: true },
    { key: "Active Window", value: "9:30-14:30 IST", tunable: true },
  ]},
  { id: 8, name: "ORB", status: "active", markets: "BankNifty (0.85), Nifty (0.82)", tf: "5m, 15m", wr: "50-58%", rr: "2-3:1", desc: "First 15 min opening range. Breakout = trend day", regime: "Volatile", params: [
    { key: "Window", value: "15 min", tunable: true },
    { key: "Gap Filter", value: "Skip > 1.5%", tunable: true },
    { key: "Range Filter", value: "0.3%-1.5%", tunable: true },
  ]},
  { id: 9, name: "ICT (Smart Money)", status: "new", markets: "BankNifty, Nifty, NQ", tf: "15m HTF → 5m entry", wr: "50-60%", rr: "2-3:1", desc: "Order Blocks, FVG, Liquidity Sweeps, CHoCH/BOS, Power of Three, OTE at 62-79% fib", regime: "Trending", badge: "NEW", params: [
    { key: "OTE Fib Low", value: "0.618", tunable: true },
    { key: "OTE Fib High", value: "0.786", tunable: true },
    { key: "Swing Lookback", value: "20 bars", tunable: true },
  ]},
  { id: 10, name: "Fabervaale Triple-A", status: "new", markets: "NQ, ES, BTC/ETH, Large-Caps", tf: "5m (learning), 2m, 1m", wr: "55-65%", rr: "2:1", desc: "Absorption (high vol, low range) → Accumulation (consolidation) → Aggression (breakout entry)", regime: "Trending/Volatile", badge: "NEW", params: [
    { key: "Volume Multiplier", value: "2.0x avg", tunable: true },
    { key: "Range Multiplier", value: "< 0.3x ATR", tunable: true },
    { key: "Accum Candles", value: "2-5", tunable: true },
    { key: "Aggression Volume", value: "> 1.5x avg", tunable: true },
    { key: "SL (ATR mult)", value: "1.0x", tunable: true },
    { key: "TP (ATR mult)", value: "2.0x", tunable: true },
    { key: "Trail (ATR mult)", value: "1.5x", tunable: true },
  ]},
];

const RISK_RULES = [
  { rule: "Max risk per trade", value: "2%", icon: Target },
  { rule: "Max daily loss", value: "5%", icon: AlertTriangle },
  { rule: "Max weekly loss", value: "10%", icon: AlertTriangle },
  { rule: "Max total drawdown", value: "25% → HALT", icon: Shield },
  { rule: "Max concurrent trades", value: "5", icon: Layers },
  { rule: "Min R:R ratio", value: "1.5:1", icon: TrendingUp },
  { rule: "Min MC P(profit)", value: "60%", icon: Brain },
  { rule: "Min MC composite score", value: "0.55", icon: Brain },
  { rule: "Consecutive loss reduction", value: "-10%/loss after 3", icon: AlertTriangle },
];

const MC_WEIGHTS = [
  { factor: "Probability of Profit", weight: 30, color: "#BFFF00" },
  { factor: "Expected Return (₹)", weight: 25, color: "#22d3ee" },
  { factor: "Sharpe Ratio", weight: 15, color: "#a78bfa" },
  { factor: "Max Drawdown Risk", weight: 15, color: "#f87171" },
  { factor: "Strategy-Market Affinity", weight: 10, color: "#fb923c" },
  { factor: "Market Regime Fit", weight: 5, color: "#94a3b8" },
];

const KILL_ZONES = [
  { zone: "Indian Open", time: "9:15 - 10:30 AM IST", desc: "Gap fill, ORB, first hour range", active: true },
  { zone: "Mid-Morning", time: "10:30 - 12:30 PM IST", desc: "Highest signal density, all sisters active", active: true },
  { zone: "Lunch Lull", time: "12:30 - 2:00 PM IST", desc: "Volume Profile, ICT, mean reversion", active: false },
  { zone: "Power Hour", time: "2:00 - 3:15 PM IST", desc: "End-of-day moves, position squaring", active: true },
  { zone: "London Open", time: "12:30 - 3:30 PM IST", desc: "ICT PO3, Momentum (Gold, Crude)", active: true },
  { zone: "NY AM Session", time: "7:00 - 9:30 PM IST", desc: "Highest volume globally (NQ, ES, BTC)", active: true },
];

const SCALING = [
  { capital: "₹5,00,000", risk: "₹10,000", lots: "1 lot (15 qty)", phase: "Starting" },
  { capital: "₹10,00,000", risk: "₹20,000", lots: "2 lots", phase: "Proving" },
  { capital: "₹15,00,000", risk: "₹30,000", lots: "2-3 lots", phase: "Comfortable" },
  { capital: "₹20,00,000", risk: "₹40,000", lots: "3-4 lots", phase: "Intermediate" },
  { capital: "₹30,00,000", risk: "₹60,000", lots: "4-5 lots", phase: "Strong" },
  { capital: "₹50,00,000", risk: "₹1,00,000", lots: "6-7 lots", phase: "TARGET" },
];

const EXIT_RULES = [
  { at: "1:1 R:R", action: "Exit 25%, move SL to breakeven" },
  { at: "1.5x profit", action: "Trail SL at 1x ATR behind price" },
  { at: "2:1 R:R", action: "Exit 25% more, trail at 0.75x ATR" },
  { at: "3:1 R:R", action: "Exit 25% more, trail final 25% at 0.5x ATR" },
  { at: "Runner", action: "Let final 25% ride with tight trail" },
];

// ─── Collapsible Section Component ──────────────────────────────
function Section({ title, icon: Icon, children, defaultOpen = false, badge }: { title: string; icon: typeof Target; children: React.ReactNode; defaultOpen?: boolean; badge?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="glass-card overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-4 hover:bg-white/3 transition">
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-[#BFFF00]" />
          <span className="text-[14px] font-bold text-white">{title}</span>
          {badge && <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#BFFF00]/10 text-[#BFFF00] font-bold">{badge}</span>}
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-[#666]" /> : <ChevronRight className="w-4 h-4 text-[#666]" />}
      </button>
      {open && <div className="px-4 pb-4 border-t border-white/5 pt-3">{children}</div>}
    </div>
  );
}

// ─── Strategy Card ──────────────────────────────────────────────
function StrategyCard({ s }: { s: typeof SISTERS[0] }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-white/3 rounded-xl border border-white/5 hover:border-white/10 transition">
      <button onClick={() => setExpanded(!expanded)} className="w-full text-left p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-[#888] font-mono">#{s.id}</span>
            <span className="text-[13px] font-bold text-white">{s.name}</span>
            {s.badge && <span className={`text-[8px] px-2 py-0.5 rounded-full font-bold ${s.badge === "HIGHEST EDGE" ? "bg-[#BFFF00]/15 text-[#BFFF00]" : "bg-cyan-500/15 text-cyan-400"}`}>{s.badge}</span>}
          </div>
          {expanded ? <ChevronDown className="w-3.5 h-3.5 text-[#666]" /> : <ChevronRight className="w-3.5 h-3.5 text-[#666]" />}
        </div>
        <p className="text-[11px] text-[#999] leading-relaxed mb-3">{s.desc}</p>
        <div className="flex flex-wrap gap-3 text-[10px]">
          <span className="text-[#888]">Markets: <span className="text-[#ccc]">{s.markets}</span></span>
          <span className="text-[#888]">TF: <span className="text-[#ccc]">{s.tf}</span></span>
          <span className="text-[#888]">WR: <span className="text-[#BFFF00]">{s.wr}</span></span>
          <span className="text-[#888]">R:R: <span className="text-cyan-400">{s.rr}</span></span>
          <span className="text-[#888]">Regime: <span className="text-[#ccc]">{s.regime}</span></span>
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-4 border-t border-white/5 pt-3">
          <div className="text-[10px] font-bold text-[#888] mb-2 uppercase tracking-wider">Tunable Parameters</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {s.params.map((p, i) => (
              <div key={i} className="bg-white/4 rounded-lg p-2.5 border border-white/5">
                <div className="text-[9px] text-[#777] mb-1">{p.key}</div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] font-bold text-white">{p.value}</span>
                  {p.tunable && <Settings2 className="w-3 h-3 text-[#BFFF00]/50" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Panel ─────────────────────────────────────────────────
export default function BlueprintPanel() {
  return (
    <div className="space-y-4 pb-8">
      {/* Title */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-black text-white tracking-tight">ALGO BLUEPRINT</h1>
            <p className="text-[12px] text-[#888] mt-1">Complete trading system — 10 strategies, Monte Carlo arbitration, risk management</p>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-[#888]">Goal</div>
            <div className="text-[16px] font-black text-[#BFFF00]">₹5L → ₹50L</div>
            <div className="text-[10px] text-[#666]">by Dec 2026 | ~29% monthly</div>
          </div>
        </div>
      </div>

      {/* Architecture */}
      <Section title="System Architecture" icon={Layers} defaultOpen={true}>
        <div className="bg-black/30 rounded-xl p-5 font-mono text-[10px] leading-relaxed text-[#ccc] overflow-x-auto">
          <pre>{`  ┌────────────────────── MARKET DATA (Fyers WS / Yahoo) ──────────────────────┐
  │                                                                            │
  │  ┌──────────────────── PRE-PROCESSING ────────────────────┐                │
  │  │ ATR, RSI, MACD, BB, VWAP, Volume Profile, PDC/PDH/PDL │                │
  │  └──────────────────────────┬──────────────────────────────┘                │
  │                             │                                              │
  │  ┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐
  │  │MnRev ││MACrs ││PDC/PH││1HrHL ││VolPf ││Momtm ││VWAP  ││ ORB  ││ ICT  ││Tri-A │
  │  │ #1   ││ #2   ││ #3   ││ #4   ││ #5   ││ #6   ││ #7   ││ #8   ││ #9   ││ #10  │
  │  └──┬───┘└──┬───┘└──┬───┘└──┬───┘└──┬───┘└──┬───┘└──┬───┘└──┬───┘└──┬───┘└──┬───┘
  │     └───────┴───────┴───────┴───────┼───────┴───────┴───────┴───────┴───────┘
  │                                     │ SIGNALS                              │
  │                          ┌──────────▼──────────┐                           │
  │                          │  MONTE CARLO ENGINE │                           │
  │                          │  10K sims / signal  │                           │
  │                          │  Composite ranking  │                           │
  │                          └──────────┬──────────┘                           │
  │                                     │ RANKED                               │
  │                          ┌──────────▼──────────┐                           │
  │                          │   RISK MANAGER      │                           │
  │                          │   Half-Kelly sizing │                           │
  │                          │   Drawdown controls │                           │
  │                          └──────────┬──────────┘                           │
  │                                     │ APPROVED                             │
  │                          ┌──────────▼──────────┐                           │
  │                          │  EXECUTION (Fyers)  │                           │
  │                          │  Smart Exit flows   │                           │
  │                          └─────────────────────┘                           │
  └────────────────────────────────────────────────────────────────────────────┘`}</pre>
        </div>
      </Section>

      {/* Strategy Library */}
      <Section title="Strategy Library (10 Sisters)" icon={Zap} defaultOpen={true} badge="10 STRATEGIES">
        <div className="space-y-3">
          {SISTERS.map(s => <StrategyCard key={s.id} s={s} />)}
        </div>
      </Section>

      {/* Risk Management */}
      <Section title="Risk Management Rules" icon={Shield}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {RISK_RULES.map((r, i) => {
            const Icon = r.icon;
            return (
              <div key={i} className="bg-white/3 rounded-xl p-3 border border-white/5 flex items-center gap-3">
                <Icon className="w-4 h-4 text-[#BFFF00] flex-shrink-0" />
                <div>
                  <div className="text-[11px] text-[#999]">{r.rule}</div>
                  <div className="text-[14px] font-bold text-white">{r.value}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Drawdown Scaling */}
        <div className="mt-4 bg-white/3 rounded-xl p-4 border border-white/5">
          <div className="text-[11px] font-bold text-[#888] mb-3 uppercase tracking-wider">Drawdown-Scaled Sizing</div>
          <div className="flex items-center gap-2 flex-wrap text-[10px]">
            <span className="px-3 py-1.5 rounded-lg bg-[#BFFF00]/10 text-[#BFFF00] font-bold">0-10% DD → Full Size</span>
            <span className="text-[#666]">→</span>
            <span className="px-3 py-1.5 rounded-lg bg-yellow-500/10 text-yellow-400 font-bold">10-20% DD → Scale Down</span>
            <span className="text-[#666]">→</span>
            <span className="px-3 py-1.5 rounded-lg bg-orange-500/10 text-orange-400 font-bold">20-25% DD → 30% Size</span>
            <span className="text-[#666]">→</span>
            <span className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 font-bold">&gt;25% DD → HALT SYSTEM</span>
          </div>
        </div>
      </Section>

      {/* Monte Carlo */}
      <Section title="Monte Carlo Arbitration" icon={Brain}>
        <div className="text-[11px] text-[#999] mb-3">Composite score weights — how the MC engine ranks competing signals</div>
        <div className="space-y-2">
          {MC_WEIGHTS.map((w, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-[11px] text-[#999] w-44">{w.factor}</span>
              <div className="flex-1 h-5 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full rounded-full flex items-center px-2" style={{ width: `${w.weight * 3}%`, backgroundColor: w.color + "30", borderLeft: `3px solid ${w.color}` }}>
                  <span className="text-[10px] font-bold" style={{ color: w.color }}>{w.weight}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-3 text-[10px]">
          <span className="px-3 py-1.5 rounded-lg bg-white/5 text-[#ccc]">Min P(profit): <span className="text-[#BFFF00] font-bold">60%</span></span>
          <span className="px-3 py-1.5 rounded-lg bg-white/5 text-[#ccc]">Min Score: <span className="text-[#BFFF00] font-bold">0.55</span></span>
          <span className="px-3 py-1.5 rounded-lg bg-white/5 text-[#ccc]">Simulations: <span className="text-[#BFFF00] font-bold">10,000</span></span>
          <span className="px-3 py-1.5 rounded-lg bg-white/5 text-[#ccc]">Bonus (confidence): <span className="text-[#BFFF00] font-bold">+15%</span></span>
        </div>
      </Section>

      {/* Kill Zones */}
      <Section title="Kill Zones & Daily Routine" icon={Clock}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {KILL_ZONES.map((kz, i) => (
            <div key={i} className={`rounded-xl p-3 border ${kz.active ? "bg-[#BFFF00]/5 border-[#BFFF00]/15" : "bg-white/3 border-white/5"}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] font-bold text-white">{kz.zone}</span>
                {kz.active ? <span className="text-[8px] px-2 py-0.5 rounded-full bg-[#BFFF00]/15 text-[#BFFF00] font-bold">HIGH ACTIVITY</span>
                  : <span className="text-[8px] px-2 py-0.5 rounded-full bg-white/10 text-[#888] font-bold">LOW VOL</span>}
              </div>
              <div className="text-[11px] text-[#BFFF00] font-mono mb-1">{kz.time}</div>
              <div className="text-[10px] text-[#999]">{kz.desc}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Exit Strategy */}
      <Section title="Exit & Trade Management" icon={Target}>
        <div className="text-[11px] font-bold text-[#888] mb-3 uppercase tracking-wider">Partial Exit Ladder</div>
        <div className="space-y-2">
          {EXIT_RULES.map((e, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-20 text-center">
                <span className="text-[11px] font-bold text-[#BFFF00] bg-[#BFFF00]/10 px-2 py-1 rounded-lg">{e.at}</span>
              </div>
              <div className="flex-1 h-[1px] bg-white/10" />
              <CheckCircle2 className="w-3.5 h-3.5 text-[#BFFF00]/50" />
              <span className="text-[11px] text-[#ccc]">{e.action}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 bg-red-500/5 border border-red-500/15 rounded-xl p-3">
          <div className="text-[11px] font-bold text-red-400 mb-1">NON-NEGOTIABLE EXIT RULES</div>
          <div className="text-[10px] text-[#999] space-y-1">
            <div>1. Hard SL hit → Immediate exit, no questions</div>
            <div>2. Daily loss limit hit → Close ALL positions, stop trading</div>
            <div>3. End of day (3:15 PM IST) → Close all intraday positions</div>
            <div>4. Never move SL further away</div>
          </div>
        </div>
      </Section>

      {/* Capital Scaling */}
      <Section title="Capital Scaling Plan" icon={DollarSign}>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-[#888] text-left border-b border-white/10">
                <th className="pb-2 font-semibold">Capital Level</th>
                <th className="pb-2 font-semibold">Risk (2%)</th>
                <th className="pb-2 font-semibold">BankNifty Lots</th>
                <th className="pb-2 font-semibold">Phase</th>
              </tr>
            </thead>
            <tbody>
              {SCALING.map((row, i) => (
                <tr key={i} className={`border-b border-white/5 ${row.phase === "TARGET" ? "bg-[#BFFF00]/5" : ""}`}>
                  <td className="py-2.5 font-bold text-white">{row.capital}</td>
                  <td className="py-2.5 text-[#ccc]">{row.risk}</td>
                  <td className="py-2.5 text-[#ccc]">{row.lots}</td>
                  <td className="py-2.5">
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${row.phase === "TARGET" ? "bg-[#BFFF00]/15 text-[#BFFF00]" : "bg-white/10 text-[#888]"}`}>{row.phase}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Quick Reference Card */}
      <Section title="Quick Reference Checklists" icon={CheckCircle2}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/3 rounded-xl p-4 border border-white/5">
            <div className="text-[11px] font-bold text-[#BFFF00] mb-3">ENTRY CHECKLIST</div>
            <div className="space-y-1.5 text-[10px] text-[#ccc]">
              {["Kill zone active?", "Regime identified?", "Signal from sister algo?", "MC score > 0.55?", "P(profit) > 60%?", "R:R > 1.5:1?", "Within daily loss limit?", "< 5 concurrent positions?", "Position size = Half-Kelly, max 2%?"].map((item, i) => (
                <div key={i} className="flex items-center gap-2"><span className="w-3 h-3 rounded border border-[#555] flex-shrink-0" />{item}</div>
              ))}
            </div>
          </div>
          <div className="bg-white/3 rounded-xl p-4 border border-white/5">
            <div className="text-[11px] font-bold text-cyan-400 mb-3">EXIT CHECKLIST</div>
            <div className="space-y-1.5 text-[10px] text-[#ccc]">
              {["Hard SL in place?", "Smart exit via Fyers attached?", "Trailing stop active after 1x profit?", "Partial exits at 1:1, 2:1, 3:1?", "EOD exit by 3:15 PM IST?"].map((item, i) => (
                <div key={i} className="flex items-center gap-2"><span className="w-3 h-3 rounded border border-[#555] flex-shrink-0" />{item}</div>
              ))}
            </div>
          </div>
          <div className="bg-white/3 rounded-xl p-4 border border-white/5">
            <div className="text-[11px] font-bold text-orange-400 mb-3">DAILY DISCIPLINE</div>
            <div className="space-y-1.5 text-[10px] text-[#ccc]">
              {["No trading before 9:30 AM IST", "No new positions after 2:30 PM", "Stop after 3 consecutive losses", "Never move SL further away", "Log every trade (win or loss)", "Weekly review every Sunday"].map((item, i) => (
                <div key={i} className="flex items-center gap-2"><span className="w-3 h-3 rounded border border-[#555] flex-shrink-0" />{item}</div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* Footer */}
      <div className="text-center text-[10px] text-[#555] pt-4">
        Full editable document: <span className="text-[#888] font-mono">ALGO_BLUEPRINT.md</span> in project root
      </div>
    </div>
  );
}
