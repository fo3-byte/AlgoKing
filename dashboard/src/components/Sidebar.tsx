"use client";
import { Activity, Ship, Globe, Fish, BarChart3, Bot, Settings, Bell, ChevronLeft, ChevronRight, LineChart, Shield, MessageCircle, LayoutGrid, Calendar, Search, DollarSign, Zap, Users, Newspaper, Landmark, TrendingUp, Workflow, Layers, FlaskConical, Crosshair, PieChart, GitCompare, BookOpen, Target } from "lucide-react";
import { useState } from "react";
import type { ViewId } from "@/lib/data";

interface Props { activeView: ViewId; onViewChange: (view: ViewId) => void; }

const navSections: { title?: string; items: { icon: typeof Activity; label: string; id: ViewId }[] }[] = [
  { items: [{ icon: Activity, label: "Overview", id: "overview" }] },
  {
    title: "MARKETS",
    items: [
      { icon: LineChart, label: "Charts", id: "price-charts" },
      { icon: TrendingUp, label: "World Indices", id: "world-indices" },
      { icon: LayoutGrid, label: "Heatmap", id: "heatmap" },
      { icon: Layers, label: "Options / OI", id: "options-chain" },
      { icon: Target, label: "Payoff Diagram", id: "payoff-diagram" },
      { icon: PieChart, label: "Sectors", id: "sector-rotation" },
      { icon: Search, label: "Screener", id: "screener" },
      { icon: DollarSign, label: "Forex", id: "forex" },
      { icon: Calendar, label: "Calendar", id: "calendar" },
    ],
  },
  {
    title: "INTELLIGENCE",
    items: [
      { icon: Newspaper, label: "News", id: "news-terminal" },
      { icon: Users, label: "Social", id: "social-intel" },
      { icon: Landmark, label: "Macro", id: "macro" },
      { icon: Ship, label: "Vessels", id: "vessel-tracker" },
      { icon: Globe, label: "Geopolitical", id: "geopolitical" },
      { icon: Fish, label: "Whales", id: "whale-trades" },
      { icon: BarChart3, label: "Volume", id: "volume-monitor" },
    ],
  },
  {
    title: "TRADING",
    items: [
      { icon: Crosshair, label: "Signals", id: "algo-signals" },
      { icon: LineChart, label: "Equity P&L", id: "equity-tracker" },
      { icon: GitCompare, label: "Correlations", id: "correlation" },
      { icon: BookOpen, label: "Journal", id: "trade-journal" },
      { icon: Bot, label: "Algo", id: "algo-positions" },
      { icon: Workflow, label: "Workflows", id: "workflows" },
      { icon: FlaskConical, label: "Backtest", id: "strategy-backtest" },
      { icon: BookOpen, label: "Blueprint", id: "algo-blueprint" },
      { icon: Zap, label: "Kite", id: "kite" },
      { icon: Shield, label: "Paper", id: "backtester" },
      { icon: MessageCircle, label: "AI Chat", id: "ai-chat" },
    ],
  },
];

export default function Sidebar({ activeView, onViewChange }: Props) {
  const [collapsed, setCollapsed] = useState(true);
  return (
    <aside style={{ width: collapsed ? 52 : 180 }} className="flex-shrink-0 flex flex-col border-r border-white/5 frosted transition-[width] duration-200 overflow-hidden">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3 py-3 border-b border-[#333333]">
        <div className="w-7 h-7 rounded-xl bg-[#BFFF00] flex items-center justify-center flex-shrink-0">
          <Activity className="w-4 h-4 text-black" />
        </div>
        {!collapsed && <span className="text-[11px] font-black text-white tracking-wide whitespace-nowrap">MOTHER ALGO</span>}
      </div>

      <nav className="flex-1 py-2 overflow-y-auto scrollbar-none">
        {navSections.map((section, si) => (
          <div key={si}>
            {section.title && !collapsed && (
              <div className="px-4 pt-4 pb-1.5 text-[8px] text-[#777] font-bold uppercase tracking-[0.15em]">{section.title}</div>
            )}
            {section.title && collapsed && <div className="border-t border-[#333333] mx-3 my-2" />}
            <div className="space-y-0.5 px-2">
              {section.items.map(item => {
                const Icon = item.icon;
                const isActive = item.id === activeView;
                return (
                  <button key={item.id} onClick={() => onViewChange(item.id)} title={collapsed ? item.label : undefined}
                    className={`w-full flex items-center gap-2.5 text-[10px] font-medium transition-all duration-150 relative
                      ${collapsed ? "px-0 py-2 justify-center rounded-xl" : "px-3 py-2 rounded-xl"}
                      ${isActive
                        ? "bg-[#BFFF00]/10 text-[#BFFF00]"
                        : "text-[#888] hover:text-[#aaa] hover:bg-[#2a2a2a]"
                      }`}>
                    <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-[#BFFF00]" : ""}`} />
                    {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
                    {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-r-full bg-[#BFFF00]" />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="border-t border-[#333333] px-2 py-2 space-y-0.5">
        <button title={collapsed ? "Settings" : undefined} className={`w-full flex items-center gap-2.5 rounded-xl text-[10px] text-[#777] hover:text-[#888] hover:bg-[#2a2a2a] transition ${collapsed ? "px-0 py-2 justify-center" : "px-3 py-2"}`}>
          <Settings className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Settings</span>}
        </button>
        <button onClick={() => setCollapsed(!collapsed)} className="w-full flex items-center justify-center py-1.5 text-[#666] hover:text-[#888] hover:bg-[#2a2a2a] rounded-xl transition">
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </div>
    </aside>
  );
}
