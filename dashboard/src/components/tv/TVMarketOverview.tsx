"use client";
import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { useMarketData, LiveTicker } from "@/hooks/useYahooData";

const TABS = [
  { id: "commodities", label: "Commodities", symbols: ["WTI", "BRENT", "GOLD", "SILVER", "NATGAS", "COPPER"] },
  { id: "indices", label: "Indices", symbols: ["S&P500", "NASDAQ", "NIFTY", "BANKNIFTY", "VIX", "DXY"] },
  { id: "crypto", label: "Crypto", symbols: ["BTC", "ETH"] },
  { id: "forex", label: "Forex", symbols: ["EUR/USD", "10Y UST"] },
];

export default function TVMarketOverview() {
  const { tickers } = useMarketData(3000);
  const [activeTab, setActiveTab] = useState("commodities");

  const tab = TABS.find(t => t.id === activeTab) || TABS[0];
  const filtered = tab.symbols
    .map(sym => tickers.find(t => t.displayName === sym || t.symbol === sym))
    .filter(Boolean) as LiveTicker[];

  return (
    <div className="h-full flex flex-col bg-[#262626]">
      {/* Tabs */}
      <div className="flex items-center border-b border-[#3a3a3a] flex-shrink-0">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex-1 text-[9px] py-2 font-semibold transition border-b-2 ${activeTab === t.id ? "border-blue-400 text-blue-400" : "border-transparent text-slate-500 hover:text-slate-300"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Market items */}
      <div className="flex-1 overflow-auto divide-y divide-[#222222]/50">
        {filtered.length === 0 && tickers.length === 0 && (
          <div className="flex items-center justify-center h-20 text-[10px] text-slate-600">Loading market data...</div>
        )}
        {filtered.map((t, i) => (
          <div key={i} className="flex items-center justify-between px-3 py-2.5 hover:bg-[#2e2e2e]/60 transition cursor-pointer">
            <div>
              <div className="text-[10px] font-bold text-white">{t.displayName}</div>
              <div className="text-[8px] text-slate-600">{t.symbol}</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-bold text-white">{typeof t.price === "number" ? t.price.toLocaleString() : t.price}</div>
              <div className={`text-[9px] font-semibold flex items-center justify-end gap-0.5 ${t.changePct >= 0 ? "text-green-400" : "text-red-400"}`}>
                {t.changePct >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                {t.changePct >= 0 ? "+" : ""}{t.changePct}%
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
