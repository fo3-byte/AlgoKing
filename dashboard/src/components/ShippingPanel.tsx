"use client";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Ship, MapPin, ArrowUpRight, ArrowDownRight, Minus, Info } from "lucide-react";
import { generateVessels, generateShippingInsights, generateFlowData, generatePortCongestion, generateTankerRates, Vessel, FlowData, PortCongestion, TankerRate } from "@/lib/data";

const VesselMap = dynamic(() => import("./VesselMap"), { ssr: false, loading: () => <div className="flex items-center justify-center h-full text-[10px] text-slate-500">Loading map...</div> });

const tabs = ["Map", "Fleet", "Flows", "Ports", "Rates", "Insights"] as const;
type Tab = typeof tabs[number];

function StatusDot({ status }: { status: Vessel["status"] }) {
  const c = { underway: "bg-green-400", anchored: "bg-amber-400", loading: "bg-blue-400", discharging: "bg-purple-400" };
  return <span className={`w-1.5 h-1.5 rounded-full ${c[status]} inline-block`} />;
}

export default function ShippingPanel() {
  const [tab, setTab] = useState<Tab>("Map");
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [insights, setInsights] = useState<string[]>([]);
  const [flows, setFlows] = useState<FlowData[]>([]);
  const [ports, setPorts] = useState<PortCongestion[]>([]);
  const [rates, setRates] = useState<TankerRate[]>([]);
  const [typeFilter, setTypeFilter] = useState("ALL");

  useEffect(() => {
    const update = () => {
      const v = generateVessels();
      setVessels(v); setInsights(generateShippingInsights(v));
      setFlows(generateFlowData()); setPorts(generatePortCongestion());
      setRates(generateTankerRates());
    };
    update();
    const i = setInterval(update, 30000);
    return () => clearInterval(i);
  }, []);

  const underway = vessels.filter(v => v.status === "underway").length;
  const totalCargo = vessels.reduce((s, v) => s + v.cargoVolume, 0);
  const filtered = typeFilter === "ALL" ? vessels : vessels.filter(v => v.type === typeFilter);

  return (
    <div className="bg-[#262626] rounded-xl border border-[#3a3a3a] flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#3a3a3a] flex-shrink-0">
        <div className="flex items-center gap-2">
          <Ship className="w-3.5 h-3.5 text-cyan-400" />
          <h2 className="text-[11px] font-bold text-white">Strait of Hormuz — Oil Traffic</h2>
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 pulse-dot" />
        </div>
        <div className="flex items-center gap-2 text-[9px] text-slate-500">
          <span>{underway} moving</span>
          <span>{(totalCargo / 1e6).toFixed(1)}M bbl</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 px-3 border-b border-[#3a3a3a] flex-shrink-0">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`text-[9px] px-2.5 py-1.5 font-semibold border-b-2 transition ${tab === t ? "border-cyan-400 text-cyan-400" : "border-transparent text-slate-500 hover:text-slate-300"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Content — flex-1 + overflow for scroll, min-h-0 to allow shrink */}
      <div className="flex-1 min-h-0 overflow-auto">
        {tab === "Map" && (
          <div className="h-full w-full min-h-[300px]">
            <VesselMap vessels={vessels} />
          </div>
        )}

        {tab === "Fleet" && (
          <>
            <div className="flex items-center gap-1 px-3 py-1.5 border-b border-[#3a3a3a]/50 flex-shrink-0 sticky top-0 bg-[#262626] z-10">
              {["ALL", "VLCC", "Suezmax", "Aframax", "Panamax"].map(t => (
                <button key={t} onClick={() => setTypeFilter(t)}
                  className={`text-[8px] px-1.5 py-0.5 rounded font-medium ${typeFilter === t ? "bg-cyan-500/20 text-cyan-400" : "text-slate-500 hover:text-slate-300"}`}>
                  {t} {t !== "ALL" && <span className="text-slate-600">({vessels.filter(v => v.type === t).length})</span>}
                </button>
              ))}
            </div>
            <table className="w-full text-[10px]">
              <thead className="sticky top-[30px] bg-[#262626] z-10">
                <tr className="text-slate-600 border-b border-[#3a3a3a]">
                  <th className="text-left px-3 py-1.5 font-medium">Vessel</th>
                  <th className="text-left px-1 py-1.5 font-medium">Type</th>
                  <th className="text-left px-1 py-1.5 font-medium">Cargo</th>
                  <th className="text-right px-1 py-1.5 font-medium">DWT</th>
                  <th className="text-left px-1 py-1.5 font-medium">Route</th>
                  <th className="text-right px-1 py-1.5 font-medium">Spd</th>
                  <th className="text-center px-2 py-1.5 font-medium">St</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(v => (
                  <tr key={v.id} className="border-b border-[#3a3a3a]/30 hover:bg-[#2e2e2e]/60 transition">
                    <td className="px-3 py-1.5"><div className="font-semibold text-white text-[10px]">{v.flag} {v.name}</div><div className="text-[8px] text-slate-600">{v.id} · Built {v.built}</div></td>
                    <td className="px-1 py-1.5"><span className="text-[8px] px-1 py-0.5 rounded bg-[#333333] text-slate-400">{v.type}</span></td>
                    <td className="px-1 py-1.5 text-slate-400">{v.cargo}<div className="text-[8px] text-slate-600">{(v.cargoVolume / 1e6).toFixed(1)}M bbl</div></td>
                    <td className="px-1 py-1.5 text-right text-slate-400">{(v.dwt / 1000).toFixed(0)}K</td>
                    <td className="px-1 py-1.5 text-[8px] text-slate-400">{v.origin} → {v.destination}</td>
                    <td className="px-1 py-1.5 text-right text-slate-300">{v.speed}</td>
                    <td className="px-2 py-1.5 text-center"><StatusDot status={v.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {tab === "Flows" && (
          <div className="p-3 space-y-2">
            <div className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider mb-1">Trade Route Volumes</div>
            {flows.map((f, i) => (
              <div key={i} className="bg-[#333333] rounded-lg p-2.5 border border-[#3a3a3a]/50">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-semibold text-white">{f.route}</span>
                  <span className={`text-[9px] font-bold flex items-center gap-0.5 ${f.change >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {f.change >= 0 ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                    {f.change >= 0 ? "+" : ""}{f.change}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-[9px] text-slate-400">
                  <span>{(f.volume / 1e6).toFixed(1)}M bbl/day</span><span>{f.vessels} vessels</span>
                </div>
                <div className="mt-1.5 h-1 rounded-full bg-[#333333] overflow-hidden">
                  <div className="h-full rounded-full bg-cyan-500/60" style={{ width: `${Math.min(f.volume / 18e6 * 100, 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "Ports" && (
          <div className="p-3">
            <div className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider mb-2">Port Congestion Monitor</div>
            <table className="w-full text-[10px]">
              <thead><tr className="text-slate-600 border-b border-[#3a3a3a]"><th className="text-left py-1.5 font-medium">Port</th><th className="text-right py-1.5 font-medium">Waiting</th><th className="text-right py-1.5 font-medium">Avg Wait</th><th className="text-center py-1.5 font-medium">Trend</th></tr></thead>
              <tbody>
                {ports.map((p, i) => (
                  <tr key={i} className="border-b border-[#3a3a3a]/30">
                    <td className="py-2 font-semibold text-white flex items-center gap-1.5"><MapPin className="w-3 h-3 text-cyan-500" />{p.port}</td>
                    <td className="py-2 text-right"><span className={`font-bold ${p.waiting > 8 ? "text-red-400" : p.waiting > 4 ? "text-amber-400" : "text-green-400"}`}>{p.waiting}</span></td>
                    <td className="py-2 text-right text-slate-400">{p.avgWait}h</td>
                    <td className="py-2 text-center">{p.trend === "up" ? <ArrowUpRight className="w-3 h-3 text-red-400 mx-auto" /> : p.trend === "down" ? <ArrowDownRight className="w-3 h-3 text-green-400 mx-auto" /> : <Minus className="w-3 h-3 text-slate-500 mx-auto" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "Rates" && (
          <div className="p-3 space-y-2">
            <div className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider mb-1">Tanker Spot Rates (Worldscale)</div>
            {rates.map((r, i) => (
              <div key={i} className="bg-[#333333] rounded-lg p-3 border border-[#3a3a3a]/50">
                <div className="flex items-center justify-between mb-1"><span className="text-[10px] font-bold text-white">{r.type}</span><span className="text-sm font-bold text-white">WS {r.rate}</span></div>
                <div className="flex items-center gap-3 text-[9px]">
                  <span className={r.change >= 0 ? "text-green-400" : "text-red-400"}>Day: {r.change >= 0 ? "+" : ""}{r.change}%</span>
                  <span className={r.weekChange >= 0 ? "text-green-400" : "text-red-400"}>Week: {r.weekChange >= 0 ? "+" : ""}{r.weekChange}%</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "Insights" && (
          <div className="p-3 space-y-2">
            <div className="flex items-center gap-1.5 mb-1"><Info className="w-3 h-3 text-cyan-400" /><span className="text-[9px] font-semibold text-cyan-400 uppercase tracking-wider">AI Shipping Analysis</span></div>
            {insights.map((ins, i) => (
              <div key={i} className="bg-[#333333] rounded-lg p-2.5 border border-[#3a3a3a]/50 text-[10px] text-slate-300 leading-relaxed"><span className="text-cyan-500 mr-1">▸</span>{ins}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
