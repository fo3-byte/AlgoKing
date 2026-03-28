import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export interface ChartPoint {
  time: string;
  timestamp: number; // Unix seconds — for proper chart rendering
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Map our keys to Yahoo symbols
const SYM_MAP: Record<string, string> = {
  CL: "CL=F",
  BZ: "BZ=F",
  GC: "GC=F",
  BTC: "BTC-USD",
  ES: "ES=F",
  NQ: "NQ=F",
  NG: "NG=F",
  // Indian indices & stocks (already valid Yahoo symbols)
  "^NSEI": "^NSEI",
  "^NSEBANK": "^NSEBANK",
  "RELIANCE.NS": "RELIANCE.NS",
  "TCS.NS": "TCS.NS",
  "HDFCBANK.NS": "HDFCBANK.NS",
  "INFY.NS": "INFY.NS",
  "SBIN.NS": "SBIN.NS",
  "ICICIBANK.NS": "ICICIBANK.NS",
  "TATAMOTORS.NS": "TATAMOTORS.NS",
  "ITC.NS": "ITC.NS",
};

export async function GET(req: NextRequest) {
  const asset = req.nextUrl.searchParams.get("asset") || "CL";
  const interval = req.nextUrl.searchParams.get("interval") || "5m";
  const range = req.nextUrl.searchParams.get("range") || "1d";

  // Use SYM_MAP for known keys, otherwise pass through directly (supports any Yahoo symbol)
  const yahooSym = SYM_MAP[asset] ?? asset;

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSym)}?interval=${interval}&range=${range}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ points: [], error: `Yahoo returned ${res.status}` }, { status: 502 });
    }

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) {
      return NextResponse.json({ points: [], error: "No chart data" }, { status: 404 });
    }

    const timestamps: number[] = result.timestamp || [];
    const ohlcv = result.indicators?.quote?.[0] || {};
    const opens: number[] = ohlcv.open || [];
    const highs: number[] = ohlcv.high || [];
    const lows: number[] = ohlcv.low || [];
    const closes: number[] = ohlcv.close || [];
    const volumes: number[] = ohlcv.volume || [];

    const points: ChartPoint[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (closes[i] == null) continue;
      const d = new Date(timestamps[i] * 1000);
      points.push({
        time: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }),
        timestamp: timestamps[i],
        open: +(opens[i] ?? closes[i]).toFixed(2),
        high: +(highs[i] ?? closes[i]).toFixed(2),
        low: +(lows[i] ?? closes[i]).toFixed(2),
        close: +closes[i].toFixed(2),
        volume: volumes[i] ?? 0,
      });
    }

    // Compute SMA20, SMA50, BB
    const enriched = points.map((p, idx) => {
      const slice20 = points.slice(Math.max(0, idx - 19), idx + 1).map(x => x.close);
      const slice50 = points.slice(Math.max(0, idx - 49), idx + 1).map(x => x.close);
      const sma20 = slice20.reduce((s, v) => s + v, 0) / slice20.length;
      const sma50 = slice50.reduce((s, v) => s + v, 0) / slice50.length;
      const std20 = Math.sqrt(slice20.reduce((s, v) => s + (v - sma20) ** 2, 0) / slice20.length);
      return {
        ...p,
        sma20: +sma20.toFixed(2),
        sma50: +sma50.toFixed(2),
        bbUpper: +(sma20 + 2 * std20).toFixed(2),
        bbLower: +(sma20 - 2 * std20).toFixed(2),
      };
    });

    const meta = result.meta || {};
    return NextResponse.json({
      points: enriched,
      meta: {
        symbol: yahooSym,
        price: meta.regularMarketPrice,
        prevClose: meta.chartPreviousClose ?? meta.previousClose,
        high: meta.regularMarketDayHigh,
        low: meta.regularMarketDayLow,
      },
      timestamp: Date.now(),
    });
  } catch (err) {
    return NextResponse.json({ points: [], error: String(err) }, { status: 500 });
  }
}
