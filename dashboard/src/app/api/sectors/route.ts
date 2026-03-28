import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Fetches all NSE sector indices from Fyers API.
 * Returns live LTP, change%, high, low, open, prev close for each sector.
 */

const SECTOR_SYMBOLS = [
  { symbol: "NSE:NIFTYBANK-INDEX", name: "Banking" },
  { symbol: "NSE:NIFTYIT-INDEX", name: "IT" },
  { symbol: "NSE:NIFTYPHARMA-INDEX", name: "Pharma" },
  { symbol: "NSE:NIFTYAUTO-INDEX", name: "Auto" },
  { symbol: "NSE:NIFTYFMCG-INDEX", name: "FMCG" },
  { symbol: "NSE:NIFTYENERGY-INDEX", name: "Energy" },
  { symbol: "NSE:NIFTYMETAL-INDEX", name: "Metals" },
  { symbol: "NSE:NIFTYREALTY-INDEX", name: "Realty" },
  { symbol: "NSE:NIFTYINFRA-INDEX", name: "Infra" },
  { symbol: "NSE:NIFTYMEDIA-INDEX", name: "Media" },
  { symbol: "NSE:NIFTYFINSERV-INDEX", name: "Finance" },
  { symbol: "NSE:NIFTYPSE-INDEX", name: "PSE" },
];

export async function GET() {
  const token = process.env.FYERS_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json({ sectors: [], source: "no-token", error: "FYERS_ACCESS_TOKEN not set" });
  }

  try {
    const symbols = SECTOR_SYMBOLS.map(s => s.symbol).join(",");
    const res = await fetch(`https://api-t1.fyers.in/data/quotes?symbols=${symbols}`, {
      headers: { Authorization: token },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ sectors: [], source: "fyers-error", error: `HTTP ${res.status}` });
    }

    const data = await res.json();
    if (data.code !== 200 || !data.d) {
      return NextResponse.json({ sectors: [], source: "fyers-error", error: data.message });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sectors = data.d.map((item: any) => {
      const v = item.v;
      const meta = SECTOR_SYMBOLS.find(s => s.symbol === item.n);
      return {
        name: meta?.name || v.short_name,
        symbol: item.n,
        ltp: v.lp,
        change: v.ch,
        changePct: v.chp,
        high: v.high_price,
        low: v.low_price,
        open: v.open_price,
        prevClose: v.prev_close_price,
      };
    });

    return NextResponse.json({
      sectors,
      source: "fyers-live",
      count: sectors.length,
      timestamp: Date.now(),
    });
  } catch (err) {
    return NextResponse.json({ sectors: [], source: "error", error: String(err) });
  }
}
