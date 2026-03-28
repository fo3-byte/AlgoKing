"use client";
import { useState, useEffect } from "react";
import { Bot, Target, ShieldCheck, TrendingUp, TrendingDown, Award } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ComposedChart } from "recharts";
import { generateAlgoPositions, generateEquityCurve, generateStrategyPerf, AlgoPosition, EquityPoint, StrategyPerf } from "@/lib/data";

const tabs = ["Positions", "Equity", "Strategies"] as const;

function ConfRing({ value }: { value: number }) {
  const r = 12; const c = 2 * Math.PI * r; const off = c - (value / 100) * c;
  const color = value >= 80 ? "#22c55e" : value >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative w-7 h-7 flex items-center justify-center">
      <svg className="w-7 h-7 -rotate-90" viewBox="0 0 30 30">
        <circle cx="15" cy="15" r={r} fill="none" stroke="#222222" strokeWidth="2.5" />
        <circle cx="15" cy="15" r={r} fill="none" stroke={color} strokeWidth="2.5" strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" />
      </svg>
      <span className="absolute text-[7px] font-black text-white">{value}</span>
    </div>
  );
}

function GreekPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[7px] text-slate-600">{label}</span>
      <span className={`text-[8px] font-bold ${color}`}>{value >= 0 && label !== "θ" ? "+" : ""}{value}</span>
    </div>
  );
}

export default function AlgoPositionsPanel() {
  const [tab, setTab] = useState<typeof tabs[number]>("Positions");
  const [positions, setPositions] = useState<AlgoPosition[]>([]);
  const [equity, setEquity] = useState<EquityPoint[]>([]);
  const [stratPerf, setStratPerf] = useState<StrategyPerf[]>([]);
  const [marketFilter, setMarketFilter] = useState("All");

  useEffect(() => {
    const update = () => { setPositions(generateAlgoPositions()); setEquity(generateEquityCurve()); setStratPerf(generateStrategyPerf()); };
    update();
    const i = setInterval(update, 20000);
    return () => clearInterval(i);
  }, []);

  const totalPnl = positions.reduce((s, p) => s + p.pnl * p.size, 0);
  const active = positions.filter(p => p.status === "active").length;
  const longN = positions.filter(p => p.side === "LONG").length;
  const winN = positions.filter(p => p.pnl > 0).length;
  const markets = ["All", ...Array.from(new Set(positions.map(p => p.market)))];
  const filtered = marketFilter === "All" ? positions : positions.filter(p => p.market === marketFilter);

  return (
    <div className="bg-[#262626] rounded-xl border border-[#3a3a3a] flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#3a3a3a] flex-shrink-0">
        <div className="flex items-center gap-2">
          <Bot className="w-3.5 h-3.5 text-blue-400" />
          <h2 className="text-[11px] font-bold text-white">Mother Algo</h2>
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 pulse-dot" />
        </div>
        <span className={`text-[10px] font-black ${totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
          P&L: {totalPnl >= 0 ? "+" : ""}₹{Math.abs(totalPnl).toLocaleString()}
        </span>
      </div>

      <div className="grid grid-cols-5 gap-0 border-b border-[#3a3a3a] text-[8px] flex-shrink-0">
        {[
          { label: "Active", val: `${active}/${positions.length}`, color: "text-white" },
          { label: "Long/Short", val: `${longN}L/${positions.length - longN}S`, color: "text-white" },
          { label: "Win Rate", val: `${((winN / positions.length) * 100).toFixed(0)}%`, color: winN > positions.length / 2 ? "text-green-400" : "text-red-400" },
          { label: "Avg Conf", val: `${(positions.reduce((s, p) => s + p.confidence, 0) / positions.length).toFixed(0)}%`, color: "text-cyan-400" },
          { label: "MC Score", val: `${(positions.reduce((s, p) => s + +p.mcScore, 0) / positions.length).toFixed(1)}`, color: "text-purple-400" },
        ].map((s, i) => (
          <div key={i} className="px-2 py-1.5 text-center border-r border-[#3a3a3a]/50 last:border-0">
            <div className="text-slate-600">{s.label}</div>
            <div className={`font-bold ${s.color}`}>{s.val}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-0 px-3 border-b border-[#3a3a3a] flex-shrink-0">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`text-[9px] px-2.5 py-1.5 font-semibold border-b-2 transition ${tab === t ? "border-blue-400 text-blue-400" : "border-transparent text-slate-500 hover:text-slate-300"}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {tab === "Positions" && (
          <>
            <div className="flex items-center gap-0.5 px-3 py-1 border-b border-[#3a3a3a]/50 sticky top-0 bg-[#262626] z-10">
              {markets.map(m => (
                <button key={m} onClick={() => setMarketFilter(m)}
                  className={`text-[7px] px-1.5 py-0.5 rounded font-medium ${marketFilter === m ? "bg-blue-500/20 text-blue-400" : "text-slate-600 hover:text-slate-400"}`}>
                  {m}
                </button>
              ))}
            </div>
            {filtered.map(p => (
              <div key={p.id} className={`px-3 py-2 border-b border-[#3a3a3a]/30 hover:bg-[#2e2e2e]/60 transition ${p.status === "pending" ? "opacity-50" : ""}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className={`px-1 py-0.5 rounded text-[7px] font-black ${p.side === "LONG" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>{p.side}</span>
                    <span className="text-[10px] font-bold text-white">{p.asset}</span>
                    <span className="text-[7px] px-1 py-0.5 rounded bg-blue-500/10 text-blue-400">{p.strategy}</span>
                    <span className="text-[7px] text-slate-600">{p.market}</span>
                  </div>
                  <ConfRing value={p.confidence} />
                </div>
                <div className="relative h-1 rounded-full bg-[#333333] mb-2 mx-1">
                  <div className="absolute top-1/2 -translate-y-1/2 w-1 h-2.5 bg-red-500 rounded-full" style={{ left: `${p.side === "LONG" ? 5 : 90}%` }} />
                  <div className="absolute top-1/2 -translate-y-1/2 w-1 h-2.5 bg-white rounded-full" style={{ left: "35%" }} />
                  <div className={`absolute top-1/2 -translate-y-1/2 w-1.5 h-3 rounded-full ${p.pnl >= 0 ? "bg-green-400" : "bg-red-400"}`} style={{ left: `${35 + p.pnlPercent * 8}%` }} />
                  <div className="absolute top-1/2 -translate-y-1/2 w-1 h-2.5 bg-green-500 rounded-full" style={{ left: `${p.side === "LONG" ? 90 : 5}%` }} />
                </div>
                <div className="grid grid-cols-6 gap-1 text-[8px]">
                  <div><span className="text-slate-600">Entry</span><div className="text-slate-300 font-semibold">{p.entry.toLocaleString()}</div></div>
                  <div><span className="text-slate-600">Current</span><div className="text-white font-bold">{p.current.toLocaleString()}</div></div>
                  <div><span className="text-slate-600 flex items-center gap-0.5"><Target className="w-2 h-2" />TP</span><div className="text-green-400">{p.target.toLocaleString()}</div></div>
                  <div><span className="text-slate-600 flex items-center gap-0.5"><ShieldCheck className="w-2 h-2" />SL</span><div className="text-red-400">{p.stopLoss.toLocaleString()}</div></div>
                  <div><span className="text-slate-600">R:R</span><div className="text-cyan-400">{p.riskReward}x</div></div>
                  <div className="text-right">
                    <span className={`text-[10px] font-black ${p.pnlPercent >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {p.pnlPercent >= 0 ? "+" : ""}{p.pnlPercent.toFixed(2)}%
                    </span>
                    <div className="text-[7px] text-slate-600">MC:{p.mcScore} Qty:{p.size}</div>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {tab === "Equity" && (
          <div className="p-2">
            <div className="flex items-center justify-between px-2 mb-1 text-[9px]">
              <span className="text-slate-500">60-Day Equity Curve</span>
              <span className="text-white font-bold">₹{equity[equity.length - 1]?.equity.toLocaleString()}</span>
            </div>
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={equity}>
                  <defs>
                    <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" tick={{ fontSize: 7, fill: "#475569" }} axisLine={false} tickLine={false} interval={9} />
                  <YAxis tick={{ fontSize: 7, fill: "#475569" }} axisLine={false} tickLine={false} width={40} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`} />
                  <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #222222", borderRadius: 8, fontSize: 9 }} />
                  <Area type="monotone" dataKey="equity" stroke="#3b82f6" strokeWidth={1.5} fill="url(#eqGrad)" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="text-[9px] text-slate-500 text-center mt-1">Drawdown</div>
            <div style={{ height: 60 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={equity}>
                  <XAxis dataKey="time" tick={false} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 7, fill: "#475569" }} axisLine={false} tickLine={false} width={40} />
                  <Area type="monotone" dataKey="drawdown" stroke="#ef4444" fill="#ef4444" fillOpacity={0.15} strokeWidth={1} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {tab === "Strategies" && (
          <div className="p-3 space-y-1.5">
            <div className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider mb-1">Strategy Performance + Option Greeks</div>
            {stratPerf.sort((a, b) => b.pnl - a.pnl).map((s, i) => (
              <div key={i} className="bg-[#333333] rounded-lg p-2.5 border border-[#3a3a3a]/50">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    {i === 0 && <Award className="w-3 h-3 text-amber-400" />}
                    <span className="text-[10px] font-bold text-white">{s.name}</span>
                  </div>
                  <span className={`text-[10px] font-black ${s.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {s.pnl >= 0 ? "+" : ""}₹{Math.abs(s.pnl).toLocaleString()}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[8px] mb-2">
                  <div><span className="text-slate-600">Win Rate</span><div className={`font-bold ${s.winRate >= 55 ? "text-green-400" : "text-amber-400"}`}>{s.winRate}%</div></div>
                  <div><span className="text-slate-600">Trades</span><div className="text-white font-semibold">{s.trades}</div></div>
                  <div><span className="text-slate-600">Sharpe</span><div className={`font-bold ${s.sharpe >= 1.5 ? "text-green-400" : s.sharpe >= 1 ? "text-cyan-400" : "text-amber-400"}`}>{s.sharpe}</div></div>
                </div>
                {/* Option Greeks */}
                <div className="border-t border-[#3a3a3a]/50 pt-1.5 mt-1">
                  <div className="text-[7px] text-slate-600 uppercase tracking-wider mb-1">Option Greeks</div>
                  <div className="grid grid-cols-6 gap-1">
                    <GreekPill label="Δ" value={s.greeks.delta} color={s.greeks.delta >= 0 ? "text-green-400" : "text-red-400"} />
                    <GreekPill label="Γ" value={s.greeks.gamma} color="text-cyan-400" />
                    <GreekPill label="θ" value={s.greeks.theta} color="text-red-400" />
                    <GreekPill label="ν" value={s.greeks.vega} color="text-purple-400" />
                    <GreekPill label="ρ" value={s.greeks.rho} color="text-blue-400" />
                    <div className="flex items-center gap-1">
                      <span className="text-[7px] text-slate-600">IV</span>
                      <span className={`text-[8px] font-bold ${s.greeks.iv > 30 ? "text-amber-400" : "text-green-400"}`}>{s.greeks.iv}%</span>
                    </div>
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
