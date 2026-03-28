"use client";
import { useEffect, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";

interface HeatmapStock {
  symbol: string; name: string; sector: string;
  price: number; change: number; changePct: number;
  marketCap: number; volume: number;
}

const GEOS = [
  { id: "india", label: "🇮🇳 India" },
  { id: "us", label: "🇺🇸 US" },
  { id: "crypto", label: "₿ Crypto" },
  { id: "commodities", label: "🛢️ Commodities" },
];

function getColor(pct: number): string {
  if (pct >= 3) return "#16a34a";
  if (pct >= 1.5) return "#22c55e";
  if (pct >= 0.5) return "#4ade80";
  if (pct >= 0) return "#1a3a2a";
  if (pct >= -0.5) return "#3a1a1a";
  if (pct >= -1.5) return "#ef4444";
  if (pct >= -3) return "#dc2626";
  return "#b91c1c";
}

function getTextColor(pct: number): string {
  if (Math.abs(pct) < 0.5) return "#94a3b8";
  return "#ffffff";
}

export default function TVHeatmap() {
  const [geo, setGeo] = useState("india");
  const [stocks, setStocks] = useState<HeatmapStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/heatmap?geo=${geo}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.stocks?.length > 0) {
          setStocks(data.stocks);
          setLastUpdate(Date.now());
        }
      }
    } catch { /* noop */ }
    setLoading(false);
  }, [geo]);

  useEffect(() => {
    setLoading(true);
    fetchData();
    const i = setInterval(fetchData, 5000);
    return () => clearInterval(i);
  }, [fetchData]);

  // Group by sector
  const sectors: Record<string, HeatmapStock[]> = {};
  stocks.forEach(s => {
    if (!sectors[s.sector]) sectors[s.sector] = [];
    sectors[s.sector].push(s);
  });

  // Sort sectors by total market cap
  const sortedSectors = Object.entries(sectors).sort((a, b) =>
    b[1].reduce((s, x) => s + x.marketCap, 0) - a[1].reduce((s, x) => s + x.marketCap, 0)
  );

  // Total market cap for sizing
  const totalMcap = stocks.reduce((s, x) => s + x.marketCap, 0);

  return (
    <div className="h-full flex flex-col bg-[#262626] rounded-xl border border-[#3a3a3a] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#3a3a3a] flex-shrink-0">
        <div className="flex items-center gap-1">
          {GEOS.map(g => (
            <button key={g.id} onClick={() => setGeo(g.id)}
              className={`text-[9px] px-2.5 py-1 rounded font-semibold transition ${geo === g.id ? "bg-[#BFFF00]/10 text-[#BFFF00]" : "text-[#888] hover:text-white"}`}>
              {g.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-[8px] text-slate-500">
          <span>{stocks.length} stocks</span>
          {lastUpdate > 0 && <span className="flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-green-400 pulse-dot" />Live</span>}
          {/* Color legend */}
          <div className="flex items-center gap-0.5">
            {[-3, -1.5, -0.5, 0, 0.5, 1.5, 3].map(v => (
              <div key={v} className="w-3 h-2 rounded-sm" style={{ background: getColor(v) }} />
            ))}
            <span className="ml-1 text-[7px]">-3% to +3%</span>
          </div>
        </div>
      </div>

      {/* Heatmap grid */}
      <div className="flex-1 min-h-0 overflow-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 text-slate-600 animate-spin" /></div>
        ) : stocks.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[11px] text-slate-600">No data available — market may be closed</div>
        ) : (
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(sortedSectors.length, 6)}, 1fr)` }}>
            {sortedSectors.map(([sector, sectorStocks]) => {
              const sectorPct = (sectorStocks.reduce((s, x) => s + x.marketCap, 0) / totalMcap) * 100;
              const sectorAvgChange = sectorStocks.reduce((s, x) => s + x.changePct, 0) / sectorStocks.length;
              const sorted = [...sectorStocks].sort((a, b) => b.marketCap - a.marketCap);

              return (
                <div key={sector} className="space-y-0.5">
                  {/* Sector header */}
                  <div className="text-[8px] font-bold text-slate-400 uppercase tracking-wider px-1 flex items-center justify-between">
                    <span>{sector}</span>
                    <span className={`${sectorAvgChange >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {sectorAvgChange >= 0 ? "+" : ""}{sectorAvgChange.toFixed(1)}%
                    </span>
                  </div>
                  {/* Stock tiles */}
                  {sorted.map(stock => {
                    const size = Math.max(40, Math.min(90, (stock.marketCap / totalMcap) * 2000));
                    return (
                      <div key={stock.symbol}
                        className="rounded-md px-2 py-1.5 transition-all hover:brightness-125 cursor-pointer"
                        style={{ background: getColor(stock.changePct), minHeight: size }}
                        title={`${stock.name} (${stock.symbol})\nPrice: ${stock.price}\nChange: ${stock.changePct}%\nVolume: ${stock.volume.toLocaleString()}`}
                      >
                        <div className="text-[10px] font-bold" style={{ color: getTextColor(stock.changePct) }}>
                          {stock.symbol}
                        </div>
                        <div className="text-[13px] font-black" style={{ color: getTextColor(stock.changePct) }}>
                          {stock.changePct >= 0 ? "+" : ""}{stock.changePct.toFixed(2)}%
                        </div>
                        <div className="text-[8px] opacity-70" style={{ color: getTextColor(stock.changePct) }}>
                          ₹{stock.price.toLocaleString()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
