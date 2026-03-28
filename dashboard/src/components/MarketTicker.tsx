"use client";
import dynamic from "next/dynamic";

const TVTickerTape = dynamic(() => import("./tv/TVTickerTape"), { ssr: false });

export default function MarketTicker() {
  return (
    <div className="border-b border-[#333333] bg-[#1e1e1e] flex-shrink-0 overflow-hidden" style={{ height: 46 }}>
      <TVTickerTape />
    </div>
  );
}
