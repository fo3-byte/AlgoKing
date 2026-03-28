"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  BookOpen,
  Plus,
  Filter,
  Download,
  Trash2,
  TrendingUp,
  TrendingDown,
  Award,
  Target,
  Tag,
  X,
  ChevronDown,
  ChevronUp,
  Search,
  Calendar,
  BarChart3,
  Copy,
  Check,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────
interface Trade {
  id: string;
  date: string;
  symbol: string;
  side: "BUY" | "SELL";
  entryPrice: number;
  exitPrice: number;
  qty: number;
  strategy: string;
  notes: string;
  tags: string[];
}

const STORAGE_KEY = "algomaster-journal";
const CAPITAL = 500000; // ₹5L

const PRESET_TAGS = [
  "followed plan",
  "revenge trade",
  "early exit",
  "late entry",
  "oversize",
  "breakout",
  "scalp",
  "swing",
  "news-based",
  "gap play",
];

const PRESET_STRATEGIES = [
  "Fabervaale Triple-A",
  "ORB",
  "VWAP Bounce",
  "Breakout",
  "Mean Reversion",
  "Momentum",
  "Scalping",
  "Straddle",
  "Iron Condor",
  "Custom",
];

// ─── Helpers ──────────────────────────────────────────────────
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function calcPnl(trade: Trade): number {
  if (trade.side === "BUY") {
    return (trade.exitPrice - trade.entryPrice) * trade.qty;
  }
  return (trade.entryPrice - trade.exitPrice) * trade.qty;
}

function fmtINR(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : n > 0 ? "+" : "";
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2)}L`;
  if (abs >= 1e3) return `${sign}₹${(abs / 1e3).toFixed(1)}K`;
  return `${sign}₹${abs.toFixed(0)}`;
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function loadTrades(): Trade[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Trade[];
  } catch {
    /* noop */
  }
  return [];
}

function saveTrades(trades: Trade[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
}

// ─── Component ────────────────────────────────────────────────
export default function TradeJournalPanel() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expandedTradeId, setExpandedTradeId] = useState<string | null>(null);

  // Form state
  const [formDate, setFormDate] = useState(toISO(new Date()));
  const [formSymbol, setFormSymbol] = useState("");
  const [formSide, setFormSide] = useState<"BUY" | "SELL">("BUY");
  const [formEntry, setFormEntry] = useState("");
  const [formExit, setFormExit] = useState("");
  const [formQty, setFormQty] = useState("");
  const [formStrategy, setFormStrategy] = useState(PRESET_STRATEGIES[0]);
  const [formNotes, setFormNotes] = useState("");
  const [formTags, setFormTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");

  // Filter state
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterSymbol, setFilterSymbol] = useState("");
  const [filterStrategy, setFilterStrategy] = useState("");
  const [filterResult, setFilterResult] = useState<"all" | "win" | "loss">(
    "all"
  );

  // Load on mount
  useEffect(() => {
    setTrades(loadTrades());
  }, []);

  const persist = useCallback((next: Trade[]) => {
    setTrades(next);
    saveTrades(next);
  }, []);

  // Add trade
  const addTrade = () => {
    const entry = parseFloat(formEntry);
    const exit = parseFloat(formExit);
    const qty = parseInt(formQty);

    if (!formSymbol || isNaN(entry) || isNaN(exit) || isNaN(qty) || qty <= 0) {
      return;
    }

    const trade: Trade = {
      id: generateId(),
      date: formDate,
      symbol: formSymbol.toUpperCase(),
      side: formSide,
      entryPrice: entry,
      exitPrice: exit,
      qty,
      strategy: formStrategy,
      notes: formNotes,
      tags: formTags,
    };

    const next = [trade, ...trades];
    persist(next);
    resetForm();
  };

  const resetForm = () => {
    setFormSymbol("");
    setFormEntry("");
    setFormExit("");
    setFormQty("");
    setFormNotes("");
    setFormTags([]);
    setCustomTag("");
    setShowForm(false);
  };

  const deleteTrade = (id: string) => {
    persist(trades.filter((t) => t.id !== id));
  };

  const toggleTag = (tag: string) => {
    setFormTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const addCustomTag = () => {
    const trimmed = customTag.trim().toLowerCase();
    if (trimmed && !formTags.includes(trimmed)) {
      setFormTags([...formTags, trimmed]);
      setCustomTag("");
    }
  };

  // ─── Filtered trades ─────────────────────────────────────
  const filteredTrades = useMemo(() => {
    return trades.filter((t) => {
      if (filterDateFrom && t.date < filterDateFrom) return false;
      if (filterDateTo && t.date > filterDateTo) return false;
      if (
        filterSymbol &&
        !t.symbol.toLowerCase().includes(filterSymbol.toLowerCase())
      )
        return false;
      if (filterStrategy && t.strategy !== filterStrategy) return false;
      if (filterResult !== "all") {
        const pnl = calcPnl(t);
        if (filterResult === "win" && pnl <= 0) return false;
        if (filterResult === "loss" && pnl >= 0) return false;
      }
      return true;
    });
  }, [trades, filterDateFrom, filterDateTo, filterSymbol, filterStrategy, filterResult]);

  // ─── Stats ────────────────────────────────────────────────
  const stats = useMemo(() => {
    const pnls = filteredTrades.map(calcPnl);
    const totalPnl = pnls.reduce((s, p) => s + p, 0);
    const wins = pnls.filter((p) => p > 0).length;
    const losses = pnls.filter((p) => p < 0).length;
    const winRate =
      filteredTrades.length > 0
        ? (wins / filteredTrades.length) * 100
        : 0;

    const avgWin =
      wins > 0
        ? pnls.filter((p) => p > 0).reduce((s, p) => s + p, 0) / wins
        : 0;
    const avgLoss =
      losses > 0
        ? Math.abs(
            pnls.filter((p) => p < 0).reduce((s, p) => s + p, 0) / losses
          )
        : 0;
    const avgRR = avgLoss > 0 ? avgWin / avgLoss : 0;

    const bestTrade = pnls.length > 0 ? Math.max(...pnls) : 0;
    const worstTrade = pnls.length > 0 ? Math.min(...pnls) : 0;

    return {
      totalPnl,
      wins,
      losses,
      winRate,
      avgRR,
      bestTrade,
      worstTrade,
      tradeCount: filteredTrades.length,
    };
  }, [filteredTrades]);

  // ─── Export to CSV ────────────────────────────────────────
  const exportCSV = () => {
    const header =
      "Date,Symbol,Side,Entry,Exit,Qty,P&L,Strategy,Tags,Notes";
    const rows = filteredTrades.map((t) => {
      const pnl = calcPnl(t);
      return [
        t.date,
        t.symbol,
        t.side,
        t.entryPrice,
        t.exitPrice,
        t.qty,
        pnl.toFixed(2),
        t.strategy,
        `"${t.tags.join(", ")}"`,
        `"${t.notes.replace(/"/g, '""')}"`,
      ].join(",");
    });

    const csv = [header, ...rows].join("\n");
    navigator.clipboard.writeText(csv);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ─── Render ───────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className="w-5 h-5 text-[#BFFF00]" />
          <h2 className="text-lg font-bold text-white">Trade Journal</h2>
          <span className="text-xs text-gray-500">
            {trades.length} trade{trades.length !== 1 ? "s" : ""} logged
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#BFFF00] transition-colors px-2 py-1 rounded-lg border border-[#3a3a3a] hover:border-[#BFFF00]/30"
          >
            {copied ? (
              <Check className="w-3 h-3" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
            {copied ? "Copied!" : "CSV"}
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors ${
              showFilters
                ? "text-[#BFFF00] border-[#BFFF00]/30 bg-[#BFFF00]/5"
                : "text-gray-400 border-[#3a3a3a] hover:text-white"
            }`}
          >
            <Filter className="w-3 h-3" />
            Filter
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1 bg-[#BFFF00] text-black px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-[#a8e600] transition-colors"
          >
            <Plus className="w-3 h-3" />
            Log Trade
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          {
            label: "Total P&L",
            value: fmtINR(stats.totalPnl),
            sub: `${((stats.totalPnl / CAPITAL) * 100).toFixed(1)}% of ₹5L`,
            color: stats.totalPnl >= 0 ? "text-[#BFFF00]" : "text-red-400",
            icon: TrendingUp,
          },
          {
            label: "Win Rate",
            value: `${stats.winRate.toFixed(0)}%`,
            sub: `${stats.wins}W / ${stats.losses}L`,
            color:
              stats.winRate >= 50 ? "text-[#BFFF00]" : "text-red-400",
            icon: Target,
          },
          {
            label: "Avg R:R",
            value: stats.avgRR.toFixed(2),
            sub: "reward / risk",
            color:
              stats.avgRR >= 2 ? "text-[#BFFF00]" : stats.avgRR >= 1 ? "text-yellow-400" : "text-red-400",
            icon: Award,
          },
          {
            label: "Best / Worst",
            value: fmtINR(stats.bestTrade),
            sub: fmtINR(stats.worstTrade),
            color: "text-[#BFFF00]",
            icon: BarChart3,
          },
        ].map((s) => (
          <div key={s.label} className="glass-card p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <s.icon className={`w-3 h-3 ${s.color}`} />
              <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                {s.label}
              </span>
            </div>
            <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-gray-500">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="glass-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white">
              Filters
            </span>
            <button
              onClick={() => {
                setFilterDateFrom("");
                setFilterDateTo("");
                setFilterSymbol("");
                setFilterStrategy("");
                setFilterResult("all");
              }}
              className="text-[10px] text-gray-500 hover:text-[#BFFF00]"
            >
              Clear All
            </button>
          </div>
          <div className="grid grid-cols-5 gap-2">
            <input
              type="date"
              placeholder="From"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg px-2 py-1.5 text-xs text-white focus:border-[#BFFF00] focus:outline-none"
            />
            <input
              type="date"
              placeholder="To"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg px-2 py-1.5 text-xs text-white focus:border-[#BFFF00] focus:outline-none"
            />
            <input
              type="text"
              placeholder="Symbol"
              value={filterSymbol}
              onChange={(e) => setFilterSymbol(e.target.value)}
              className="bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg px-2 py-1.5 text-xs text-white placeholder:text-gray-600 focus:border-[#BFFF00] focus:outline-none"
            />
            <select
              value={filterStrategy}
              onChange={(e) => setFilterStrategy(e.target.value)}
              className="bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg px-2 py-1.5 text-xs text-white focus:border-[#BFFF00] focus:outline-none"
            >
              <option value="">All Strategies</option>
              {PRESET_STRATEGIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={filterResult}
              onChange={(e) =>
                setFilterResult(e.target.value as "all" | "win" | "loss")
              }
              className="bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg px-2 py-1.5 text-xs text-white focus:border-[#BFFF00] focus:outline-none"
            >
              <option value="all">All Results</option>
              <option value="win">Winners</option>
              <option value="loss">Losers</option>
            </select>
          </div>
        </div>
      )}

      {/* Add Trade Form */}
      {showForm && (
        <div className="glass-card p-4 space-y-3 border border-[#BFFF00]/20">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-white">
              Log New Trade
            </span>
            <button
              onClick={() => setShowForm(false)}
              className="text-gray-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Row 1: Date, Symbol, Side */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-gray-500 mb-1 block">
                Date
              </label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg px-3 py-2 text-sm text-white focus:border-[#BFFF00] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 mb-1 block">
                Symbol
              </label>
              <input
                type="text"
                placeholder="e.g. NIFTY 24000 CE"
                value={formSymbol}
                onChange={(e) => setFormSymbol(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-[#BFFF00] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 mb-1 block">
                Side
              </label>
              <div className="flex gap-1">
                <button
                  onClick={() => setFormSide("BUY")}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
                    formSide === "BUY"
                      ? "bg-[#BFFF00] text-black"
                      : "bg-[#1a1a1a] text-gray-400 border border-[#3a3a3a]"
                  }`}
                >
                  BUY
                </button>
                <button
                  onClick={() => setFormSide("SELL")}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
                    formSide === "SELL"
                      ? "bg-red-500 text-white"
                      : "bg-[#1a1a1a] text-gray-400 border border-[#3a3a3a]"
                  }`}
                >
                  SELL
                </button>
              </div>
            </div>
          </div>

          {/* Row 2: Entry, Exit, Qty */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-gray-500 mb-1 block">
                Entry Price
              </label>
              <input
                type="number"
                placeholder="0.00"
                value={formEntry}
                onChange={(e) => setFormEntry(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-[#BFFF00] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 mb-1 block">
                Exit Price
              </label>
              <input
                type="number"
                placeholder="0.00"
                value={formExit}
                onChange={(e) => setFormExit(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-[#BFFF00] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 mb-1 block">
                Quantity
              </label>
              <input
                type="number"
                placeholder="25"
                value={formQty}
                onChange={(e) => setFormQty(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-[#BFFF00] focus:outline-none"
              />
            </div>
          </div>

          {/* Row 3: Strategy */}
          <div>
            <label className="text-[10px] text-gray-500 mb-1 block">
              Strategy
            </label>
            <select
              value={formStrategy}
              onChange={(e) => setFormStrategy(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg px-3 py-2 text-sm text-white focus:border-[#BFFF00] focus:outline-none"
            >
              {PRESET_STRATEGIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Row 4: Notes */}
          <div>
            <label className="text-[10px] text-gray-500 mb-1 block">
              Notes
            </label>
            <textarea
              placeholder="What happened? What did you learn?"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              rows={2}
              className="w-full bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-[#BFFF00] focus:outline-none resize-none"
            />
          </div>

          {/* Row 5: Tags */}
          <div>
            <label className="text-[10px] text-gray-500 mb-1 block">
              Tags
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {PRESET_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                    formTags.includes(tag)
                      ? "bg-[#BFFF00]/20 text-[#BFFF00] border-[#BFFF00]/30"
                      : "text-gray-500 border-[#3a3a3a] hover:border-gray-500"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add custom tag..."
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCustomTag()}
                className="flex-1 bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-gray-600 focus:border-[#BFFF00] focus:outline-none"
              />
              <button
                onClick={addCustomTag}
                className="text-xs text-gray-400 hover:text-[#BFFF00] px-2 border border-[#3a3a3a] rounded-lg"
              >
                <Tag className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Preview P&L */}
          {formEntry && formExit && formQty && (
            <div className="bg-[#1a1a1a] rounded-lg p-3 flex items-center justify-between border border-[#3a3a3a]">
              <span className="text-xs text-gray-400">
                Estimated P&amp;L
              </span>
              {(() => {
                const pnl =
                  formSide === "BUY"
                    ? (parseFloat(formExit) - parseFloat(formEntry)) *
                      parseInt(formQty)
                    : (parseFloat(formEntry) - parseFloat(formExit)) *
                      parseInt(formQty);
                const pctOfCapital = (pnl / CAPITAL) * 100;
                return (
                  <div className="text-right">
                    <span
                      className={`text-sm font-bold ${
                        pnl >= 0 ? "text-[#BFFF00]" : "text-red-400"
                      }`}
                    >
                      {fmtINR(pnl)}
                    </span>
                    <span className="text-[10px] text-gray-500 ml-2">
                      ({pctOfCapital.toFixed(2)}% of ₹5L)
                    </span>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={addTrade}
            disabled={
              !formSymbol || !formEntry || !formExit || !formQty
            }
            className="w-full bg-[#BFFF00] text-black py-2.5 rounded-lg text-sm font-bold hover:bg-[#a8e600] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Save Trade
          </button>
        </div>
      )}

      {/* Trades Table */}
      <div className="glass-card overflow-hidden">
        {filteredTrades.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <BookOpen className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">
              {trades.length === 0
                ? "No trades logged yet. Click \"Log Trade\" to add your first entry."
                : "No trades match your filters."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-[#3a3a3a] bg-[#1a1a1a]">
                  <th className="text-left py-2.5 px-3">Date</th>
                  <th className="text-left py-2.5 px-3">Symbol</th>
                  <th className="text-center py-2.5 px-3">Side</th>
                  <th className="text-right py-2.5 px-3">Entry</th>
                  <th className="text-right py-2.5 px-3">Exit</th>
                  <th className="text-right py-2.5 px-3">Qty</th>
                  <th className="text-right py-2.5 px-3">P&amp;L</th>
                  <th className="text-right py-2.5 px-3">% of ₹5L</th>
                  <th className="text-left py-2.5 px-3">Strategy</th>
                  <th className="py-2.5 px-2 w-8" />
                </tr>
              </thead>
              <tbody>
                {filteredTrades.map((trade) => {
                  const pnl = calcPnl(trade);
                  const pctOfCapital = (pnl / CAPITAL) * 100;
                  const isExpanded = expandedTradeId === trade.id;

                  return (
                    <tr key={trade.id} className="group">
                      <td colSpan={10} className="p-0">
                        <div>
                          {/* Main row */}
                          <div
                            className="flex items-center border-b border-[#2a2a2a] hover:bg-[#2a2a2a] transition-colors cursor-pointer"
                            onClick={() =>
                              setExpandedTradeId(
                                isExpanded ? null : trade.id
                              )
                            }
                          >
                            <div className="flex-[1] py-2 px-3 text-gray-400">
                              {trade.date}
                            </div>
                            <div className="flex-[1] py-2 px-3 text-white font-medium">
                              {trade.symbol}
                            </div>
                            <div className="flex-[0.5] py-2 px-3 text-center">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                  trade.side === "BUY"
                                    ? "bg-[#BFFF00]/10 text-[#BFFF00]"
                                    : "bg-red-500/10 text-red-400"
                                }`}
                              >
                                {trade.side}
                              </span>
                            </div>
                            <div className="flex-[0.7] py-2 px-3 text-right text-gray-300 font-mono">
                              {trade.entryPrice.toFixed(2)}
                            </div>
                            <div className="flex-[0.7] py-2 px-3 text-right text-gray-300 font-mono">
                              {trade.exitPrice.toFixed(2)}
                            </div>
                            <div className="flex-[0.5] py-2 px-3 text-right text-gray-400">
                              {trade.qty}
                            </div>
                            <div
                              className={`flex-[0.8] py-2 px-3 text-right font-bold ${
                                pnl >= 0
                                  ? "text-[#BFFF00]"
                                  : "text-red-400"
                              }`}
                            >
                              {fmtINR(pnl)}
                            </div>
                            <div
                              className={`flex-[0.7] py-2 px-3 text-right ${
                                pctOfCapital >= 0
                                  ? "text-[#BFFF00]"
                                  : "text-red-400"
                              }`}
                            >
                              {pctOfCapital >= 0 ? "+" : ""}
                              {pctOfCapital.toFixed(2)}%
                            </div>
                            <div className="flex-[1] py-2 px-3 text-gray-500">
                              {trade.strategy}
                            </div>
                            <div className="w-8 py-2 px-2 flex items-center gap-1">
                              {isExpanded ? (
                                <ChevronUp className="w-3 h-3 text-gray-500" />
                              ) : (
                                <ChevronDown className="w-3 h-3 text-gray-500" />
                              )}
                            </div>
                          </div>

                          {/* Expanded detail */}
                          {isExpanded && (
                            <div className="px-3 py-3 bg-[#1a1a1a] border-b border-[#2a2a2a] space-y-2">
                              {trade.tags.length > 0 && (
                                <div className="flex items-center gap-1.5">
                                  <Tag className="w-3 h-3 text-gray-500" />
                                  {trade.tags.map((tag) => (
                                    <span
                                      key={tag}
                                      className="text-[10px] px-2 py-0.5 rounded-full bg-[#BFFF00]/10 text-[#BFFF00] border border-[#BFFF00]/20"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {trade.notes && (
                                <p className="text-xs text-gray-400">
                                  {trade.notes}
                                </p>
                              )}
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-gray-600">
                                  ID: {trade.id}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteTrade(trade.id);
                                  }}
                                  className="flex items-center gap-1 text-[10px] text-gray-600 hover:text-red-400 transition-colors"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  Delete
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
