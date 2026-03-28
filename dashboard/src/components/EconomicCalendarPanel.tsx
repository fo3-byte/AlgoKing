"use client";
import { useState, useMemo, useEffect } from "react";
import {
  Calendar,
  Clock,
  Filter,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Globe,
  Timer,
  Flame,
  X,
} from "lucide-react";

/* ── types ── */
type Impact = "HIGH" | "MEDIUM" | "LOW";
type Country = "US" | "India" | "Global";
type TimeFilter = "this_week" | "next_week" | "this_month";

interface EcoEvent {
  id: string;
  date: string;        // YYYY-MM-DD
  time: string;        // HH:MM IST or "All Day"
  name: string;
  country: Country;
  flag: string;
  impact: Impact;
  previous: string;
  forecast: string;
  actual: string;       // "" when not yet released
  historicalReaction: string;
}

/* ── mock data Mar-Jun 2026 ── */
const EVENTS: EcoEvent[] = [
  { id: "1",  date: "2026-03-28", time: "18:00", name: "US PCE Price Index (Feb)",                country: "US",     flag: "\uD83C\uDDFA\uD83C\uDDF8", impact: "HIGH",   previous: "2.6%",   forecast: "2.5%",   actual: "2.5%", historicalReaction: "Last PCE miss: S&P 500 dropped 0.9%, US 10Y yield rose 6bps" },
  { id: "2",  date: "2026-03-31", time: "All Day", name: "India FY26 Year-End NAV Marking",       country: "India",  flag: "\uD83C\uDDEE\uD83C\uDDF3", impact: "HIGH",   previous: "--",     forecast: "--",     actual: "",    historicalReaction: "FY25 year-end: NIFTY saw heavy selling last 2 hours, recovered next day +0.8%" },
  { id: "3",  date: "2026-04-01", time: "10:00", name: "RBI MPC Meeting Begins",                  country: "India",  flag: "\uD83C\uDDEE\uD83C\uDDF3", impact: "HIGH",   previous: "6.50%",  forecast: "6.25%",  actual: "",    historicalReaction: "Last surprise cut: NIFTY Bank rallied 2.1%, INR weakened 0.3%" },
  { id: "4",  date: "2026-04-02", time: "20:00", name: "US ISM Manufacturing PMI (Mar)",          country: "US",     flag: "\uD83C\uDDFA\uD83C\uDDF8", impact: "MEDIUM", previous: "50.3",   forecast: "50.8",   actual: "",    historicalReaction: "Last PMI miss (sub-50): S&P dropped 0.6%, VIX spiked 5%" },
  { id: "5",  date: "2026-04-03", time: "15:30", name: "OPEC+ Production Decision Meeting",       country: "Global", flag: "\uD83C\uDF0D",             impact: "HIGH",   previous: "+0.4M bpd", forecast: "No change", actual: "", historicalReaction: "Last surprise cut: Brent surged 6%, energy stocks rallied 3.2%" },
  { id: "6",  date: "2026-04-04", time: "18:00", name: "US Non-Farm Payrolls (Mar)",              country: "US",     flag: "\uD83C\uDDFA\uD83C\uDDF8", impact: "HIGH",   previous: "275K",   forecast: "210K",   actual: "",    historicalReaction: "Last NFP miss: S&P dropped 1.2%, VIX spiked 8%, DXY fell 0.5%" },
  { id: "7",  date: "2026-04-07", time: "10:00", name: "RBI Rate Decision Announcement",          country: "India",  flag: "\uD83C\uDDEE\uD83C\uDDF3", impact: "HIGH",   previous: "6.50%",  forecast: "6.25%",  actual: "",    historicalReaction: "Last 25bps cut: Bank NIFTY +1.8%, NIFTY +0.9%, bond yields fell 12bps" },
  { id: "8",  date: "2026-04-10", time: "18:00", name: "US CPI (Mar) Release",                    country: "US",     flag: "\uD83C\uDDFA\uD83C\uDDF8", impact: "HIGH",   previous: "3.1%",   forecast: "2.9%",   actual: "",    historicalReaction: "Last CPI beat: S&P fell 1.5%, Nasdaq -2.1%, gold rallied 1.8%" },
  { id: "9",  date: "2026-04-12", time: "14:00", name: "India IIP (Feb) Release",                 country: "India",  flag: "\uD83C\uDDEE\uD83C\uDDF3", impact: "MEDIUM", previous: "5.8%",   forecast: "6.1%",   actual: "",    historicalReaction: "Last IIP beat: NIFTY infra stocks rose 1.4% same day" },
  { id: "10", date: "2026-04-14", time: "14:00", name: "India WPI Inflation (Mar)",               country: "India",  flag: "\uD83C\uDDEE\uD83C\uDDF3", impact: "MEDIUM", previous: "1.9%",   forecast: "2.2%",   actual: "",    historicalReaction: "Last WPI spike: metal stocks fell 0.8%, FMCG gained 0.5%" },
  { id: "11", date: "2026-04-15", time: "All Day", name: "India Q4 FY26 Results Season Begins",   country: "India",  flag: "\uD83C\uDDEE\uD83C\uDDF3", impact: "HIGH",   previous: "--",     forecast: "--",     actual: "",    historicalReaction: "Q3 season: IT stocks fell 4% first week on weak guidance" },
  { id: "12", date: "2026-04-15", time: "07:30", name: "China Q1 2026 GDP Release",               country: "Global", flag: "\uD83C\uDF0D",             impact: "MEDIUM", previous: "5.2%",   forecast: "4.8%",   actual: "",    historicalReaction: "Last GDP miss: Hang Seng fell 2.1%, metals dropped 1.5%" },
  { id: "13", date: "2026-04-29", time: "18:00", name: "US GDP Q1 Advance Estimate",              country: "US",     flag: "\uD83C\uDDFA\uD83C\uDDF8", impact: "HIGH",   previous: "3.2%",   forecast: "2.4%",   actual: "",    historicalReaction: "Last GDP miss: S&P dropped 0.8%, bond yields fell 8bps" },
  { id: "14", date: "2026-04-30", time: "23:30", name: "FOMC Rate Decision",                      country: "US",     flag: "\uD83C\uDDFA\uD83C\uDDF8", impact: "HIGH",   previous: "5.25%",  forecast: "5.00%",  actual: "",    historicalReaction: "Last surprise hold: S&P fell 1.8%, VIX spiked 12%, DXY surged 0.8%" },
  { id: "15", date: "2026-05-02", time: "18:00", name: "US Non-Farm Payrolls (Apr)",              country: "US",     flag: "\uD83C\uDDFA\uD83C\uDDF8", impact: "HIGH",   previous: "210K",   forecast: "195K",   actual: "",    historicalReaction: "Last NFP beat: S&P rallied 0.7%, VIX fell 6%" },
  { id: "16", date: "2026-05-13", time: "18:00", name: "US CPI (Apr) Release",                    country: "US",     flag: "\uD83C\uDDFA\uD83C\uDDF8", impact: "HIGH",   previous: "2.9%",   forecast: "2.7%",   actual: "",    historicalReaction: "Last CPI in-line: S&P flat, bonds rallied slightly" },
  { id: "17", date: "2026-05-20", time: "10:00", name: "India WPI Inflation (Apr)",               country: "India",  flag: "\uD83C\uDDEE\uD83C\uDDF3", impact: "MEDIUM", previous: "2.2%",   forecast: "2.0%",   actual: "",    historicalReaction: "Last WPI drop: positive for rate cut expectations, banks rallied 0.6%" },
  { id: "18", date: "2026-05-28", time: "19:30", name: "US GDP Q1 Second Estimate",               country: "US",     flag: "\uD83C\uDDFA\uD83C\uDDF8", impact: "MEDIUM", previous: "2.4%",   forecast: "2.3%",   actual: "",    historicalReaction: "Last revision lower: muted reaction, S&P -0.2%" },
  { id: "19", date: "2026-06-04", time: "15:30", name: "OPEC+ Mid-Year Review Meeting",           country: "Global", flag: "\uD83C\uDF0D",             impact: "HIGH",   previous: "--",     forecast: "--",     actual: "",    historicalReaction: "Last mid-year: output hike surprised, Brent fell 4%, energy stocks -2.5%" },
  { id: "20", date: "2026-06-05", time: "18:00", name: "US Non-Farm Payrolls (May)",              country: "US",     flag: "\uD83C\uDDFA\uD83C\uDDF8", impact: "HIGH",   previous: "195K",   forecast: "180K",   actual: "",    historicalReaction: "Last NFP miss: S&P dropped 1.2%, VIX spiked 8%" },
  { id: "21", date: "2026-06-06", time: "10:00", name: "RBI MPC Rate Decision (Jun)",             country: "India",  flag: "\uD83C\uDDEE\uD83C\uDDF3", impact: "HIGH",   previous: "6.25%",  forecast: "6.00%",  actual: "",    historicalReaction: "Last consecutive cut: Bank NIFTY rallied 2.8%, housing stocks +3.5%" },
  { id: "22", date: "2026-06-10", time: "18:00", name: "US CPI (May) Release",                    country: "US",     flag: "\uD83C\uDDFA\uD83C\uDDF8", impact: "HIGH",   previous: "2.7%",   forecast: "2.5%",   actual: "",    historicalReaction: "Last CPI miss: S&P surged 1.2%, Nasdaq +1.8%, gold fell 0.5%" },
  { id: "23", date: "2026-06-12", time: "14:00", name: "India IIP (Apr) Release",                 country: "India",  flag: "\uD83C\uDDEE\uD83C\uDDF3", impact: "LOW",    previous: "6.1%",   forecast: "5.9%",   actual: "",    historicalReaction: "Last IIP miss: minimal market impact, infra stocks flat" },
  { id: "24", date: "2026-06-17", time: "23:30", name: "FOMC Rate Decision (Jun)",                country: "US",     flag: "\uD83C\uDDFA\uD83C\uDDF8", impact: "HIGH",   previous: "5.00%",  forecast: "4.75%",  actual: "",    historicalReaction: "Last 25bps cut: S&P rallied 1.1%, VIX crushed 15%, DXY fell 0.7%" },
  { id: "25", date: "2026-06-25", time: "18:00", name: "US GDP Q1 Final Reading",                 country: "US",     flag: "\uD83C\uDDFA\uD83C\uDDF8", impact: "MEDIUM", previous: "2.3%",   forecast: "2.3%",   actual: "",    historicalReaction: "Last final reading: no revision, market ignored" },
  { id: "26", date: "2026-06-30", time: "19:30", name: "US Core PCE (May)",                       country: "US",     flag: "\uD83C\uDDFA\uD83C\uDDF8", impact: "HIGH",   previous: "2.5%",   forecast: "2.3%",   actual: "",    historicalReaction: "Last PCE in-line: S&P +0.3%, bonds stable" },
  { id: "27", date: "2026-04-20", time: "20:00", name: "US PMI Composite Flash (Apr)",            country: "US",     flag: "\uD83C\uDDFA\uD83C\uDDF8", impact: "MEDIUM", previous: "52.1",   forecast: "51.8",   actual: "",    historicalReaction: "Last PMI miss: S&P dipped 0.4%, services sector hit hardest" },
  { id: "28", date: "2026-05-15", time: "All Day", name: "US Earnings Season Peak (Q1)",          country: "US",     flag: "\uD83C\uDDFA\uD83C\uDDF8", impact: "HIGH",   previous: "--",     forecast: "--",     actual: "",    historicalReaction: "Last Q4 season: 78% beat rate, tech led gains, S&P +3.2% during season" },
];

/* ── helpers ── */
const TODAY = "2026-03-28";

function parseDate(d: string) { return new Date(d + "T00:00:00"); }
function isSameDay(a: string, b: string) { return a === b; }
function isTomorrow(d: string) {
  const t = parseDate(TODAY);
  t.setDate(t.getDate() + 1);
  return d === t.toISOString().slice(0, 10);
}

function getWeekRange(offset: number): [string, string] {
  const d = parseDate(TODAY);
  const day = d.getDay();
  const mon = new Date(d);
  mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return [mon.toISOString().slice(0, 10), sun.toISOString().slice(0, 10)];
}

function getMonthRange(): [string, string] {
  const d = parseDate(TODAY);
  const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
  return [start, end];
}

function formatDisplayDate(d: string): string {
  const dt = parseDate(d);
  return dt.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

function getCountdown(events: EcoEvent[]): string {
  const now = parseDate(TODAY);
  const upcoming = events
    .filter(e => parseDate(e.date) >= now && !e.actual)
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  if (upcoming.length === 0) return "No upcoming events";
  const next = upcoming[0];
  const diff = parseDate(next.date).getTime() - now.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return `TODAY: ${next.name}`;
  if (days === 1) return `TOMORROW: ${next.name}`;
  return `${days}d to ${next.name}`;
}

const IMPACT_COLORS: Record<Impact, { bg: string; text: string; border: string }> = {
  HIGH:   { bg: "bg-red-500/15",    text: "text-red-400",    border: "border-red-500/30" },
  MEDIUM: { bg: "bg-amber-500/15",  text: "text-amber-400",  border: "border-amber-500/30" },
  LOW:    { bg: "bg-green-500/15",  text: "text-green-400",  border: "border-green-500/30" },
};

/* ── component ── */
export default function EconomicCalendarPanel() {
  const [countryFilter, setCountryFilter] = useState<Country | "ALL">("ALL");
  const [impactFilter, setImpactFilter] = useState<Impact | "ALL">("ALL");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("this_month");
  const [selectedEvent, setSelectedEvent] = useState<EcoEvent | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [liveEvents, setLiveEvents] = useState<EcoEvent[]>([]);

  // Fetch live calendar data
  useEffect(() => {
    async function fetchLive() {
      try {
        const res = await fetch("/api/calendar", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (data.events?.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const countryFlags: Record<string, string> = { US: "🇺🇸", IN: "🇮🇳", India: "🇮🇳", CN: "🇨🇳", EU: "🇪🇺", JP: "🇯🇵", GB: "🇬🇧", Global: "🌍" };
          const mapped: EcoEvent[] = data.events.map((e: any, i: number) => {
            const ctry = (e.country === "US" ? "US" : e.country === "IN" ? "India" : e.country === "CN" ? "China" : "Global") as Country;
            return {
              id: `live-${i}`,
              date: e.date || new Date().toISOString().slice(0, 10),
              time: e.time || "—",
              name: e.event || "Unknown",
              country: ctry,
              flag: countryFlags[e.country] || "🌍",
              impact: (e.impact || "LOW") as Impact,
              previous: e.previous || "—",
              forecast: e.forecast || "—",
              actual: e.actual || "—",
              historicalReaction: "Live data — check historical charts for past market reactions.",
            };
          });
          setLiveEvents(mapped);
        }
      } catch { /* noop */ }
    }
    fetchLive();
  }, []);

  const allEvents = useMemo(() => {
    // Merge live events with static ones, deduplicate by event name similarity
    const combined = [...liveEvents, ...EVENTS];
    const seen = new Set<string>();
    return combined.filter(e => {
      const key = e.name.slice(0, 30).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [liveEvents]);

  const filtered = useMemo(() => {
    let list = [...allEvents];

    if (countryFilter !== "ALL") list = list.filter(e => e.country === countryFilter);
    if (impactFilter !== "ALL") list = list.filter(e => e.impact === impactFilter);

    let start: string, end: string;
    if (timeFilter === "this_week") [start, end] = getWeekRange(0);
    else if (timeFilter === "next_week") [start, end] = getWeekRange(1);
    else [start, end] = getMonthRange();

    // For "this_month" show everything from today through end of June
    if (timeFilter === "this_month") {
      start = TODAY;
      end = "2026-06-30";
    }

    list = list.filter(e => e.date >= start && e.date <= end);
    list.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
    return list;
  }, [countryFilter, impactFilter, timeFilter]);

  const countdown = useMemo(() => getCountdown(EVENTS), []);

  return (
    <div className="bg-[#262626] rounded-xl border border-[#3a3a3a] flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#3a3a3a] flex-shrink-0">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#BFFF00]" />
          <h2 className="text-[11px] font-bold text-white">Economic Calendar</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#BFFF00]/10 border border-[#BFFF00]/30">
            <Timer className="w-3 h-3 text-[#BFFF00]" />
            <span className="text-[8px] font-bold text-[#BFFF00]">{countdown}</span>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="p-1 rounded hover:bg-white/5 transition"
          >
            <Filter className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="px-4 py-2 border-b border-[#3a3a3a] flex flex-wrap gap-2 bg-[#1e1e1e]">
          {/* Country */}
          <div className="flex items-center gap-1">
            <span className="text-[8px] text-slate-500 font-semibold uppercase">Country:</span>
            {(["ALL", "US", "India", "Global"] as const).map(c => (
              <button
                key={c}
                onClick={() => setCountryFilter(c)}
                className={`text-[8px] px-1.5 py-0.5 rounded font-semibold transition ${
                  countryFilter === c
                    ? "bg-[#BFFF00]/20 text-[#BFFF00] border border-[#BFFF00]/40"
                    : "text-slate-400 hover:text-white border border-transparent"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          {/* Impact */}
          <div className="flex items-center gap-1">
            <span className="text-[8px] text-slate-500 font-semibold uppercase">Impact:</span>
            {(["ALL", "HIGH", "MEDIUM", "LOW"] as const).map(i => {
              const col = i === "ALL" ? null : IMPACT_COLORS[i];
              return (
                <button
                  key={i}
                  onClick={() => setImpactFilter(i)}
                  className={`text-[8px] px-1.5 py-0.5 rounded font-semibold transition border ${
                    impactFilter === i
                      ? col ? `${col.bg} ${col.text} ${col.border}` : "bg-[#BFFF00]/20 text-[#BFFF00] border-[#BFFF00]/40"
                      : "text-slate-400 hover:text-white border-transparent"
                  }`}
                >
                  {i}
                </button>
              );
            })}
          </div>
          {/* Time */}
          <div className="flex items-center gap-1">
            <span className="text-[8px] text-slate-500 font-semibold uppercase">Period:</span>
            {([["this_week", "This Week"], ["next_week", "Next Week"], ["this_month", "All Upcoming"]] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTimeFilter(k as TimeFilter)}
                className={`text-[8px] px-1.5 py-0.5 rounded font-semibold transition ${
                  timeFilter === k
                    ? "bg-[#BFFF00]/20 text-[#BFFF00] border border-[#BFFF00]/40"
                    : "text-slate-400 hover:text-white border border-transparent"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Events list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-500">
            <Calendar className="w-8 h-8 opacity-30" />
            <span className="text-[10px]">No events match your filters</span>
          </div>
        ) : (
          <div className="divide-y divide-[#3a3a3a]/50">
            {filtered.map(ev => {
              const isToday = isSameDay(ev.date, TODAY);
              const isTmrw = isTomorrow(ev.date);
              const ic = IMPACT_COLORS[ev.impact];
              const isSelected = selectedEvent?.id === ev.id;
              const isReleased = ev.actual !== "";

              return (
                <div key={ev.id}>
                  <button
                    onClick={() => setSelectedEvent(isSelected ? null : ev)}
                    className={`w-full text-left px-4 py-2.5 hover:bg-white/[0.03] transition ${
                      isToday ? "bg-[#BFFF00]/[0.04] border-l-2 border-l-[#BFFF00]" :
                      isTmrw ? "bg-amber-500/[0.03] border-l-2 border-l-amber-500/50" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {isSelected ? (
                          <ChevronDown className="w-3 h-3 text-slate-500 flex-shrink-0" />
                        ) : (
                          <ChevronRight className="w-3 h-3 text-slate-500 flex-shrink-0" />
                        )}
                        <span className="text-[11px]">{ev.flag}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-semibold text-white truncate">{ev.name}</span>
                            {isToday && (
                              <span className="text-[7px] px-1 py-0.5 rounded bg-[#BFFF00]/20 text-[#BFFF00] font-bold flex-shrink-0">TODAY</span>
                            )}
                            {isTmrw && (
                              <span className="text-[7px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold flex-shrink-0">TOMORROW</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[8px] text-slate-500">{formatDisplayDate(ev.date)}</span>
                            <span className="text-[8px] text-slate-500">{ev.time === "All Day" ? "All Day" : `${ev.time} IST`}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Impact badge */}
                        <span className={`text-[7px] px-1.5 py-0.5 rounded font-bold ${ic.bg} ${ic.text}`}>
                          {ev.impact === "HIGH" && <Flame className="w-2.5 h-2.5 inline mr-0.5" />}
                          {ev.impact}
                        </span>
                        {/* Values */}
                        <div className="text-right">
                          <div className="flex items-center gap-1.5 text-[8px]">
                            <span className="text-slate-500">Prev: <span className="text-slate-300">{ev.previous}</span></span>
                            <span className="text-slate-500">Fcst: <span className="text-amber-300">{ev.forecast}</span></span>
                            {isReleased && (
                              <span className="text-slate-500">Act: <span className="text-[#BFFF00] font-bold">{ev.actual}</span></span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Historical Reaction dropdown */}
                  {isSelected && (
                    <div className="px-4 py-3 bg-[#1e1e1e] border-t border-[#3a3a3a]/50">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[9px] font-bold text-amber-400 uppercase">Historical Market Reaction</span>
                          <p className="text-[9px] text-slate-300 mt-1 leading-relaxed">{ev.historicalReaction}</p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedEvent(null); }}
                        className="mt-2 flex items-center gap-1 text-[8px] text-slate-500 hover:text-slate-300 transition"
                      >
                        <X className="w-2.5 h-2.5" /> Close
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer summary */}
      <div className="px-4 py-1.5 border-t border-[#3a3a3a] flex items-center justify-between flex-shrink-0 bg-[#1e1e1e]">
        <div className="flex items-center gap-3 text-[8px]">
          <span className="text-slate-500">{filtered.length} events</span>
          <span className="flex items-center gap-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
            <span className="text-red-400 font-semibold">{filtered.filter(e => e.impact === "HIGH").length} High</span>
          </span>
          <span className="flex items-center gap-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span className="text-amber-400 font-semibold">{filtered.filter(e => e.impact === "MEDIUM").length} Med</span>
          </span>
          <span className="flex items-center gap-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            <span className="text-green-400 font-semibold">{filtered.filter(e => e.impact === "LOW").length} Low</span>
          </span>
        </div>
        <div className="flex items-center gap-1 text-[8px] text-slate-500">
          <Globe className="w-3 h-3" />
          <span>Times in IST</span>
        </div>
      </div>
    </div>
  );
}
