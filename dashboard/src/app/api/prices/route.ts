import { NextRequest, NextResponse } from "next/server";

// Yahoo Finance symbols → our display names
const SYMBOLS: Record<string, string> = {
  "CL=F": "WTI",
  "BZ=F": "BRENT",
  "GC=F": "GOLD",
  "SI=F": "SILVER",
  "NG=F": "NATGAS",
  "ES=F": "S&P500",
  "NQ=F": "NASDAQ",
  "BTC-USD": "BTC",
  "ETH-USD": "ETH",
  "^VIX": "VIX",
  "DX-Y.NYB": "DXY",
  "HG=F": "COPPER",
  "^NSEI": "NIFTY",
  "^NSEBANK": "BANKNIFTY",
  "^TNX": "10Y UST",
  "EURUSD=X": "EUR/USD",
};

export interface YFQuote {
  symbol: string;
  displayName: string;
  price: number;
  change: number;
  changePct: number;
  volume: string;
  high: number;
  low: number;
  open: number;
  prevClose: number;
  marketState: string;
  timestamp: number;
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const customSymbols = req.nextUrl.searchParams.get("symbols");
  const symbolList = customSymbols || Object.keys(SYMBOLS).join(",");

  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbolList)}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketVolume,regularMarketDayHigh,regularMarketDayLow,regularMarketOpen,regularMarketPreviousClose,marketState,shortName`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return await fetchV6Fallback(symbolList);
    }

    const data = await res.json();
    const quotes: YFQuote[] = (data?.quoteResponse?.result || []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (q: any) => formatQuote(q)
    );

    return NextResponse.json({
      quotes,
      timestamp: Date.now(),
      source: "yahoo-v7",
    });
  } catch {
    return await fetchV6Fallback(symbolList);
  }
}

async function fetchV6Fallback(symbolList?: string) {
  const syms = symbolList || Object.keys(SYMBOLS).join(",");
  try {
    const url = `https://query2.finance.yahoo.com/v6/finance/quote?symbols=${encodeURIComponent(syms)}`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return await fetchCrumbFallback(syms);
    }

    const data = await res.json();
    const quotes: YFQuote[] = (data?.quoteResponse?.result || []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (q: any) => formatQuote(q)
    );

    return NextResponse.json({ quotes, timestamp: Date.now(), source: "yahoo-v6" });
  } catch {
    return await fetchCrumbFallback(syms);
  }
}

async function fetchCrumbFallback(symbolList?: string) {
  try {
    // Try individual chart endpoints as last resort
    const symbols = symbolList ? symbolList.split(",") : Object.keys(SYMBOLS);
    const quotes: YFQuote[] = [];

    const results = await Promise.allSettled(
      symbols.map(async (sym) => {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1m&range=1d`;
        const res = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          },
          cache: "no-store",
        });
        if (!res.ok) return null;
        const data = await res.json();
        const meta = data?.chart?.result?.[0]?.meta;
        if (!meta) return null;

        const price = meta.regularMarketPrice ?? 0;
        const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
        const change = price - prevClose;
        const changePct = prevClose ? (change / prevClose) * 100 : 0;
        const vol = meta.regularMarketVolume ?? 0;

        return {
          symbol: sym,
          displayName: SYMBOLS[sym] || meta.shortName || sym,
          price,
          change: +change.toFixed(4),
          changePct: +changePct.toFixed(2),
          volume: formatVol(vol),
          high: meta.regularMarketDayHigh ?? price,
          low: meta.regularMarketDayLow ?? price,
          open: meta.regularMarketOpen ?? price,
          prevClose,
          marketState: meta.marketState ?? "REGULAR",
          timestamp: Date.now(),
        } as YFQuote;
      })
    );

    for (const r of results) {
      if (r.status === "fulfilled" && r.value) quotes.push(r.value);
    }

    if (quotes.length === 0) {
      return NextResponse.json(
        { quotes: [], timestamp: Date.now(), source: "error", error: "All Yahoo Finance endpoints failed" },
        { status: 502 }
      );
    }

    return NextResponse.json({ quotes, timestamp: Date.now(), source: "yahoo-v8-chart" });
  } catch (err) {
    return NextResponse.json(
      { quotes: [], timestamp: Date.now(), source: "error", error: String(err) },
      { status: 502 }
    );
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatQuote(q: any): YFQuote {
  const sym = q.symbol as string;
  const price = q.regularMarketPrice ?? 0;
  const change = q.regularMarketChange ?? 0;
  const changePct = q.regularMarketChangePercent ?? 0;
  const vol = q.regularMarketVolume ?? 0;

  return {
    symbol: sym,
    displayName: SYMBOLS[sym] ?? sym,
    price: +price.toFixed(price < 10 ? 4 : price < 100 ? 2 : price < 1000 ? 1 : 0),
    change: +change.toFixed(price < 10 ? 4 : 2),
    changePct: +changePct.toFixed(2),
    volume: formatVol(vol),
    high: q.regularMarketDayHigh ?? price,
    low: q.regularMarketDayLow ?? price,
    open: q.regularMarketOpen ?? price,
    prevClose: q.regularMarketPreviousClose ?? price,
    marketState: q.marketState ?? "REGULAR",
    timestamp: Date.now(),
  };
}

function formatVol(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return String(v);
}
