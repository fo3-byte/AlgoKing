"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { TrendingUp, TrendingDown, Activity, Shield, Crosshair, Newspaper, ArrowUpRight, ArrowDownRight, Search, ShoppingCart, BarChart3 } from "lucide-react";
import { generateGeopoliticalEvents, generateRegionRisks } from "@/lib/data";
import { loadState } from "@/lib/paperTrading";
import { useMarketData, type LiveTicker } from "@/hooks/useYahooData";
import type { YFQuote } from "@/app/api/prices/route";

const TVChart = dynamic(() => import("./tv/TVChart"), { ssr: false });

interface KitePosition { tradingsymbol: string; quantity: number; average_price: number; last_price: number; pnl: number; }

export default function OverviewPanel() {
  const [kiteLoggedIn, setKiteLoggedIn] = useState(false);
  const [kitePositions, setKitePositions] = useState<KitePosition[]>([]);
  const [kiteMargin, setKiteMargin] = useState(0);
  const [kiteDayPnl, setKiteDayPnl] = useState(0);
  const [paperPnl, setPaperPnl] = useState(0);
  const [paperCash, setPaperCash] = useState(500000);
  const [news, setNews] = useState<{ headline: string; source: string; sentiment: string }[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ symbol: string; name: string; exchange: string }[]>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [marketViewTab, setMarketViewTab] = useState<"Indices" | "Stocks" | "Commodities">("Indices");
  const [stockTickers, setStockTickers] = useState<LiveTicker[]>([]);
  const [commodityTickers, setCommodityTickers] = useState<LiveTicker[]>([]);

  // Fetch stocks & commodities data for Market View tabs
  useEffect(() => {
    const stockSymbols = "RELIANCE.NS,TCS.NS,HDFCBANK.NS,INFY.NS,ICICIBANK.NS,BHARTIARTL.NS";
    const commoditySymbols = "GC=F,SI=F,CL=F,NG=F,HG=F,PL=F";

    const fetchExtra = async (symbols: string, setter: (t: LiveTicker[]) => void) => {
      try {
        const res = await fetch(`/api/prices?symbols=${encodeURIComponent(symbols)}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (data.quotes?.length) {
          setter(data.quotes.map((q: YFQuote) => ({
            symbol: q.symbol, displayName: q.displayName, price: q.price,
            change: q.change, changePct: q.changePct, volume: q.volume,
            high: q.high, low: q.low, open: q.open, prevClose: q.prevClose, marketState: q.marketState,
          })));
        }
      } catch { /* noop */ }
    };

    fetchExtra(stockSymbols, setStockTickers);
    fetchExtra(commoditySymbols, setCommodityTickers);
    const id = setInterval(() => {
      fetchExtra(stockSymbols, setStockTickers);
      fetchExtra(commoditySymbols, setCommodityTickers);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const { tickers } = useMarketData();

  const fetchKiteData = useCallback(async () => {
    try {
      const statusRes = await fetch("/api/kite?action=status");
      const statusData = await statusRes.json();
      setKiteLoggedIn(statusData.logged_in === true);
      if (statusData.logged_in) {
        const [marginsRes, posRes] = await Promise.all([
          fetch("/api/kite?action=margins").then(r => r.json()),
          fetch("/api/kite?action=positions").then(r => r.json()),
        ]);
        if (marginsRes.data?.equity) setKiteMargin(marginsRes.data.equity.available?.live_balance || 0);
        if (posRes.data?.net) {
          setKitePositions(posRes.data.net);
          setKiteDayPnl(posRes.data.net.reduce((s: number, p: KitePosition) => s + (p.pnl || 0), 0));
        }
      }
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    fetchKiteData();
    try {
      const state = loadState();
      setPaperPnl(state.positions.reduce((s, p) => s + p.unrealizedPnl, 0) + state.history.reduce((s, t) => s + t.pnl, 0));
      setPaperCash(state.cash);
    } catch { /* noop */ }
    fetch("/api/news", { cache: "no-store" }).then(r => r.json()).then(d => setNews((d.news || []).slice(0, 6))).catch(() => {});
    const i = setInterval(fetchKiteData, 5000);
    return () => clearInterval(i);
  }, [fetchKiteData]);

  const totalPnl = kiteDayPnl + paperPnl;
  const totalValue = kiteLoggedIn ? kiteMargin : paperCash;

  const nifty = tickers.find(t => t.symbol === "^NSEI" || t.displayName === "NIFTY");
  const banknifty = tickers.find(t => t.symbol === "^NSEBANK" || t.displayName === "BANKNIFTY");
  const sp500 = tickers.find(t => t.symbol === "ES=F" || t.displayName === "S&P500");
  const crude = tickers.find(t => t.symbol === "CL=F" || t.displayName === "WTI");
  const gold = tickers.find(t => t.symbol === "GC=F" || t.displayName === "GOLD");
  const btc = tickers.find(t => t.symbol === "BTC-USD" || t.displayName === "BTC");
  const vix = tickers.find(t => t.symbol === "^VIX" || t.displayName === "VIX");

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.length >= 1) {
      searchTimer.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
          if (res.ok) { const d = await res.json(); setSearchResults(d.results || []); }
        } catch { /* noop */ }
      }, 250);
    } else { setSearchResults([]); }
  };

  // Signal generation from live prices
  const nP = nifty?.price || 0;
  const bnP = banknifty?.price || 0;
  const nChg = nifty?.changePct || 0;
  const bnChg = banknifty?.changePct || 0;
  const nATM = Math.round(nP / 50) * 50;
  const bnATM = Math.round(bnP / 100) * 100;
  const nBias = nChg > 0.3 ? "CE" : nChg < -0.3 ? "PE" : "CE";
  const bnBias = bnChg > 0.3 ? "CE" : bnChg < -0.3 ? "PE" : "PE";

  return (
    <div className="space-y-5 pb-6">

      {/* ═══ SEARCH BAR — Prominent ═══ */}
      <div className="relative">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#777]" />
            <input
              type="text" value={searchQuery}
              onChange={(e) => handleSearch(e.target.value.toUpperCase())}
              placeholder="Find any stock, index, or crypto..."
              className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/8 text-[16px] text-white placeholder:text-[#555] focus:border-[#BFFF00]/30 focus:bg-white/8 outline-none transition font-medium shadow-lg shadow-black/10"
            />
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-[#262626] border border-[#3a3a3a] rounded-2xl shadow-2xl z-50 max-h-72 overflow-y-auto">
                {searchResults.slice(0, 8).map((r, i) => (
                  <button key={i} className="w-full text-left px-5 py-3 hover:bg-[#2e2e2e] transition flex items-center justify-between group border-b border-[#333333] last:border-0">
                    <div>
                      <span className="text-[14px] font-bold text-white group-hover:text-[#BFFF00]">{r.symbol}</span>
                      <span className="text-[12px] text-[#888] ml-3">{r.name}</span>
                    </div>
                    <span className="text-[10px] text-[#777]">{r.exchange}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ KEY METRICS ROW ═══ */}
      <div className="grid grid-cols-5 gap-4">
        {/* P&L */}
        <div className="glass-card p-6">
          <div className="text-[12px] text-[#888] font-medium mb-3">Today&apos;s P&L</div>
          <div className={`text-[32px] font-black leading-none ${totalPnl > 0 ? "text-[#BFFF00]" : totalPnl < 0 ? "text-red-400" : "text-white"}`}>
            {totalPnl === 0 ? "₹0" : `${totalPnl >= 0 ? "+" : ""}₹${Math.abs(totalPnl).toLocaleString()}`}
          </div>
        </div>

        {/* Portfolio */}
        <div className="glass-card p-6">
          <div className="text-[12px] text-[#888] font-medium mb-3">Capital</div>
          <div className="text-[32px] font-black text-white leading-none">₹{(totalValue / 100000).toFixed(1)}L</div>
          <div className={`text-[11px] mt-2 px-3 py-1 rounded-full inline-block font-bold ${kiteLoggedIn ? "bg-[#BFFF00]/10 text-[#BFFF00]" : "bg-[#333333] text-[#888]"}`}>
            {kiteLoggedIn ? "KITE LIVE" : "PAPER"}
          </div>
        </div>

        {/* NIFTY */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[12px] text-[#888]">🇮🇳 NIFTY 50</span>
            <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold ${(nChg) >= 0 ? "bg-[#BFFF00]/10 text-[#BFFF00]" : "bg-red-500/10 text-red-400"}`}>
              {nChg >= 0 ? "+" : ""}{nChg.toFixed(2)}%
            </span>
          </div>
          <div className="text-[28px] font-black text-white leading-none">{nP ? nP.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"}</div>
          <div className={`text-[12px] mt-2 flex items-center gap-1 ${nChg >= 0 ? "text-[#BFFF00]" : "text-red-400"}`}>
            {nChg >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
            {(nifty?.change || 0) >= 0 ? "+" : ""}{nifty?.change?.toFixed(1) || "0"}
          </div>
        </div>

        {/* BANKNIFTY */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[12px] text-[#888]">🇮🇳 BANK NIFTY</span>
            <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold ${bnChg >= 0 ? "bg-[#BFFF00]/10 text-[#BFFF00]" : "bg-red-500/10 text-red-400"}`}>
              {bnChg >= 0 ? "+" : ""}{bnChg.toFixed(2)}%
            </span>
          </div>
          <div className="text-[28px] font-black text-white leading-none">{bnP ? bnP.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"}</div>
          <div className={`text-[12px] mt-2 flex items-center gap-1 ${bnChg >= 0 ? "text-[#BFFF00]" : "text-red-400"}`}>
            {bnChg >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
            {(banknifty?.change || 0) >= 0 ? "+" : ""}{banknifty?.change?.toFixed(1) || "0"}
          </div>
        </div>

        {/* VIX */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[12px] text-[#888]">VIX</span>
            <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold ${(vix?.price || 15) > 18 ? "bg-red-500/10 text-red-400" : "bg-[#BFFF00]/10 text-[#BFFF00]"}`}>
              {(vix?.price || 15) > 18 ? "FEAR" : (vix?.price || 15) > 14 ? "CAUTION" : "CALM"}
            </span>
          </div>
          <div className={`text-[28px] font-black leading-none ${(vix?.price || 15) > 18 ? "text-red-400" : "text-[#BFFF00]"}`}>
            {vix?.price?.toFixed(2) || "—"}
          </div>
          <div className={`text-[12px] mt-2 ${(vix?.changePct || 0) >= 0 ? "text-red-400" : "text-[#BFFF00]"}`}>
            {(vix?.changePct || 0) >= 0 ? "+" : ""}{vix?.changePct?.toFixed(2) || "0"}%
          </div>
        </div>
      </div>

      {/* ═══ OHLC STRIP — Lime accent boxes ═══ */}
      {nifty && (
        <div className="flex items-center gap-3">
          <span className="text-[14px] font-bold text-white">NIFTY 50</span>
          <div className="flex items-center gap-2">
            {[
              { label: "Open", value: nifty.open },
              { label: "High", value: nifty.high },
              { label: "Low", value: nifty.low },
              { label: "Close", value: nifty.price },
            ].map((v, i) => (
              <div key={i} className="bg-[#BFFF00] rounded-xl px-5 py-2.5">
                <div className="text-[9px] text-black/50 uppercase font-medium">{v.label}</div>
                <div className="text-[18px] font-black text-black">{v.value?.toLocaleString(undefined, { maximumFractionDigits: 1 }) || "—"}</div>
              </div>
            ))}
          </div>
          <div className="ml-auto text-[13px] text-[#888]">
            Range: <span className="text-white font-bold">{nifty.low?.toLocaleString()} — {nifty.high?.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* ═══ MAIN CONTENT: Chart + Sidebar ═══ */}
      <div className="grid grid-cols-12 gap-4">
        {/* Chart */}
        <div className="col-span-8 glass-card overflow-hidden" style={{ height: 440 }}>
          <TVChart symbol="^NSEI" height="100%" />
        </div>

        {/* Right sidebar */}
        <div className="col-span-4 space-y-4">
          {/* Algo Signals */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-[#BFFF00]" />
                <span className="text-[13px] font-bold text-white">Algo Signals</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-[#BFFF00] pulse-dot" />
            </div>
            <div className="space-y-2.5">
              {nP ? [
                { sym: `NIFTY ${nATM} ${nBias}`, strat: nBias === "PE" ? "Bearish" : "Bullish", rr: "2:1", chg: nChg },
                { sym: `BANKNIFTY ${bnATM} ${bnBias}`, strat: "ORB", rr: "2.25:1", chg: bnChg },
                { sym: `NIFTY ${nATM} Straddle`, strat: "Theta", rr: "1:1", chg: 0 },
              ].map((s, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 px-4 bg-[#333333] rounded-xl border border-[#1a1a1a]">
                  <div className="flex items-center gap-2.5">
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${i < 2 ? "bg-[#BFFF00]/10 text-[#BFFF00]" : "bg-red-500/10 text-red-400"}`}>
                      {i < 2 ? "BUY" : "SELL"}
                    </span>
                    <span className="text-[12px] font-bold text-white">{s.sym}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-[#888]">{s.strat}</span>
                    <span className="text-[9px] text-[#BFFF00] font-bold">{s.rr}</span>
                  </div>
                </div>
              )) : <div className="text-[11px] text-[#777] text-center py-4">Loading prices...</div>}
            </div>
          </div>

          {/* News */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Newspaper className="w-4 h-4 text-red-400" />
                <span className="text-[13px] font-bold text-white">News</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-red-400 pulse-dot" />
            </div>
            <div className="space-y-3">
              {news.slice(0, 4).map((n, i) => (
                <div key={i} className="flex items-start gap-2.5 group cursor-pointer">
                  <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${n.sentiment === "bullish" ? "bg-[#BFFF00]" : n.sentiment === "bearish" ? "bg-red-400" : "bg-[#444]"}`} />
                  <div>
                    <p className="text-[11px] text-[#ccc] leading-snug group-hover:text-[#BFFF00] transition line-clamp-2">{n.headline}</p>
                    <span className="text-[9px] text-[#777]">{n.source}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ MARKET VIEW — Watchlist style ═══ */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[14px] font-bold text-white">Market View</span>
          <div className="flex items-center gap-1">
            {(["Indices", "Stocks", "Commodities"] as const).map((t) => (
              <span key={t} onClick={() => setMarketViewTab(t)} className={`text-[10px] px-3 py-1.5 rounded-full font-semibold cursor-pointer transition ${marketViewTab === t ? "bg-[#BFFF00]/10 text-[#BFFF00]" : "text-[#888] hover:text-[#aaa]"}`}>{t}</span>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-6 gap-3">
          {(marketViewTab === "Indices" ? [
            { label: "NIFTY 50", flag: "🇮🇳", data: nifty },
            { label: "BANK NIFTY", flag: "🇮🇳", data: banknifty },
            { label: "S&P 500", flag: "🇺🇸", data: sp500 },
            { label: "CRUDE OIL", flag: "🛢️", data: crude },
            { label: "GOLD", flag: "🥇", data: gold },
            { label: "BITCOIN", flag: "₿", data: btc },
          ] : marketViewTab === "Stocks" ? [
            { label: "RELIANCE", flag: "🇮🇳", data: stockTickers.find(t => t.symbol === "RELIANCE.NS") },
            { label: "TCS", flag: "🇮🇳", data: stockTickers.find(t => t.symbol === "TCS.NS") },
            { label: "HDFC BANK", flag: "🇮🇳", data: stockTickers.find(t => t.symbol === "HDFCBANK.NS") },
            { label: "INFOSYS", flag: "🇮🇳", data: stockTickers.find(t => t.symbol === "INFY.NS") },
            { label: "ICICI BANK", flag: "🇮🇳", data: stockTickers.find(t => t.symbol === "ICICIBANK.NS") },
            { label: "BHARTI AIRTEL", flag: "🇮🇳", data: stockTickers.find(t => t.symbol === "BHARTIARTL.NS") },
          ] : [
            { label: "GOLD", flag: "🥇", data: commodityTickers.find(t => t.symbol === "GC=F") },
            { label: "SILVER", flag: "🥈", data: commodityTickers.find(t => t.symbol === "SI=F") },
            { label: "CRUDE OIL", flag: "🛢️", data: commodityTickers.find(t => t.symbol === "CL=F") },
            { label: "NATURAL GAS", flag: "🔥", data: commodityTickers.find(t => t.symbol === "NG=F") },
            { label: "COPPER", flag: "🟤", data: commodityTickers.find(t => t.symbol === "HG=F") },
            { label: "PLATINUM", flag: "⚪", data: commodityTickers.find(t => t.symbol === "PL=F") },
          ]).map((item, i) => (
            <div key={i} className="bg-white/4 backdrop-blur-md rounded-xl p-4 border border-white/5 hover:border-white/10 hover:bg-white/6 transition cursor-pointer group">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[18px]">{item.flag}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${(item.data?.changePct || 0) >= 0 ? "bg-[#BFFF00]/10 text-[#BFFF00]" : "bg-red-500/10 text-red-400"}`}>
                  {(item.data?.changePct || 0) >= 0 ? "+" : ""}{item.data?.changePct?.toFixed(2) || "0"}%
                </span>
              </div>
              <div className="text-[11px] text-[#888] mb-1">{item.label}</div>
              <div className="text-[20px] font-black text-white group-hover:text-[#BFFF00] transition">
                {item.data?.price ? item.data.price.toLocaleString(undefined, { maximumFractionDigits: item.data.price < 100 ? 2 : 0 }) : "—"}
              </div>
              <div className={`text-[11px] mt-1 flex items-center gap-0.5 ${(item.data?.changePct || 0) >= 0 ? "text-[#BFFF00]" : "text-red-400"}`}>
                {(item.data?.changePct || 0) >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {(item.data?.change || 0) >= 0 ? "+" : ""}{item.data?.change?.toFixed(2) || "0"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
