"use client";
import { useState, useEffect, useCallback } from "react";
import { Users, TrendingUp, TrendingDown, RefreshCw, Newspaper, BarChart3 } from "lucide-react";
import { useMarketData } from "@/hooks/useYahooData";

interface SocialPost {
  id: string; author: string; handle: string; platform: string;
  content: string; sentiment: "bullish" | "bearish" | "neutral";
  tickers: string[]; time: string; engagement: string;
  source: "news" | "analysis";
}

const FILTERS = ["ALL", "BULLISH", "BEARISH"] as const;

export default function SocialIntelPanel() {
  const [filter, setFilter] = useState<typeof FILTERS[number]>("ALL");
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const { tickers } = useMarketData();

  // Fetch real news and convert to social-style posts
  const fetchPosts = useCallback(async () => {
    try {
      const res = await fetch("/api/news", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const news = data.news || [];

      const converted: SocialPost[] = news.slice(0, 20).map((n: { headline: string; source: string; time: string; sentiment: string; affectedStocks: { ticker: string }[] }, i: number) => ({
        id: `n${i}`,
        author: n.source,
        handle: `@${n.source.replace(/\s+/g, "").toLowerCase()}`,
        platform: "news",
        content: n.headline,
        sentiment: n.sentiment as "bullish" | "bearish" | "neutral",
        tickers: (n.affectedStocks || []).slice(0, 4).map((s: { ticker: string }) => s.ticker),
        time: n.time,
        engagement: `${Math.floor(Math.random() * 50 + 10)} reactions`,
        source: "news" as const,
      }));

      // Add market-data-driven analysis posts
      const analysisItems: SocialPost[] = [];
      const nifty = tickers.find(t => t.displayName === "NIFTY" || t.symbol === "^NSEI");
      const bn = tickers.find(t => t.displayName === "BANKNIFTY" || t.symbol === "^NSEBANK");
      const vix = tickers.find(t => t.displayName === "VIX" || t.symbol === "^VIX");
      const crude = tickers.find(t => t.displayName === "WTI" || t.symbol === "CL=F");
      const gold = tickers.find(t => t.displayName === "GOLD" || t.symbol === "GC=F");

      if (nifty) {
        analysisItems.push({
          id: "a1", author: "AlgoMaster Analysis", handle: "@algomaster", platform: "analysis",
          content: `NIFTY at ${nifty.price?.toLocaleString()} (${nifty.changePct >= 0 ? "+" : ""}${nifty.changePct?.toFixed(2)}%). ${nifty.changePct > 0.5 ? "Bulls in control — buying on dips." : nifty.changePct < -0.5 ? "Bears dominating — selling on rallies." : "Consolidation mode — wait for direction."} Key levels: Support ${Math.round((nifty.price || 22800) / 100) * 100 - 200}, Resistance ${Math.round((nifty.price || 22800) / 100) * 100 + 200}.`,
          sentiment: nifty.changePct > 0.3 ? "bullish" : nifty.changePct < -0.3 ? "bearish" : "neutral",
          tickers: ["NIFTY"], time: new Date().toISOString(), engagement: "Live", source: "analysis",
        });
      }
      if (bn) {
        analysisItems.push({
          id: "a2", author: "AlgoMaster Analysis", handle: "@algomaster", platform: "analysis",
          content: `BANKNIFTY ${bn.changePct >= 0 ? "+" : ""}${bn.changePct?.toFixed(2)}% at ${bn.price?.toLocaleString()}. ${Math.abs(bn.changePct || 0) > Math.abs(nifty?.changePct || 0) ? "Banking sector leading the move." : "Banks underperforming broader market."} ${bn.changePct > 0 ? "HDFC, ICICI driving gains." : "PSU banks under pressure."}`,
          sentiment: bn.changePct > 0.3 ? "bullish" : bn.changePct < -0.3 ? "bearish" : "neutral",
          tickers: ["BANKNIFTY"], time: new Date().toISOString(), engagement: "Live", source: "analysis",
        });
      }
      if (vix) {
        analysisItems.push({
          id: "a3", author: "Vol Tracker", handle: "@voltracker", platform: "analysis",
          content: `VIX at ${vix.price?.toFixed(2)} (${vix.changePct >= 0 ? "+" : ""}${vix.changePct?.toFixed(2)}%). ${(vix.price || 15) > 18 ? "FEAR mode — hedging activity elevated. Option premiums expensive." : (vix.price || 15) > 14 ? "Moderate volatility — normal option pricing." : "Very low VIX — ideal for selling strategies (straddles/strangles)."}`,
          sentiment: (vix.price || 15) > 16 ? "bearish" : "bullish",
          tickers: ["VIX"], time: new Date().toISOString(), engagement: "Live", source: "analysis",
        });
      }
      if (crude) {
        analysisItems.push({
          id: "a4", author: "Commodity Desk", handle: "@commoditydesk", platform: "analysis",
          content: `Crude at $${crude.price?.toFixed(2)} (${crude.changePct >= 0 ? "+" : ""}${crude.changePct?.toFixed(2)}%). ${(crude.price || 85) > 95 ? "Above $95 — bearish for India (CAD widening, INR pressure, airline stocks weak)." : (crude.price || 85) > 80 ? "Stable range — manageable for Indian economy." : "Below $80 — bullish for India (lower import bill, fiscal relief)."}`,
          sentiment: (crude.price || 85) > 95 ? "bearish" : "bullish",
          tickers: ["CL", "RELIANCE", "ONGC"], time: new Date().toISOString(), engagement: "Live", source: "analysis",
        });
      }

      setPosts([...analysisItems, ...converted]);
    } catch { /* noop */ }
    setLoading(false);
  }, [tickers]);

  useEffect(() => {
    fetchPosts();
    const i = setInterval(fetchPosts, 30000);
    return () => clearInterval(i);
  }, [fetchPosts]);

  const filtered = filter === "ALL" ? posts : posts.filter(p => p.sentiment === filter.toLowerCase());
  const bullish = posts.filter(p => p.sentiment === "bullish").length;
  const bearish = posts.filter(p => p.sentiment === "bearish").length;
  const score = posts.length > 0 ? Math.round((bullish / posts.length) * 100) : 50;

  return (
    <div className="bg-[#262626] rounded-2xl border border-[#3a3a3a] flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#3a3a3a] flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center">
            <Users className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h2 className="text-[13px] font-bold text-white">Social Intelligence</h2>
            <p className="text-[9px] text-[#888]">Live news + market analysis</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="text-green-400 font-bold">🐂 {bullish}</span>
          <span className="text-red-400 font-bold">🐻 {bearish}</span>
          <span className={`px-2 py-0.5 rounded-full font-bold ${score > 55 ? "bg-green-500/10 text-green-400" : score < 45 ? "bg-red-500/10 text-red-400" : "bg-[#333333] text-[#888]"}`}>
            {score}% Bullish
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 pulse-dot" />
        </div>
      </div>

      <div className="flex items-center gap-2 px-5 py-2 border-b border-[#333333] flex-shrink-0">
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-[9px] px-3 py-1 rounded-full font-semibold transition ${filter === f ? "bg-purple-500/10 text-purple-400" : "text-[#888] hover:text-[#aaa]"}`}>
            {f}
          </button>
        ))}
        <span className="ml-auto text-[8px] text-[#777] flex items-center gap-1"><RefreshCw className="w-2.5 h-2.5" /> 30s</span>
      </div>

      <div className="flex-1 min-h-0 overflow-auto divide-y divide-[#191919]">
        {loading && posts.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-[11px] text-[#888]">Loading intelligence feed...</div>
        ) : filtered.map(post => (
          <div key={post.id} className="px-5 py-3 hover:bg-[#2a2a2a] transition">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${post.source === "analysis" ? "bg-[#BFFF00]/20" : "bg-[#333333]"}`}>
                  {post.source === "analysis" ? <BarChart3 className="w-3 h-3 text-[#BFFF00]" /> : <Newspaper className="w-3 h-3 text-[#888]" />}
                </div>
                <div>
                  <span className="text-[10px] font-bold text-white">{post.author}</span>
                  {post.source === "analysis" && <span className="text-[7px] text-[#BFFF00] ml-1">LIVE</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[8px] px-2 py-0.5 rounded-full font-bold ${
                  post.sentiment === "bullish" ? "bg-green-500/10 text-green-400" :
                  post.sentiment === "bearish" ? "bg-red-500/10 text-red-400" :
                  "bg-[#333333] text-[#666]"
                }`}>
                  {post.sentiment === "bullish" ? "🐂" : post.sentiment === "bearish" ? "🐻" : "•"} {post.sentiment.toUpperCase()}
                </span>
                <span className="text-[8px] text-[#777]">
                  {Math.floor((Date.now() - new Date(post.time).getTime()) / 60000)}m
                </span>
              </div>
            </div>

            <p className="text-[10px] text-[#ccc] leading-relaxed mb-2">{post.content}</p>

            {post.tickers.length > 0 && (
              <div className="flex gap-1">
                {post.tickers.map(t => (
                  <span key={t} className="text-[7px] px-1.5 py-0.5 rounded bg-[#2e2e2e] text-[#BFFF00] font-semibold">${t}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
