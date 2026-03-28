"use client";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Globe, AlertTriangle, TrendingUp, ExternalLink, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { generateGeopoliticalEvents, generateRegionRisks, GeopoliticalEvent, RegionRisk } from "@/lib/data";

const WorldRiskMap = dynamic(() => import("./WorldRiskMap"), { ssr: false, loading: () => <div className="flex items-center justify-center h-full text-[10px] text-slate-500">Loading map...</div> });

const tabs = ["World Map", "Events", "Risk Index"] as const;

function SeverityDot({ severity }: { severity: GeopoliticalEvent["severity"] }) {
  const c = { low: "bg-green-400", medium: "bg-amber-400", high: "bg-orange-400", critical: "bg-red-500 animate-pulse" };
  return <span className={`w-2 h-2 rounded-full ${c[severity]} inline-block`} />;
}

function RiskBar({ score, size = "normal" }: { score: number; size?: "normal" | "large" }) {
  const color = score >= 80 ? "bg-red-500" : score >= 60 ? "bg-orange-500" : score >= 40 ? "bg-amber-500" : "bg-green-500";
  return (
    <div className={`w-full ${size === "large" ? "h-2" : "h-1"} rounded-full bg-[#333333] overflow-hidden`}>
      <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${score}%` }} />
    </div>
  );
}

export default function GeopoliticalPanel() {
  const [tab, setTab] = useState<typeof tabs[number]>("World Map");
  const [events, setEvents] = useState<GeopoliticalEvent[]>([]);
  const [regions, setRegions] = useState<RegionRisk[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [regionFilter, setRegionFilter] = useState<string | null>(null);

  useEffect(() => {
    setEvents(generateGeopoliticalEvents());
    setRegions(generateRegionRisks());

    // Also fetch live geopolitical news
    async function fetchGeoNews() {
      try {
        const res = await fetch("/api/news", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          const geoKeywords = /war|missile|houthi|iran|sanction|tariff|geopolit|conflict|military|nuclear|tension|strike|attack|defense|nato|china|russia|taiwan/i;
          const geoNews = (data.news || []).filter((n: { headline: string; category: string }) =>
            geoKeywords.test(n.headline) || n.category === "Geopolitical"
          );
          if (geoNews.length > 0) {
            const liveEvents: GeopoliticalEvent[] = geoNews.slice(0, 5).map((n: { headline: string; source: string; time: string; sentiment: string }, i: number) => ({
              id: `live-${i}`,
              title: n.headline,
              description: `Source: ${n.source}`,
              region: "Global",
              severity: n.sentiment === "bearish" ? "high" as const : "medium" as const,
              category: "Geopolitical" as const,
              timestamp: n.time,
              riskScore: n.sentiment === "bearish" ? 75 : 50,
              marketImpact: n.sentiment === "bearish" ? "Risk-off — safe havens up, equities pressured" : "Monitor for escalation",
              affectedAssets: ["CL", "GC", "VIX"],
            }));
            setEvents(prev => [...liveEvents, ...prev.filter(e => !e.id.startsWith("live-"))]);
          }
        }
      } catch { /* noop */ }
    }
    fetchGeoNews();
    const i = setInterval(() => {
      setEvents(generateGeopoliticalEvents());
      setRegions(generateRegionRisks());
      fetchGeoNews();
    }, 30000);
    return () => clearInterval(i);
  }, []);

  const avgRisk = events.length ? Math.round(events.reduce((s, e) => s + e.riskScore, 0) / events.length) : 0;
  const critCount = events.filter(e => e.severity === "critical" || e.severity === "high").length;
  const filteredEvents = regionFilter ? events.filter(e => e.region === regionFilter) : events;

  return (
    <div className="bg-[#262626] rounded-xl border border-[#3a3a3a] flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#3a3a3a] flex-shrink-0">
        <div className="flex items-center gap-2">
          <Globe className="w-3.5 h-3.5 text-amber-400" />
          <h2 className="text-[11px] font-bold text-white">Geopolitical Risk</h2>
          {critCount > 0 && <span className="flex items-center gap-0.5 text-[8px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded font-bold"><AlertTriangle className="w-2.5 h-2.5" />{critCount}</span>}
        </div>
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${avgRisk > 65 ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-400"}`}>GRI: {avgRisk}</span>
      </div>

      <div className="flex items-center gap-0 px-3 border-b border-[#3a3a3a] flex-shrink-0">
        {tabs.map(t => (
          <button key={t} onClick={() => { setTab(t); if (t !== "Events") setRegionFilter(null); }}
            className={`text-[9px] px-2.5 py-1.5 font-semibold border-b-2 transition ${tab === t ? "border-amber-400 text-amber-400" : "border-transparent text-slate-500 hover:text-slate-300"}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {tab === "World Map" && (
          <div className="h-full w-full min-h-[300px]">
            <WorldRiskMap
                events={events}
                regions={regions}
                onSelectRegion={(r) => {
                  setRegionFilter(r);
                  setTab("Events");
                }}
              />
          </div>
        )}

        {tab === "Events" && (
          <div>
            {/* Region filter */}
            {regionFilter && (
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#3a3a3a]/50 bg-amber-500/5 flex-shrink-0 sticky top-0 z-10">
                <span className="text-[9px] text-amber-400 font-bold">Filtered: {regionFilter}</span>
                <button onClick={() => setRegionFilter(null)} className="text-[8px] text-slate-500 hover:text-white">Clear ×</button>
              </div>
            )}
            <div className="divide-y divide-[#222222]/40">
              {filteredEvents.map(e => (
                <div key={e.id} className="px-3 py-2 hover:bg-[#2e2e2e]/60 transition cursor-pointer" onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}>
                  <div className="flex items-center gap-2 mb-1">
                    <SeverityDot severity={e.severity} />
                    <span className="text-[8px] px-1 py-0.5 rounded bg-[#333333] text-slate-500 font-medium">{e.category}</span>
                    <span className="text-[8px] text-slate-600">{e.region}</span>
                    <span className="text-[8px] text-slate-600 ml-auto">{new Date(e.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <h3 className="text-[10px] font-bold text-white mb-0.5 leading-snug">{e.title}</h3>
                  {expandedId === e.id && (
                    <div className="mt-1.5 animate-slide-in">
                      <p className="text-[9px] text-slate-400 mb-1.5">{e.summary}</p>
                      <div className="flex items-center gap-1 text-[8px] text-blue-400 mb-1.5"><TrendingUp className="w-2.5 h-2.5" /> {e.impact}</div>
                      <div className="flex items-center justify-between">
                        <div className="flex gap-0.5 flex-wrap">{e.affectedAssets.map(a => (<span key={a} className="text-[7px] px-1 py-0.5 rounded bg-[#333333] text-slate-500">{a}</span>))}</div>
                        <span className="text-[8px] text-slate-600 flex items-center gap-0.5">{e.source} <ExternalLink className="w-2 h-2" /></span>
                      </div>
                    </div>
                  )}
                  <div className="mt-1"><RiskBar score={e.riskScore} /></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "Risk Index" && (
          <div className="p-3 space-y-2.5">
            <div className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider">Regional Risk Index</div>
            {regions.sort((a, b) => b.score - a.score).map((r, i) => (
              <div key={i} className="bg-[#333333] rounded-lg p-2.5 border border-[#3a3a3a]/50 cursor-pointer hover:border-[#334155] transition"
                onClick={() => { setRegionFilter(r.region); setTab("Events"); }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-white">{r.region}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] flex items-center gap-0.5 font-semibold ${r.change > 0 ? "text-red-400" : r.change < 0 ? "text-green-400" : "text-slate-500"}`}>
                      {r.change > 0 ? <ArrowUpRight className="w-2.5 h-2.5" /> : r.change < 0 ? <ArrowDownRight className="w-2.5 h-2.5" /> : <Minus className="w-2.5 h-2.5" />}
                      {r.change > 0 ? "+" : ""}{r.change}
                    </span>
                    <span className={`text-xs font-black ${r.score >= 70 ? "text-red-400" : r.score >= 50 ? "text-amber-400" : "text-green-400"}`}>{r.score}</span>
                  </div>
                </div>
                <RiskBar score={r.score} size="large" />
                <div className="text-[8px] text-slate-600 mt-1">{r.events} active event{r.events !== 1 ? "s" : ""} — click to view</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
