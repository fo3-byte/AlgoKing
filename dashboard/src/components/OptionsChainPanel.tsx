"use client";
import { useState, useEffect, useCallback } from "react";
import { Layers, RefreshCw, TrendingUp, TrendingDown, Activity, Eye, BarChart3, Grid3X3, Sparkles } from "lucide-react";

interface ChainEntry {
  symbol: string; ltp: number; ltpch: number; ltpchp: number;
  option_type: string; strike_price: number;
  oi?: number; oich?: number; oichp?: number; prev_oi?: number;
  volume?: number; bid?: number; ask?: number; iv?: number;
  fp?: number; fpch?: number; fpchp?: number; description?: string;
  delta?: number; gamma?: number; theta?: number; vega?: number; rho?: number;
}

interface ExpiryData { date: string; expiry: string; }
interface VixData { symbol: string; ltp: number; ltpch: number; ltpchp: number; }
interface OIResponse {
  code: number; source: string; error?: string;
  data: {
    callOi: number; putOi: number;
    optionsChain: ChainEntry[];
    expiryData: ExpiryData[];
    indiavixData: VixData;
  };
}

const SYMBOLS = [
  { value: "NSE:NIFTY50-INDEX", label: "NIFTY 50" },
  { value: "NSE:BANKNIFTY-INDEX", label: "BANK NIFTY" },
  { value: "NSE:FINNIFTY-INDEX", label: "FIN NIFTY" },
  { value: "NSE:MIDCPNIFTY-INDEX", label: "MIDCAP NIFTY" },
  { value: "NSE:RELIANCE-EQ", label: "RELIANCE" },
  { value: "NSE:TCS-EQ", label: "TCS" },
  { value: "NSE:HDFCBANK-EQ", label: "HDFC BANK" },
  { value: "NSE:INFY-EQ", label: "INFOSYS" },
  { value: "NSE:SBIN-EQ", label: "SBI" },
  { value: "NSE:ICICIBANK-EQ", label: "ICICI BANK" },
  { value: "NSE:TATAMOTORS-EQ", label: "TATA MOTORS" },
  { value: "NSE:ITC-EQ", label: "ITC" },
];

const VIEWS = ["Chain", "Heatmap", "AI Pick"] as const;

function fmtNum(n: number, dec = 2): string { return n.toLocaleString(undefined, { maximumFractionDigits: dec }); }
function fmtOI(n: number): string {
  if (n >= 10000000) return `${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `${(n / 100000).toFixed(2)} L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)} K`;
  return String(n);
}

export default function OptionsChainPanel() {
  const [symbol, setSymbol] = useState("NSE:NIFTY50-INDEX");
  const [strikecount, setStrikecount] = useState(10);
  const [view, setView] = useState<typeof VIEWS[number]>("Chain");
  const [data, setData] = useState<OIResponse["data"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState("");
  const [selectedExpiry, setSelectedExpiry] = useState("");

  const fetchOI = useCallback(async () => {
    try {
      let url = `/api/oi?symbol=${encodeURIComponent(symbol)}&strikecount=${strikecount}`;
      if (selectedExpiry) url += `&expiry=${selectedExpiry}`;
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const json: OIResponse = await res.json();
        setData(json.data);
        setSource(json.source || "unknown");
      }
    } catch { /* noop */ }
    setLoading(false);
  }, [symbol, strikecount, selectedExpiry]);

  useEffect(() => {
    setLoading(true);
    fetchOI();
    const i = setInterval(fetchOI, 5000);
    return () => clearInterval(i);
  }, [fetchOI]);

  if (!data) return <div className="bg-[#262626] rounded-xl border border-[#3a3a3a] flex items-center justify-center h-full text-[10px] text-slate-600">Loading OI data...</div>;

  const underlying = data.optionsChain.find(o => o.strike_price === -1);
  const calls = data.optionsChain.filter(o => o.option_type === "CE").sort((a, b) => a.strike_price - b.strike_price);
  const puts = data.optionsChain.filter(o => o.option_type === "PE").sort((a, b) => a.strike_price - b.strike_price);
  const strikes = [...new Set([...calls.map(c => c.strike_price), ...puts.map(p => p.strike_price)])].sort((a, b) => a - b);
  const spotPrice = underlying?.ltp || underlying?.fp || 0;
  const atmStrike = strikes.reduce((prev, curr) => Math.abs(curr - spotPrice) < Math.abs(prev - spotPrice) ? curr : prev, strikes[0]);
  const hasGreeks = [...calls, ...puts].some(o => o.delta !== undefined);
  const pcr = data.callOi > 0 ? (data.putOi / data.callOi).toFixed(2) : "—";
  const maxOI = Math.max(...[...calls, ...puts].map(o => o.oi || 0), 1);
  const maxOIChange = Math.max(...[...calls, ...puts].map(o => Math.abs(o.oich || 0)), 1);

  // Max pain calculation
  const maxPainStrike = strikes.reduce((best, strike) => {
    const pain = strikes.reduce((total, s) => {
      const callOI = calls.find(c => c.strike_price === s)?.oi || 0;
      const putOI = puts.find(p => p.strike_price === s)?.oi || 0;
      const callPain = s > strike ? callOI * (s - strike) : 0;
      const putPain = s < strike ? putOI * (strike - s) : 0;
      return total + callPain + putPain;
    }, 0);
    return pain < best.pain ? { strike, pain } : best;
  }, { strike: strikes[0], pain: Infinity }).strike;

  return (
    <div className="bg-[#262626] rounded-xl border border-[#3a3a3a] flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#3a3a3a] flex-shrink-0">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <h2 className="text-[11px] font-bold text-white">OPTIONS CHAIN — OI ANALYSIS</h2>
          <span className={`w-1.5 h-1.5 rounded-full ${source.includes("live") ? "bg-green-400" : "bg-amber-400"} pulse-dot`} />
          <span className="text-[7px] text-slate-600 uppercase">{source}</span>
        </div>
        <div className="flex items-center gap-2">
          {VIEWS.map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`text-[8px] px-2 py-0.5 rounded font-bold transition ${view === v ? "bg-cyan-500/20 text-cyan-400" : "text-slate-500 hover:text-slate-300"}`}>
              {v === "Chain" ? <Eye className="w-3 h-3 inline mr-0.5" /> : <Grid3X3 className="w-3 h-3 inline mr-0.5" />}{v}
            </button>
          ))}
          <span className="text-[8px] text-slate-500 flex items-center gap-0.5"><RefreshCw className="w-2.5 h-2.5" /> 5s</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[#3a3a3a] flex-shrink-0 flex-wrap">
        {/* Symbol */}
        <div className="flex items-center gap-1.5">
          <span className="text-[8px] text-slate-600 font-semibold">SYMBOL</span>
          <select value={symbol} onChange={e => setSymbol(e.target.value)}
            className="text-[10px] px-2 py-1 rounded bg-[#333333] border border-[#3a3a3a] text-white font-bold focus:border-cyan-500/40 outline-none">
            {SYMBOLS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        {/* Expiry */}
        {data.expiryData.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[8px] text-slate-600 font-semibold">EXPIRY</span>
            <div className="flex gap-0.5">
              {data.expiryData.slice(0, 4).map((e, i) => (
                <button key={e.expiry} onClick={() => setSelectedExpiry(e.expiry)}
                  className={`text-[8px] px-2 py-0.5 rounded font-semibold transition ${(selectedExpiry === e.expiry || (!selectedExpiry && i === 0)) ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" : "text-slate-500 hover:text-slate-300 border border-[#3a3a3a]"}`}>
                  {e.date}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Strikes */}
        <div className="flex items-center gap-1.5">
          <span className="text-[8px] text-slate-600 font-semibold">STRIKES</span>
          <select value={strikecount} onChange={e => setStrikecount(+e.target.value)}
            className="text-[9px] px-1.5 py-0.5 rounded bg-[#333333] border border-[#3a3a3a] text-white outline-none">
            {[5, 10, 15, 20, 25].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        {/* Spot + VIX + PCR summary */}
        <div className="flex items-center gap-3 ml-auto">
          <div className="text-center">
            <div className="text-[7px] text-slate-600">SPOT</div>
            <div className="text-[11px] font-black text-white">{fmtNum(spotPrice)}</div>
            {underlying && <div className={`text-[8px] font-bold ${(underlying.ltpch || 0) >= 0 ? "text-green-400" : "text-red-400"}`}>{(underlying.ltpch || 0) >= 0 ? "+" : ""}{fmtNum(underlying.ltpch || 0)} ({fmtNum(underlying.ltpchp || 0)}%)</div>}
          </div>
          {data.indiavixData && (
            <div className="text-center">
              <div className="text-[7px] text-slate-600">INDIA VIX</div>
              <div className={`text-[11px] font-black ${data.indiavixData.ltp > 15 ? "text-red-400" : data.indiavixData.ltp > 12 ? "text-amber-400" : "text-green-400"}`}>{fmtNum(data.indiavixData.ltp)}</div>
              <div className={`text-[8px] font-bold ${data.indiavixData.ltpch >= 0 ? "text-red-400" : "text-green-400"}`}>{data.indiavixData.ltpch >= 0 ? "+" : ""}{fmtNum(data.indiavixData.ltpch)} ({fmtNum(data.indiavixData.ltpchp)}%)</div>
            </div>
          )}
          <div className="text-center">
            <div className="text-[7px] text-slate-600">PCR</div>
            <div className={`text-[11px] font-black ${+pcr > 1.2 ? "text-green-400" : +pcr < 0.8 ? "text-red-400" : "text-white"}`}>{pcr}</div>
            <div className="text-[7px] text-slate-600">{+pcr > 1.2 ? "BULLISH" : +pcr < 0.8 ? "BEARISH" : "NEUTRAL"}</div>
          </div>
          <div className="text-center">
            <div className="text-[7px] text-slate-600">MAX PAIN</div>
            <div className="text-[11px] font-black text-amber-400">{fmtNum(maxPainStrike, 0)}</div>
            <div className="text-[7px] text-slate-600">{spotPrice > maxPainStrike ? `${fmtNum(spotPrice - maxPainStrike, 0)} above` : `${fmtNum(maxPainStrike - spotPrice, 0)} below`}</div>
          </div>
          <div className="text-center">
            <div className="text-[7px] text-green-400">CALL OI</div>
            <div className="text-[10px] font-bold text-white">{fmtOI(data.callOi)}</div>
          </div>
          <div className="text-center">
            <div className="text-[7px] text-red-400">PUT OI</div>
            <div className="text-[10px] font-bold text-white">{fmtOI(data.putOi)}</div>
          </div>
        </div>
      </div>

      {/* ═══ CHAIN VIEW ═══ */}
      {view === "Chain" && (
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full text-[9px] border-collapse">
            <thead className="sticky top-0 z-10 bg-[#333333]">
              <tr>
                <th colSpan={hasGreeks ? 10 : 7} className="text-center text-[8px] text-green-400 font-bold py-1 border-b border-[#3a3a3a] bg-green-500/5">CALLS {hasGreeks && <span className="text-emerald-400 ml-1">(+ Greeks)</span>}</th>
                <th className="text-center text-[8px] text-white font-bold py-1 border-b border-[#3a3a3a] bg-[#333333]/30">STRIKE</th>
                <th colSpan={hasGreeks ? 10 : 7} className="text-center text-[8px] text-red-400 font-bold py-1 border-b border-[#3a3a3a] bg-red-500/5">PUTS {hasGreeks && <span className="text-rose-400 ml-1">(+ Greeks)</span>}</th>
              </tr>
              <tr className="text-slate-600 font-medium">
                {hasGreeks && <th className="px-1.5 py-1 text-right border-b border-[#3a3a3a] text-emerald-700">Delta</th>}
                {hasGreeks && <th className="px-1.5 py-1 text-right border-b border-[#3a3a3a] text-emerald-700">Theta</th>}
                {hasGreeks && <th className="px-1.5 py-1 text-right border-b border-[#3a3a3a] text-emerald-700">Vega</th>}
                <th className="px-2 py-1 text-right border-b border-[#3a3a3a]">OI Chg</th>
                <th className="px-2 py-1 text-right border-b border-[#3a3a3a]">OI</th>
                <th className="px-2 py-1 text-right border-b border-[#3a3a3a]">Volume</th>
                <th className="px-2 py-1 text-right border-b border-[#3a3a3a]">IV</th>
                <th className="px-2 py-1 text-right border-b border-[#3a3a3a]">Chg%</th>
                <th className="px-2 py-1 text-right border-b border-[#3a3a3a]">LTP</th>
                <th className="px-1 py-1 border-b border-[#3a3a3a]"></th>
                <th className="px-3 py-1 text-center border-b border-[#3a3a3a] bg-[#333333]/20 font-bold text-slate-400">STRIKE</th>
                <th className="px-1 py-1 border-b border-[#3a3a3a]"></th>
                <th className="px-2 py-1 text-left border-b border-[#3a3a3a]">LTP</th>
                <th className="px-2 py-1 text-left border-b border-[#3a3a3a]">Chg%</th>
                <th className="px-2 py-1 text-left border-b border-[#3a3a3a]">IV</th>
                <th className="px-2 py-1 text-left border-b border-[#3a3a3a]">Volume</th>
                <th className="px-2 py-1 text-left border-b border-[#3a3a3a]">OI</th>
                <th className="px-2 py-1 text-left border-b border-[#3a3a3a]">OI Chg</th>
                {hasGreeks && <th className="px-1.5 py-1 text-left border-b border-[#3a3a3a] text-rose-700">Delta</th>}
                {hasGreeks && <th className="px-1.5 py-1 text-left border-b border-[#3a3a3a] text-rose-700">Theta</th>}
                {hasGreeks && <th className="px-1.5 py-1 text-left border-b border-[#3a3a3a] text-rose-700">Vega</th>}
              </tr>
            </thead>
            <tbody>
              {strikes.map(strike => {
                const ce = calls.find(c => c.strike_price === strike);
                const pe = puts.find(p => p.strike_price === strike);
                const isATM = strike === atmStrike;
                const isITM_CE = strike < spotPrice;
                const isITM_PE = strike > spotPrice;

                return (
                  <tr key={strike} className={`hover:bg-[#2e2e2e]/60 transition ${isATM ? "bg-cyan-500/5 border-y border-cyan-500/20" : ""}`}>
                    {/* CE Greeks */}
                    {hasGreeks && <td className="px-1.5 py-1.5 text-right text-[8px] text-emerald-500 font-mono">{ce?.delta?.toFixed(4) || "—"}</td>}
                    {hasGreeks && <td className="px-1.5 py-1.5 text-right text-[8px] text-emerald-500 font-mono">{ce?.theta?.toFixed(2) || "—"}</td>}
                    {hasGreeks && <td className="px-1.5 py-1.5 text-right text-[8px] text-emerald-500 font-mono">{ce?.vega?.toFixed(2) || "—"}</td>}
                    {/* CE OI Change */}
                    <td className="px-2 py-1.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <div className="w-12 h-1.5 rounded-full bg-[#333333] overflow-hidden">
                          <div className={`h-full rounded-full ${(ce?.oich || 0) > 0 ? "bg-green-500" : "bg-red-500"}`}
                            style={{ width: `${Math.min(Math.abs(ce?.oich || 0) / maxOIChange * 100, 100)}%` }} />
                        </div>
                        <span className={`font-semibold ${(ce?.oich || 0) > 0 ? "text-green-400" : (ce?.oich || 0) < 0 ? "text-red-400" : "text-slate-600"}`}>
                          {(ce?.oich || 0) > 0 ? "+" : ""}{fmtOI(ce?.oich || 0)}
                        </span>
                      </div>
                    </td>
                    {/* CE OI */}
                    <td className="px-2 py-1.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <div className="w-10 h-1.5 rounded-full bg-[#333333] overflow-hidden">
                          <div className="h-full rounded-full bg-green-500/40" style={{ width: `${(ce?.oi || 0) / maxOI * 100}%` }} />
                        </div>
                        <span className="text-white font-semibold">{fmtOI(ce?.oi || 0)}</span>
                      </div>
                    </td>
                    {/* CE Volume */}
                    <td className="px-2 py-1.5 text-right text-slate-400">{fmtOI(ce?.volume || 0)}</td>
                    {/* CE IV */}
                    <td className="px-2 py-1.5 text-right text-slate-500">{ce?.iv ? `${ce.iv}%` : "—"}</td>
                    {/* CE Change% */}
                    <td className={`px-2 py-1.5 text-right font-semibold ${(ce?.ltpchp || 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {(ce?.ltpchp || 0) >= 0 ? "+" : ""}{fmtNum(ce?.ltpchp || 0)}%
                    </td>
                    {/* CE LTP */}
                    <td className={`px-2 py-1.5 text-right font-bold ${isITM_CE ? "text-cyan-300" : "text-white"}`}>
                      {fmtNum(ce?.ltp || 0)}
                    </td>
                    {/* CE bar */}
                    <td className="px-0.5 py-1.5">
                      <div className="w-1.5 h-3 rounded-sm" style={{ background: isITM_CE ? "rgba(6,182,212,0.3)" : "transparent" }} />
                    </td>
                    {/* STRIKE */}
                    <td className={`px-3 py-1.5 text-center font-black bg-[#333333]/15 ${isATM ? "text-cyan-400 text-[11px]" : "text-white"}`}>
                      {fmtNum(strike, 0)}
                      {isATM && <span className="text-[6px] ml-1 text-cyan-400">ATM</span>}
                    </td>
                    {/* PE bar */}
                    <td className="px-0.5 py-1.5">
                      <div className="w-1.5 h-3 rounded-sm" style={{ background: isITM_PE ? "rgba(6,182,212,0.3)" : "transparent" }} />
                    </td>
                    {/* PE LTP */}
                    <td className={`px-2 py-1.5 text-left font-bold ${isITM_PE ? "text-cyan-300" : "text-white"}`}>
                      {fmtNum(pe?.ltp || 0)}
                    </td>
                    {/* PE Change% */}
                    <td className={`px-2 py-1.5 text-left font-semibold ${(pe?.ltpchp || 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {(pe?.ltpchp || 0) >= 0 ? "+" : ""}{fmtNum(pe?.ltpchp || 0)}%
                    </td>
                    {/* PE IV */}
                    <td className="px-2 py-1.5 text-left text-slate-500">{pe?.iv ? `${pe.iv}%` : "—"}</td>
                    {/* PE Volume */}
                    <td className="px-2 py-1.5 text-left text-slate-400">{fmtOI(pe?.volume || 0)}</td>
                    {/* PE OI */}
                    <td className="px-2 py-1.5 text-left">
                      <div className="flex items-center gap-1">
                        <span className="text-white font-semibold">{fmtOI(pe?.oi || 0)}</span>
                        <div className="w-10 h-1.5 rounded-full bg-[#333333] overflow-hidden">
                          <div className="h-full rounded-full bg-red-500/40" style={{ width: `${(pe?.oi || 0) / maxOI * 100}%` }} />
                        </div>
                      </div>
                    </td>
                    {/* PE OI Change */}
                    <td className="px-2 py-1.5 text-left">
                      <div className="flex items-center gap-1">
                        <span className={`font-semibold ${(pe?.oich || 0) > 0 ? "text-green-400" : (pe?.oich || 0) < 0 ? "text-red-400" : "text-slate-600"}`}>
                          {(pe?.oich || 0) > 0 ? "+" : ""}{fmtOI(pe?.oich || 0)}
                        </span>
                        <div className="w-12 h-1.5 rounded-full bg-[#333333] overflow-hidden">
                          <div className={`h-full rounded-full ${(pe?.oich || 0) > 0 ? "bg-green-500" : "bg-red-500"}`}
                            style={{ width: `${Math.min(Math.abs(pe?.oich || 0) / maxOIChange * 100, 100)}%` }} />
                        </div>
                      </div>
                    </td>
                    {/* PE Greeks */}
                    {hasGreeks && <td className="px-1.5 py-1.5 text-left text-[8px] text-rose-500 font-mono">{pe?.delta?.toFixed(4) || "—"}</td>}
                    {hasGreeks && <td className="px-1.5 py-1.5 text-left text-[8px] text-rose-500 font-mono">{pe?.theta?.toFixed(2) || "—"}</td>}
                    {hasGreeks && <td className="px-1.5 py-1.5 text-left text-[8px] text-rose-500 font-mono">{pe?.vega?.toFixed(2) || "—"}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ HEATMAP VIEW ═══ */}
      {view === "Heatmap" && (
        <div className="flex-1 min-h-0 overflow-auto p-3">
          {/* OI Heatmap */}
          <div className="grid grid-cols-2 gap-4">
            {/* Call OI Heatmap */}
            <div>
              <div className="text-[10px] font-bold text-green-400 mb-2 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" /> CALL OI HEATMAP
              </div>
              <div className="space-y-1">
                {strikes.map(strike => {
                  const ce = calls.find(c => c.strike_price === strike);
                  const oi = ce?.oi || 0;
                  const oiPct = (oi / maxOI) * 100;
                  const oiChange = ce?.oich || 0;
                  const isATM = strike === atmStrike;
                  const intensity = Math.min(oiPct / 60, 1);

                  return (
                    <div key={strike} className={`flex items-center gap-2 ${isATM ? "bg-cyan-500/10 rounded px-1 py-0.5" : ""}`}>
                      <span className={`text-[9px] w-14 text-right font-semibold ${isATM ? "text-cyan-400" : "text-slate-400"}`}>{strike}</span>
                      <div className="flex-1 h-5 rounded relative overflow-hidden" style={{ background: `rgba(34,197,94,${0.05 + intensity * 0.4})` }}>
                        <div className="absolute inset-y-0 left-0 rounded"
                          style={{ width: `${oiPct}%`, background: `rgba(34,197,94,${0.2 + intensity * 0.5})`, transition: "width 0.5s" }} />
                        <div className="absolute inset-0 flex items-center justify-between px-2">
                          <span className="text-[8px] font-bold text-white z-10">{fmtOI(oi)}</span>
                          <span className={`text-[7px] font-bold z-10 ${oiChange > 0 ? "text-green-300" : oiChange < 0 ? "text-red-300" : "text-slate-500"}`}>
                            {oiChange > 0 ? "+" : ""}{fmtOI(oiChange)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Put OI Heatmap */}
            <div>
              <div className="text-[10px] font-bold text-red-400 mb-2 flex items-center gap-1">
                <TrendingDown className="w-3.5 h-3.5" /> PUT OI HEATMAP
              </div>
              <div className="space-y-1">
                {strikes.map(strike => {
                  const pe = puts.find(p => p.strike_price === strike);
                  const oi = pe?.oi || 0;
                  const oiPct = (oi / maxOI) * 100;
                  const oiChange = pe?.oich || 0;
                  const isATM = strike === atmStrike;
                  const intensity = Math.min(oiPct / 60, 1);

                  return (
                    <div key={strike} className={`flex items-center gap-2 ${isATM ? "bg-cyan-500/10 rounded px-1 py-0.5" : ""}`}>
                      <span className={`text-[9px] w-14 text-right font-semibold ${isATM ? "text-cyan-400" : "text-slate-400"}`}>{strike}</span>
                      <div className="flex-1 h-5 rounded relative overflow-hidden" style={{ background: `rgba(239,68,68,${0.05 + intensity * 0.4})` }}>
                        <div className="absolute inset-y-0 left-0 rounded"
                          style={{ width: `${oiPct}%`, background: `rgba(239,68,68,${0.2 + intensity * 0.5})`, transition: "width 0.5s" }} />
                        <div className="absolute inset-0 flex items-center justify-between px-2">
                          <span className="text-[8px] font-bold text-white z-10">{fmtOI(oi)}</span>
                          <span className={`text-[7px] font-bold z-10 ${oiChange > 0 ? "text-green-300" : oiChange < 0 ? "text-red-300" : "text-slate-500"}`}>
                            {oiChange > 0 ? "+" : ""}{fmtOI(oiChange)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* OI Change comparison */}
          <div className="mt-6">
            <div className="text-[10px] font-bold text-white mb-2 flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-cyan-400" /> OI CHANGE — CALL vs PUT
            </div>
            <div className="space-y-1">
              {strikes.map(strike => {
                const ce = calls.find(c => c.strike_price === strike);
                const pe = puts.find(p => p.strike_price === strike);
                const ceChange = ce?.oich || 0;
                const peChange = pe?.oich || 0;
                const maxChange = Math.max(Math.abs(ceChange), Math.abs(peChange), 1);
                const isATM = strike === atmStrike;

                return (
                  <div key={strike} className={`flex items-center gap-2 ${isATM ? "bg-cyan-500/10 rounded px-1 py-0.5" : ""}`}>
                    {/* CE change bar (right-aligned, going left) */}
                    <div className="flex-1 h-4 flex items-center justify-end">
                      <span className={`text-[7px] font-bold mr-1 ${ceChange > 0 ? "text-green-400" : ceChange < 0 ? "text-red-400" : "text-slate-600"}`}>
                        {ceChange > 0 ? "+" : ""}{fmtOI(ceChange)}
                      </span>
                      <div className="w-24 h-3 rounded-l bg-[#333333] overflow-hidden flex justify-end">
                        <div className={`h-full rounded-l ${ceChange > 0 ? "bg-green-500/60" : "bg-red-500/60"}`}
                          style={{ width: `${(Math.abs(ceChange) / maxChange) * 100}%` }} />
                      </div>
                    </div>

                    <span className={`text-[9px] w-14 text-center font-bold ${isATM ? "text-cyan-400" : "text-slate-400"}`}>{strike}</span>

                    {/* PE change bar (left-aligned, going right) */}
                    <div className="flex-1 h-4 flex items-center">
                      <div className="w-24 h-3 rounded-r bg-[#333333] overflow-hidden">
                        <div className={`h-full rounded-r ${peChange > 0 ? "bg-green-500/60" : "bg-red-500/60"}`}
                          style={{ width: `${(Math.abs(peChange) / maxChange) * 100}%` }} />
                      </div>
                      <span className={`text-[7px] font-bold ml-1 ${peChange > 0 ? "text-green-400" : peChange < 0 ? "text-red-400" : "text-slate-600"}`}>
                        {peChange > 0 ? "+" : ""}{fmtOI(peChange)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══ AI PICK VIEW ═══ */}
      {view === "AI Pick" && (() => {
        // Analyze chain data to find best option to buy
        const ceByOI = [...calls].sort((a, b) => (b.oi || 0) - (a.oi || 0));
        const peByOI = [...puts].sort((a, b) => (b.oi || 0) - (a.oi || 0));
        const maxCallOI = ceByOI[0];
        const maxPutOI = peByOI[0];
        const pcrValue = data.callOi > 0 ? data.putOi / data.callOi : 1;
        const bias = pcrValue > 1.2 ? "BULLISH" : pcrValue < 0.8 ? "BEARISH" : "NEUTRAL";

        // Find best option: highest OI change (buildup) near ATM
        const nearATMCalls = calls.filter(c => Math.abs(c.strike_price - spotPrice) < spotPrice * 0.03);
        const nearATMPuts = puts.filter(p => Math.abs(p.strike_price - spotPrice) < spotPrice * 0.03);
        const bestCE = nearATMCalls.sort((a, b) => (b.oich || 0) - (a.oich || 0))[0];
        const bestPE = nearATMPuts.sort((a, b) => (b.oich || 0) - (a.oich || 0))[0];
        const recommended = bias === "BULLISH" ? bestCE : bias === "BEARISH" ? bestPE : (bestCE && bestPE && (bestCE.oich || 0) > (bestPE.oich || 0) ? bestCE : bestPE);
        const recType = recommended?.option_type === "CE" ? "CALL" : "PUT";

        return (
          <div className="flex-1 min-h-0 overflow-auto p-4">
            {/* AI Recommendation Card */}
            <div className="bg-[#BFFF00]/5 border border-[#BFFF00]/20 rounded-2xl p-5 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-[#BFFF00]" />
                <span className="text-[14px] font-bold text-[#BFFF00]">AI Recommendation</span>
                <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ml-auto ${bias === "BULLISH" ? "bg-green-500/15 text-green-400" : bias === "BEARISH" ? "bg-red-500/15 text-red-400" : "bg-[#333] text-[#888]"}`}>
                  MARKET BIAS: {bias}
                </span>
              </div>

              {recommended ? (
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${recType === "CALL" ? "bg-[#BFFF00]/15 text-[#BFFF00]" : "bg-red-500/15 text-red-400"}`}>
                      BUY {recType}
                    </span>
                    <span className="text-2xl font-black text-white">{recommended.strike_price} {recommended.option_type}</span>
                    <span className="text-[14px] text-[#888]">@ ₹{recommended.ltp}</span>
                  </div>

                  <div className="grid grid-cols-4 gap-3 mb-3">
                    <div className="bg-[#333333] rounded-xl p-3">
                      <div className="text-[9px] text-[#888]">Premium</div>
                      <div className="text-lg font-black text-white">₹{recommended.ltp}</div>
                    </div>
                    <div className="bg-[#333333] rounded-xl p-3">
                      <div className="text-[9px] text-[#888]">OI Buildup</div>
                      <div className={`text-lg font-black ${(recommended.oich || 0) > 0 ? "text-green-400" : "text-red-400"}`}>
                        {(recommended.oich || 0) > 0 ? "+" : ""}{fmtOI(recommended.oich || 0)}
                      </div>
                    </div>
                    <div className="bg-[#333333] rounded-xl p-3">
                      <div className="text-[9px] text-[#888]">Total OI</div>
                      <div className="text-lg font-black text-white">{fmtOI(recommended.oi || 0)}</div>
                    </div>
                    <div className="bg-[#333333] rounded-xl p-3">
                      <div className="text-[9px] text-[#888]">IV</div>
                      <div className="text-lg font-black text-cyan-400">{recommended.iv ? `${recommended.iv}%` : "—"}</div>
                    </div>
                  </div>

                  <div className="text-[11px] text-[#aaa] leading-relaxed">
                    <strong className="text-white">Why this pick:</strong>{" "}
                    {bias === "BULLISH"
                      ? `PCR at ${pcrValue.toFixed(2)} (>1.2) indicates strong put writing = bullish. Max CE OI at ${maxCallOI?.strike_price || "—"} (resistance). Max PE OI at ${maxPutOI?.strike_price || "—"} (support). OI buildup of ${fmtOI(recommended.oich || 0)} at ${recommended.strike_price} CE suggests institutional buying. Spot at ${fmtNum(spotPrice)} with ${fmtNum(spotPrice - (maxPutOI?.strike_price || spotPrice))} pts of PE support below.`
                      : bias === "BEARISH"
                      ? `PCR at ${pcrValue.toFixed(2)} (<0.8) indicates call writing = bearish. Max CE OI at ${maxCallOI?.strike_price || "—"} (resistance ceiling). OI buildup of ${fmtOI(recommended.oich || 0)} at ${recommended.strike_price} PE suggests institutional put buying. Spot at ${fmtNum(spotPrice)} near resistance at ${maxCallOI?.strike_price || "—"}.`
                      : `Market is range-bound (PCR: ${pcrValue.toFixed(2)}). Highest OI buildup at ${recommended.strike_price} ${recommended.option_type}. Consider straddle/strangle strategies in this neutral environment.`
                    }
                  </div>

                  {/* Suggested trade */}
                  <div className="mt-4 bg-[#333333] rounded-xl p-4 border border-[#3a3a3a]">
                    <div className="text-[10px] text-[#BFFF00] font-bold mb-2">SUGGESTED TRADE</div>
                    <div className="grid grid-cols-5 gap-2 text-[10px]">
                      <div><span className="text-[#888]">Entry:</span> <span className="text-white font-bold">₹{recommended.ltp}</span></div>
                      <div><span className="text-[#888]">SL:</span> <span className="text-red-400 font-bold">₹{Math.round(recommended.ltp * 0.7)}</span></div>
                      <div><span className="text-[#888]">Target:</span> <span className="text-green-400 font-bold">₹{Math.round(recommended.ltp * 1.5)}</span></div>
                      <div><span className="text-[#888]">R:R:</span> <span className="text-[#BFFF00] font-bold">1.67:1</span></div>
                      <div><span className="text-[#888]">Max Loss:</span> <span className="text-red-400 font-bold">₹{Math.round(recommended.ltp * 0.3 * 25)}</span></div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-[12px] text-[#888]">Loading chain data to generate recommendation...</div>
              )}
            </div>

            {/* Key Levels */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#262626] rounded-xl border border-[#3a3a3a] p-4">
                <div className="text-[10px] text-green-400 font-bold mb-2">CALL SIDE — Max OI Strikes</div>
                {ceByOI.slice(0, 5).map((c, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-[#333333] last:border-0 text-[10px]">
                    <span className="text-white font-semibold">{c.strike_price}</span>
                    <span className="text-[#888]">{fmtOI(c.oi || 0)} OI</span>
                    <span className={`font-bold ${(c.oich || 0) > 0 ? "text-green-400" : "text-red-400"}`}>{(c.oich || 0) > 0 ? "+" : ""}{fmtOI(c.oich || 0)}</span>
                    <span className="text-[#888]">{c.strike_price > spotPrice ? "RESISTANCE" : "ITM"}</span>
                  </div>
                ))}
              </div>
              <div className="bg-[#262626] rounded-xl border border-[#3a3a3a] p-4">
                <div className="text-[10px] text-red-400 font-bold mb-2">PUT SIDE — Max OI Strikes</div>
                {peByOI.slice(0, 5).map((p, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-[#333333] last:border-0 text-[10px]">
                    <span className="text-white font-semibold">{p.strike_price}</span>
                    <span className="text-[#888]">{fmtOI(p.oi || 0)} OI</span>
                    <span className={`font-bold ${(p.oich || 0) > 0 ? "text-green-400" : "text-red-400"}`}>{(p.oich || 0) > 0 ? "+" : ""}{fmtOI(p.oich || 0)}</span>
                    <span className="text-[#888]">{p.strike_price < spotPrice ? "SUPPORT" : "OTM"}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
