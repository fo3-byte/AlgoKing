import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Economic calendar — scrapes from free sources.
 * Returns upcoming economic events with impact scoring.
 */

interface CalendarEvent {
  date: string;
  time: string;
  event: string;
  country: string;
  impact: "HIGH" | "MEDIUM" | "LOW";
  previous: string;
  forecast: string;
  actual: string;
}

async function scrapeInvestingCalendar(): Promise<CalendarEvent[]> {
  try {
    // Try TradingEconomics RSS
    const res = await fetch("https://tradingeconomics.com/rss/calendar.aspx", {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MotherAlgo/1.0)" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();

    const events: CalendarEvent[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    let idx = 0;

    while ((match = itemRegex.exec(text)) !== null && idx < 30) {
      const block = match[1];
      const title = (block.match(/<title>\s*<!\[CDATA\[([\s\S]*?)\]\]>/) || block.match(/<title>([\s\S]*?)<\/title>/))?.[1]?.trim() || "";
      const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/))?.[1]?.trim() || "";

      if (!title || title.length < 5) continue;

      // Parse country and event from title
      const country = title.includes("United States") ? "US" :
        title.includes("India") ? "IN" :
        title.includes("China") ? "CN" :
        title.includes("Euro") ? "EU" :
        title.includes("Japan") ? "JP" :
        title.includes("United Kingdom") ? "GB" : "Global";

      const impact: "HIGH" | "MEDIUM" | "LOW" =
        /gdp|interest rate|inflation|cpi|nfp|non-farm|employment|pmi|rbi|fed/i.test(title) ? "HIGH" :
        /trade balance|retail|industrial|housing|consumer/i.test(title) ? "MEDIUM" : "LOW";

      events.push({
        date: pubDate ? new Date(pubDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        time: pubDate ? new Date(pubDate).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }) : "—",
        event: title.replace(/<[^>]+>/g, "").trim(),
        country,
        impact,
        previous: "",
        forecast: "",
        actual: "",
      });
      idx++;
    }

    return events;
  } catch {
    return [];
  }
}

// Fallback: try ForexFactory-style RSS
async function scrapeForexFactory(): Promise<CalendarEvent[]> {
  try {
    const res = await fetch("https://nfs.faireconomy.media/ff_calendar_thisweek.json", {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any[] = await res.json();

    return data.slice(0, 30).map(e => ({
      date: e.date || "",
      time: e.time || "—",
      event: e.title || e.event || "",
      country: e.country || "US",
      impact: e.impact === "High" ? "HIGH" : e.impact === "Medium" ? "MEDIUM" : "LOW",
      previous: e.previous || "",
      forecast: e.forecast || "",
      actual: e.actual || "",
    }));
  } catch {
    return [];
  }
}

export async function GET() {
  // Try multiple sources
  let events = await scrapeForexFactory();
  if (events.length === 0) {
    events = await scrapeInvestingCalendar();
  }

  return NextResponse.json({
    events,
    count: events.length,
    source: events.length > 0 ? "live" : "none",
    timestamp: Date.now(),
  });
}
