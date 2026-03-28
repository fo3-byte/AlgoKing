"use client";
import { useState, useEffect } from "react";
import { BarChart3, TrendingUp, TrendingDown, Zap, Filter } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { generateVolumeSpikes, VolumeSpike } from "@/lib/data";

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <div className="w-16 h-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id={`sp-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1} fill={`url(#sp-${color})`} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function SpikeBar({ ratio }: { ratio: number }) {
  const pct = Math.min(ratio / 5 * 100, 100);
  const color = ratio >= 4 ? "bg-red-500" : ratio >= 3 ? "bg-orange-500" : ratio >= 2 ? "bg-amber-500" : "bg-green-500";
  return (
    <div className="w-16 h-1.5 rounded-full bg-[#333333] overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function VolumeSpikePanel() {
  const [spikes, setSpikes] = useState<VolumeSpike[]>([]);
  const [sector, setSector] = useState("All");

  useEffect(() => {
    setSpikes(generateVolumeSpikes());
    const i = setInterval(() => setSpikes(generateVolumeSpikes()), 10000);
    return () => clearInterval(i);
  }, []);

  const alerts = spikes.filter(s => s.spikeRatio >= 3).length;
  const sectors = ["All", ...Array.from(new Set(spikes.map(s => s.sector)))];
  const filtered = sector === "All" ? spikes : spikes.filter(s => s.sector === sector);

  return (
    <div className="bg-[#262626] rounded-xl border border-[#3a3a3a] flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#3a3a3a]">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
          <h2 className="text-[11px] font-bold text-white">Volume Spikes</h2>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 pulse-dot" />
        </div>
        {alerts > 0 && <span className="flex items-center gap-0.5 text-[8px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded font-bold"><Zap className="w-2.5 h-2.5" />{alerts} alerts</span>}
      </div>

      {/* Sector filter */}
      <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-[#3a3a3a]">
        {sectors.map(s => (
          <button key={s} onClick={() => setSector(s)}
            className={`text-[8px] px-1.5 py-0.5 rounded font-medium transition ${sector === s ? "bg-amber-500/20 text-amber-400" : "text-slate-500 hover:text-slate-300"}`}>
            {s}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full text-[10px]">
          <thead className="sticky top-0 bg-[#262626] z-10">
            <tr className="text-slate-600 border-b border-[#3a3a3a]">
              <th className="text-left px-3 py-1.5 font-medium">Asset</th>
              <th className="text-right px-1 py-1.5 font-medium">Vol</th>
              <th className="text-right px-1 py-1.5 font-medium">Spike</th>
              <th className="px-1 py-1.5 font-medium text-center">Trend</th>
              <th className="text-right px-1 py-1.5 font-medium">OI Δ</th>
              <th className="text-right px-2 py-1.5 font-medium">Price</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => {
              const sparkColor = s.spikeRatio >= 3 ? "#ef4444" : s.spikeRatio >= 2 ? "#f59e0b" : "#22c55e";
              return (
                <tr key={s.asset} className={`border-b border-[#3a3a3a]/30 hover:bg-[#2e2e2e]/60 transition ${s.spikeRatio >= 4 ? "bg-red-500/[0.03]" : ""}`}>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      {s.spikeRatio >= 3 && <Zap className="w-2.5 h-2.5 text-amber-400" />}
                      <div>
                        <div className="font-bold text-white text-[10px]">{s.asset}</div>
                        <div className="text-[7px] text-slate-600">{s.sector}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-1 py-2 text-right">
                    <div className="text-slate-300">{(s.currentVolume/1000).toFixed(0)}K</div>
                    <div className="text-[8px] text-slate-600">avg {(s.avgVolume/1000).toFixed(0)}K</div>
                  </td>
                  <td className="px-1 py-2 text-right">
                    <span className={`font-black text-[11px] ${s.spikeRatio >= 3 ? "text-red-400" : s.spikeRatio >= 2 ? "text-amber-400" : "text-green-400"}`}>
                      {s.spikeRatio}x
                    </span>
                    <div className="mt-0.5"><SpikeBar ratio={s.spikeRatio} /></div>
                  </td>
                  <td className="px-1 py-2 text-center">
                    <MiniSparkline data={s.sparkline} color={sparkColor} />
                  </td>
                  <td className="px-1 py-2 text-right">
                    <span className={`text-[9px] ${s.openInterestChange >= 0 ? "text-cyan-400" : "text-purple-400"}`}>
                      {s.openInterestChange >= 0 ? "+" : ""}{s.openInterestChange}%
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <span className={`flex items-center justify-end gap-0.5 font-bold ${s.priceChange >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {s.priceChange >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                      {s.priceChange >= 0 ? "+" : ""}{s.priceChange}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
