"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  TrendingUp,
  TrendingDown,
  Target,
  Calendar,
  Plus,
  CheckCircle2,
  Circle,
  BarChart3,
  Award,
  AlertTriangle,
  Trash2,
  Download,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────
interface DailyEntry {
  date: string; // YYYY-MM-DD
  pnl: number;
  equity: number;
}

interface EquityData {
  startDate: string;
  targetDate: string;
  startingCapital: number;
  targetCapital: number;
  entries: DailyEntry[];
}

const STORAGE_KEY = "algomaster-equity";
const START_CAPITAL = 500000; // ₹5L
const TARGET_CAPITAL = 5000000; // ₹50L
const MILESTONES = [500000, 1000000, 2000000, 3000000, 5000000];
const MILESTONE_LABELS = ["₹5L", "₹10L", "₹20L", "₹30L", "₹50L"];

// ─── Helpers ──────────────────────────────────────────────────
function fmtINR(n: number, decimals = 0): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2)}L`;
  if (abs >= 1e3) return `${sign}₹${(abs / 1e3).toFixed(1)}K`;
  return `${sign}₹${abs.toFixed(decimals)}`;
}

function daysBetween(a: string, b: string): number {
  return Math.ceil(
    (new Date(b).getTime() - new Date(a).getTime()) / 86400000
  );
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function loadEquityData(): EquityData {
  if (typeof window === "undefined") return defaultData();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as EquityData;
  } catch {
    /* noop */
  }
  return defaultData();
}

function defaultData(): EquityData {
  return {
    startDate: toISO(new Date()),
    targetDate: toISO(
      new Date(Date.now() + 365 * 86400000)
    ),
    startingCapital: START_CAPITAL,
    targetCapital: TARGET_CAPITAL,
    entries: [],
  };
}

function saveEquityData(data: EquityData) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ─── Component ────────────────────────────────────────────────
export default function EquityTrackerPanel() {
  const [data, setData] = useState<EquityData>(defaultData);
  const [pnlInput, setPnlInput] = useState("");
  const [dateInput, setDateInput] = useState(toISO(new Date()));
  const [activeTab, setActiveTab] = useState<"curve" | "daily" | "monthly">(
    "curve"
  );

  // Load on mount
  useEffect(() => {
    setData(loadEquityData());
  }, []);

  // Persist on change
  const persist = useCallback((next: EquityData) => {
    setData(next);
    saveEquityData(next);
  }, []);

  // Add daily entry
  const addEntry = () => {
    const pnl = parseFloat(pnlInput);
    if (isNaN(pnl)) return;

    const entries = [...data.entries];
    const existingIdx = entries.findIndex((e) => e.date === dateInput);
    const lastEquity =
      entries.length > 0
        ? entries[entries.length - 1].equity
        : data.startingCapital;

    if (existingIdx >= 0) {
      // Update existing entry - recalculate equity from that point
      entries[existingIdx].pnl = pnl;
      // Recalculate all equities from the changed point
      for (let i = existingIdx; i < entries.length; i++) {
        const prev =
          i === 0 ? data.startingCapital : entries[i - 1].equity;
        entries[i].equity = prev + entries[i].pnl;
      }
    } else {
      const equity = lastEquity + pnl;
      entries.push({ date: dateInput, pnl, equity });
      entries.sort((a, b) => a.date.localeCompare(b.date));
      // Recalculate all equities after sort
      for (let i = 0; i < entries.length; i++) {
        const prev =
          i === 0 ? data.startingCapital : entries[i - 1].equity;
        entries[i].equity = prev + entries[i].pnl;
      }
    }

    persist({ ...data, entries });
    setPnlInput("");
  };

  const deleteEntry = (date: string) => {
    const entries = data.entries.filter((e) => e.date !== date);
    // Recalculate equities
    for (let i = 0; i < entries.length; i++) {
      const prev =
        i === 0 ? data.startingCapital : entries[i - 1].equity;
      entries[i].equity = prev + entries[i].pnl;
    }
    persist({ ...data, entries });
  };

  // ─── Computed Stats ───────────────────────────────────────
  const stats = useMemo(() => {
    const entries = data.entries;
    const currentEquity =
      entries.length > 0
        ? entries[entries.length - 1].equity
        : data.startingCapital;
    const progress =
      ((currentEquity - data.startingCapital) /
        (data.targetCapital - data.startingCapital)) *
      100;
    const daysElapsed =
      entries.length > 0
        ? daysBetween(data.startDate, entries[entries.length - 1].date)
        : 0;
    const totalDays = daysBetween(data.startDate, data.targetDate);
    const daysRemaining = Math.max(0, totalDays - daysElapsed);

    // CAGR
    const yearsElapsed = Math.max(daysElapsed / 365, 1 / 365);
    const cagr =
      entries.length > 0
        ? (Math.pow(currentEquity / data.startingCapital, 1 / yearsElapsed) -
            1) *
          100
        : 0;

    // Max Drawdown
    let peak = data.startingCapital;
    let maxDD = 0;
    for (const e of entries) {
      if (e.equity > peak) peak = e.equity;
      const dd = ((peak - e.equity) / peak) * 100;
      if (dd > maxDD) maxDD = dd;
    }

    // Sharpe (annualized, risk-free = 6%)
    const dailyReturns = entries.map((e, i) => {
      const prev =
        i === 0 ? data.startingCapital : entries[i - 1].equity;
      return prev > 0 ? (e.equity - prev) / prev : 0;
    });
    const avgReturn =
      dailyReturns.length > 0
        ? dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length
        : 0;
    const stdDev =
      dailyReturns.length > 1
        ? Math.sqrt(
            dailyReturns.reduce(
              (s, r) => s + Math.pow(r - avgReturn, 2),
              0
            ) /
              (dailyReturns.length - 1)
          )
        : 0;
    const sharpe =
      stdDev > 0
        ? ((avgReturn - 0.06 / 252) / stdDev) * Math.sqrt(252)
        : 0;

    // Best/Worst day
    const pnls = entries.map((e) => e.pnl);
    const bestDay = pnls.length > 0 ? Math.max(...pnls) : 0;
    const worstDay = pnls.length > 0 ? Math.min(...pnls) : 0;

    // Required monthly return
    const monthsRemaining = Math.max(1, daysRemaining / 30);
    const remaining = data.targetCapital - currentEquity;
    const requiredMonthly =
      remaining > 0
        ? (Math.pow(data.targetCapital / currentEquity, 1 / monthsRemaining) -
            1) *
          100
        : 0;

    // Win rate
    const wins = entries.filter((e) => e.pnl > 0).length;
    const winRate =
      entries.length > 0 ? (wins / entries.length) * 100 : 0;

    return {
      currentEquity,
      progress: Math.min(100, Math.max(0, progress)),
      daysRemaining,
      daysElapsed,
      cagr,
      maxDD,
      sharpe,
      bestDay,
      worstDay,
      requiredMonthly,
      winRate,
      totalPnl: currentEquity - data.startingCapital,
    };
  }, [data]);

  // ─── Monthly summary ─────────────────────────────────────
  const monthlySummary = useMemo(() => {
    const map = new Map<string, { pnl: number; trades: number }>();
    for (const e of data.entries) {
      const month = e.date.slice(0, 7); // YYYY-MM
      const existing = map.get(month) || { pnl: 0, trades: 0 };
      existing.pnl += e.pnl;
      existing.trades += 1;
      map.set(month, existing);
    }
    return Array.from(map.entries())
      .map(([month, d]) => ({ month, ...d }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [data.entries]);

  // ─── Last 30 entries for daily bar chart ──────────────────
  const last30 = data.entries.slice(-30);

  // ─── SVG Equity Curve ─────────────────────────────────────
  const curveW = 700;
  const curveH = 250;
  const pad = { top: 20, right: 20, bottom: 30, left: 60 };

  const curvePath = useMemo(() => {
    if (data.entries.length === 0) return "";
    const allEquities = [data.startingCapital, ...data.entries.map((e) => e.equity)];
    const minE = Math.min(...allEquities, data.startingCapital) * 0.95;
    const maxE = Math.max(...allEquities, data.targetCapital) * 1.05;
    const rangeE = maxE - minE || 1;
    const n = data.entries.length;

    const points = data.entries.map((e, i) => {
      const x = pad.left + (i / Math.max(n - 1, 1)) * (curveW - pad.left - pad.right);
      const y = pad.top + (1 - (e.equity - minE) / rangeE) * (curveH - pad.top - pad.bottom);
      return `${x},${y}`;
    });

    return `M${points.join(" L")}`;
  }, [data.entries, data.startingCapital, data.targetCapital]);

  const equityRange = useMemo(() => {
    if (data.entries.length === 0) return { min: data.startingCapital * 0.95, max: data.targetCapital * 1.05 };
    const allEquities = [data.startingCapital, ...data.entries.map((e) => e.equity)];
    return {
      min: Math.min(...allEquities, data.startingCapital) * 0.95,
      max: Math.max(...allEquities, data.targetCapital) * 1.05,
    };
  }, [data.entries, data.startingCapital, data.targetCapital]);

  const yToSvg = (val: number) => {
    const range = equityRange.max - equityRange.min || 1;
    return pad.top + (1 - (val - equityRange.min) / range) * (curveH - pad.top - pad.bottom);
  };

  // ─── Render ───────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Target className="w-5 h-5 text-[#BFFF00]" />
          <h2 className="text-lg font-bold text-white">
            Equity Tracker
          </h2>
          <span className="text-xs text-gray-500">
            ₹5L &rarr; ₹50L Journey
          </span>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-white">
            {fmtINR(stats.currentEquity)}
          </div>
          <div
            className={`text-sm font-medium ${
              stats.totalPnl >= 0 ? "text-[#BFFF00]" : "text-red-400"
            }`}
          >
            {stats.totalPnl >= 0 ? "+" : ""}
            {fmtINR(stats.totalPnl)} ({stats.progress.toFixed(1)}%)
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="glass-card p-4">
        <div className="flex justify-between text-xs text-gray-400 mb-2">
          <span>₹5L Start</span>
          <span>₹50L Target</span>
        </div>
        <div className="relative h-4 bg-[#1a1a1a] rounded-full overflow-hidden border border-[#3a3a3a]">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${stats.progress}%`,
              background:
                "linear-gradient(90deg, #BFFF00 0%, #8BC34A 100%)",
            }}
          />
          {/* Milestone markers */}
          {MILESTONES.map((m, i) => {
            const pct =
              ((m - START_CAPITAL) / (TARGET_CAPITAL - START_CAPITAL)) * 100;
            if (i === 0) return null; // skip start
            return (
              <div
                key={m}
                className="absolute top-0 h-full w-px bg-gray-600"
                style={{ left: `${pct}%` }}
              />
            );
          })}
        </div>
        {/* Milestone labels */}
        <div className="flex justify-between mt-2">
          {MILESTONES.map((m, i) => {
            const reached = stats.currentEquity >= m;
            return (
              <div
                key={m}
                className="flex flex-col items-center gap-0.5"
              >
                {reached ? (
                  <CheckCircle2 className="w-4 h-4 text-[#BFFF00]" />
                ) : (
                  <Circle className="w-4 h-4 text-gray-600" />
                )}
                <span
                  className={`text-[10px] ${
                    reached ? "text-[#BFFF00]" : "text-gray-500"
                  }`}
                >
                  {MILESTONE_LABELS[i]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-3">
        {[
          {
            label: "CAGR",
            value: `${stats.cagr.toFixed(1)}%`,
            icon: TrendingUp,
            color: stats.cagr >= 0 ? "text-[#BFFF00]" : "text-red-400",
          },
          {
            label: "Max Drawdown",
            value: `${stats.maxDD.toFixed(1)}%`,
            icon: TrendingDown,
            color: stats.maxDD > 20 ? "text-red-400" : "text-yellow-400",
          },
          {
            label: "Sharpe Ratio",
            value: stats.sharpe.toFixed(2),
            icon: Award,
            color:
              stats.sharpe >= 1.5
                ? "text-[#BFFF00]"
                : stats.sharpe >= 1
                ? "text-yellow-400"
                : "text-red-400",
          },
          {
            label: "Win Rate",
            value: `${stats.winRate.toFixed(0)}%`,
            icon: BarChart3,
            color:
              stats.winRate >= 50 ? "text-[#BFFF00]" : "text-red-400",
          },
        ].map((s) => (
          <div key={s.label} className="glass-card p-3 text-center">
            <s.icon className={`w-4 h-4 mx-auto mb-1 ${s.color}`} />
            <div className={`text-lg font-bold ${s.color}`}>
              {s.value}
            </div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Extra stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-card p-3 text-center">
          <div className="text-xs text-gray-500 mb-1">Best Day</div>
          <div className="text-sm font-bold text-[#BFFF00]">
            {fmtINR(stats.bestDay)}
          </div>
        </div>
        <div className="glass-card p-3 text-center">
          <div className="text-xs text-gray-500 mb-1">Worst Day</div>
          <div className="text-sm font-bold text-red-400">
            {fmtINR(stats.worstDay)}
          </div>
        </div>
        <div className="glass-card p-3 text-center">
          <div className="text-xs text-gray-500 mb-1">
            Req. Monthly Return
          </div>
          <div
            className={`text-sm font-bold ${
              stats.requiredMonthly > 20
                ? "text-red-400"
                : stats.requiredMonthly > 10
                ? "text-yellow-400"
                : "text-[#BFFF00]"
            }`}
          >
            {stats.requiredMonthly.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Days remaining */}
      <div className="glass-card p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-400">Days Remaining</span>
        </div>
        <span className="text-sm font-bold text-white">
          {stats.daysRemaining} days ({stats.daysElapsed} elapsed)
        </span>
      </div>

      {/* Log P&L Input */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Plus className="w-4 h-4 text-[#BFFF00]" />
          <span className="text-sm font-semibold text-white">
            Log Today&apos;s P&amp;L
          </span>
        </div>
        <div className="flex gap-2">
          <input
            type="date"
            value={dateInput}
            onChange={(e) => setDateInput(e.target.value)}
            className="bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg px-3 py-2 text-sm text-white focus:border-[#BFFF00] focus:outline-none"
          />
          <input
            type="number"
            placeholder="P&L amount (e.g. 5000 or -2000)"
            value={pnlInput}
            onChange={(e) => setPnlInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addEntry()}
            className="flex-1 bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-[#BFFF00] focus:outline-none"
          />
          <button
            onClick={addEntry}
            className="bg-[#BFFF00] text-black px-4 py-2 rounded-lg text-sm font-bold hover:bg-[#a8e600] transition-colors"
          >
            Add
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#1a1a1a] rounded-lg p-1 border border-[#3a3a3a]">
        {(["curve", "daily", "monthly"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeTab === t
                ? "bg-[#BFFF00] text-black"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {t === "curve"
              ? "Equity Curve"
              : t === "daily"
              ? "Daily P&L"
              : "Monthly"}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="glass-card p-4">
        {activeTab === "curve" && (
          <div>
            {data.entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <TrendingUp className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm">No data yet. Log your first P&amp;L above.</p>
              </div>
            ) : (
              <svg
                viewBox={`0 0 ${curveW} ${curveH}`}
                className="w-full"
                preserveAspectRatio="xMidYMid meet"
              >
                {/* Grid lines */}
                {[0.25, 0.5, 0.75].map((frac) => {
                  const val =
                    equityRange.min +
                    frac * (equityRange.max - equityRange.min);
                  const y = yToSvg(val);
                  return (
                    <g key={frac}>
                      <line
                        x1={pad.left}
                        y1={y}
                        x2={curveW - pad.right}
                        y2={y}
                        stroke="#333"
                        strokeWidth={0.5}
                      />
                      <text
                        x={pad.left - 5}
                        y={y + 3}
                        textAnchor="end"
                        fill="#666"
                        fontSize={9}
                      >
                        {fmtINR(val)}
                      </text>
                    </g>
                  );
                })}

                {/* Start line ₹5L */}
                <line
                  x1={pad.left}
                  y1={yToSvg(START_CAPITAL)}
                  x2={curveW - pad.right}
                  y2={yToSvg(START_CAPITAL)}
                  stroke="#BFFF00"
                  strokeWidth={1}
                  opacity={0.4}
                />
                <text
                  x={curveW - pad.right + 2}
                  y={yToSvg(START_CAPITAL) + 3}
                  fill="#BFFF00"
                  fontSize={8}
                  opacity={0.6}
                >
                  ₹5L
                </text>

                {/* Target line ₹50L (dashed) */}
                <line
                  x1={pad.left}
                  y1={yToSvg(TARGET_CAPITAL)}
                  x2={curveW - pad.right}
                  y2={yToSvg(TARGET_CAPITAL)}
                  stroke="#BFFF00"
                  strokeWidth={1}
                  strokeDasharray="6,4"
                  opacity={0.6}
                />
                <text
                  x={curveW - pad.right + 2}
                  y={yToSvg(TARGET_CAPITAL) + 3}
                  fill="#BFFF00"
                  fontSize={8}
                  opacity={0.8}
                >
                  ₹50L
                </text>

                {/* Equity curve */}
                <path
                  d={curvePath}
                  fill="none"
                  stroke="#BFFF00"
                  strokeWidth={2}
                />

                {/* Area fill */}
                {data.entries.length > 0 && (
                  <path
                    d={`${curvePath} L${
                      pad.left +
                      ((data.entries.length - 1) /
                        Math.max(data.entries.length - 1, 1)) *
                        (curveW - pad.left - pad.right)
                    },${
                      curveH - pad.bottom
                    } L${pad.left},${curveH - pad.bottom} Z`}
                    fill="url(#equityGrad)"
                    opacity={0.3}
                  />
                )}

                <defs>
                  <linearGradient
                    id="equityGrad"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#BFFF00" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#BFFF00" stopOpacity={0} />
                  </linearGradient>
                </defs>

                {/* Date labels */}
                {data.entries.length > 1 &&
                  [0, Math.floor(data.entries.length / 2), data.entries.length - 1].map(
                    (idx) => {
                      const e = data.entries[idx];
                      const x =
                        pad.left +
                        (idx / Math.max(data.entries.length - 1, 1)) *
                          (curveW - pad.left - pad.right);
                      return (
                        <text
                          key={idx}
                          x={x}
                          y={curveH - 8}
                          textAnchor="middle"
                          fill="#666"
                          fontSize={8}
                        >
                          {e.date.slice(5)}
                        </text>
                      );
                    }
                  )}
              </svg>
            )}
          </div>
        )}

        {activeTab === "daily" && (
          <div>
            {last30.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <BarChart3 className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm">No daily data yet.</p>
              </div>
            ) : (
              <div>
                {/* Bar chart using SVG */}
                <svg
                  viewBox={`0 0 ${curveW} 200`}
                  className="w-full"
                  preserveAspectRatio="xMidYMid meet"
                >
                  {(() => {
                    const maxPnl = Math.max(
                      ...last30.map((e) => Math.abs(e.pnl)),
                      1
                    );
                    const mid = 100;
                    const barW =
                      (curveW - pad.left - pad.right) / last30.length - 2;

                    return last30.map((e, i) => {
                      const x =
                        pad.left +
                        (i / last30.length) *
                          (curveW - pad.left - pad.right) +
                        1;
                      const h = (Math.abs(e.pnl) / maxPnl) * 80;
                      const y = e.pnl >= 0 ? mid - h : mid;
                      const fill =
                        e.pnl >= 0 ? "#BFFF00" : "#ef4444";

                      return (
                        <g key={e.date}>
                          <rect
                            x={x}
                            y={y}
                            width={Math.max(barW, 2)}
                            height={Math.max(h, 1)}
                            fill={fill}
                            rx={1}
                            opacity={0.8}
                          />
                          {i % Math.ceil(last30.length / 6) === 0 && (
                            <text
                              x={x + barW / 2}
                              y={190}
                              textAnchor="middle"
                              fill="#666"
                              fontSize={7}
                            >
                              {e.date.slice(5)}
                            </text>
                          )}
                        </g>
                      );
                    });
                  })()}
                  {/* Zero line */}
                  <line
                    x1={pad.left}
                    y1={100}
                    x2={curveW - pad.right}
                    y2={100}
                    stroke="#555"
                    strokeWidth={0.5}
                  />
                </svg>

                {/* Recent entries list */}
                <div className="mt-4 max-h-48 overflow-y-auto space-y-1">
                  {[...last30].reverse().map((e) => (
                    <div
                      key={e.date}
                      className="flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-[#2a2a2a] transition-colors group"
                    >
                      <span className="text-xs text-gray-400">
                        {e.date}
                      </span>
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-xs font-bold ${
                            e.pnl >= 0 ? "text-[#BFFF00]" : "text-red-400"
                          }`}
                        >
                          {e.pnl >= 0 ? "+" : ""}
                          {fmtINR(e.pnl)}
                        </span>
                        <span className="text-xs text-gray-500">
                          = {fmtINR(e.equity)}
                        </span>
                        <button
                          onClick={() => deleteEntry(e.date)}
                          className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "monthly" && (
          <div>
            {monthlySummary.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <Calendar className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm">No monthly data yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-[#3a3a3a]">
                      <th className="text-left py-2 px-2">Month</th>
                      <th className="text-right py-2 px-2">P&amp;L</th>
                      <th className="text-right py-2 px-2">
                        Trading Days
                      </th>
                      <th className="text-right py-2 px-2">Avg/Day</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlySummary.map((m) => (
                      <tr
                        key={m.month}
                        className="border-b border-[#2a2a2a] hover:bg-[#2a2a2a]"
                      >
                        <td className="py-2 px-2 text-gray-300">
                          {m.month}
                        </td>
                        <td
                          className={`py-2 px-2 text-right font-bold ${
                            m.pnl >= 0 ? "text-[#BFFF00]" : "text-red-400"
                          }`}
                        >
                          {m.pnl >= 0 ? "+" : ""}
                          {fmtINR(m.pnl)}
                        </td>
                        <td className="py-2 px-2 text-right text-gray-400">
                          {m.trades}
                        </td>
                        <td
                          className={`py-2 px-2 text-right ${
                            m.pnl / m.trades >= 0
                              ? "text-[#BFFF00]"
                              : "text-red-400"
                          }`}
                        >
                          {fmtINR(m.pnl / m.trades)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Warning if required monthly is extreme */}
      {stats.requiredMonthly > 25 && data.entries.length > 0 && (
        <div className="glass-card p-3 border-l-2 border-red-500 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
          <p className="text-xs text-red-300">
            Required monthly return of {stats.requiredMonthly.toFixed(1)}%
            is very aggressive. Consider extending your timeline or
            adjusting the target.
          </p>
        </div>
      )}
    </div>
  );
}
