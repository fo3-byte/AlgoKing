"use client";
import { useState, useEffect } from "react";
import { Newspaper, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface NewsItem {
  id: string; headline: string; source: string; time: string;
  sentiment: "bullish" | "bearish" | "neutral";
  affectedStocks: { ticker: string; impact: string }[];
}

export default function NewsTicker() {
  const [news, setNews] = useState<NewsItem[]>([]);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const res = await fetch("/api/news", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.news?.length > 0) setNews(data.news);
        }
      } catch { /* fallback stays */ }
    };
    fetchNews();
    const i = setInterval(fetchNews, 30000); // Refresh every 30s
    return () => clearInterval(i);
  }, []);

  const sentimentIcon = (s: string) => {
    if (s === "bullish") return <TrendingUp className="w-2.5 h-2.5 text-green-400 flex-shrink-0" />;
    if (s === "bearish") return <TrendingDown className="w-2.5 h-2.5 text-red-400 flex-shrink-0" />;
    return <Minus className="w-2.5 h-2.5 text-slate-500 flex-shrink-0" />;
  };

  const impactColor = (impact: string) => {
    if (impact === "positive") return "bg-green-500/20 text-green-400";
    if (impact === "negative") return "bg-red-500/20 text-red-400";
    return "bg-slate-500/20 text-slate-400";
  };

  if (news.length === 0) return null;

  // Duplicate for seamless scroll
  const doubled = [...news, ...news];

  return (
    <div className="border-t border-[#333333] bg-[#1e1e1e] flex items-center overflow-hidden h-8 flex-shrink-0">
      <div className="flex items-center gap-1.5 px-2.5 border-r border-[#333333] h-full flex-shrink-0">
        <Newspaper className="w-3 h-3 text-red-400" />
        <span className="text-[8px] font-bold text-red-400 uppercase">LIVE</span>
      </div>
      <div className="flex-1 overflow-hidden relative">
        <div className="flex items-center gap-0 animate-scroll-news whitespace-nowrap">
          {doubled.map((n, i) => (
            <div key={`${n.id}-${i}`} className="flex items-center gap-1.5 px-4 flex-shrink-0">
              {sentimentIcon(n.sentiment)}
              <span className="text-[9px] text-slate-300">{n.headline}</span>
              <span className="text-[7px] text-slate-600">{n.source}</span>
              {n.affectedStocks?.slice(0, 3).map((s, j) => (
                <span key={j} className={`text-[7px] px-1 py-0 rounded font-semibold ${impactColor(s.impact)}`}>
                  {s.impact === "positive" ? "▲" : s.impact === "negative" ? "▼" : "●"} {s.ticker}
                </span>
              ))}
              <span className="text-slate-700 mx-2">•</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
