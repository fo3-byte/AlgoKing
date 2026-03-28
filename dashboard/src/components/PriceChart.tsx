"use client";
import { useState, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Line, ComposedChart } from "recharts";
import { useChartData } from "@/hooks/useYahooData";
import { generatePriceCandles } from "@/lib/data";
import { Eye, EyeOff } from "lucide-react";

const assets = [
  { key: "CL", label: "WTI Crude", color: "#22c55e" },
  { key: "BZ", label: "Brent", color: "#3b82f6" },
  { key: "GC", label: "Gold", color: "#f59e0b" },
  { key: "BTC", label: "Bitcoin", color: "#a855f7" },
  { key: "ES", label: "S&P 500", color: "#06b6d4" },
  { key: "NQ", label: "Nasdaq", color: "#ec4899" },
];

const TF_MAP: Record<string, { interval: string; range: string }> = {
  "5m": { interval: "1m", range: "1d" },
  "15m": { interval: "5m", range: "5d" },
  "1H": { interval: "15m", range: "5d" },
  "4H": { interval: "1h", range: "1mo" },
  "1D": { interval: "1d", range: "6mo" },
};

export default function PriceChart() {
  const [selected, setSelected] = useState("CL");
  const [tf, setTf] = useState("1H");
  const [showBB, setShowBB] = useState(true);
  const [showMA, setShowMA] = useState(true);

  const tfConfig = TF_MAP[tf] || TF_MAP["1H"];
  const { points: livePoints, meta, source } = useChartData(selected, tfConfig.interval, tfConfig.range, 2000);

  // Fallback to simulated data if Yahoo fails
  const [simData, setSimData] = useState(generatePriceCandles(selected));
  useEffect(() => { setSimData(generatePriceCandles(selected)); }, [selected]);

  const data = livePoints.length > 0 ? livePoints : simData;
  const isLive = livePoints.length > 0;

  const last = data[data.length - 1];
  const first = data[0];
  if (!last || !first) return null;

  const change = last.close - first.open;
  const changePct = first.open ? (change / first.open) * 100 : 0;
  const isUp = change >= 0;
  const high24 = Math.max(...data.map(d => d.high));
  const low24 = Math.min(...data.map(d => d.low));
  const totalVol = data.reduce((s, d) => s + d.volume, 0);
  const assetColor = assets.find(a => a.key === selected)?.color || "#22c55e";

  return (
    <div className="bg-[#262626] rounded-xl border border-[#3a3a3a] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#3a3a3a]">
        <div className="flex items-center gap-1">
          {assets.map(a => (
            <button key={a.key} onClick={() => setSelected(a.key)}
              className={`text-[10px] px-2 py-1 rounded font-medium transition ${selected === a.key ? "text-white" : "text-slate-500 hover:text-slate-300"}`}
              style={selected === a.key ? { background: a.color + "20", color: a.color } : {}}>
              {a.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-0.5 bg-[#333333] rounded p-0.5">
            {Object.keys(TF_MAP).map(t => (
              <button key={t} onClick={() => setTf(t)}
                className={`text-[9px] px-2 py-0.5 rounded font-medium transition ${tf === t ? "bg-[#333333] text-white" : "text-slate-500 hover:text-slate-300"}`}>
                {t}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-[9px]">
            <button onClick={() => setShowMA(!showMA)} className={`flex items-center gap-0.5 ${showMA ? "text-cyan-400" : "text-slate-600"}`}>
              {showMA ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5" />} MA
            </button>
            <button onClick={() => setShowBB(!showBB)} className={`flex items-center gap-0.5 ${showBB ? "text-amber-400" : "text-slate-600"}`}>
              {showBB ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5" />} BB
            </button>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className={`w-1.5 h-1.5 rounded-full ${isLive ? "bg-green-400 pulse-dot" : "bg-amber-400"}`} />
            <span className="text-white font-bold text-sm">{last.close.toLocaleString()}</span>
            <span className={`font-semibold ${isUp ? "text-green-400" : "text-red-400"}`}>
              {isUp ? "+" : ""}{change.toFixed(2)} ({changePct.toFixed(2)}%)
            </span>
          </div>
        </div>
      </div>
      {/* Stats bar */}
      <div className="flex items-center gap-4 px-4 py-1.5 border-b border-[#3a3a3a]/50 text-[10px] text-slate-500">
        <span>O <span className="text-slate-300">{last.open}</span></span>
        <span>H <span className="text-green-400">{last.high}</span></span>
        <span>L <span className="text-red-400">{last.low}</span></span>
        <span>C <span className="text-white">{last.close}</span></span>
        <span className="text-slate-600">|</span>
        <span>24h Hi <span className="text-green-400">{high24.toFixed(2)}</span></span>
        <span>24h Lo <span className="text-red-400">{low24.toFixed(2)}</span></span>
        <span>Vol <span className="text-blue-400">{(totalVol / 1000).toFixed(0)}K</span></span>
        {isLive && <span className="text-[8px] text-green-500 ml-auto">● YAHOO FINANCE LIVE</span>}
        {!isLive && <span className="text-[8px] text-amber-400 ml-auto">● SIMULATED</span>}
      </div>
      {/* Chart */}
      <div className="px-1 pt-1" style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
            <defs>
              <linearGradient id={`grad-${selected}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={assetColor} stopOpacity={0.2} />
                <stop offset="100%" stopColor={assetColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="time" tick={{ fontSize: 8, fill: "#475569" }} axisLine={false} tickLine={false} interval={8} />
            <YAxis domain={["dataMin", "dataMax"]} tick={{ fontSize: 8, fill: "#475569" }} axisLine={false} tickLine={false} width={45} />
            <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #222222", borderRadius: 8, fontSize: 10, padding: "6px 10px" }} labelStyle={{ color: "#64748b", fontSize: 9 }} />
            {showBB && <Area type="monotone" dataKey="bbUpper" stroke="transparent" fill="#f59e0b" fillOpacity={0.04} dot={false} />}
            {showBB && <Area type="monotone" dataKey="bbLower" stroke="transparent" fill="transparent" dot={false} />}
            {showBB && <Line type="monotone" dataKey="bbUpper" stroke="#f59e0b" strokeWidth={0.5} strokeDasharray="3 3" dot={false} />}
            {showBB && <Line type="monotone" dataKey="bbLower" stroke="#f59e0b" strokeWidth={0.5} strokeDasharray="3 3" dot={false} />}
            {showMA && <Line type="monotone" dataKey="sma20" stroke="#06b6d4" strokeWidth={1} dot={false} />}
            {showMA && <Line type="monotone" dataKey="sma50" stroke="#a855f7" strokeWidth={1} dot={false} />}
            <Area type="monotone" dataKey="close" stroke={assetColor} strokeWidth={1.5} fill={`url(#grad-${selected})`} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {/* Volume */}
      <div className="px-1 pb-1" style={{ height: 45 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 0, right: 5, bottom: 0, left: 5 }}>
            <XAxis dataKey="time" tick={false} axisLine={false} tickLine={false} />
            <Bar dataKey="volume" radius={[1, 1, 0, 0]} fill={assetColor} fillOpacity={0.25} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
