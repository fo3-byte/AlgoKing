"use client";
import { useState } from "react";
import { BarChart3, TrendingUp, TrendingDown, Calendar, AlertTriangle, Globe, DollarSign, Landmark } from "lucide-react";

const TABS = ["Macro Factors", "FII/DII Flows", "Key Events"] as const;

interface MacroFactor { label: string; value: string; trend: "positive" | "negative" | "neutral"; detail: string; icon: typeof Globe; }
interface FlowData { date: string; fii: number; dii: number; net: number; }
interface KeyEvent { date: string; event: string; impact: "high" | "medium" | "low"; region: string; }

const macroFactors: MacroFactor[] = [
  { label: "RBI Repo Rate", value: "6.50%", trend: "neutral", detail: "Paused since Feb 2023 — market pricing June cut", icon: Landmark },
  { label: "RBI Rate Cycle", value: "EASING", trend: "positive", detail: "MPC shifting dovish — accommodation likely in H2 2026", icon: TrendingDown },
  { label: "India CPI Inflation", value: "5.1%", trend: "negative", detail: "Above RBI comfort zone — food prices sticky", icon: BarChart3 },
  { label: "India GDP Growth", value: "6.8%", trend: "positive", detail: "FY26E consensus — capex + rural recovery driving", icon: TrendingUp },
  { label: "FII Flows (Mar 2026)", value: "NET SELLER", trend: "negative", detail: "₹18,200 Cr net sold in cash segment — 12th session", icon: DollarSign },
  { label: "DII Flows (Mar 2026)", value: "NET BUYER", trend: "positive", detail: "₹15,800 Cr net bought — MF SIP flows remain strong", icon: DollarSign },
  { label: "US Fed Funds Rate", value: "5.25%", trend: "neutral", detail: "CME FedWatch: 82% probability of June cut", icon: Landmark },
  { label: "US 10Y Yield", value: "4.18%", trend: "negative", detail: "Falling from 4.35% — risk assets benefiting", icon: BarChart3 },
  { label: "Crude Oil (Brent)", value: "$97.20", trend: "negative", detail: "Elevated on Houthi risks — bearish for India CAD", icon: Globe },
  { label: "USD/INR", value: "₹83.45", trend: "negative", detail: "Weakest in 3 weeks — FII outflows pressuring rupee", icon: DollarSign },
  { label: "US Tariff Policy", value: "RISK", trend: "negative", detail: "New tariffs on China goods — supply chain disruption", icon: AlertTriangle },
  { label: "China PMI", value: "49.1", trend: "negative", detail: "Manufacturing contraction deepening — demand risk", icon: Globe },
];

const fiiDiiFlows: FlowData[] = [
  { date: "27 Mar", fii: -4200, dii: 3800, net: -400 },
  { date: "26 Mar", fii: -3100, dii: 2900, net: -200 },
  { date: "25 Mar", fii: -2800, dii: 3200, net: 400 },
  { date: "24 Mar", fii: -1500, dii: 1800, net: 300 },
  { date: "21 Mar", fii: -3600, dii: 2100, net: -1500 },
  { date: "20 Mar", fii: -2200, dii: 2800, net: 600 },
  { date: "19 Mar", fii: -4100, dii: 3500, net: -600 },
  { date: "18 Mar", fii: -1800, dii: 2200, net: 400 },
  { date: "17 Mar", fii: -3200, dii: 2600, net: -600 },
  { date: "14 Mar", fii: -2700, dii: 3100, net: 400 },
];

const keyEvents: KeyEvent[] = [
  { date: "27 Mar", event: "US GDP Q4 Final Reading", impact: "high", region: "US" },
  { date: "28 Mar", event: "US PCE Price Index (Feb)", impact: "high", region: "US" },
  { date: "31 Mar", event: "India FY26 Year-End — NAV marking", impact: "high", region: "India" },
  { date: "01 Apr", event: "RBI MPC Meeting Begins", impact: "high", region: "India" },
  { date: "02 Apr", event: "US ISM Manufacturing PMI", impact: "medium", region: "US" },
  { date: "03 Apr", event: "OPEC+ Meeting — Production Decision", impact: "high", region: "Global" },
  { date: "04 Apr", event: "US Non-Farm Payrolls (Mar)", impact: "high", region: "US" },
  { date: "07 Apr", event: "RBI Rate Decision Announcement", impact: "high", region: "India" },
  { date: "10 Apr", event: "US CPI (Mar) Release", impact: "high", region: "US" },
  { date: "15 Apr", event: "India Q4 FY26 Results Season Begins", impact: "high", region: "India" },
  { date: "15 Apr", event: "China Q1 GDP Release", impact: "medium", region: "China" },
  { date: "30 Apr", event: "FOMC Rate Decision", impact: "high", region: "US" },
];

function fmtCr(n: number): string {
  return `₹${Math.abs(n).toLocaleString()} Cr`;
}

export default function MacroDashboardPanel() {
  const [tab, setTab] = useState<typeof TABS[number]>("Macro Factors");

  const totalFII = fiiDiiFlows.reduce((s, f) => s + f.fii, 0);
  const totalDII = fiiDiiFlows.reduce((s, f) => s + f.dii, 0);

  return (
    <div className="bg-[#262626] rounded-xl border border-[#3a3a3a] flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#3a3a3a] flex-shrink-0">
        <div className="flex items-center gap-2">
          <Landmark className="w-4 h-4 text-amber-400" />
          <h2 className="text-[11px] font-bold text-white">Macro Intelligence</h2>
        </div>
        <div className="flex items-center gap-2 text-[8px]">
          <span className="px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 font-bold">FII: {fmtCr(totalFII)}</span>
          <span className="px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 font-bold">DII: +{fmtCr(totalDII)}</span>
        </div>
      </div>

      <div className="flex items-center gap-0 px-3 border-b border-[#3a3a3a] flex-shrink-0">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`text-[9px] px-2.5 py-1.5 font-semibold border-b-2 transition ${tab === t ? "border-amber-400 text-amber-400" : "border-transparent text-slate-500 hover:text-slate-300"}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {tab === "Macro Factors" && (
          <div className="grid grid-cols-2 gap-2 p-3">
            {macroFactors.map((f, i) => {
              const Icon = f.icon;
              return (
                <div key={i} className="bg-[#333333] rounded-lg p-2.5 border border-[#3a3a3a]/50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] text-slate-500 font-semibold">{f.label}</span>
                    <Icon className={`w-3 h-3 ${f.trend === "positive" ? "text-green-400" : f.trend === "negative" ? "text-red-400" : "text-slate-500"}`} />
                  </div>
                  <div className={`text-sm font-black ${f.trend === "positive" ? "text-green-400" : f.trend === "negative" ? "text-red-400" : "text-white"}`}>
                    {f.value}
                  </div>
                  <div className="text-[8px] text-slate-500 mt-0.5">{f.detail}</div>
                </div>
              );
            })}
          </div>
        )}

        {tab === "FII/DII Flows" && (
          <div className="p-3">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-red-500/10 rounded-lg p-2.5 border border-red-500/20 text-center">
                <div className="text-[8px] text-slate-500">FII (10 days)</div>
                <div className="text-sm font-black text-red-400">-{fmtCr(Math.abs(totalFII))}</div>
              </div>
              <div className="bg-green-500/10 rounded-lg p-2.5 border border-green-500/20 text-center">
                <div className="text-[8px] text-slate-500">DII (10 days)</div>
                <div className="text-sm font-black text-green-400">+{fmtCr(totalDII)}</div>
              </div>
              <div className={`${totalFII + totalDII >= 0 ? "bg-green-500/10 border-green-500/20" : "bg-red-500/10 border-red-500/20"} rounded-lg p-2.5 border text-center`}>
                <div className="text-[8px] text-slate-500">Net Flow</div>
                <div className={`text-sm font-black ${totalFII + totalDII >= 0 ? "text-green-400" : "text-red-400"}`}>{totalFII + totalDII >= 0 ? "+" : ""}{fmtCr(totalFII + totalDII)}</div>
              </div>
            </div>

            {/* Daily flows */}
            <table className="w-full text-[10px]">
              <thead>
                <tr className="text-slate-600 border-b border-[#3a3a3a]">
                  <th className="text-left py-1.5 font-medium">Date</th>
                  <th className="text-right py-1.5 font-medium">FII</th>
                  <th className="text-right py-1.5 font-medium">DII</th>
                  <th className="text-right py-1.5 font-medium">Net</th>
                  <th className="py-1.5 font-medium text-center">Flow</th>
                </tr>
              </thead>
              <tbody>
                {fiiDiiFlows.map((f, i) => (
                  <tr key={i} className="border-b border-[#3a3a3a]/30">
                    <td className="py-1.5 text-slate-400">{f.date}</td>
                    <td className="py-1.5 text-right text-red-400 font-semibold">-{fmtCr(Math.abs(f.fii))}</td>
                    <td className="py-1.5 text-right text-green-400 font-semibold">+{fmtCr(f.dii)}</td>
                    <td className={`py-1.5 text-right font-bold ${f.net >= 0 ? "text-green-400" : "text-red-400"}`}>{f.net >= 0 ? "+" : ""}{fmtCr(f.net)}</td>
                    <td className="py-1.5 text-center">
                      <div className="flex items-center justify-center h-3">
                        <div className="flex h-full w-24 rounded overflow-hidden">
                          <div className="bg-red-500/60 h-full" style={{ width: `${Math.abs(f.fii) / (Math.abs(f.fii) + f.dii) * 100}%` }} />
                          <div className="bg-green-500/60 h-full flex-1" />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "Key Events" && (
          <div className="p-3 space-y-1.5">
            <div className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider mb-1">Upcoming Catalysts</div>
            {keyEvents.map((e, i) => (
              <div key={i} className="bg-[#333333] rounded-lg p-2.5 border border-[#3a3a3a]/50 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="text-center min-w-[45px]">
                    <div className="text-[10px] font-bold text-white">{e.date.split(" ")[0]}</div>
                    <div className="text-[7px] text-slate-600">{e.date.split(" ")[1]}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold text-white">{e.event}</div>
                    <div className="text-[8px] text-slate-500">{e.region}</div>
                  </div>
                </div>
                <span className={`text-[7px] px-1.5 py-0.5 rounded font-bold ${
                  e.impact === "high" ? "bg-red-500/15 text-red-400" :
                  e.impact === "medium" ? "bg-amber-500/15 text-amber-400" :
                  "bg-green-500/15 text-green-400"
                }`}>
                  {e.impact.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
