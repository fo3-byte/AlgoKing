"use client";
import { useState, useMemo, useCallback } from "react";
import {
  TrendingUp,
  TrendingDown,
  Target,
  Shield,
  Zap,
  ChevronDown,
  Info,
  DollarSign,
  BarChart3,
} from "lucide-react";

/* ── strategy definitions ── */
type StrategyKey =
  | "long_call" | "long_put"
  | "bull_call_spread" | "bear_put_spread"
  | "straddle" | "strangle"
  | "iron_condor" | "iron_butterfly"
  | "covered_call" | "protective_put";

interface StrategyDef {
  key: StrategyKey;
  label: string;
  legs: number; // number of strike inputs
  icon: typeof TrendingUp;
  description: string;
}

const STRATEGIES: StrategyDef[] = [
  { key: "long_call",        label: "Long Call",         legs: 1, icon: TrendingUp,  description: "Bullish bet with limited risk" },
  { key: "long_put",         label: "Long Put",          legs: 1, icon: TrendingDown, description: "Bearish bet with limited risk" },
  { key: "bull_call_spread", label: "Bull Call Spread",  legs: 2, icon: TrendingUp,  description: "Moderate bullish, capped profit" },
  { key: "bear_put_spread",  label: "Bear Put Spread",   legs: 2, icon: TrendingDown, description: "Moderate bearish, capped profit" },
  { key: "straddle",         label: "Straddle",          legs: 1, icon: Zap,         description: "Profit from big move either way" },
  { key: "strangle",         label: "Strangle",          legs: 2, icon: Zap,         description: "Cheaper vol play, wider range" },
  { key: "iron_condor",      label: "Iron Condor",       legs: 4, icon: Shield,      description: "Range-bound premium collection" },
  { key: "iron_butterfly",   label: "Iron Butterfly",    legs: 3, icon: Shield,      description: "Pinned-price premium strategy" },
  { key: "covered_call",     label: "Covered Call",      legs: 1, icon: Target,      description: "Income on long stock position" },
  { key: "protective_put",   label: "Protective Put",    legs: 1, icon: Shield,      description: "Insurance for long stock" },
];

interface QuickSetup {
  label: string;
  strategy: StrategyKey;
  underlying: number;
  strikes: number[];
  premiums: number[];
  lotSize: number;
}

const QUICK_SETUPS: QuickSetup[] = [
  { label: "NIFTY Bull Call",      strategy: "bull_call_spread", underlying: 22800, strikes: [22800, 23000], premiums: [180, 90],            lotSize: 25 },
  { label: "NIFTY Iron Condor",    strategy: "iron_condor",      underlying: 22800, strikes: [22400, 22600, 23000, 23200], premiums: [40, 95, 90, 35], lotSize: 25 },
  { label: "NIFTY Straddle",       strategy: "straddle",         underlying: 22800, strikes: [22800],       premiums: [250, 240],           lotSize: 25 },
  { label: "NIFTY Protective Put", strategy: "protective_put",   underlying: 22800, strikes: [22500],       premiums: [120],                lotSize: 25 },
  { label: "BANKNIFTY Long Call",  strategy: "long_call",        underlying: 48500, strikes: [49000],       premiums: [350],                lotSize: 15 },
];

const PORTFOLIO_VALUE = 500000; // 5 Lakh

/* ── payoff calculation ── */
function calcPayoff(
  strategy: StrategyKey,
  underlying: number,
  strikes: number[],
  premiums: number[],
  lotSize: number,
): { points: { x: number; y: number }[]; maxProfit: number; maxLoss: number; breakevens: number[]; deltaEst: number; thetaEst: number } {
  const range = underlying * 0.12;
  const lo = Math.floor(underlying - range);
  const hi = Math.ceil(underlying + range);
  const step = Math.max(1, Math.round((hi - lo) / 200));
  const points: { x: number; y: number }[] = [];

  const pnlAt = (price: number): number => {
    const s = strikes;
    const p = premiums;
    switch (strategy) {
      case "long_call":
        return (Math.max(price - s[0], 0) - p[0]) * lotSize;
      case "long_put":
        return (Math.max(s[0] - price, 0) - p[0]) * lotSize;
      case "bull_call_spread":
        return (Math.max(price - s[0], 0) - Math.max(price - s[1], 0) - (p[0] - p[1])) * lotSize;
      case "bear_put_spread":
        return (Math.max(s[1] - price, 0) - Math.max(s[0] - price, 0) - (p[1] - p[0])) * lotSize;
      case "straddle":
        return (Math.max(price - s[0], 0) + Math.max(s[0] - price, 0) - (p[0] + (p[1] || p[0]))) * lotSize;
      case "strangle":
        return (Math.max(price - s[1], 0) + Math.max(s[0] - price, 0) - (p[0] + p[1])) * lotSize;
      case "iron_condor": {
        // Buy put s[0], sell put s[1], sell call s[2], buy call s[3]
        const putSpread = Math.max(s[1] - price, 0) - Math.max(s[0] - price, 0);
        const callSpread = Math.max(price - s[2], 0) - Math.max(price - s[3], 0);
        const netPrem = (p[1] + p[2]) - (p[0] + p[3]);
        return (netPrem - putSpread - callSpread) * lotSize;
      }
      case "iron_butterfly": {
        // Buy put s[0], sell ATM put s[1], sell ATM call s[1], buy call s[2]
        const bfPut = Math.max(s[1] - price, 0) - Math.max(s[0] - price, 0);
        const bfCall = Math.max(price - s[1], 0) - Math.max(price - s[2], 0);
        const bfPrem = (p[1] + p[1]) - (p[0] + p[2]);
        return (bfPrem - bfPut - bfCall) * lotSize;
      }
      case "covered_call":
        return ((price - underlying) + Math.min(p[0], p[0]) - Math.max(price - s[0], 0) + p[0]) * lotSize;
      case "protective_put":
        return ((price - underlying) + Math.max(s[0] - price, 0) - p[0]) * lotSize;
      default:
        return 0;
    }
  };

  let maxProfit = -Infinity;
  let maxLoss = Infinity;

  for (let x = lo; x <= hi; x += step) {
    const y = pnlAt(x);
    points.push({ x, y });
    if (y > maxProfit) maxProfit = y;
    if (y < maxLoss) maxLoss = y;
  }

  // Breakevens: where PnL crosses zero
  const breakevens: number[] = [];
  for (let i = 1; i < points.length; i++) {
    if ((points[i - 1].y <= 0 && points[i].y >= 0) || (points[i - 1].y >= 0 && points[i].y <= 0)) {
      // Linear interpolation
      const x0 = points[i - 1].x, y0 = points[i - 1].y;
      const x1 = points[i].x, y1 = points[i].y;
      if (y1 !== y0) {
        breakevens.push(Math.round(x0 + (0 - y0) * (x1 - x0) / (y1 - y0)));
      }
    }
  }

  // Cap for unlimited strategies
  if (["long_call", "covered_call"].includes(strategy)) maxProfit = Math.min(maxProfit, range * lotSize);
  if (["long_put", "protective_put"].includes(strategy) && maxProfit > range * lotSize) maxProfit = range * lotSize;

  // Rough greeks
  const deltaEst = (pnlAt(underlying + 1) - pnlAt(underlying - 1)) / (2 * lotSize);
  const thetaEst = strategy.includes("long") ? -(premiums[0] * lotSize * 0.04) : (premiums[0] * lotSize * 0.03);

  return { points, maxProfit, maxLoss, breakevens, deltaEst, thetaEst };
}

/* ── SVG payoff chart ── */
function PayoffSVG({ points, underlying, strikes, breakevens }: {
  points: { x: number; y: number }[];
  underlying: number;
  strikes: number[];
  breakevens: number[];
}) {
  const W = 560, H = 240, PAD = { top: 20, right: 20, bottom: 30, left: 55 };
  const cw = W - PAD.left - PAD.right;
  const ch = H - PAD.top - PAD.bottom;

  if (points.length === 0) return null;

  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const yRange = Math.max(yMax - yMin, 1);

  const sx = (v: number) => PAD.left + ((v - xMin) / (xMax - xMin)) * cw;
  const sy = (v: number) => PAD.top + ch - ((v - yMin) / yRange) * ch;

  const zeroY = sy(0);

  // Build path and fill areas
  let path = "";
  let profitPath = `M${sx(points[0].x)},${zeroY}`;
  let lossPath = `M${sx(points[0].x)},${zeroY}`;

  points.forEach((p, i) => {
    const px = sx(p.x), py = sy(p.y);
    if (i === 0) path += `M${px},${py}`;
    else path += ` L${px},${py}`;

    if (p.y >= 0) {
      profitPath += ` L${px},${py}`;
      lossPath += ` L${px},${zeroY}`;
    } else {
      profitPath += ` L${px},${zeroY}`;
      lossPath += ` L${px},${py}`;
    }
  });

  profitPath += ` L${sx(points[points.length - 1].x)},${zeroY} Z`;
  lossPath += ` L${sx(points[points.length - 1].x)},${zeroY} Z`;

  // X axis labels
  const xTicks = 6;
  const xLabels: number[] = [];
  for (let i = 0; i <= xTicks; i++) xLabels.push(Math.round(xMin + (i / xTicks) * (xMax - xMin)));

  // Y axis labels
  const yTicks = 5;
  const yLabels: number[] = [];
  for (let i = 0; i <= yTicks; i++) yLabels.push(Math.round(yMin + (i / yTicks) * yRange));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#BFFF00" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#BFFF00" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id="lossGrad" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0.05" />
        </linearGradient>
      </defs>

      {/* Grid */}
      {yLabels.map((v, i) => (
        <g key={i}>
          <line x1={PAD.left} y1={sy(v)} x2={W - PAD.right} y2={sy(v)} stroke="#3a3a3a" strokeWidth="0.5" strokeDasharray="3,3" />
          <text x={PAD.left - 6} y={sy(v) + 3} textAnchor="end" fill="#6b7280" fontSize="8">{(v / 1000).toFixed(1)}K</text>
        </g>
      ))}
      {xLabels.map((v, i) => (
        <text key={i} x={sx(v)} y={H - 8} textAnchor="middle" fill="#6b7280" fontSize="8">{v}</text>
      ))}

      {/* Zero line */}
      <line x1={PAD.left} y1={zeroY} x2={W - PAD.right} y2={zeroY} stroke="#6b7280" strokeWidth="1" />

      {/* Fill areas */}
      <path d={profitPath} fill="url(#profitGrad)" />
      <path d={lossPath} fill="url(#lossGrad)" />

      {/* Payoff line */}
      <path d={path} fill="none" stroke="#BFFF00" strokeWidth="2" />

      {/* Underlying price marker */}
      <line x1={sx(underlying)} y1={PAD.top} x2={sx(underlying)} y2={H - PAD.bottom} stroke="#BFFF00" strokeWidth="1" strokeDasharray="4,4" opacity="0.5" />
      <text x={sx(underlying)} y={PAD.top - 5} textAnchor="middle" fill="#BFFF00" fontSize="8" fontWeight="bold">Spot: {underlying}</text>

      {/* Strike markers */}
      {strikes.map((s, i) => (
        <g key={i}>
          <line x1={sx(s)} y1={PAD.top} x2={sx(s)} y2={H - PAD.bottom} stroke="#f59e0b" strokeWidth="0.8" strokeDasharray="2,3" opacity="0.6" />
          <text x={sx(s)} y={H - PAD.bottom + 18} textAnchor="middle" fill="#f59e0b" fontSize="7">K{i + 1}:{s}</text>
        </g>
      ))}

      {/* Breakeven markers */}
      {breakevens.map((b, i) => (
        <g key={i}>
          <circle cx={sx(b)} cy={zeroY} r="3" fill="#BFFF00" stroke="#262626" strokeWidth="1" />
          <text x={sx(b)} y={zeroY - 8} textAnchor="middle" fill="#BFFF00" fontSize="7" fontWeight="bold">BE: {b}</text>
        </g>
      ))}
    </svg>
  );
}

/* ── main component ── */
export default function PayoffDiagramPanel() {
  const [strategy, setStrategy] = useState<StrategyKey>("bull_call_spread");
  const [underlying, setUnderlying] = useState(22800);
  const [strikes, setStrikes] = useState<number[]>([22800, 23000]);
  const [premiums, setPremiums] = useState<number[]>([180, 90]);
  const [lotSize, setLotSize] = useState(25);
  const [showStrategyPicker, setShowStrategyPicker] = useState(false);

  const currentStratDef = STRATEGIES.find(s => s.key === strategy)!;

  const applyQuick = useCallback((q: QuickSetup) => {
    setStrategy(q.strategy);
    setUnderlying(q.underlying);
    setStrikes([...q.strikes]);
    setPremiums([...q.premiums]);
    setLotSize(q.lotSize);
  }, []);

  const result = useMemo(
    () => calcPayoff(strategy, underlying, strikes, premiums, lotSize),
    [strategy, underlying, strikes, premiums, lotSize]
  );

  const riskPct = result.maxLoss !== Infinity && result.maxLoss !== -Infinity
    ? ((Math.abs(result.maxLoss) / PORTFOLIO_VALUE) * 100).toFixed(1)
    : "N/A";

  const updateStrike = (idx: number, val: number) => {
    const ns = [...strikes];
    ns[idx] = val;
    setStrikes(ns);
  };
  const updatePremium = (idx: number, val: number) => {
    const np = [...premiums];
    np[idx] = val;
    setPremiums(np);
  };

  const strikeLabels: Record<StrategyKey, string[]> = {
    long_call: ["Strike"],
    long_put: ["Strike"],
    bull_call_spread: ["Buy Call Strike", "Sell Call Strike"],
    bear_put_spread: ["Buy Put Strike", "Sell Put Strike"],
    straddle: ["ATM Strike"],
    strangle: ["Put Strike (OTM)", "Call Strike (OTM)"],
    iron_condor: ["Buy Put", "Sell Put", "Sell Call", "Buy Call"],
    iron_butterfly: ["Buy Put", "ATM Strike", "Buy Call"],
    covered_call: ["Sell Call Strike"],
    protective_put: ["Buy Put Strike"],
  };

  const premiumLabels: Record<StrategyKey, string[]> = {
    long_call: ["Premium Paid"],
    long_put: ["Premium Paid"],
    bull_call_spread: ["Buy Premium", "Sell Premium"],
    bear_put_spread: ["Buy Premium", "Sell Premium"],
    straddle: ["Call Premium", "Put Premium"],
    strangle: ["Put Premium", "Call Premium"],
    iron_condor: ["Buy Put Prem", "Sell Put Prem", "Sell Call Prem", "Buy Call Prem"],
    iron_butterfly: ["Buy Put Prem", "ATM Prem", "Buy Call Prem"],
    covered_call: ["Call Premium Recd"],
    protective_put: ["Put Premium Paid"],
  };

  const sLabels = strikeLabels[strategy];
  const pLabels = premiumLabels[strategy];

  return (
    <div className="bg-[#262626] rounded-xl border border-[#3a3a3a] flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#3a3a3a] flex-shrink-0">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-[#BFFF00]" />
          <h2 className="text-[11px] font-bold text-white">Options Payoff Calculator</h2>
        </div>
        <div className="flex items-center gap-2 text-[8px]">
          <span className="px-1.5 py-0.5 rounded bg-[#BFFF00]/10 text-[#BFFF00] font-bold border border-[#BFFF00]/30">
            {currentStratDef.label}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Quick Strategies */}
        <div className="px-4 py-2 border-b border-[#3a3a3a]">
          <span className="text-[8px] text-slate-500 font-semibold uppercase">Quick Strategies</span>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {QUICK_SETUPS.map(q => (
              <button
                key={q.label}
                onClick={() => applyQuick(q)}
                className="text-[8px] px-2 py-1 rounded bg-white/5 text-slate-300 hover:bg-[#BFFF00]/10 hover:text-[#BFFF00] border border-[#3a3a3a] hover:border-[#BFFF00]/30 transition font-medium"
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>

        {/* Strategy Selector */}
        <div className="px-4 py-2 border-b border-[#3a3a3a]">
          <div className="relative">
            <button
              onClick={() => setShowStrategyPicker(!showStrategyPicker)}
              className="w-full flex items-center justify-between px-3 py-1.5 rounded bg-[#1e1e1e] border border-[#3a3a3a] text-[10px] text-white hover:border-[#BFFF00]/40 transition"
            >
              <div className="flex items-center gap-2">
                <currentStratDef.icon className="w-3.5 h-3.5 text-[#BFFF00]" />
                <span className="font-semibold">{currentStratDef.label}</span>
                <span className="text-slate-500">-- {currentStratDef.description}</span>
              </div>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
            {showStrategyPicker && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-[#1e1e1e] border border-[#3a3a3a] rounded-lg shadow-xl max-h-48 overflow-y-auto">
                {STRATEGIES.map(s => (
                  <button
                    key={s.key}
                    onClick={() => {
                      setStrategy(s.key);
                      setStrikes(new Array(s.legs).fill(underlying));
                      setPremiums(new Array(Math.max(s.legs, s.key === "straddle" ? 2 : s.legs)).fill(100));
                      setShowStrategyPicker(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-[9px] hover:bg-white/5 transition ${
                      s.key === strategy ? "text-[#BFFF00] bg-[#BFFF00]/5" : "text-slate-300"
                    }`}
                  >
                    <s.icon className="w-3 h-3" />
                    <span className="font-semibold">{s.label}</span>
                    <span className="text-slate-500 ml-1">{s.description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Inputs */}
        <div className="px-4 py-2 border-b border-[#3a3a3a]">
          <div className="grid grid-cols-2 gap-2">
            {/* Underlying */}
            <div>
              <label className="text-[8px] text-slate-500 font-semibold uppercase block mb-1">Underlying Price</label>
              <input
                type="number"
                value={underlying}
                onChange={e => setUnderlying(Number(e.target.value) || 0)}
                className="w-full px-2 py-1 rounded bg-[#1e1e1e] border border-[#3a3a3a] text-[10px] text-white focus:border-[#BFFF00]/50 outline-none"
              />
            </div>
            {/* Lot Size */}
            <div>
              <label className="text-[8px] text-slate-500 font-semibold uppercase block mb-1">Lot Size</label>
              <input
                type="number"
                value={lotSize}
                onChange={e => setLotSize(Number(e.target.value) || 1)}
                className="w-full px-2 py-1 rounded bg-[#1e1e1e] border border-[#3a3a3a] text-[10px] text-white focus:border-[#BFFF00]/50 outline-none"
              />
            </div>
            {/* Strikes */}
            {sLabels.map((label, i) => (
              <div key={`s-${i}`}>
                <label className="text-[8px] text-slate-500 font-semibold uppercase block mb-1">{label}</label>
                <input
                  type="number"
                  value={strikes[i] ?? underlying}
                  onChange={e => updateStrike(i, Number(e.target.value) || 0)}
                  className="w-full px-2 py-1 rounded bg-[#1e1e1e] border border-[#3a3a3a] text-[10px] text-white focus:border-[#BFFF00]/50 outline-none"
                />
              </div>
            ))}
            {/* Premiums */}
            {pLabels.map((label, i) => (
              <div key={`p-${i}`}>
                <label className="text-[8px] text-slate-500 font-semibold uppercase block mb-1">{label}</label>
                <input
                  type="number"
                  value={premiums[i] ?? 100}
                  onChange={e => updatePremium(i, Number(e.target.value) || 0)}
                  className="w-full px-2 py-1 rounded bg-[#1e1e1e] border border-[#3a3a3a] text-[10px] text-white focus:border-[#BFFF00]/50 outline-none"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Payoff Diagram */}
        <div className="px-4 py-3 border-b border-[#3a3a3a]">
          <span className="text-[8px] text-slate-500 font-semibold uppercase">Payoff at Expiry</span>
          <div className="mt-2 glass-card rounded-lg p-2">
            {result.points.length > 0 ? (
              <PayoffSVG
                points={result.points}
                underlying={underlying}
                strikes={strikes}
                breakevens={result.breakevens}
              />
            ) : (
              <div className="flex items-center justify-center h-40 text-slate-500 text-[10px]">
                Enter valid parameters to see payoff
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="px-4 py-2">
          <div className="grid grid-cols-3 gap-2">
            <div className="glass-card rounded-lg p-2 text-center">
              <span className="text-[7px] text-slate-500 uppercase font-semibold block">Max Profit</span>
              <span className="text-[12px] font-bold text-[#BFFF00]">
                {result.maxProfit === Infinity || result.maxProfit > 1e8
                  ? "Unlimited"
                  : `+${(result.maxProfit).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}`}
              </span>
            </div>
            <div className="glass-card rounded-lg p-2 text-center">
              <span className="text-[7px] text-slate-500 uppercase font-semibold block">Max Loss</span>
              <span className="text-[12px] font-bold text-red-400">
                {result.maxLoss === -Infinity || result.maxLoss < -1e8
                  ? "Unlimited"
                  : (result.maxLoss).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className="glass-card rounded-lg p-2 text-center">
              <span className="text-[7px] text-slate-500 uppercase font-semibold block">Breakeven(s)</span>
              <span className="text-[12px] font-bold text-amber-400">
                {result.breakevens.length > 0 ? result.breakevens.join(" / ") : "--"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-2">
            <div className="glass-card rounded-lg p-2 text-center">
              <span className="text-[7px] text-slate-500 uppercase font-semibold block">Risk per 5L Capital</span>
              <span className={`text-[12px] font-bold ${
                riskPct !== "N/A" && parseFloat(riskPct) > 5 ? "text-red-400" : "text-[#BFFF00]"
              }`}>
                {riskPct === "N/A" ? "Unlimited" : `${riskPct}%`}
              </span>
            </div>
            <div className="glass-card rounded-lg p-2 text-center">
              <span className="text-[7px] text-slate-500 uppercase font-semibold block">Delta (est)</span>
              <span className="text-[12px] font-bold text-slate-200">
                {result.deltaEst.toFixed(2)}
              </span>
            </div>
            <div className="glass-card rounded-lg p-2 text-center">
              <span className="text-[7px] text-slate-500 uppercase font-semibold block">Theta/day (est)</span>
              <span className={`text-[12px] font-bold ${result.thetaEst < 0 ? "text-red-400" : "text-[#BFFF00]"}`}>
                {result.thetaEst >= 0 ? "+" : ""}{result.thetaEst.toFixed(0)}
              </span>
            </div>
          </div>

          {/* Info */}
          <div className="mt-2 flex items-start gap-1.5 px-2 py-1.5 rounded bg-white/[0.02] border border-[#3a3a3a]/50">
            <Info className="w-3 h-3 text-slate-500 flex-shrink-0 mt-0.5" />
            <span className="text-[8px] text-slate-500 leading-relaxed">
              Payoff shown at expiry. Greeks are rough estimates. Default lot size 25 for NIFTY, 15 for BANKNIFTY. Adjust inputs as needed.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
