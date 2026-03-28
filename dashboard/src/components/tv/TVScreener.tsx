"use client";
import { useEffect, useRef, memo, useState } from "react";

function TVScreenerInner() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [market, setMarket] = useState("india");

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-screener.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      width: "100%",
      height: "100%",
      defaultColumn: "overview",
      defaultScreen: "most_capitalized",
      market,
      showToolbar: true,
      colorTheme: "dark",
      locale: "en",
      isTransparent: true,
    });

    containerRef.current.appendChild(script);
  }, [market]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-[#3a3a3a] flex-shrink-0">
        {[
          { id: "india", label: "India (NSE)" },
          { id: "america", label: "US Stocks" },
          { id: "uk", label: "UK" },
          { id: "crypto", label: "Crypto" },
          { id: "forex", label: "Forex" },
          { id: "cfd", label: "Commodities" },
        ].map(m => (
          <button key={m.id} onClick={() => setMarket(m.id)}
            className={`text-[9px] px-2 py-0.5 rounded font-medium transition ${market === m.id ? "bg-blue-500/20 text-blue-400" : "text-slate-500 hover:text-slate-300"}`}>
            {m.label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0">
        <div className="tradingview-widget-container" style={{ height: "100%", width: "100%" }}>
          <div ref={containerRef} style={{ height: "100%", width: "100%" }} />
        </div>
      </div>
    </div>
  );
}

export default memo(TVScreenerInner);
