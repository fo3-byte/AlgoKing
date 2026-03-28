"use client";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Clock, Wifi, Activity } from "lucide-react";
import type { ViewId } from "@/lib/data";
import Sidebar from "@/components/Sidebar";
import MarketTicker from "@/components/MarketTicker";
import NewsTicker from "@/components/NewsTicker";
import OverviewPanel from "@/components/OverviewPanel";
import ShippingPanel from "@/components/ShippingPanel";
import GeopoliticalPanel from "@/components/GeopoliticalPanel";
import WhaleTradesPanel from "@/components/WhaleTradesPanel";
import VolumeSpikePanel from "@/components/VolumeSpikePanel";
import AlgoPositionsPanel from "@/components/AlgoPositionsPanel";
import PaperTradingPanel from "@/components/PaperTradingPanel";
import ChatPanel from "@/components/ChatPanel";
import KiteTradingPanel from "@/components/KiteTradingPanel";
import WorldIndicesPanel from "@/components/WorldIndicesPanel";
import SocialIntelPanel from "@/components/SocialIntelPanel";
import NewsTerminalPanel from "@/components/NewsTerminalPanel";
import MacroDashboardPanel from "@/components/MacroDashboardPanel";
import WorkflowBuilderPanel from "@/components/WorkflowBuilderPanel";
import OptionsChainPanel from "@/components/OptionsChainPanel";
import BacktesterPanel from "@/components/BacktesterPanel";
import AlgoSignalsPanel from "@/components/AlgoSignalsPanel";
import EquityTrackerPanel from "@/components/EquityTrackerPanel";
import CorrelationMatrixPanel from "@/components/CorrelationMatrixPanel";
import TradeJournalPanel from "@/components/TradeJournalPanel";
import BlueprintPanel from "@/components/BlueprintPanel";
import EconomicCalendarPanel from "@/components/EconomicCalendarPanel";
import PayoffDiagramPanel from "@/components/PayoffDiagramPanel";
import SectorRotationPanel from "@/components/SectorRotationPanel";

const TVChart = dynamic(() => import("@/components/tv/TVChart"), { ssr: false });
const TVHeatmap = dynamic(() => import("@/components/tv/TVHeatmap"), { ssr: false });
const TVCalendar = dynamic(() => import("@/components/tv/TVCalendar"), { ssr: false });
const TVScreener = dynamic(() => import("@/components/tv/TVScreener"), { ssr: false });
const TVForexCross = dynamic(() => import("@/components/tv/TVForexCross"), { ssr: false });

const VIEW_LABELS: Record<ViewId, string> = {
  overview: "Overview",
  "vessel-tracker": "Vessels",
  geopolitical: "Geopolitical",
  "whale-trades": "Whales",
  "volume-monitor": "Volume",
  "algo-positions": "Algo",
  "price-charts": "Charts",
  "risk-manager": "Risk",
  backtester: "Paper Trade",
  kite: "Kite",
  "ai-chat": "AI Chat",
  heatmap: "Heatmap",
  calendar: "Calendar",
  screener: "Screener",
  forex: "Forex",
  "world-indices": "World Markets",
  "social-intel": "Social",
  "news-terminal": "News",
  macro: "Macro",
  workflows: "Workflows",
  "options-chain": "Options Chain",
  "strategy-backtest": "Backtester",
  "algo-signals": "Algo Signals",
  "equity-tracker": "Equity P&L Tracker",
  correlation: "Correlation Matrix",
  "econ-calendar": "Economic Calendar",
  "payoff-diagram": "Options Payoff",
  "sector-rotation": "Sector Rotation",
  "trade-journal": "Trade Journal",
  "algo-blueprint": "Algo Blueprint",
};

export default function Home() {
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");
  const [activeView, setActiveView] = useState<ViewId>("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("en-US", { hour12: false }));
      setDate(now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }));
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#1a1a1a]">
      {/* ── Lime accent bar ── */}
      <div className="h-1 bg-[#BFFF00] flex-shrink-0" />
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-5 py-2 border-b border-white/5 frosted flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#BFFF00] pulse-dot" />
            <span className="text-[11px] font-bold text-white tracking-wider">MOTHER ALGO</span>
          </div>
          {activeView !== "overview" && (
            <>
              <span className="text-[#666] text-[10px]">/</span>
              <span className="text-[11px] text-[#888] font-medium">{VIEW_LABELS[activeView]}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-5 text-[10px]">
          <span className="text-[#888] font-mono">{date}</span>
          <span className="text-white font-mono font-bold tracking-wider">{time}</span>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#BFFF00] pulse-dot" />
            <span className="text-[#BFFF00] text-[9px] font-semibold">LIVE</span>
          </div>
        </div>
      </header>

      {/* ── Market Ticker ── */}
      <MarketTicker />

      {/* ── Main Layout ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar activeView={activeView} onViewChange={setActiveView} />

        <main className="flex-1 min-w-0 min-h-0 overflow-hidden">
          {activeView === "overview" && <div className="h-full overflow-auto p-3"><OverviewPanel /></div>}

          {/* MARKETS */}
          {activeView === "price-charts" && <div className="h-full p-3"><TVChart symbol="NYMEX:CL1!" /></div>}
          {activeView === "world-indices" && <div className="h-full p-3"><WorldIndicesPanel /></div>}
          {activeView === "heatmap" && <div className="h-full card m-3 overflow-hidden"><TVHeatmap /></div>}
          {activeView === "options-chain" && <div className="h-full p-3"><OptionsChainPanel /></div>}
          {activeView === "screener" && <div className="h-full card m-3 overflow-hidden"><TVScreener /></div>}
          {activeView === "forex" && <div className="h-full card m-3 overflow-hidden p-3"><TVForexCross /></div>}
          {activeView === "calendar" && <div className="h-full card m-3 overflow-hidden p-3"><TVCalendar /></div>}

          {/* INTELLIGENCE */}
          {activeView === "news-terminal" && <div className="h-full p-3"><NewsTerminalPanel /></div>}
          {activeView === "social-intel" && <div className="h-full p-3"><SocialIntelPanel /></div>}
          {activeView === "macro" && <div className="h-full p-3"><MacroDashboardPanel /></div>}
          {activeView === "vessel-tracker" && <div className="h-full p-3"><ShippingPanel /></div>}
          {activeView === "geopolitical" && <div className="h-full p-3"><GeopoliticalPanel /></div>}
          {activeView === "whale-trades" && <div className="h-full p-3"><WhaleTradesPanel /></div>}
          {activeView === "volume-monitor" && <div className="h-full p-3"><VolumeSpikePanel /></div>}

          {/* TRADING */}
          {activeView === "algo-signals" && <div className="h-full p-3"><AlgoSignalsPanel /></div>}
          {activeView === "equity-tracker" && <div className="h-full p-3"><EquityTrackerPanel /></div>}
          {activeView === "correlation" && <div className="h-full p-3"><CorrelationMatrixPanel /></div>}
          {activeView === "econ-calendar" && <div className="h-full p-3"><EconomicCalendarPanel /></div>}
          {activeView === "payoff-diagram" && <div className="h-full p-3"><PayoffDiagramPanel /></div>}
          {activeView === "sector-rotation" && <div className="h-full p-3"><SectorRotationPanel /></div>}
          {activeView === "trade-journal" && <div className="h-full p-3"><TradeJournalPanel /></div>}
          {activeView === "algo-positions" && <div className="h-full p-3"><AlgoPositionsPanel /></div>}
          {activeView === "workflows" && <div className="h-full p-3"><WorkflowBuilderPanel /></div>}
          {activeView === "strategy-backtest" && <div className="h-full p-3"><BacktesterPanel /></div>}
          {activeView === "kite" && <div className="h-full p-3"><KiteTradingPanel /></div>}
          {activeView === "risk-manager" && <div className="h-full p-3"><GeopoliticalPanel /></div>}
          {activeView === "backtester" && <div className="h-full p-3"><PaperTradingPanel /></div>}
          {activeView === "algo-blueprint" && <div className="h-full overflow-auto p-3"><BlueprintPanel /></div>}
          {activeView === "ai-chat" && <div className="h-full p-3"><ChatPanel /></div>}
        </main>
      </div>

      {/* ── News Ticker (hidden on mobile) ── */}
      <div className="hidden md:block"><NewsTicker /></div>

      {/* ── Mobile bottom nav — fixed at bottom ── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-[#2a2a2a] bg-[#1e1e1e]/95 backdrop-blur-xl py-2 safe-bottom">
        {[
          { id: "overview" as ViewId, icon: "📊", label: "Home" },
          { id: "price-charts" as ViewId, icon: "📈", label: "Charts" },
          { id: "algo-signals" as ViewId, icon: "🎯", label: "Signals" },
          { id: "options-chain" as ViewId, icon: "⛓️", label: "OI" },
        ].map(item => (
          <button key={item.id} onClick={() => { setActiveView(item.id); setMobileMenuOpen(false); }}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition ${activeView === item.id ? "text-[#BFFF00]" : "text-[#666]"}`}>
            <span className="text-[16px]">{item.icon}</span>
            <span className="text-[8px] font-semibold">{item.label}</span>
          </button>
        ))}
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition ${mobileMenuOpen ? "text-[#BFFF00]" : "text-[#666]"}`}>
          <span className="text-[16px]">☰</span>
          <span className="text-[8px] font-semibold">More</span>
        </button>
      </div>

      {/* ── Mobile full menu ── */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-[#1a1a1a]/95 backdrop-blur-xl overflow-y-auto" onClick={() => setMobileMenuOpen(false)}>
          <div className="p-5 pt-12" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[18px] font-black text-white">All Sections</h2>
              <button onClick={() => setMobileMenuOpen(false)} className="text-[#888] text-[24px]">×</button>
            </div>
            {[
              { title: "MARKETS", items: [
                { id: "overview" as ViewId, icon: "📊", label: "Overview" },
                { id: "price-charts" as ViewId, icon: "📈", label: "Charts" },
                { id: "world-indices" as ViewId, icon: "🌍", label: "World Indices" },
                { id: "heatmap" as ViewId, icon: "🟩", label: "Heatmap" },
                { id: "options-chain" as ViewId, icon: "⛓️", label: "Options / OI" },
                { id: "screener" as ViewId, icon: "🔍", label: "Screener" },
                { id: "forex" as ViewId, icon: "💱", label: "Forex" },
                { id: "calendar" as ViewId, icon: "📅", label: "Calendar" },
              ]},
              { title: "INTELLIGENCE", items: [
                { id: "news-terminal" as ViewId, icon: "📰", label: "News Terminal" },
                { id: "social-intel" as ViewId, icon: "👥", label: "Social Intel" },
                { id: "macro" as ViewId, icon: "🏛️", label: "Macro / FII" },
                { id: "vessel-tracker" as ViewId, icon: "🚢", label: "Vessels" },
                { id: "geopolitical" as ViewId, icon: "🌐", label: "Geopolitical" },
                { id: "whale-trades" as ViewId, icon: "🐟", label: "Whale Trades" },
                { id: "volume-monitor" as ViewId, icon: "📊", label: "Volume" },
              ]},
              { title: "TRADING", items: [
                { id: "algo-signals" as ViewId, icon: "🎯", label: "Algo Signals" },
                { id: "equity-tracker" as ViewId, icon: "📈", label: "Equity P&L" },
                { id: "trade-journal" as ViewId, icon: "📓", label: "Journal" },
                { id: "correlation" as ViewId, icon: "🔗", label: "Correlations" },
                { id: "payoff-diagram" as ViewId, icon: "📐", label: "Payoff Diagram" },
                { id: "sector-rotation" as ViewId, icon: "🔄", label: "Sectors" },
                { id: "econ-calendar" as ViewId, icon: "📅", label: "Econ Calendar" },
                { id: "algo-positions" as ViewId, icon: "🤖", label: "Algo Positions" },
                { id: "workflows" as ViewId, icon: "⚙️", label: "Workflows" },
                { id: "strategy-backtest" as ViewId, icon: "🧪", label: "Backtester" },
                { id: "kite" as ViewId, icon: "⚡", label: "Kite Live" },
                { id: "backtester" as ViewId, icon: "🛡️", label: "Paper Trade" },
                { id: "ai-chat" as ViewId, icon: "💬", label: "AI Chat" },
              ]},
            ].map(section => (
              <div key={section.title} className="mb-5">
                <div className="text-[10px] text-[#555] font-bold uppercase tracking-widest mb-2">{section.title}</div>
                <div className="grid grid-cols-3 gap-2">
                  {section.items.map(item => (
                    <button key={item.id} onClick={() => { setActiveView(item.id); setMobileMenuOpen(false); }}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl transition ${activeView === item.id ? "bg-[#BFFF00]/10 border border-[#BFFF00]/20" : "bg-[#262626] border border-[#333]"}`}>
                      <span className="text-[20px]">{item.icon}</span>
                      <span className={`text-[10px] font-semibold ${activeView === item.id ? "text-[#BFFF00]" : "text-[#aaa]"}`}>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
