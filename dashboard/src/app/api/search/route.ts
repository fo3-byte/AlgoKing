import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Symbol search — queries Yahoo Finance autocomplete API.
 * Returns matching stocks, indices, ETFs, futures, crypto from any exchange worldwide.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") || "";
  if (q.length < 1) return NextResponse.json({ results: [] });

  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=12&newsCount=0&enableFuzzyQuery=true&quotesQueryId=tss_match_phrase_query&multiQuoteQueryId=multi_quote_single_token_query&enableCb=false&enableNavLinks=false&enableEnhancedTrivialQuery=true&enableResearchReports=false&enableCulturalAssets=false&enableLogoUrl=true&researchReportsCount=0`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      // Fallback: try v6 search
      return await fallbackSearch(q);
    }

    const data = await res.json();
    const quotes = (data.quotes || []).map((q: Record<string, string | number | boolean>) => ({
      symbol: q.symbol,
      name: q.shortname || q.longname || q.symbol,
      exchange: q.exchDisp || q.exchange || "",
      type: q.quoteType || q.typeDisp || "",
      isYahoo: true,
    }));

    return NextResponse.json({ results: quotes });
  } catch {
    return await fallbackSearch(q);
  }
}

async function fallbackSearch(q: string) {
  try {
    const url = `https://query1.finance.yahoo.com/v6/finance/autocomplete?query=${encodeURIComponent(q)}&lang=en`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
    });
    if (!res.ok) return NextResponse.json({ results: [] });
    const data = await res.json();
    const results = (data.ResultSet?.Result || []).map((r: Record<string, string>) => ({
      symbol: r.symbol,
      name: r.name || r.symbol,
      exchange: r.exchDisp || r.exch || "",
      type: r.typeDisp || r.type || "",
      isYahoo: true,
    }));
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
