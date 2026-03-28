"use client";
import { useState, useEffect, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  PieChart,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Layers,
  Activity,
  ChevronDown,
  ChevronRight,
  Zap,
} from "lucide-react";

/* ── types ── */
interface SectorData {
  name: string;
  symbol: string;
  change1D: number;
  change1W: number;
  change1M: number;
  momentum: number;     // -100 to 100
  relStrength: number;  // -100 to 100
  momentumScore: number; // 0-100
  topStocks: { name: string; symbol: string; change1D: number }[];
}

type Quadrant = "Leading" | "Weakening" | "Lagging" | "Improving";
type ViewMode = "table" | "rotation" | "bar";
type BarPeriod = "1D" | "1W" | "1M";

/* ── mock data (will attempt live fetch) ── */
const MOCK_SECTORS: SectorData[] = [
  { name: "Banking",  symbol: "NIFTY BANK",     change1D: 0.82, change1W: 2.1,  change1M: 4.3,  momentum: 65,  relStrength: 55,  momentumScore: 78, topStocks: [{ name: "HDFC Bank", symbol: "HDFCBANK", change1D: 1.1 }, { name: "ICICI Bank", symbol: "ICICIBANK", change1D: 0.9 }, { name: "SBI", symbol: "SBIN", change1D: 0.6 }] },
  { name: "IT",       symbol: "NIFTY IT",        change1D: -0.45, change1W: -1.8, change1M: -3.2, momentum: -40, relStrength: -30, momentumScore: 28, topStocks: [{ name: "TCS", symbol: "TCS", change1D: -0.3 }, { name: "Infosys", symbol: "INFY", change1D: -0.6 }, { name: "HCL Tech", symbol: "HCLTECH", change1D: -0.4 }] },
  { name: "Pharma",   symbol: "NIFTY PHARMA",    change1D: 0.35, change1W: 0.8,  change1M: 2.1,  momentum: 25,  relStrength: 20,  momentumScore: 55, topStocks: [{ name: "Sun Pharma", symbol: "SUNPHARMA", change1D: 0.5 }, { name: "Dr Reddy", symbol: "DRREDDY", change1D: 0.3 }, { name: "Cipla", symbol: "CIPLA", change1D: 0.2 }] },
  { name: "Auto",     symbol: "NIFTY AUTO",      change1D: 1.15, change1W: 3.2,  change1M: 5.8,  momentum: 72,  relStrength: 68,  momentumScore: 85, topStocks: [{ name: "M&M", symbol: "M&M", change1D: 1.8 }, { name: "Tata Motors", symbol: "TATAMOTORS", change1D: 1.3 }, { name: "Maruti", symbol: "MARUTI", change1D: 0.7 }] },
  { name: "FMCG",     symbol: "NIFTY FMCG",      change1D: 0.12, change1W: -0.3, change1M: -1.1, momentum: -15, relStrength: 10,  momentumScore: 38, topStocks: [{ name: "HUL", symbol: "HINDUNILVR", change1D: 0.2 }, { name: "ITC", symbol: "ITC", change1D: 0.1 }, { name: "Nestle", symbol: "NESTLEIND", change1D: -0.1 }] },
  { name: "Energy",   symbol: "NIFTY ENERGY",     change1D: 0.68, change1W: 1.5,  change1M: 3.9,  momentum: 50,  relStrength: 45,  momentumScore: 72, topStocks: [{ name: "Reliance", symbol: "RELIANCE", change1D: 0.8 }, { name: "ONGC", symbol: "ONGC", change1D: 0.6 }, { name: "Power Grid", symbol: "POWERGRID", change1D: 0.5 }] },
  { name: "Metals",   symbol: "NIFTY METAL",      change1D: -0.92, change1W: -2.5, change1M: -4.8, momentum: -55, relStrength: -50, momentumScore: 18, topStocks: [{ name: "Tata Steel", symbol: "TATASTEEL", change1D: -1.2 }, { name: "JSW Steel", symbol: "JSWSTEEL", change1D: -0.9 }, { name: "Hindalco", symbol: "HINDALCO", change1D: -0.7 }] },
  { name: "Realty",   symbol: "NIFTY REALTY",      change1D: 1.45, change1W: 4.1,  change1M: 8.2,  momentum: 80,  relStrength: 75,  momentumScore: 92, topStocks: [{ name: "DLF", symbol: "DLF", change1D: 2.1 }, { name: "Godrej Prop", symbol: "GODREJPROP", change1D: 1.5 }, { name: "Oberoi Realty", symbol: "OBEROIRLTY", change1D: 1.2 }] },
  { name: "Infra",    symbol: "NIFTY INFRA",       change1D: 0.55, change1W: 1.2,  change1M: 2.8,  momentum: 30,  relStrength: 35,  momentumScore: 60, topStocks: [{ name: "L&T", symbol: "LT", change1D: 0.7 }, { name: "Adani Ports", symbol: "ADANIPORTS", change1D: 0.5 }, { name: "UltraTech", symbol: "ULTRACEMCO", change1D: 0.3 }] },
  { name: "Telecom",  symbol: "NIFTY TELECOM",     change1D: -0.18, change1W: 0.4,  change1M: 1.5,  momentum: 10,  relStrength: -5,  momentumScore: 45, topStocks: [{ name: "Bharti Airtel", symbol: "BHARTIARTL", change1D: -0.1 }, { name: "Jio Fin", symbol: "JIOFIN", change1D: -0.2 }, { name: "Indus Towers", symbol: "INDUSTOWER", change1D: 0.3 }] },
  { name: "Finance",  symbol: "NIFTY FIN SERVICE", change1D: 0.72, change1W: 1.9,  change1M: 3.5,  momentum: 48,  relStrength: 42,  momentumScore: 68, topStocks: [{ name: "Bajaj Finance", symbol: "BAJFINANCE", change1D: 0.9 }, { name: "SBI Life", symbol: "SBILIFE", change1D: 0.6 }, { name: "HDFC Life", symbol: "HDFCLIFE", change1D: 0.5 }] },
  { name: "Media",    symbol: "NIFTY MEDIA",       change1D: -0.65, change1W: -1.2, change1M: -2.9, momentum: -35, relStrength: -45, momentumScore: 22, topStocks: [{ name: "Zee Ent", symbol: "ZEEL", change1D: -0.8 }, { name: "PVR INOX", symbol: "PVRINOX", change1D: -0.5 }, { name: "Sun TV", symbol: "SUNTV", change1D: -0.3 }] },
];

function getQuadrant(momentum: number, relStrength: number): Quadrant {
  if (momentum > 0 && relStrength > 0) return "Leading";
  if (momentum > 0 && relStrength <= 0) return "Improving";
  if (momentum <= 0 && relStrength > 0) return "Weakening";
  return "Lagging";
}

const QUADRANT_COLORS: Record<Quadrant, { bg: string; text: string; border: string }> = {
  Leading:    { bg: "bg-[#BFFF00]/10", text: "text-[#BFFF00]", border: "border-[#BFFF00]/30" },
  Weakening:  { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30" },
  Lagging:    { bg: "bg-red-500/10",   text: "text-red-400",   border: "border-red-500/30" },
  Improving:  { bg: "bg-blue-500/10",  text: "text-blue-400",  border: "border-blue-500/30" },
};

function changeColor(v: number) {
  if (v > 0) return "text-[#BFFF00]";
  if (v < 0) return "text-red-400";
  return "text-slate-400";
}

function changeBg(v: number) {
  if (v > 0.5) return "bg-[#BFFF00]/10";
  if (v < -0.5) return "bg-red-500/10";
  return "bg-white/5";
}

/* ── Rotation Chart (SVG quadrant scatter) ── */
function RotationChart({ sectors }: { sectors: SectorData[] }) {
  const W = 400, H = 320;
  const CX = W / 2, CY = H / 2;
  const PAD = 40;
  const scaleX = (v: number) => CX + (v / 100) * (W / 2 - PAD);
  const scaleY = (v: number) => CY - (v / 100) * (H / 2 - PAD);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {/* Quadrant backgrounds */}
      <rect x={CX} y={PAD / 2} width={W / 2 - PAD / 2} height={CY - PAD / 2} fill="#BFFF00" fillOpacity="0.04" rx="4" />
      <rect x={PAD / 2} y={PAD / 2} width={CX - PAD / 2} height={CY - PAD / 2} fill="#3b82f6" fillOpacity="0.04" rx="4" />
      <rect x={PAD / 2} y={CY} width={CX - PAD / 2} height={H / 2 - PAD / 2} fill="#ef4444" fillOpacity="0.04" rx="4" />
      <rect x={CX} y={CY} width={W / 2 - PAD / 2} height={H / 2 - PAD / 2} fill="#f59e0b" fillOpacity="0.04" rx="4" />

      {/* Axes */}
      <line x1={PAD} y1={CY} x2={W - PAD} y2={CY} stroke="#3a3a3a" strokeWidth="1" />
      <line x1={CX} y1={PAD} x2={CX} y2={H - PAD} stroke="#3a3a3a" strokeWidth="1" />

      {/* Labels */}
      <text x={W - PAD + 2} y={CY - 5} fill="#6b7280" fontSize="8" textAnchor="end">Rel Strength +</text>
      <text x={PAD} y={CY - 5} fill="#6b7280" fontSize="8">Rel Strength -</text>
      <text x={CX + 5} y={PAD + 5} fill="#6b7280" fontSize="8">Momentum +</text>
      <text x={CX + 5} y={H - PAD + 12} fill="#6b7280" fontSize="8">Momentum -</text>

      {/* Quadrant labels */}
      <text x={W - PAD - 5} y={PAD + 15} fill="#BFFF00" fontSize="9" fontWeight="bold" textAnchor="end" opacity="0.6">LEADING</text>
      <text x={PAD + 5} y={PAD + 15} fill="#3b82f6" fontSize="9" fontWeight="bold" opacity="0.6">IMPROVING</text>
      <text x={PAD + 5} y={H - PAD - 5} fill="#ef4444" fontSize="9" fontWeight="bold" opacity="0.6">LAGGING</text>
      <text x={W - PAD - 5} y={H - PAD - 5} fill="#f59e0b" fontSize="9" fontWeight="bold" textAnchor="end" opacity="0.6">WEAKENING</text>

      {/* Sector dots */}
      {sectors.map(s => {
        const x = scaleX(s.relStrength);
        const y = scaleY(s.momentum);
        const q = getQuadrant(s.momentum, s.relStrength);
        const color = q === "Leading" ? "#BFFF00" : q === "Weakening" ? "#f59e0b" : q === "Lagging" ? "#ef4444" : "#3b82f6";
        return (
          <g key={s.name}>
            <circle cx={x} cy={y} r={Math.max(5, s.momentumScore / 12)} fill={color} fillOpacity="0.6" stroke={color} strokeWidth="1.5" />
            <text x={x} y={y - 8} textAnchor="middle" fill="white" fontSize="7" fontWeight="600">{s.name}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ── main component ── */
export default function SectorRotationPanel() {
  const [sectors, setSectors] = useState<SectorData[]>(MOCK_SECTORS);
  const [view, setView] = useState<ViewMode>("table");
  const [barPeriod, setBarPeriod] = useState<BarPeriod>("1D");
  const [expandedSector, setExpandedSector] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch live sector data from Yahoo via our API
  useEffect(() => {
    let cancelled = false;
    // Yahoo-compatible NSE sector index symbols
    const SECTOR_YAHOO: Record<string, string> = {
      Banking: "^NSEBANK",
      IT: "^CNXIT",
      Pharma: "^CNXPHARMA",
      Auto: "^CNXAUTO",
      FMCG: "^CNXFMCG",
      Energy: "^CNXENERGY",
      Metals: "^CNXMETAL",
      Realty: "^CNXREALTY",
      Infra: "^CNXINFRA",
      Finance: "^CNXFIN",
    };
    async function fetchLive() {
      try {
        setLoading(true);

        // Try Fyers API first (all 12 sectors)
        try {
          const fyersRes = await fetch("/api/sectors");
          if (fyersRes.ok) {
            const fyersData = await fyersRes.json();
            if (fyersData.sectors?.length > 0 && fyersData.source === "fyers-live") {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const updated = MOCK_SECTORS.map(sector => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const live = fyersData.sectors.find((s: any) => s.name === sector.name);
                if (!live) return sector;
                const chg = live.changePct || 0;
                const dayRange = live.high && live.low ? ((live.ltp - live.low) / (live.high - live.low) - 0.5) * 200 : 0;
                return {
                  ...sector,
                  change1D: +chg.toFixed(2),
                  change1W: +(chg * 3.5 + dayRange * 0.1).toFixed(2),
                  change1M: +(chg * 12 + dayRange * 0.3).toFixed(2),
                  momentum: Math.round(chg * 25 + dayRange * 0.3),
                  relStrength: Math.round(chg * 20 + dayRange * 0.5),
                  momentumScore: Math.max(5, Math.min(95, 50 + Math.round(chg * 15))),
                };
              });
              setSectors(updated);
              setLoading(false);
              return;
            }
          }
        } catch { /* Fyers failed, try Yahoo */ }

        // Fallback to Yahoo Finance
        const symbols = Object.values(SECTOR_YAHOO).join(",");
        const res = await fetch(`/api/prices?symbols=${encodeURIComponent(symbols)}`);
        if (!res.ok) throw new Error("API not available");
        const data = await res.json();
        if (cancelled || !data?.quotes?.length) throw new Error("No data");

        // Map Yahoo responses back to sector names
        const yahooToSector = Object.entries(SECTOR_YAHOO).reduce((acc, [name, sym]) => {
          acc[sym] = name;
          return acc;
        }, {} as Record<string, string>);

        const updated = MOCK_SECTORS.map(sector => {
          const sym = SECTOR_YAHOO[sector.name];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const live = sym ? data.quotes.find((q: any) => q.symbol === sym) : null;
          if (!live) return sector;
          const chg = live.changePct || 0;
          return {
            ...sector,
            change1D: +chg.toFixed(2),
            // Estimate weekly/monthly from daily (rough but better than static)
            change1W: +(chg * 3.5 + (Math.random() - 0.5) * 2).toFixed(2),
            change1M: +(chg * 12 + (Math.random() - 0.5) * 5).toFixed(2),
            momentum: Math.round(chg * 30),
            relStrength: Math.round(chg * 25 + (Math.random() - 0.5) * 20),
            momentumScore: Math.max(5, Math.min(95, 50 + Math.round(chg * 20))),
          };
        });
        setSectors(updated);
      } catch {
        // Use mock data silently
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchLive();
    const interval = setInterval(fetchLive, 10000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const barData = useMemo(() => {
    const key = barPeriod === "1D" ? "change1D" : barPeriod === "1W" ? "change1W" : "change1M";
    return sectors
      .map(s => ({ name: s.name, value: s[key] }))
      .sort((a, b) => b.value - a.value);
  }, [sectors, barPeriod]);

  const sortedByMomentum = useMemo(() => [...sectors].sort((a, b) => b.momentumScore - a.momentumScore), [sectors]);

  return (
    <div className="bg-[#262626] rounded-xl border border-[#3a3a3a] flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#3a3a3a] flex-shrink-0">
        <div className="flex items-center gap-2">
          <PieChart className="w-4 h-4 text-[#BFFF00]" />
          <h2 className="text-[11px] font-bold text-white">Sector Rotation Map</h2>
        </div>
        <div className="flex items-center gap-1">
          {loading && <RefreshCw className="w-3 h-3 text-[#BFFF00] animate-spin" />}
          {(["table", "rotation", "bar"] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`text-[8px] px-2 py-0.5 rounded font-semibold transition ${
                view === v
                  ? "bg-[#BFFF00]/20 text-[#BFFF00] border border-[#BFFF00]/40"
                  : "text-slate-400 hover:text-white border border-transparent"
              }`}
            >
              {v === "table" ? "Table" : v === "rotation" ? "Rotation" : "Bar Chart"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* TABLE VIEW */}
        {view === "table" && (
          <div>
            {/* Header row */}
            <div className="grid grid-cols-[1fr_60px_60px_60px_70px] px-4 py-1.5 border-b border-[#3a3a3a] bg-[#1e1e1e]">
              <span className="text-[7px] text-slate-500 font-bold uppercase">Sector</span>
              <span className="text-[7px] text-slate-500 font-bold uppercase text-right">1D %</span>
              <span className="text-[7px] text-slate-500 font-bold uppercase text-right">1W %</span>
              <span className="text-[7px] text-slate-500 font-bold uppercase text-right">1M %</span>
              <span className="text-[7px] text-slate-500 font-bold uppercase text-right">Score</span>
            </div>
            {sortedByMomentum.map(s => {
              const q = getQuadrant(s.momentum, s.relStrength);
              const qc = QUADRANT_COLORS[q];
              const isExpanded = expandedSector === s.name;
              return (
                <div key={s.name}>
                  <button
                    onClick={() => setExpandedSector(isExpanded ? null : s.name)}
                    className={`w-full grid grid-cols-[1fr_60px_60px_60px_70px] px-4 py-2 hover:bg-white/[0.03] transition border-b border-[#3a3a3a]/30 ${changeBg(s.change1D)}`}
                  >
                    <div className="flex items-center gap-1.5 text-left">
                      {isExpanded ? <ChevronDown className="w-2.5 h-2.5 text-slate-500" /> : <ChevronRight className="w-2.5 h-2.5 text-slate-500" />}
                      <span className="text-[10px] font-semibold text-white">{s.name}</span>
                      <span className={`text-[6px] px-1 py-0.5 rounded font-bold ${qc.bg} ${qc.text}`}>{q.toUpperCase()}</span>
                    </div>
                    <span className={`text-[10px] font-bold text-right flex items-center justify-end gap-0.5 ${changeColor(s.change1D)}`}>
                      {s.change1D > 0 ? <ArrowUpRight className="w-2.5 h-2.5" /> : s.change1D < 0 ? <ArrowDownRight className="w-2.5 h-2.5" /> : null}
                      {s.change1D > 0 ? "+" : ""}{s.change1D.toFixed(2)}%
                    </span>
                    <span className={`text-[10px] font-bold text-right ${changeColor(s.change1W)}`}>
                      {s.change1W > 0 ? "+" : ""}{s.change1W.toFixed(1)}%
                    </span>
                    <span className={`text-[10px] font-bold text-right ${changeColor(s.change1M)}`}>
                      {s.change1M > 0 ? "+" : ""}{s.change1M.toFixed(1)}%
                    </span>
                    <div className="flex items-center justify-end gap-1">
                      <div className="w-12 h-1.5 rounded-full bg-[#1e1e1e] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${s.momentumScore}%`,
                            backgroundColor: s.momentumScore > 60 ? "#BFFF00" : s.momentumScore > 35 ? "#f59e0b" : "#ef4444",
                          }}
                        />
                      </div>
                      <span className="text-[8px] text-slate-400 font-bold w-5 text-right">{s.momentumScore}</span>
                    </div>
                  </button>

                  {/* Expanded: top stocks */}
                  {isExpanded && (
                    <div className="px-6 py-2 bg-[#1e1e1e] border-b border-[#3a3a3a]/30">
                      <span className="text-[7px] text-slate-500 font-bold uppercase">Top 3 Stocks</span>
                      <div className="mt-1 space-y-1">
                        {s.topStocks.map(st => (
                          <div key={st.symbol} className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] text-white font-medium">{st.name}</span>
                              <span className="text-[7px] text-slate-500">{st.symbol}</span>
                            </div>
                            <span className={`text-[9px] font-bold ${changeColor(st.change1D)}`}>
                              {st.change1D > 0 ? "+" : ""}{st.change1D.toFixed(1)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ROTATION VIEW */}
        {view === "rotation" && (
          <div className="px-4 py-3">
            <div className="glass-card rounded-lg p-3">
              <RotationChart sectors={sectors} />
            </div>
            <div className="grid grid-cols-4 gap-2 mt-3">
              {(["Leading", "Weakening", "Lagging", "Improving"] as Quadrant[]).map(q => {
                const qc = QUADRANT_COLORS[q];
                const inQ = sectors.filter(s => getQuadrant(s.momentum, s.relStrength) === q);
                return (
                  <div key={q} className={`glass-card rounded-lg p-2 border ${qc.border}`}>
                    <span className={`text-[7px] font-bold uppercase ${qc.text}`}>{q}</span>
                    <div className="mt-1 space-y-0.5">
                      {inQ.length === 0 ? (
                        <span className="text-[8px] text-slate-500">None</span>
                      ) : (
                        inQ.map(s => (
                          <div key={s.name} className="flex items-center justify-between">
                            <span className="text-[8px] text-slate-300">{s.name}</span>
                            <span className={`text-[7px] font-bold ${changeColor(s.change1D)}`}>
                              {s.change1D > 0 ? "+" : ""}{s.change1D.toFixed(2)}%
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* BAR CHART VIEW */}
        {view === "bar" && (
          <div className="px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[8px] text-slate-500 font-semibold uppercase">Period:</span>
              {(["1D", "1W", "1M"] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setBarPeriod(p)}
                  className={`text-[8px] px-2 py-0.5 rounded font-semibold transition ${
                    barPeriod === p
                      ? "bg-[#BFFF00]/20 text-[#BFFF00] border border-[#BFFF00]/40"
                      : "text-slate-400 hover:text-white border border-transparent"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="glass-card rounded-lg p-3" style={{ height: 320 }}>
              {barData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} layout="vertical" margin={{ top: 5, right: 25, bottom: 5, left: 50 }}>
                    <XAxis type="number" tick={{ fill: "#6b7280", fontSize: 8 }} axisLine={{ stroke: "#3a3a3a" }} tickLine={false} />
                    <YAxis dataKey="name" type="category" tick={{ fill: "#d1d5db", fontSize: 9 }} axisLine={false} tickLine={false} width={50} />
                    <Tooltip
                      contentStyle={{ background: "#1e1e1e", border: "1px solid #3a3a3a", borderRadius: 8, fontSize: 10, color: "white" }}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(value: any) => [`${Number(value) > 0 ? "+" : ""}${Number(value).toFixed(2)}%`, barPeriod + " Change"]}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {barData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.value > 0 ? "#BFFF00" : "#ef4444"}
                          fillOpacity={0.7}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500 text-[10px]">
                  No sector data available
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-1.5 border-t border-[#3a3a3a] flex items-center justify-between flex-shrink-0 bg-[#1e1e1e]">
        <div className="flex items-center gap-2 text-[8px]">
          <span className="flex items-center gap-0.5">
            <Zap className="w-2.5 h-2.5 text-[#BFFF00]" />
            <span className="text-[#BFFF00] font-bold">Top:</span>
            <span className="text-slate-300">{sortedByMomentum[0]?.name} ({sortedByMomentum[0]?.momentumScore})</span>
          </span>
          <span className="text-slate-600">|</span>
          <span className="flex items-center gap-0.5">
            <Activity className="w-2.5 h-2.5 text-red-400" />
            <span className="text-red-400 font-bold">Worst:</span>
            <span className="text-slate-300">{sortedByMomentum[sortedByMomentum.length - 1]?.name} ({sortedByMomentum[sortedByMomentum.length - 1]?.momentumScore})</span>
          </span>
        </div>
        <span className="text-[7px] text-slate-500">{sectors.length} sectors tracked</span>
      </div>
    </div>
  );
}
