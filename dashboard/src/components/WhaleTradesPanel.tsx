"use client";
import { useState, useEffect } from "react";
import { Fish, ArrowUpRight, ArrowDownRight, Layers, Lock, Zap } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { generateWhaleTrades, generateFlowBuckets, generateAssetFlows, WhaleTrade, FlowBucket, AssetFlow } from "@/lib/data";

const tabs = ["Trades", "Flow Chart", "By Asset"] as const;

function fmtN(n: number): string {
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}

export default function WhaleTradesPanel() {
  const [tab, setTab] = useState<typeof tabs[number]>("Trades");
  const [trades, setTrades] = useState<WhaleTrade[]>([]);
  const [buckets, setBuckets] = useState<FlowBucket[]>([]);
  const [assetFlows, setAssetFlows] = useState<AssetFlow[]>([]);

  useEffect(() => {
    const update = () => { setTrades(generateWhaleTrades()); setBuckets(generateFlowBuckets()); setAssetFlows(generateAssetFlows()); };
    update();
    const i = setInterval(update, 15000);
    return () => clearInterval(i);
  }, []);

  const buyFlow = trades.filter(t => t.side === "BUY").reduce((s, t) => s + t.notional, 0);
  const sellFlow = trades.filter(t => t.side === "SELL").reduce((s, t) => s + t.notional, 0);
  const net = buyFlow - sellFlow;
  const blockCount = trades.filter(t => t.blockTrade).length;
  const darkCount = trades.filter(t => t.darkPool).length;

  return (
    <div className="bg-[#262626] rounded-xl border border-[#3a3a3a] flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#3a3a3a]">
        <div className="flex items-center gap-2">
          <Fish className="w-3.5 h-3.5 text-purple-400" />
          <h2 className="text-[11px] font-bold text-white">Whale Trades</h2>
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 pulse-dot" />
        </div>
        <span className={`text-[9px] font-bold ${net >= 0 ? "text-green-400" : "text-red-400"}`}>
          Net: {fmtN(Math.abs(net))} {net >= 0 ? "buy" : "sell"}
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-0 border-b border-[#3a3a3a] text-[9px]">
        <div className="px-3 py-1.5 border-r border-[#3a3a3a]/50 text-center">
          <div className="text-slate-500">Buy Flow</div>
          <div className="text-green-400 font-bold">{fmtN(buyFlow)}</div>
        </div>
        <div className="px-3 py-1.5 border-r border-[#3a3a3a]/50 text-center">
          <div className="text-slate-500">Sell Flow</div>
          <div className="text-red-400 font-bold">{fmtN(sellFlow)}</div>
        </div>
        <div className="px-3 py-1.5 border-r border-[#3a3a3a]/50 text-center">
          <div className="text-slate-500 flex items-center justify-center gap-0.5"><Layers className="w-2.5 h-2.5" />Block</div>
          <div className="text-white font-bold">{blockCount}</div>
        </div>
        <div className="px-3 py-1.5 text-center">
          <div className="text-slate-500 flex items-center justify-center gap-0.5"><Lock className="w-2.5 h-2.5" />Dark</div>
          <div className="text-white font-bold">{darkCount}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 px-3 border-b border-[#3a3a3a]">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`text-[9px] px-2.5 py-1.5 font-semibold border-b-2 transition ${tab === t ? "border-purple-400 text-purple-400" : "border-transparent text-slate-500 hover:text-slate-300"}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {tab === "Trades" && (
          <table className="w-full text-[10px]">
            <thead className="sticky top-0 bg-[#262626] z-10">
              <tr className="text-slate-600 border-b border-[#3a3a3a]">
                <th className="text-left px-3 py-1.5 font-medium">Time</th>
                <th className="text-left px-1 py-1.5 font-medium">Asset</th>
                <th className="text-left px-1 py-1.5 font-medium">Side</th>
                <th className="text-right px-1 py-1.5 font-medium">Size</th>
                <th className="text-right px-1 py-1.5 font-medium">Notional</th>
                <th className="text-right px-1 py-1.5 font-medium">%Vol</th>
                <th className="text-right px-1 py-1.5 font-medium">Impact</th>
                <th className="text-center px-2 py-1.5 font-medium">Flags</th>
              </tr>
            </thead>
            <tbody>
              {trades.map(t => (
                <tr key={t.id} className={`border-b border-[#3a3a3a]/30 hover:bg-[#2e2e2e]/60 transition ${t.percentOfVolume > 6 ? "bg-purple-500/5" : ""}`}>
                  <td className="px-3 py-1.5 text-slate-500">{new Date(t.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                  <td className="px-1 py-1.5 font-bold text-white">{t.asset}</td>
                  <td className="px-1 py-1.5">
                    <span className={`flex items-center gap-0.5 font-bold text-[9px] ${t.side === "BUY" ? "text-green-400" : "text-red-400"}`}>
                      {t.side === "BUY" ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}{t.side}
                    </span>
                  </td>
                  <td className="px-1 py-1.5 text-right text-slate-300">{t.size.toLocaleString()}</td>
                  <td className="px-1 py-1.5 text-right font-semibold text-white">{fmtN(t.notional)}</td>
                  <td className="px-1 py-1.5 text-right"><span className={t.percentOfVolume > 5 ? "text-amber-400 font-bold" : "text-slate-500"}>{t.percentOfVolume}%</span></td>
                  <td className="px-1 py-1.5 text-right"><span className={`${t.priceImpact >= 0 ? "text-green-400" : "text-red-400"}`}>{t.priceImpact >= 0 ? "+" : ""}{(t.priceImpact * 100).toFixed(1)}bp</span></td>
                  <td className="px-2 py-1.5 text-center">
                    <div className="flex items-center justify-center gap-0.5">
                      {t.blockTrade && <span className="text-[7px] px-1 py-0 rounded bg-blue-500/20 text-blue-400">BLK</span>}
                      {t.darkPool && <span className="text-[7px] px-1 py-0 rounded bg-slate-500/20 text-slate-400">DP</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === "Flow Chart" && (
          <div className="p-2" style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={buckets} stackOffset="sign">
                <XAxis dataKey="time" tick={{ fontSize: 8, fill: "#475569" }} axisLine={false} tickLine={false} interval={3} />
                <YAxis tick={{ fontSize: 8, fill: "#475569" }} axisLine={false} tickLine={false} width={35} tickFormatter={(v: number) => `${(v/1e6).toFixed(0)}M`} />
                <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #222222", borderRadius: 8, fontSize: 9 }} formatter={(v: unknown) => fmtN(Math.abs(Number(v)))} />
                <ReferenceLine y={0} stroke="#334155" />
                <Bar dataKey="buyFlow" fill="#22c55e" fillOpacity={0.7} radius={[2, 2, 0, 0]} />
                <Bar dataKey="sellFlow" fill="#ef4444" fillOpacity={0.7} radius={[0, 0, 2, 2]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {tab === "By Asset" && (
          <div className="p-3 space-y-1.5">
            {assetFlows.map((a, i) => (
              <div key={i} className="bg-[#333333] rounded-lg p-2 border border-[#3a3a3a]/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-white">{a.asset}</span>
                  <span className={`text-[9px] font-bold ${a.net >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {a.net >= 0 ? "+" : ""}{fmtN(a.net)}
                  </span>
                </div>
                <div className="flex items-center gap-1 h-2">
                  <div className="h-full rounded-l bg-green-500/60" style={{ width: `${a.buyVol / (a.buyVol + a.sellVol) * 100}%` }} />
                  <div className="h-full rounded-r bg-red-500/60 flex-1" />
                </div>
                <div className="flex items-center justify-between mt-1 text-[8px] text-slate-500">
                  <span>Buy: {fmtN(a.buyVol)}</span>
                  <span>{a.count} trades</span>
                  <span>Sell: {fmtN(a.sellVol)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
