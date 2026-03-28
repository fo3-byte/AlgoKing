"use client";
import { useState, useEffect, useCallback } from "react";
import { Globe, TrendingUp, TrendingDown, Minus, RefreshCw } from "lucide-react";

interface IndexData {
  symbol: string; name: string; price: number; change: number; changePct: number; region: string;
}

const TABS = ["Indices", "Commodities", "Forex", "Bonds", "Crypto", "VIX"] as const;

const INDEX_SYMBOLS: Record<string, { symbols: string; items: { sym: string; name: string }[] }> = {
  Indices: {
    symbols: "^GSPC,^IXIC,^DJI,^NSEI,^NSEBANK,^BSESN,^RUT,^FTSE,^GDAXI,^FCHI,^N225,^HSI,^STI,000001.SS,^STOXX50E,^AXJO",
    items: [
      { sym: "^GSPC", name: "S&P 500" }, { sym: "^IXIC", name: "NASDAQ" }, { sym: "^DJI", name: "Dow Jones" },
      { sym: "^NSEI", name: "NIFTY 50" }, { sym: "^NSEBANK", name: "BANK NIFTY" }, { sym: "^BSESN", name: "SENSEX" },
      { sym: "^RUT", name: "Russell 2000" }, { sym: "^FTSE", name: "FTSE 100" }, { sym: "^GDAXI", name: "DAX" },
      { sym: "^FCHI", name: "CAC 40" }, { sym: "^N225", name: "Nikkei 225" }, { sym: "^HSI", name: "Hang Seng" },
      { sym: "^STI", name: "Straits Times" }, { sym: "000001.SS", name: "Shanghai" }, { sym: "^STOXX50E", name: "Euro Stoxx 50" },
      { sym: "^AXJO", name: "ASX 200" },
    ],
  },
  Commodities: {
    symbols: "CL=F,BZ=F,GC=F,SI=F,NG=F,HG=F,PL=F,PA=F,ZC=F,ZW=F,ZS=F,KC=F",
    items: [
      { sym: "CL=F", name: "WTI Crude" }, { sym: "BZ=F", name: "Brent Crude" }, { sym: "GC=F", name: "Gold" },
      { sym: "SI=F", name: "Silver" }, { sym: "NG=F", name: "Natural Gas" }, { sym: "HG=F", name: "Copper" },
      { sym: "PL=F", name: "Platinum" }, { sym: "PA=F", name: "Palladium" }, { sym: "ZC=F", name: "Corn" },
      { sym: "ZW=F", name: "Wheat" }, { sym: "ZS=F", name: "Soybean" }, { sym: "KC=F", name: "Coffee" },
    ],
  },
  Forex: {
    symbols: "EURUSD=X,GBPUSD=X,USDJPY=X,USDCHF=X,AUDUSD=X,USDCAD=X,USDINR=X,GBPINR=X,EURINR=X,USDCNY=X,USDHKD=X,USDSGD=X",
    items: [
      { sym: "EURUSD=X", name: "EUR/USD" }, { sym: "GBPUSD=X", name: "GBP/USD" }, { sym: "USDJPY=X", name: "USD/JPY" },
      { sym: "USDCHF=X", name: "USD/CHF" }, { sym: "AUDUSD=X", name: "AUD/USD" }, { sym: "USDCAD=X", name: "USD/CAD" },
      { sym: "USDINR=X", name: "USD/INR" }, { sym: "GBPINR=X", name: "GBP/INR" }, { sym: "EURINR=X", name: "EUR/INR" },
      { sym: "USDCNY=X", name: "USD/CNY" }, { sym: "USDHKD=X", name: "USD/HKD" }, { sym: "USDSGD=X", name: "USD/SGD" },
    ],
  },
  Bonds: {
    symbols: "^TNX,^FVX,^TYX,^IRX",
    items: [
      { sym: "^TNX", name: "US 10Y Treasury" }, { sym: "^FVX", name: "US 5Y Treasury" },
      { sym: "^TYX", name: "US 30Y Treasury" }, { sym: "^IRX", name: "US 13W T-Bill" },
    ],
  },
  Crypto: {
    symbols: "BTC-USD,ETH-USD,BNB-USD,SOL-USD,XRP-USD,ADA-USD,DOGE-USD,AVAX-USD,DOT-USD,LINK-USD,MATIC-USD,ATOM-USD",
    items: [
      { sym: "BTC-USD", name: "Bitcoin" }, { sym: "ETH-USD", name: "Ethereum" }, { sym: "BNB-USD", name: "BNB" },
      { sym: "SOL-USD", name: "Solana" }, { sym: "XRP-USD", name: "XRP" }, { sym: "ADA-USD", name: "Cardano" },
      { sym: "DOGE-USD", name: "Dogecoin" }, { sym: "AVAX-USD", name: "Avalanche" }, { sym: "DOT-USD", name: "Polkadot" },
      { sym: "LINK-USD", name: "Chainlink" }, { sym: "MATIC-USD", name: "Polygon" }, { sym: "ATOM-USD", name: "Cosmos" },
    ],
  },
  VIX: {
    symbols: "^VIX,^VVIX,^VXN,^VXD,^OVX,^GVZ,^EVZ,DX-Y.NYB,^MOVE,^TNX,INDIAVIX.NS",
    items: [
      { sym: "^VIX", name: "CBOE VIX (S&P 500)" },
      { sym: "INDIAVIX.NS", name: "India VIX (NIFTY)" },
      { sym: "^VVIX", name: "VIX of VIX" },
      { sym: "^VXN", name: "NASDAQ VIX (VXN)" },
      { sym: "^VXD", name: "Dow Jones VIX (VXD)" },
      { sym: "^OVX", name: "Crude Oil VIX (OVX)" },
      { sym: "^GVZ", name: "Gold VIX (GVZ)" },
      { sym: "^EVZ", name: "Euro VIX (EVZ)" },
      { sym: "^MOVE", name: "MOVE Bond Volatility" },
      { sym: "DX-Y.NYB", name: "Dollar Index (DXY)" },
      { sym: "^TNX", name: "US 10Y Yield" },
    ],
  },
};

function regionFlag(name: string): string {
  if (name.includes("NIFTY") || name.includes("SENSEX") || name.includes("BANK") || name.includes("INR")) return "🇮🇳";
  if (name.includes("S&P") || name.includes("NASDAQ") || name.includes("Dow") || name.includes("Russell") || name.includes("US ") || name.includes("VIX") || name.includes("Dollar")) return "🇺🇸";
  if (name.includes("FTSE")) return "🇬🇧";
  if (name.includes("DAX")) return "🇩🇪";
  if (name.includes("CAC")) return "🇫🇷";
  if (name.includes("Nikkei")) return "🇯🇵";
  if (name.includes("Hang")) return "🇭🇰";
  if (name.includes("Shanghai")) return "🇨🇳";
  if (name.includes("Euro Stoxx")) return "🇪🇺";
  if (name.includes("Straits")) return "🇸🇬";
  if (name.includes("ASX")) return "🇦🇺";
  return "🌍";
}

export default function WorldIndicesPanel() {
  const [tab, setTab] = useState<typeof TABS[number]>("Indices");
  const [data, setData] = useState<IndexData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(0);

  const fetchData = useCallback(async () => {
    const config = INDEX_SYMBOLS[tab];
    if (!config) return;
    try {
      const res = await fetch(`/api/prices?symbols=${encodeURIComponent(config.symbols)}`, { cache: "no-store" });
      if (!res.ok) { setLoading(false); return; }
      const result = await res.json();
      const quotes = result.quotes || [];
      // Build a map from API symbol -> quote data
      const quoteMap = new Map<string, { price: number; change: number; changePct: number }>();
      for (const q of quotes) quoteMap.set(q.symbol, q);
      // Map in config order so items always show, even if API missed some
      const mapped: IndexData[] = config.items.map(item => {
        const q = quoteMap.get(item.sym);
        return {
          symbol: item.sym,
          name: item.name,
          price: q?.price ?? 0,
          change: q?.change ?? 0,
          changePct: q?.changePct ?? 0,
          region: tab,
        };
      });
      setData(mapped);
      setLastUpdate(Date.now());
    } catch { /* noop */ }
    setLoading(false);
  }, [tab]);

  useEffect(() => {
    setLoading(true);
    fetchData();
    const i = setInterval(fetchData, 5000);
    return () => clearInterval(i);
  }, [fetchData]);

  return (
    <div className="bg-[#262626] rounded-xl border border-[#3a3a3a] flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#3a3a3a] flex-shrink-0">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-blue-400" />
          <h2 className="text-[11px] font-bold text-white">World Markets</h2>
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 pulse-dot" />
        </div>
        <div className="flex items-center gap-2 text-[8px] text-slate-500">
          <span>{data.length} instruments</span>
          <span className="flex items-center gap-0.5"><RefreshCw className="w-2.5 h-2.5" /> 5s</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 px-3 border-b border-[#3a3a3a] flex-shrink-0">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`text-[9px] px-2.5 py-1.5 font-semibold border-b-2 transition ${tab === t ? "border-blue-400 text-blue-400" : "border-transparent text-slate-500 hover:text-slate-300"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Data grid */}
      <div className="flex-1 min-h-0 overflow-auto">
        {loading && data.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-[10px] text-slate-600">Loading {tab} data...</div>
        ) : (
          <div className="grid grid-cols-2 gap-0">
            {(data.length > 0 ? data : INDEX_SYMBOLS[tab].items.map(i => ({ symbol: i.sym, name: i.name, price: 0, change: 0, changePct: 0, region: tab }))).map((item, i) => (
              <div key={i} className={`flex items-center justify-between px-4 py-2.5 border-b border-r border-[#3a3a3a]/30 hover:bg-[#2e2e2e]/60 transition cursor-pointer ${i % 2 === 0 ? "" : "border-r-0"}`}>
                <div className="flex items-center gap-2">
                  <span className="text-sm">{regionFlag(item.name)}</span>
                  <div>
                    <div className="text-[10px] font-bold text-white">{item.name}</div>
                    <div className="text-[7px] text-slate-600">{item.symbol.replace("=X", "").replace("=F", "").replace("-USD", "")}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-bold text-white">{item.price > 0 ? item.price.toLocaleString(undefined, { maximumFractionDigits: item.price < 10 ? 4 : 2 }) : "—"}</div>
                  <div className={`text-[9px] font-semibold flex items-center justify-end gap-0.5 ${item.changePct > 0 ? "text-green-400" : item.changePct < 0 ? "text-red-400" : "text-slate-500"}`}>
                    {item.changePct > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : item.changePct < 0 ? <TrendingDown className="w-2.5 h-2.5" /> : <Minus className="w-2.5 h-2.5" />}
                    {item.changePct > 0 ? "+" : ""}{item.changePct.toFixed(2)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
