"use client";
import { useEffect, useRef, memo } from "react";

function TVTickerTapeInner() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbols: [
        { proName: "NYMEX:CL1!", title: "WTI Crude" },
        { proName: "NYMEX:BZ1!", title: "Brent" },
        { proName: "COMEX:GC1!", title: "Gold" },
        { proName: "NYMEX:NG1!", title: "NatGas" },
        { proName: "COMEX:SI1!", title: "Silver" },
        { proName: "COMEX:HG1!", title: "Copper" },
        { proName: "CME_MINI:ES1!", title: "S&P 500" },
        { proName: "CME_MINI:NQ1!", title: "Nasdaq" },
        { proName: "BITSTAMP:BTCUSD", title: "Bitcoin" },
        { proName: "BITSTAMP:ETHUSD", title: "Ethereum" },
        { proName: "NSE:NIFTY", title: "NIFTY 50" },
        { proName: "NSE:BANKNIFTY", title: "BANKNIFTY" },
        { proName: "NSE:RELIANCE", title: "Reliance" },
        { proName: "NSE:HDFCBANK", title: "HDFC Bank" },
        { proName: "TVC:DXY", title: "Dollar Index" },
        { proName: "TVC:US10Y", title: "US 10Y" },
        { proName: "FX:EURUSD", title: "EUR/USD" },
        { proName: "FX:USDINR", title: "USD/INR" },
        { proName: "TVC:VIX", title: "VIX" },
      ],
      showSymbolLogo: true,
      isTransparent: true,
      displayMode: "adaptive",
      colorTheme: "dark",
      locale: "en",
    });

    containerRef.current.appendChild(script);
  }, []);

  return (
    <div className="tradingview-widget-container" style={{ height: 46 }}>
      <div ref={containerRef} />
    </div>
  );
}

export default memo(TVTickerTapeInner);
