import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Fetches Options Chain data.
 * Priority: 1) Groww bridge  2) Fyers API  3) Mock data
 *
 * Query params:
 *   symbol  — e.g. NSE:NIFTY50-INDEX, NSE:BANKNIFTY-INDEX, NSE:TCS-EQ
 *   strikecount — number of strikes above/below ATM (default 10)
 *   expiry — optional expiry date (YYYY-MM-DD for Groww, epoch for Fyers)
 */

const BRIDGE_URL = process.env.GROWW_BRIDGE_URL || "http://localhost:5050";

// Map dashboard symbols to Groww underlying names
function toGrowwUnderlying(sym: string): string {
  if (sym.includes("NIFTY50")) return "NIFTY";
  if (sym.includes("BANKNIFTY")) return "BANKNIFTY";
  if (sym.includes("FINNIFTY")) return "FINNIFTY";
  if (sym.includes("MIDCPNIFTY")) return "MIDCPNIFTY";
  // Extract stock name: NSE:RELIANCE-EQ → RELIANCE
  const match = sym.match(/:([A-Z]+)/);
  return match ? match[1] : sym;
}

// Convert Groww option chain format to our unified format
function convertGrowwChain(growwData: GrowwChainData): UnifiedChainData {
  const optionsChain: ChainRow[] = [];
  const strikes = growwData.strikes || {};

  // Add underlying as first entry
  optionsChain.push({
    symbol: "UNDERLYING",
    ltp: growwData.underlying_ltp,
    ltpch: 0, ltpchp: 0,
    option_type: "",
    strike_price: -1,
    fp: growwData.underlying_ltp,
    description: "Underlying",
  });

  let totalCallOI = 0;
  let totalPutOI = 0;

  for (const [strikeStr, data] of Object.entries(strikes)) {
    const strike = parseFloat(strikeStr);
    if (data.CE) {
      const ce = data.CE;
      totalCallOI += ce.open_interest || 0;
      optionsChain.push({
        symbol: ce.trading_symbol || `CE-${strike}`,
        ltp: ce.ltp || 0,
        ltpch: 0, ltpchp: 0,
        option_type: "CE",
        strike_price: strike,
        oi: ce.open_interest || 0,
        oich: 0, oichp: 0,
        volume: ce.volume || 0,
        iv: ce.greeks?.iv,
        delta: ce.greeks?.delta,
        gamma: ce.greeks?.gamma,
        theta: ce.greeks?.theta,
        vega: ce.greeks?.vega,
        rho: ce.greeks?.rho,
      });
    }
    if (data.PE) {
      const pe = data.PE;
      totalPutOI += pe.open_interest || 0;
      optionsChain.push({
        symbol: pe.trading_symbol || `PE-${strike}`,
        ltp: pe.ltp || 0,
        ltpch: 0, ltpchp: 0,
        option_type: "PE",
        strike_price: strike,
        oi: pe.open_interest || 0,
        oich: 0, oichp: 0,
        volume: pe.volume || 0,
        iv: pe.greeks?.iv,
        delta: pe.greeks?.delta,
        gamma: pe.greeks?.gamma,
        theta: pe.greeks?.theta,
        vega: pe.greeks?.vega,
        rho: pe.greeks?.rho,
      });
    }
  }

  return { callOi: totalCallOI, putOi: totalPutOI, optionsChain };
}

interface Greeks { delta?: number; gamma?: number; theta?: number; vega?: number; rho?: number; iv?: number; }
interface StrikeSide { greeks?: Greeks; trading_symbol?: string; ltp?: number; open_interest?: number; volume?: number; }
interface GrowwChainData { underlying_ltp: number; strikes: Record<string, { CE?: StrikeSide; PE?: StrikeSide }>; }
interface ChainRow {
  symbol: string; ltp: number; ltpch: number; ltpchp: number; option_type: string; strike_price: number;
  oi?: number; oich?: number; oichp?: number; volume?: number; iv?: number; fp?: number; description?: string;
  delta?: number; gamma?: number; theta?: number; vega?: number; rho?: number;
}
interface UnifiedChainData { callOi: number; putOi: number; optionsChain: ChainRow[]; }

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol") || "NSE:NIFTY50-INDEX";
  const strikecount = req.nextUrl.searchParams.get("strikecount") || "10";
  const expiry = req.nextUrl.searchParams.get("expiry") || "";

  // ── Try Groww bridge first ──
  try {
    const underlying = toGrowwUnderlying(symbol);
    let growwUrl = `${BRIDGE_URL}/option-chain?underlying=${underlying}`;
    if (expiry) growwUrl += `&expiry=${expiry}`;

    const gRes = await fetch(growwUrl, { cache: "no-store" });
    if (gRes.ok) {
      const gData = await gRes.json();
      if (gData.data && gData.data.strikes) {
        const unified = convertGrowwChain(gData.data);
        return NextResponse.json({
          code: 200,
          data: {
            ...unified,
            expiryData: [],
            indiavixData: { symbol: "NSE:INDIAVIX-INDEX", ltp: 0, ltpch: 0, ltpchp: 0 },
          },
          source: "groww-live",
          expiry: gData.expiry,
        });
      }
    }
  } catch { /* Groww bridge not available, try Fyers */ }

  // ── Try Fyers API ──
  const token = process.env.FYERS_ACCESS_TOKEN;
  if (token) {
    try {
      let url = `https://api-t1.fyers.in/data/options-chain-v3?symbol=${encodeURIComponent(symbol)}&strikecount=${strikecount}`;
      if (expiry) url += `&timestamp=${expiry}`;

      const res = await fetch(url, {
        headers: { Authorization: token },
        cache: "no-store",
      });

      if (res.ok) {
        const data = await res.json();
        return NextResponse.json({ ...data, source: "fyers-live" });
      }
    } catch { /* Fyers failed, fall through to mock */ }
  }

  // ── Fall back to mock ──
  return NextResponse.json({
    code: 200,
    data: generateMockData(symbol, +strikecount),
    source: "mock",
  });
}

// ── Mock data generator for demo when no token ────────────────────────────

// Seeded PRNG so mock data is stable (doesn't flicker every 5s)
function seededRandom(seed: number) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

function generateMockData(symbol: string, strikecount: number) {
  // Seed based on symbol + today's date (changes daily, not per-request)
  const today = new Date().toISOString().slice(0, 10);
  const seedStr = symbol + today;
  let seedVal = 0;
  for (let i = 0; i < seedStr.length; i++) seedVal = ((seedVal << 5) - seedVal + seedStr.charCodeAt(i)) | 0;
  const rand = seededRandom(Math.abs(seedVal));

  const isNifty = symbol.includes("NIFTY50");
  const isBankNifty = symbol.includes("BANKNIFTY");
  const spotPrice = isNifty ? 22820 : isBankNifty ? 52275 : 3884;
  const stepSize = isNifty ? 50 : isBankNifty ? 100 : 20;
  const atmStrike = Math.round(spotPrice / stepSize) * stepSize;

  const optionsChain: Record<string, unknown>[] = [];

  // Add underlying
  optionsChain.push({
    symbol: symbol,
    ltp: spotPrice,
    ltpch: +(rand() * 200 - 100).toFixed(2),
    ltpchp: +(rand() * 4 - 2).toFixed(2),
    option_type: "",
    strike_price: -1,
    fp: spotPrice,
    fpch: +(rand() * 200 - 100).toFixed(2),
    fpchp: +(rand() * 2 - 1).toFixed(2),
    exchange: "NSE",
    description: isNifty ? "NIFTY 50" : isBankNifty ? "BANK NIFTY" : symbol.split(":")[1]?.replace("-EQ", ""),
  });

  for (let i = -strikecount; i <= strikecount; i++) {
    const strike = atmStrike + i * stepSize;
    const distFromATM = Math.abs(i);
    const isITM_CE = strike < spotPrice;
    const isITM_PE = strike > spotPrice;

    // CE
    const cePremium = isITM_CE
      ? Math.max(spotPrice - strike + rand() * 30, 10)
      : Math.max(80 - distFromATM * 15 + rand() * 20, 2);
    const ceOI = Math.round((8000 + rand() * 40000) * (1 + (distFromATM < 3 ? 2 : 0)));
    const ceOIChange = Math.round((rand() - 0.4) * ceOI * 0.15);

    optionsChain.push({
      symbol: `NSE:${isNifty ? "NIFTY" : isBankNifty ? "BANKNIFTY" : "STOCK"}APR${strike}CE`,
      ltp: +cePremium.toFixed(2),
      ltpch: +(rand() * 20 - 10).toFixed(2),
      ltpchp: +(rand() * 30 - 15).toFixed(2),
      option_type: "CE",
      strike_price: strike,
      oi: ceOI,
      oich: ceOIChange,
      oichp: ceOI > 0 ? +((ceOIChange / ceOI) * 100).toFixed(2) : 0,
      prev_oi: ceOI - ceOIChange,
      volume: Math.round(ceOI * (0.5 + rand())),
      bid: +(cePremium - 0.5).toFixed(2),
      ask: +(cePremium + 0.5).toFixed(2),
      iv: +(12 + distFromATM * 0.8 + rand() * 3).toFixed(2),
    });

    // PE
    const pePremium = isITM_PE
      ? Math.max(strike - spotPrice + rand() * 30, 10)
      : Math.max(80 - distFromATM * 15 + rand() * 20, 2);
    const peOI = Math.round((8000 + rand() * 40000) * (1 + (distFromATM < 3 ? 2 : 0)));
    const peOIChange = Math.round((rand() - 0.5) * peOI * 0.15);

    optionsChain.push({
      symbol: `NSE:${isNifty ? "NIFTY" : isBankNifty ? "BANKNIFTY" : "STOCK"}APR${strike}PE`,
      ltp: +pePremium.toFixed(2),
      ltpch: +(rand() * 20 - 10).toFixed(2),
      ltpchp: +(rand() * 30 - 15).toFixed(2),
      option_type: "PE",
      strike_price: strike,
      oi: peOI,
      oich: peOIChange,
      oichp: peOI > 0 ? +((peOIChange / peOI) * 100).toFixed(2) : 0,
      prev_oi: peOI - peOIChange,
      volume: Math.round(peOI * (0.5 + rand())),
      bid: +(pePremium - 0.5).toFixed(2),
      ask: +(pePremium + 0.5).toFixed(2),
      iv: +(12 + distFromATM * 0.8 + rand() * 3).toFixed(2),
    });
  }

  // Total OI
  const callOi = optionsChain.filter((o) => o.option_type === "CE").reduce((s, o) => s + ((o.oi as number) || 0), 0);
  const putOi = optionsChain.filter((o) => o.option_type === "PE").reduce((s, o) => s + ((o.oi as number) || 0), 0);

  return {
    callOi,
    putOi,
    optionsChain,
    expiryData: [
      { date: "03-04-2026", expiry: "1743638400" },
      { date: "10-04-2026", expiry: "1744243200" },
      { date: "24-04-2026", expiry: "1745452800" },
      { date: "29-05-2026", expiry: "1748476800" },
    ],
    indiavixData: {
      symbol: "NSE:INDIAVIX-INDEX",
      ltp: 14.82,
      ltpch: -0.45,
      ltpchp: -2.95,
      description: "INDIAVIX-INDEX",
    },
  };
}
