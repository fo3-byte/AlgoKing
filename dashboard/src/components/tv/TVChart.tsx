"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState, memo } from "react";
import { useChartData } from "@/hooks/useYahooData";
import { generatePriceCandles } from "@/lib/data";

interface Props {
  symbol?: string;
  height?: number | string;
}

const ASSET_GROUPS: { group: string; items: { key: string; label: string }[] }[] = [
  {
    group: "Indian",
    items: [
      { key: "^NSEI", label: "NIFTY" },
      { key: "^NSEBANK", label: "BANKNIFTY" },
      { key: "RELIANCE.NS", label: "RELIANCE" },
      { key: "TCS.NS", label: "TCS" },
      { key: "HDFCBANK.NS", label: "HDFC" },
      { key: "INFY.NS", label: "INFY" },
      { key: "SBIN.NS", label: "SBI" },
      { key: "ICICIBANK.NS", label: "ICICI" },
      { key: "TATAMOTORS.NS", label: "TATAMOT" },
      { key: "ITC.NS", label: "ITC" },
    ],
  },
  {
    group: "Global",
    items: [
      { key: "CL", label: "Crude" },
      { key: "BZ", label: "Brent" },
      { key: "GC", label: "Gold" },
      { key: "BTC", label: "BTC" },
      { key: "ES", label: "S&P" },
      { key: "NQ", label: "Nasdaq" },
      { key: "NG", label: "NatGas" },
    ],
  },
];

// Flatten for backward compat
const ASSETS = ASSET_GROUPS.flatMap(g => g.items);

const TF_MAP: Record<string, { interval: string; range: string; label: string; seconds: number }> = {
  "1m": { interval: "1m", range: "1d", label: "1m", seconds: 60 },
  "3m": { interval: "2m", range: "5d", label: "3m", seconds: 180 },
  "5m": { interval: "5m", range: "5d", label: "5m", seconds: 300 },
  "15m": { interval: "15m", range: "5d", label: "15m", seconds: 900 },
  "30m": { interval: "30m", range: "1mo", label: "30m", seconds: 1800 },
  "1H": { interval: "1h", range: "1mo", label: "1H", seconds: 3600 },
  "4H": { interval: "1h", range: "3mo", label: "4H", seconds: 14400 },
  "1D": { interval: "1d", range: "1y", label: "1D", seconds: 86400 },
  "1W": { interval: "1wk", range: "5y", label: "1W", seconds: 604800 },
};

function TVChartInner({ height = "100%" }: Props) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const sma20Ref = useRef<any>(null);
  const sma50Ref = useRef<any>(null);
  const lwcRef = useRef<any>(null);

  const [asset, setAsset] = useState("^NSEI");
  const [tf, setTf] = useState("15m");
  const [showSMA, setShowSMA] = useState(true);
  const [ready, setReady] = useState(false);
  const [barCountdown, setBarCountdown] = useState("");
  const [assetGroup, setAssetGroup] = useState("Indian");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ symbol: string; name: string; exchange: string; type: string }[]>([]);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showSignals, setShowSignals] = useState(true);
  const priceLinesRef = useRef<any[]>([]);

  const tfConfig = TF_MAP[tf];
  const { points: livePoints } = useChartData(asset, tfConfig.interval, tfConfig.range, 3000);

  const simData = generatePriceCandles(asset, 120);
  const data = livePoints.length > 2 ? livePoints : simData;
  const isLive = livePoints.length > 2;

  // Dynamic import + create chart
  useEffect(() => {
    if (!chartContainerRef.current) return;
    let cancelled = false;

    (async () => {
      const lwc = await import("lightweight-charts");
      if (cancelled || !chartContainerRef.current) return;
      lwcRef.current = lwc;

      const chart = lwc.createChart(chartContainerRef.current, {
        layout: {
          background: { type: lwc.ColorType.Solid, color: "#1e1e1e" },
          textColor: "#64748b",
          fontSize: 10,
        },
        grid: {
          vertLines: { color: "#222222" },
          horzLines: { color: "#222222" },
        },
        crosshair: {
          mode: 0,
        },
        rightPriceScale: { borderColor: "#222222" },
        timeScale: { borderColor: "#222222", timeVisible: true, secondsVisible: false },
      });

      // v5 API: addSeries with type constructors
      const candleSeries = chart.addSeries(lwc.CandlestickSeries, {
        upColor: "#BFFF00",
        downColor: "#ef4444",
        borderUpColor: "#BFFF00",
        borderDownColor: "#ef4444",
        wickUpColor: "#BFFF00",
        wickDownColor: "#ef4444",
      });

      const volumeSeries = chart.addSeries(lwc.HistogramSeries, {
        priceFormat: { type: "volume" },
        priceScaleId: "volume",
      });

      chart.priceScale("volume").applyOptions({
        scaleMargins: { top: 0.85, bottom: 0 },
      });

      const sma20 = chart.addSeries(lwc.LineSeries, { color: "#06b6d4", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
      const sma50 = chart.addSeries(lwc.LineSeries, { color: "#a855f7", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });

      chartRef.current = chart;
      candleSeriesRef.current = candleSeries;
      volumeSeriesRef.current = volumeSeries;
      sma20Ref.current = sma20;
      sma50Ref.current = sma50;

      const ro = new ResizeObserver((entries) => {
        const { width, height } = entries[0].contentRect;
        chart.applyOptions({ width, height });
      });
      ro.observe(chartContainerRef.current);

      setReady(true);

      // Cleanup
      return () => {
        ro.disconnect();
        chart.remove();
      };
    })();

    return () => {
      cancelled = true;
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
      setReady(false);
    };
  }, []);

  // Track whether we've done the initial data load
  const initialLoadRef = useRef(false);
  const prevDataLenRef = useRef(0);

  // Update data — use real timestamps from Yahoo when available
  useEffect(() => {
    if (!ready || !candleSeriesRef.current || data.length === 0) return;

    const intervalSec = TF_MAP[tf]?.seconds || 300;

    // Use real timestamps from API if available, otherwise generate synthetic ones
    const getTime = (d: any, i: number) => {
      if (d.timestamp) return d.timestamp;
      // Fallback: synthetic timestamps
      const base = Math.floor(Date.now() / 1000);
      return base - (data.length - i) * intervalSec;
    };

    try {
    // Full data load on first render or when data length changes
    if (!initialLoadRef.current || prevDataLenRef.current !== data.length) {
      const candles = data.map((d, i) => ({
        time: getTime(d, i), open: d.open, high: d.high, low: d.low, close: d.close,
      }));
      const volumes = data.map((d, i) => ({
        time: getTime(d, i), value: d.volume,
        color: d.close >= d.open ? "rgba(191,255,0,0.25)" : "rgba(239,68,68,0.3)",
      }));

      candleSeriesRef.current.setData(candles);
      volumeSeriesRef.current.setData(volumes);

      if (showSMA && sma20Ref.current && sma50Ref.current) {
        sma20Ref.current.setData(data.map((d: any, i: number) => ({ time: getTime(d, i), value: d.sma20 || d.close })));
        sma50Ref.current.setData(data.map((d: any, i: number) => ({ time: getTime(d, i), value: d.sma50 || d.close })));
      }

      // fitContent on initial load AND when asset/tf changes
      chartRef.current?.timeScale().fitContent();

      initialLoadRef.current = true;
      prevDataLenRef.current = data.length;
    } else {
      // Just update the last candle (smooth real-time tick)
      const lastIdx = data.length - 1;
      const d = data[lastIdx];
      const t = getTime(d, lastIdx);

      candleSeriesRef.current.update({ time: t, open: d.open, high: d.high, low: d.low, close: d.close });
      volumeSeriesRef.current.update({ time: t, value: d.volume, color: d.close >= d.open ? "rgba(191,255,0,0.25)" : "rgba(239,68,68,0.3)" });

      if (showSMA && sma20Ref.current && d.sma20) {
        sma20Ref.current.update({ time: t, value: d.sma20 });
      }
      if (showSMA && sma50Ref.current && d.sma50) {
        sma50Ref.current.update({ time: t, value: d.sma50 });
      }
    }

    // Handle SMA toggle
    if (!showSMA) {
      sma20Ref.current?.setData([]);
      sma50Ref.current?.setData([]);
    }
    // ── Signal overlays (Entry / SL / Target lines) ──
    if (showSignals && candleSeriesRef.current && data.length > 5) {
      // Remove old price lines
      for (const line of priceLinesRef.current) {
        try { candleSeriesRef.current.removePriceLine(line); } catch { /* noop */ }
      }
      priceLinesRef.current = [];

      const lastPrice = data[data.length - 1]?.close;
      if (lastPrice && lastPrice > 0) {
        // Determine signal direction from recent price action
        const recentHigh = Math.max(...data.slice(-20).map(d => d.high));
        const recentLow = Math.min(...data.slice(-20).map(d => d.low));
        const range = recentHigh - recentLow;
        const isNearHigh = lastPrice > recentLow + range * 0.6;
        const side = isNearHigh ? "SHORT" : "LONG";

        const entry = lastPrice;
        const riskPts = range * 0.3;
        const sl = side === "LONG" ? entry - riskPts : entry + riskPts;
        const target = side === "LONG" ? entry + riskPts * 2 : entry - riskPts * 2;
        const rr = "2:1";

        const entryLine = candleSeriesRef.current.createPriceLine({
          price: entry,
          color: side === "LONG" ? "#BFFF00" : "#ef4444",
          lineWidth: 2,
          lineStyle: 0,
          axisLabelVisible: true,
          title: `${side} ENTRY`,
          lineVisible: true,
        });

        const slLine = candleSeriesRef.current.createPriceLine({
          price: sl,
          color: "#ef4444",
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: `SL ${Math.abs(entry - sl).toFixed(1)} pts`,
          lineVisible: true,
        });

        const targetLine = candleSeriesRef.current.createPriceLine({
          price: target,
          color: "#22c55e",
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: `TARGET ${rr}`,
          lineVisible: true,
        });

        priceLinesRef.current = [entryLine, slLine, targetLine];
      }
    } else if (!showSignals) {
      for (const line of priceLinesRef.current) {
        try { candleSeriesRef.current?.removePriceLine(line); } catch { /* noop */ }
      }
      priceLinesRef.current = [];
    }

    } catch (e) {
      console.warn("Chart update error:", e);
    }
  }, [data, tf, showSMA, showSignals, ready]);

  // Reset initial load when asset or timeframe changes
  useEffect(() => {
    initialLoadRef.current = false;
    prevDataLenRef.current = 0;
  }, [asset, tf]);

  // Bar close countdown timer
  useEffect(() => {
    const tfSec = TF_MAP[tf]?.seconds || 60;
    if (tfSec >= 86400) { setBarCountdown(""); return; } // No countdown for daily+

    const tick = () => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = tfSec - (now % tfSec);
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      setBarCountdown(`${mins}:${secs.toString().padStart(2, "0")}`);
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [tf]);

  const last = data[data.length - 1];
  const first = data[0];
  const change = last && first ? last.close - first.open : 0;
  const changePct = first?.open ? (change / first.open) * 100 : 0;

  return (
    <div className="h-full flex flex-col bg-[#262626] rounded-xl border border-[#3a3a3a] overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#3a3a3a] flex-shrink-0">
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                const q = e.target.value.toUpperCase();
                setSearchQuery(q);
                setSearchOpen(true);
                // Debounced live search
                if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
                if (q.length >= 1) {
                  searchTimerRef.current = setTimeout(async () => {
                    try {
                      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
                      if (res.ok) {
                        const data = await res.json();
                        setSearchResults(data.results || []);
                      }
                    } catch { /* noop */ }
                  }, 250);
                } else {
                  setSearchResults([]);
                }
              }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && searchResults.length > 0) {
                  setAsset(searchResults[0].symbol);
                  setSearchOpen(false);
                  setSearchQuery("");
                  setSearchResults([]);
                } else if (e.key === "Escape") {
                  setSearchOpen(false);
                }
              }}
              placeholder="Search any stock..."
              className="w-36 text-[10px] px-2.5 py-1 rounded-lg bg-[#333333] border border-[#3a3a3a] text-white placeholder:text-[#777] focus:border-[#BFFF00]/40 outline-none"
            />
            {searchOpen && (searchResults.length > 0 || searchQuery.length >= 1) && (
              <div className="absolute top-full left-0 mt-1 w-72 bg-[#262626] border border-[#3a3a3a] rounded-xl shadow-2xl z-50 max-h-64 overflow-y-auto">
                {searchResults.length === 0 && searchQuery.length >= 1 && (
                  <div className="px-3 py-2 text-[9px] text-[#777]">Searching...</div>
                )}
                {searchResults.map((r, i) => (
                  <button key={`${r.symbol}-${i}`} onClick={() => { setAsset(r.symbol); setSearchOpen(false); setSearchQuery(""); setSearchResults([]); }}
                    className="w-full text-left px-3 py-2 text-[10px] hover:bg-[#2e2e2e] transition flex items-center justify-between group border-b border-[#333333] last:border-0">
                    <div>
                      <span className="font-bold text-white group-hover:text-[#BFFF00]">{r.symbol}</span>
                      <span className="text-[#888] ml-2 text-[9px]">{r.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[7px] px-1.5 py-0.5 rounded bg-[#2e2e2e] text-[#888]">{r.type}</span>
                      <span className="text-[7px] text-[#777]">{r.exchange}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {/* Click outside to close */}
            {searchOpen && <div className="fixed inset-0 z-40" onClick={() => { setSearchOpen(false); setSearchResults([]); }} />}
          </div>

          {/* Asset group toggle */}
          <div className="flex items-center gap-0">
            {ASSET_GROUPS.map(g => (
              <button key={g.group} onClick={() => { setAssetGroup(g.group); setAsset(g.items[0].key); }}
                className={`text-[7px] px-1.5 py-0.5 font-bold uppercase border border-[#3a3a3a] first:rounded-l last:rounded-r transition ${assetGroup === g.group ? "bg-[#BFFF00]/10 text-[#BFFF00] border-[#BFFF00]/30" : "text-[#777] hover:text-slate-300"}`}>
                {g.group === "Indian" ? "🇮🇳" : "🌍"} {g.group}
              </button>
            ))}
          </div>
          {/* Assets in selected group */}
          <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-none">
            {ASSET_GROUPS.find(g => g.group === assetGroup)?.items.map(a => (
              <button key={a.key} onClick={() => setAsset(a.key)}
                className={`text-[8px] px-1.5 py-0.5 rounded font-semibold transition whitespace-nowrap ${asset === a.key ? "bg-[#BFFF00]/10 text-[#BFFF00]" : "text-[#888] hover:text-white"}`}>
                {a.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Timeframes */}
          <div className="flex items-center gap-0.5 bg-[#333333] rounded p-0.5">
            {Object.entries(TF_MAP).map(([k, v]) => (
              <button key={k} onClick={() => setTf(k)}
                className={`text-[8px] px-1.5 py-0.5 rounded font-medium transition ${tf === k ? "bg-[#333333] text-white" : "text-slate-600 hover:text-slate-300"}`}>
                {v.label}
              </button>
            ))}
          </div>
          <button onClick={() => setShowSMA(!showSMA)}
            className={`text-[8px] px-1.5 py-0.5 rounded font-medium ${showSMA ? "bg-cyan-500/15 text-cyan-400" : "text-slate-600"}`}>
            SMA
          </button>
          <button onClick={() => setShowSignals(!showSignals)}
            className={`text-[8px] px-1.5 py-0.5 rounded font-medium ${showSignals ? "bg-[#BFFF00]/15 text-[#BFFF00]" : "text-slate-600"}`}>
            Signals
          </button>
          {/* Bar close countdown */}
          {barCountdown && (
            <div className="flex items-center gap-1 bg-[#333333] rounded px-1.5 py-0.5">
              <span className="text-[7px] text-slate-600">BAR CLOSE</span>
              <span className="text-[10px] font-mono font-bold text-amber-400">{barCountdown}</span>
            </div>
          )}
          {last && (
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="text-[#BFFF00] font-bold text-[11px]">{ASSETS.find(a => a.key === asset)?.label || asset.replace(".NS","").replace("=F","").replace("-USD","")}</span>
              <span className="text-white font-bold">{last.close.toLocaleString()}</span>
              <span className={`font-semibold ${change >= 0 ? "text-green-400" : "text-red-400"}`}>
                {change >= 0 ? "+" : ""}{change.toFixed(2)} ({changePct.toFixed(2)}%)
              </span>
              <span className={`w-1.5 h-1.5 rounded-full ${isLive ? "bg-green-400 pulse-dot" : "bg-amber-400"}`} />
              <span className="text-[7px] text-slate-600">{isLive ? "LIVE" : "SIM"}</span>
            </div>
          )}
        </div>
      </div>

      {/* OHLCV */}
      {last && (
        <div className="flex items-center gap-3 px-3 py-1 border-b border-[#3a3a3a]/50 text-[9px] text-slate-500 flex-shrink-0">
          <span>O <span className="text-slate-300">{last.open}</span></span>
          <span>H <span className="text-green-400">{last.high}</span></span>
          <span>L <span className="text-red-400">{last.low}</span></span>
          <span>C <span className="text-white">{last.close}</span></span>
          <span>Vol <span className="text-blue-400">{(last.volume / 1000).toFixed(0)}K</span></span>
          {showSMA && last.sma20 && <span>SMA20 <span className="text-cyan-400">{last.sma20}</span></span>}
          {showSMA && last.sma50 && <span>SMA50 <span className="text-purple-400">{last.sma50}</span></span>}
        </div>
      )}

      {/* Chart canvas */}
      <div ref={chartContainerRef} className="flex-1 min-h-0" style={{ height: typeof height === "number" ? height : undefined }} />
    </div>
  );
}

export default memo(TVChartInner);
