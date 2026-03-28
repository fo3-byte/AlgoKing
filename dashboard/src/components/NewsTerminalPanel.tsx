"use client";
import { useState, useEffect, useCallback } from "react";
import { Newspaper, TrendingUp, TrendingDown, Minus, Filter, ExternalLink, Clock, Zap } from "lucide-react";

interface NewsArticle {
  id: string; headline: string; source: string; time: string; url: string;
  sentiment: "bullish" | "bearish" | "neutral";
  affectedStocks: { ticker: string; impact: string; reason: string }[];
  category: string;
}

const CATEGORIES = ["ALL", "ECONOMY", "STOCKS", "COMMODITIES", "CRYPTO", "GEOPOLITICAL", "INDIAN MARKETS"] as const;

export default function NewsTerminalPanel() {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [category, setCategory] = useState<typeof CATEGORIES[number]>("ALL");
  const [loading, setLoading] = useState(true);

  const fetchNews = useCallback(async () => {
    try {
      const res = await fetch("/api/news", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.news?.length > 0) setNews(data.news);
      }
    } catch { /* noop */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchNews();
    const i = setInterval(fetchNews, 10000);
    return () => clearInterval(i);
  }, [fetchNews]);

  const catMap: Record<string, string[]> = {
    ECONOMY: ["Monetary Policy", "Global Macro", "Policy"],
    STOCKS: ["Markets", "Indian Markets"],
    COMMODITIES: ["Energy", "Commodities"],
    CRYPTO: ["Crypto"],
    GEOPOLITICAL: ["Geopolitical"],
    "INDIAN MARKETS": ["Indian Markets"],
  };

  const filtered = category === "ALL" ? news : news.filter(n => catMap[category]?.some(c => n.category?.includes(c)));
  const breakingNews = news.slice(0, 1);

  return (
    <div className="bg-[#262626] rounded-xl border border-[#3a3a3a] flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#3a3a3a] flex-shrink-0">
        <div className="flex items-center gap-2">
          <Newspaper className="w-4 h-4 text-red-400" />
          <h2 className="text-[11px] font-bold text-white">LIVE NEWS TERMINAL</h2>
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 pulse-dot" />
        </div>
        <div className="flex items-center gap-2 text-[8px] text-slate-500">
          <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" /> 10s refresh</span>
          <span>{news.length} stories</span>
        </div>
      </div>

      {/* Breaking news banner */}
      {breakingNews.length > 0 && (
        <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[8px] font-bold text-red-400 bg-red-500/20 px-1.5 py-0.5 rounded animate-pulse">BREAKING</span>
            <span className="text-[10px] font-bold text-white">{breakingNews[0].headline}</span>
            <span className="text-[7px] text-slate-500 ml-auto flex-shrink-0">{breakingNews[0].source}</span>
          </div>
        </div>
      )}

      {/* Category filter */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-[#3a3a3a] flex-shrink-0 overflow-x-auto scrollbar-none">
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setCategory(c)}
            className={`text-[8px] px-2 py-0.5 rounded font-semibold transition whitespace-nowrap ${category === c ? "bg-red-500/20 text-red-400" : "text-slate-500 hover:text-slate-300"}`}>
            {c}
          </button>
        ))}
      </div>

      {/* News feed */}
      <div className="flex-1 min-h-0 overflow-auto divide-y divide-[#222222]/40">
        {loading && news.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-[10px] text-slate-600">Loading news feed...</div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-[10px] text-slate-600">No stories in this category</div>
        ) : (
          filtered.map((article, i) => (
            <div key={article.id || i} className="px-4 py-3 hover:bg-[#2e2e2e]/40 transition group">
              {/* Time + source + category */}
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[7px] text-slate-600">
                  {new Date(article.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="text-[8px] font-semibold text-cyan-400">{article.source}</span>
                {article.category && <span className="text-[7px] px-1 py-0 rounded bg-[#333333] text-slate-500">{article.category}</span>}
                {/* Sentiment badge */}
                <span className={`text-[7px] px-1 py-0 rounded font-bold ml-auto ${
                  article.sentiment === "bullish" ? "bg-green-500/15 text-green-400" :
                  article.sentiment === "bearish" ? "bg-red-500/15 text-red-400" :
                  "bg-slate-500/15 text-slate-400"
                }`}>
                  {article.sentiment === "bullish" ? "▲" : article.sentiment === "bearish" ? "▼" : "●"} {article.sentiment.toUpperCase()}
                </span>
              </div>

              {/* Headline */}
              <h3 className="text-[11px] font-bold text-white leading-snug mb-1.5 group-hover:text-blue-300 transition">
                {article.headline}
              </h3>

              {/* Affected stocks with impact */}
              {article.affectedStocks && article.affectedStocks.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {article.affectedStocks.slice(0, 5).map((s, j) => (
                    <span key={j} className={`text-[7px] px-1.5 py-0.5 rounded font-semibold flex items-center gap-0.5 ${
                      s.impact === "positive" ? "bg-green-500/15 text-green-400" :
                      s.impact === "negative" ? "bg-red-500/15 text-red-400" :
                      "bg-slate-500/15 text-slate-400"
                    }`}>
                      {s.impact === "positive" ? "▲" : s.impact === "negative" ? "▼" : "●"} {s.ticker}
                      {s.reason && <span className="text-slate-600 ml-0.5">— {s.reason}</span>}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
