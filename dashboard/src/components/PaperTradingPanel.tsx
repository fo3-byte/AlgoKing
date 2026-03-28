"use client";
import { useState, useEffect, useCallback } from "react";
import { Play, X, RotateCcw, TrendingUp, TrendingDown, DollarSign, Target, AlertTriangle, Award } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useMarketData } from "@/hooks/useYahooData";
import { loadState, saveState, placeOrder, tickPositions, closePosition, resetState, runBacktest, PaperState } from "@/lib/paperTrading";
import { generatePriceCandles, BacktestResult } from "@/lib/data";

const ASSETS = [
  { key: "CL", label: "WTI Crude", yahooName: "WTI" },
  { key: "BZ", label: "Brent", yahooName: "BRENT" },
  { key: "GC", label: "Gold", yahooName: "GOLD" },
  { key: "BTC", label: "Bitcoin", yahooName: "BTC" },
  { key: "ES", label: "S&P 500", yahooName: "S&P500" },
  { key: "NQ", label: "Nasdaq", yahooName: "NASDAQ" },
  { key: "NG", label: "NatGas", yahooName: "NATGAS" },
];

const STRATEGIES = ["MA Crossover", "Mean Reversion"];

const tabs = ["Paper Trade", "Backtest"] as const;

function fmtMoney(n: number): string {
  const abs = Math.abs(n);
  const prefix = n < 0 ? "-" : n > 0 ? "+" : "";
  if (abs >= 1e6) return `${prefix}₹${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${prefix}₹${(abs / 1e3).toFixed(1)}K`;
  return `${prefix}₹${abs.toFixed(0)}`;
}

export default function PaperTradingPanel() {
  const [tab, setTab] = useState<typeof tabs[number]>("Paper Trade");
  const [state, setState] = useState<PaperState>(loadState);
  const { tickers } = useMarketData(2000);

  // Order form state
  const [asset, setAsset] = useState("CL");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [qty, setQty] = useState(10);
  const [orderType, setOrderType] = useState<"MARKET" | "LIMIT">("MARKET");
  const [limitPrice, setLimitPrice] = useState(0);

  // Backtest state
  const [btStrategy, setBtStrategy] = useState(STRATEGIES[0]);
  const [btAsset, setBtAsset] = useState("CL");
  const [btResult, setBtResult] = useState<BacktestResult | null>(null);
  const [btRunning, setBtRunning] = useState(false);

  // Get current price for an asset
  const getPrice = useCallback((assetKey: string): number => {
    const a = ASSETS.find(a => a.key === assetKey);
    if (!a) return 0;
    const ticker = tickers.find(t => t.displayName === a.yahooName || t.symbol === a.yahooName);
    return ticker?.price ?? 0;
  }, [tickers]);

  // Tick positions with live prices every 2s
  useEffect(() => {
    if (state.positions.length === 0 && state.orders.filter(o => o.status === "open").length === 0) return;
    const priceMap: Record<string, number> = {};
    state.positions.forEach(p => { priceMap[p.asset] = getPrice(p.asset); });
    state.orders.filter(o => o.status === "open").forEach(o => { priceMap[o.asset] = getPrice(o.asset); });

    const updated = tickPositions(state, priceMap);
    setState(updated);
    saveState(updated);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickers]);

  const handlePlaceOrder = () => {
    const price = getPrice(asset);
    if (!price && orderType === "MARKET") return;
    const updated = placeOrder(state, asset, side, qty, orderType, price || 0, orderType === "LIMIT" ? limitPrice : undefined);
    setState(updated);
    saveState(updated);
  };

  const handleClose = (posId: string) => {
    const updated = closePosition(state, posId);
    setState(updated);
    saveState(updated);
  };

  const handleReset = () => {
    const fresh = resetState();
    setState(fresh);
    saveState(fresh);
  };

  const handleBacktest = () => {
    setBtRunning(true);
    setTimeout(() => {
      const candles = generatePriceCandles(btAsset, 300);
      const result = runBacktest(btStrategy, candles.map(c => ({ close: c.close, time: c.time })));
      setBtResult(result);
      setBtRunning(false);
    }, 500);
  };

  const totalUnrealized = state.positions.reduce((s, p) => s + p.unrealizedPnl, 0);
  const totalRealized = state.history.reduce((s, t) => s + t.pnl, 0);
  const currentPrice = getPrice(asset);

  return (
    <div className="bg-[#262626] rounded-xl border border-[#3a3a3a] flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#3a3a3a] flex-shrink-0">
        <div className="flex items-center gap-2">
          <Play className="w-3.5 h-3.5 text-green-400" />
          <h2 className="text-[11px] font-bold text-white">Paper Trading & Backtester</h2>
          <span className="text-[8px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-bold">SIMULATED</span>
        </div>
        <div className="flex items-center gap-3 text-[9px]">
          <span className="text-slate-400">Cash: <span className="text-white font-bold">₹{state.cash.toLocaleString()}</span></span>
          <button onClick={handleReset} className="flex items-center gap-0.5 text-slate-500 hover:text-red-400 transition"><RotateCcw className="w-3 h-3" /> Reset</button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-0 border-b border-[#3a3a3a] text-[9px] flex-shrink-0">
        <div className="px-3 py-1.5 text-center border-r border-[#3a3a3a]/50">
          <div className="text-slate-500">Open Positions</div>
          <div className="text-white font-bold">{state.positions.length}</div>
        </div>
        <div className="px-3 py-1.5 text-center border-r border-[#3a3a3a]/50">
          <div className="text-slate-500">Unrealized P&L</div>
          <div className={`font-bold ${totalUnrealized >= 0 ? "text-green-400" : "text-red-400"}`}>{fmtMoney(totalUnrealized)}</div>
        </div>
        <div className="px-3 py-1.5 text-center border-r border-[#3a3a3a]/50">
          <div className="text-slate-500">Realized P&L</div>
          <div className={`font-bold ${totalRealized >= 0 ? "text-green-400" : "text-red-400"}`}>{fmtMoney(totalRealized)}</div>
        </div>
        <div className="px-3 py-1.5 text-center">
          <div className="text-slate-500">Total Trades</div>
          <div className="text-white font-bold">{state.history.length}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 px-3 border-b border-[#3a3a3a] flex-shrink-0">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`text-[9px] px-3 py-1.5 font-semibold border-b-2 transition ${tab === t ? "border-green-400 text-green-400" : "border-transparent text-slate-500 hover:text-slate-300"}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {tab === "Paper Trade" && (
          <div className="flex flex-col h-full">
            {/* Order entry form */}
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#3a3a3a] bg-[#333333]/50 flex-shrink-0 flex-wrap">
              <select value={asset} onChange={e => setAsset(e.target.value)}
                className="bg-[#333333] text-white text-[10px] px-2 py-1 rounded border border-[#334155] outline-none">
                {ASSETS.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
              </select>

              <div className="flex rounded overflow-hidden border border-[#334155]">
                <button onClick={() => setSide("BUY")} className={`text-[9px] px-2.5 py-1 font-bold transition ${side === "BUY" ? "bg-green-500/20 text-green-400" : "bg-[#333333] text-slate-500"}`}>BUY</button>
                <button onClick={() => setSide("SELL")} className={`text-[9px] px-2.5 py-1 font-bold transition ${side === "SELL" ? "bg-red-500/20 text-red-400" : "bg-[#333333] text-slate-500"}`}>SELL</button>
              </div>

              <input type="number" value={qty} onChange={e => setQty(+e.target.value)} min={1}
                className="bg-[#333333] text-white text-[10px] px-2 py-1 rounded border border-[#334155] w-16 outline-none" placeholder="Qty" />

              <div className="flex rounded overflow-hidden border border-[#334155]">
                <button onClick={() => setOrderType("MARKET")} className={`text-[9px] px-2 py-1 font-medium transition ${orderType === "MARKET" ? "bg-blue-500/20 text-blue-400" : "bg-[#333333] text-slate-500"}`}>MKT</button>
                <button onClick={() => setOrderType("LIMIT")} className={`text-[9px] px-2 py-1 font-medium transition ${orderType === "LIMIT" ? "bg-blue-500/20 text-blue-400" : "bg-[#333333] text-slate-500"}`}>LMT</button>
              </div>

              {orderType === "LIMIT" && (
                <input type="number" value={limitPrice} onChange={e => setLimitPrice(+e.target.value)} step={0.01}
                  className="bg-[#333333] text-white text-[10px] px-2 py-1 rounded border border-[#334155] w-20 outline-none" placeholder="Limit" />
              )}

              <span className="text-[9px] text-slate-500">@ <span className="text-white font-bold">{currentPrice > 0 ? currentPrice.toLocaleString() : "N/A"}</span></span>

              <button onClick={handlePlaceOrder}
                className={`text-[10px] px-3 py-1 rounded font-bold transition ${side === "BUY" ? "bg-green-500/20 text-green-400 hover:bg-green-500/30" : "bg-red-500/20 text-red-400 hover:bg-red-500/30"}`}>
                Place {side}
              </button>
            </div>

            {/* Positions + Equity curve */}
            <div className="flex-1 min-h-0 grid grid-cols-12 gap-0">
              {/* Open positions */}
              <div className="col-span-7 border-r border-[#3a3a3a] overflow-auto">
                <div className="px-3 py-1.5 border-b border-[#3a3a3a] text-[9px] text-slate-500 font-semibold uppercase tracking-wider sticky top-0 bg-[#262626] z-10">Open Positions</div>
                {state.positions.length === 0 ? (
                  <div className="flex items-center justify-center h-20 text-[10px] text-slate-600">No open positions — place an order above</div>
                ) : (
                  <table className="w-full text-[10px]">
                    <thead className="sticky top-[26px] bg-[#262626] z-10">
                      <tr className="text-slate-600 border-b border-[#3a3a3a]">
                        <th className="text-left px-3 py-1 font-medium">Asset</th>
                        <th className="text-left px-1 py-1 font-medium">Side</th>
                        <th className="text-right px-1 py-1 font-medium">Qty</th>
                        <th className="text-right px-1 py-1 font-medium">Entry</th>
                        <th className="text-right px-1 py-1 font-medium">Current</th>
                        <th className="text-right px-1 py-1 font-medium">P&L</th>
                        <th className="text-center px-2 py-1 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.positions.map(p => (
                        <tr key={p.id} className="border-b border-[#3a3a3a]/30 hover:bg-[#2e2e2e]/60">
                          <td className="px-3 py-1.5 font-bold text-white">{p.asset}</td>
                          <td className="px-1 py-1.5"><span className={`text-[8px] px-1 py-0.5 rounded font-bold ${p.side === "BUY" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>{p.side}</span></td>
                          <td className="px-1 py-1.5 text-right text-slate-300">{p.quantity}</td>
                          <td className="px-1 py-1.5 text-right text-slate-400">{p.avgEntry.toLocaleString()}</td>
                          <td className="px-1 py-1.5 text-right text-white">{p.currentPrice.toLocaleString()}</td>
                          <td className={`px-1 py-1.5 text-right font-bold ${p.unrealizedPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {fmtMoney(p.unrealizedPnl)}<div className="text-[7px]">{p.unrealizedPnlPct >= 0 ? "+" : ""}{p.unrealizedPnlPct}%</div>
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <button onClick={() => handleClose(p.id)} className="text-[8px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 hover:bg-red-500/25 transition"><X className="w-2.5 h-2.5 inline" /> Close</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* Trade history */}
                {state.history.length > 0 && (
                  <>
                    <div className="px-3 py-1.5 border-t border-b border-[#3a3a3a] text-[9px] text-slate-500 font-semibold uppercase tracking-wider sticky bg-[#262626]">Trade History</div>
                    <table className="w-full text-[10px]">
                      <tbody>
                        {state.history.slice(0, 20).map(t => (
                          <tr key={t.id} className="border-b border-[#3a3a3a]/30">
                            <td className="px-3 py-1 font-semibold text-white">{t.asset}</td>
                            <td className="px-1 py-1"><span className={`text-[8px] font-bold ${t.side === "BUY" ? "text-green-400" : "text-red-400"}`}>{t.side}</span></td>
                            <td className="px-1 py-1 text-slate-400">{t.quantity} @ {t.entryPrice.toLocaleString()} → {t.exitPrice.toLocaleString()}</td>
                            <td className={`px-2 py-1 text-right font-bold ${t.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>{fmtMoney(t.pnl)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </div>

              {/* Equity curve */}
              <div className="col-span-5 p-2 flex flex-col">
                <div className="text-[9px] text-slate-500 font-semibold mb-1">Running P&L</div>
                {state.equityCurve.length > 1 ? (
                  <div className="flex-1" style={{ minHeight: 120 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={state.equityCurve}>
                        <defs>
                          <linearGradient id="ptGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="time" tick={{ fontSize: 7, fill: "#475569" }} axisLine={false} tickLine={false} interval={Math.floor(state.equityCurve.length / 6)} />
                        <YAxis tick={{ fontSize: 7, fill: "#475569" }} axisLine={false} tickLine={false} width={40} tickFormatter={(v: number) => `${(v/1e3).toFixed(0)}K`} />
                        <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #222222", borderRadius: 8, fontSize: 9 }} />
                        <Area type="monotone" dataKey="equity" stroke="#22c55e" strokeWidth={1.5} fill="url(#ptGrad)" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-[10px] text-slate-600">Place trades to see P&L curve</div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === "Backtest" && (
          <div className="p-3 space-y-3">
            {/* Config */}
            <div className="bg-[#333333] rounded-lg p-3 border border-[#3a3a3a]/50">
              <div className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider mb-2">Backtest Configuration</div>
              <div className="flex items-center gap-3 flex-wrap">
                <div>
                  <label className="text-[8px] text-slate-600 block mb-0.5">Strategy</label>
                  <select value={btStrategy} onChange={e => setBtStrategy(e.target.value)}
                    className="bg-[#333333] text-white text-[10px] px-2 py-1 rounded border border-[#334155] outline-none">
                    {STRATEGIES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[8px] text-slate-600 block mb-0.5">Asset</label>
                  <select value={btAsset} onChange={e => setBtAsset(e.target.value)}
                    className="bg-[#333333] text-white text-[10px] px-2 py-1 rounded border border-[#334155] outline-none">
                    {ASSETS.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
                  </select>
                </div>
                <div className="flex-1" />
                <button onClick={handleBacktest} disabled={btRunning}
                  className="text-[10px] px-4 py-1.5 rounded font-bold bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition disabled:opacity-50 flex items-center gap-1">
                  <Play className="w-3 h-3" /> {btRunning ? "Running..." : "Run Backtest"}
                </button>
              </div>
            </div>

            {/* Results */}
            {btResult && (
              <>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { label: "Total Return", val: `${btResult.totalReturn >= 0 ? "+" : ""}${btResult.totalReturn}%`, color: btResult.totalReturn >= 0 ? "text-green-400" : "text-red-400", icon: TrendingUp },
                    { label: "Sharpe Ratio", val: btResult.sharpe.toString(), color: btResult.sharpe >= 1 ? "text-green-400" : "text-amber-400", icon: Award },
                    { label: "Max Drawdown", val: `${btResult.maxDrawdown}%`, color: "text-red-400", icon: TrendingDown },
                    { label: "Win Rate", val: `${btResult.winRate}%`, color: btResult.winRate >= 50 ? "text-green-400" : "text-amber-400", icon: Target },
                    { label: "Total Trades", val: btResult.totalTrades.toString(), color: "text-blue-400", icon: DollarSign },
                  ].map((s, i) => (
                    <div key={i} className="bg-[#333333] rounded-lg p-2.5 border border-[#3a3a3a]/50">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[8px] text-slate-600 uppercase">{s.label}</span>
                        <s.icon className={`w-3 h-3 ${s.color}`} />
                      </div>
                      <div className={`text-sm font-black ${s.color}`}>{s.val}</div>
                    </div>
                  ))}
                </div>

                {/* Equity curve */}
                <div className="bg-[#333333] rounded-lg p-3 border border-[#3a3a3a]/50">
                  <div className="text-[9px] text-slate-500 font-semibold mb-2">Backtest Equity Curve</div>
                  <div style={{ height: 180 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={btResult.equityCurve}>
                        <defs>
                          <linearGradient id="btGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={btResult.totalReturn >= 0 ? "#22c55e" : "#ef4444"} stopOpacity={0.3} />
                            <stop offset="100%" stopColor={btResult.totalReturn >= 0 ? "#22c55e" : "#ef4444"} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="time" tick={{ fontSize: 7, fill: "#475569" }} axisLine={false} tickLine={false} interval={Math.floor(btResult.equityCurve.length / 8)} />
                        <YAxis tick={{ fontSize: 7, fill: "#475569" }} axisLine={false} tickLine={false} width={45} tickFormatter={(v: number) => `${(v/1e3).toFixed(0)}K`} />
                        <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #222222", borderRadius: 8, fontSize: 9 }} />
                        <Area type="monotone" dataKey="equity" stroke={btResult.totalReturn >= 0 ? "#22c55e" : "#ef4444"} strokeWidth={1.5} fill="url(#btGrad)" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Trade table */}
                {btResult.trades.length > 0 && (
                  <div className="bg-[#333333] rounded-lg border border-[#3a3a3a]/50 overflow-hidden">
                    <div className="px-3 py-1.5 border-b border-[#3a3a3a] text-[9px] text-slate-500 font-semibold uppercase tracking-wider">Trade Results ({btResult.trades.length})</div>
                    <div className="max-h-[200px] overflow-auto">
                      <table className="w-full text-[10px]">
                        <thead className="sticky top-0 bg-[#333333]">
                          <tr className="text-slate-600 border-b border-[#3a3a3a]">
                            <th className="text-left px-3 py-1 font-medium">#</th>
                            <th className="text-left px-1 py-1 font-medium">Side</th>
                            <th className="text-right px-1 py-1 font-medium">Entry</th>
                            <th className="text-right px-1 py-1 font-medium">Exit</th>
                            <th className="text-right px-3 py-1 font-medium">P&L</th>
                          </tr>
                        </thead>
                        <tbody>
                          {btResult.trades.map((t, i) => (
                            <tr key={i} className="border-b border-[#3a3a3a]/30">
                              <td className="px-3 py-1 text-slate-500">{i + 1}</td>
                              <td className="px-1 py-1"><span className={`font-bold ${t.side === "BUY" ? "text-green-400" : "text-red-400"}`}>{t.side}</span></td>
                              <td className="px-1 py-1 text-right text-slate-300">{t.entryPrice.toFixed(2)}</td>
                              <td className="px-1 py-1 text-right text-white">{t.exitPrice.toFixed(2)}</td>
                              <td className={`px-3 py-1 text-right font-bold ${t.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>{fmtMoney(t.pnl)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {!btResult && !btRunning && (
              <div className="flex flex-col items-center justify-center py-12 text-slate-600">
                <AlertTriangle className="w-8 h-8 mb-2 text-slate-700" />
                <div className="text-[11px]">Select a strategy and asset, then click Run Backtest</div>
                <div className="text-[9px] text-slate-700 mt-1">Uses 300-candle historical simulation</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
