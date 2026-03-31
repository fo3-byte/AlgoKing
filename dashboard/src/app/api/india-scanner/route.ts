import { NextRequest, NextResponse } from "next/server";
import { FNO_STOCKS, FNO_INDICES } from "@/lib/fno-stocks";
import { getDhanScripMap, type DhanScrip } from "@/lib/dhan-scrip-cache";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TG_BOT = "8440970690:AAFOHoVTCw6Gyx4Mla7Q4pOUnfzeb8fDDoE";
const TG_CHAT = "6776228988";

// ── In-memory: track alerted signals to avoid repeats ──
const alertedSignals = new Map<string, number>();
const ALERT_COOLDOWN = 3600000; // 1h per signal

// ── Dhan API base + token helpers ──
const DHAN_BASE = "https://api.dhan.co/v2";

function getDhanToken(): string | null {
  return (process.env.DHAN_ACCESS_TOKEN || "").trim() || null;
}
function getDhanClientId(): string | null {
  return (process.env.DHAN_CLIENT_ID || "").trim() || null;
}

// Try to get token from the in-memory dhan route
async function getDhanCredentials(): Promise<{ token: string; clientId: string } | null> {
  // First check env
  const envToken = getDhanToken();
  const envClient = getDhanClientId();
  if (envToken && envClient) return { token: envToken, clientId: envClient };

  // Try internal status endpoint to get runtime-set token
  try {
    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const res = await fetch(`${base}/api/dhan?action=status`, { cache: "no-store" });
    const data = await res.json();
    if (data.connected && data.clientId) {
      // Token is stored in-memory in dhan route, use the env fallback
      return envToken ? { token: envToken, clientId: data.clientId } : null;
    }
  } catch { /* */ }

  return null;
}

// ── Dhan data request ──
async function dhanDataRequest(
  path: string,
  body: unknown,
  token: string,
  clientId: string
): Promise<{ ok: boolean; data: unknown }> {
  try {
    const res = await fetch(`${DHAN_BASE}${path}`, {
      method: "POST",
      headers: {
        "access-token": token,
        "client-id": clientId,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      return { ok: res.ok, data: await res.json() };
    }
    return { ok: res.ok, data: {} };
  } catch (err) {
    return { ok: false, data: { error: String(err) } };
  }
}

// ── Dhan GET request ──
async function dhanGetRequest(
  path: string,
  token: string
): Promise<{ ok: boolean; data: unknown }> {
  try {
    const res = await fetch(`${DHAN_BASE}${path}`, {
      headers: {
        "access-token": token,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      cache: "no-store",
    });
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      return { ok: res.ok, data: await res.json() };
    }
    return { ok: res.ok, data: {} };
  } catch (err) {
    return { ok: false, data: { error: String(err) } };
  }
}

// ── Yahoo Finance fallback ──
async function fetchYahoo(symbols: string[]): Promise<Record<string, YahooQuote>> {
  const result: Record<string, YahooQuote> = {};
  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(",")}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketDayHigh,regularMarketDayLow,regularMarketPreviousClose,regularMarketVolume,averageDailyVolume3Month`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
    if (!res.ok) return result;
    const data = await res.json();
    for (const q of (data?.quoteResponse?.result || []) as Record<string, number>[]) {
      result[q.symbol as unknown as string] = {
        price: q.regularMarketPrice || 0,
        change: q.regularMarketChange || 0,
        changePct: q.regularMarketChangePercent || 0,
        high: q.regularMarketDayHigh || 0,
        low: q.regularMarketDayLow || 0,
        prevClose: q.regularMarketPreviousClose || 0,
        volume: q.regularMarketVolume || 0,
        avgVolume: q.averageDailyVolume3Month || 1,
      };
    }
  } catch { /* */ }
  return result;
}

interface YahooQuote {
  price: number; change: number; changePct: number;
  high: number; low: number; prevClose: number;
  volume: number; avgVolume: number;
}

// ── Quote type (unified for Dhan + Yahoo) ──
interface StockQuote {
  price: number;
  change: number;
  changePct: number;
  high: number;
  low: number;
  prevClose: number;
  volume: number;
  avgVolume: number;
  oi?: number;
}

// ── Option Chain data ──
interface OptionChainData {
  totalCeOI: number;
  totalPeOI: number;
  pcr: number;           // put-call ratio
  maxCeOIStrike: number; // resistance
  maxPeOIStrike: number; // support
  atmIV: number;         // ATM implied volatility
  atmCeDelta: number;
  atmCeGamma: number;
  atmCeTheta: number;
  atmCeVega: number;
  atmPeDelta: number;
  atmPeGamma: number;
  atmPeTheta: number;
  atmPeVega: number;
  oiChange?: number;     // net OI change (CE - PE buildup)
  strikes: number;       // total active strikes
}

// ── Technical Indicators ──
function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  const d = closes.slice(-period - 1).map((c, i, a) => i > 0 ? c - a[i - 1] : 0).slice(1);
  const g = d.filter(x => x > 0);
  const l = d.filter(x => x < 0).map(x => -x);
  const ag = g.length > 0 ? g.reduce((s, x) => s + x, 0) / period : 0;
  const al = l.length > 0 ? l.reduce((s, x) => s + x, 0) / period : 0.01;
  return 100 - (100 / (1 + ag / al));
}

function calcSMA(c: number[], p: number): number {
  if (c.length < p) return c[c.length - 1] || 0;
  return c.slice(-p).reduce((s, x) => s + x, 0) / p;
}

function calcATR(highs: number[], lows: number[], closes: number[], period = 14): number {
  if (highs.length < 2) return 0;
  const trs: number[] = [];
  for (let i = 1; i < highs.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trs.push(tr);
  }
  if (trs.length < period) return trs.reduce((s, x) => s + x, 0) / trs.length || 0;
  return trs.slice(-period).reduce((s, x) => s + x, 0) / period;
}

// ── Ported from crypto algo: Z-Score + Realized Vol ──
function calcZScore(closes: number[], period = 20): number {
  if (closes.length < period) return 0;
  const slice = closes.slice(-period);
  const mean = slice.reduce((s, c) => s + c, 0) / period;
  const std = Math.sqrt(slice.reduce((s, c) => s + (c - mean) ** 2, 0) / period);
  return std > 0 ? (closes[closes.length - 1] - mean) / std : 0;
}

function calcRealizedVol(closes: number[], period = 20): number {
  if (closes.length < period + 1) return 0;
  const returns = closes.slice(-period - 1).map((c, i, a) => i > 0 ? Math.log(c / a[i - 1]) : 0).slice(1);
  const std = Math.sqrt(returns.reduce((s, r) => s + r * r, 0) / returns.length);
  return std * Math.sqrt(252) * 100; // Annualized % (252 trading days for equity)
}

function isMarketHours(): boolean {
  const now = new Date();
  const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const h = ist.getHours(), m = ist.getMinutes(), tm = h * 60 + m, day = ist.getDay();
  return day >= 1 && day <= 5 && tm >= 555 && tm <= 930;
}

// ── Helpers ──
async function sendTg(text: string) {
  await fetch(`https://api.telegram.org/bot${TG_BOT}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: "Markdown", disable_web_page_preview: true }),
  }).catch(() => {});
}

// ══════════════════════════════════════════════════════════════════════
// DHAN DATA FETCHERS
// ══════════════════════════════════════════════════════════════════════

// Batch LTP from Dhan — accepts up to 1000 security IDs per segment
async function fetchDhanLTP(
  securityIds: string[],
  token: string,
  clientId: string,
  segment = "NSE_EQ"
): Promise<Record<string, { ltp: number; oi?: number }>> {
  const result: Record<string, { ltp: number; oi?: number }> = {};
  if (securityIds.length === 0) return result;

  // Dhan accepts max ~100 per call, batch them
  const BATCH = 100;
  for (let i = 0; i < securityIds.length; i += BATCH) {
    const batch = securityIds.slice(i, i + BATCH);
    const payload = { [segment]: batch.map(Number) };
    const res = await dhanDataRequest("/marketfeed/ltp", payload, token, clientId);

    if (res.ok && res.data) {
      const data = res.data as Record<string, unknown>;
      // Dhan returns { data: { "NSE_EQ": { "secId": { ltp, oi } } } } or flat
      const segData = (data.data as Record<string, Record<string, unknown>>)?.[segment] || data;
      for (const [secId, info] of Object.entries(segData)) {
        if (typeof info === "object" && info !== null) {
          const d = info as Record<string, number>;
          result[secId] = { ltp: d.last_price || d.ltp || d.LTP || 0, oi: d.oi || d.OI };
        }
      }
    }
  }
  return result;
}

// Batch OHLC from Dhan
async function fetchDhanOHLC(
  securityIds: string[],
  token: string,
  clientId: string,
  segment = "NSE_EQ"
): Promise<Record<string, { open: number; high: number; low: number; close: number; volume: number; prevClose: number }>> {
  const result: Record<string, { open: number; high: number; low: number; close: number; volume: number; prevClose: number }> = {};
  if (securityIds.length === 0) return result;

  const BATCH = 100;
  for (let i = 0; i < securityIds.length; i += BATCH) {
    const batch = securityIds.slice(i, i + BATCH);
    const payload = { [segment]: batch.map(Number) };
    const res = await dhanDataRequest("/marketfeed/ohlc", payload, token, clientId);

    if (res.ok && res.data) {
      const data = res.data as Record<string, unknown>;
      const segData = (data.data as Record<string, Record<string, unknown>>)?.[segment] || data;
      for (const [secId, info] of Object.entries(segData)) {
        if (typeof info === "object" && info !== null) {
          const d = info as Record<string, number>;
          result[secId] = {
            open: d.open || d.Open || 0,
            high: d.high || d.High || 0,
            low: d.low || d.Low || 0,
            close: d.close || d.Close || d.ltp || d.LTP || 0,
            volume: d.volume || d.Volume || 0,
            prevClose: d.prev_close || d.prevClose || d.PrevClose || 0,
          };
        }
      }
    }
  }
  return result;
}

// Intraday candles from Dhan (per security)
async function fetchDhanIntraday(
  securityId: string,
  token: string,
  clientId: string,
  interval = "15",
  segment = "NSE_EQ"
): Promise<{ closes: number[]; highs: number[]; lows: number[]; volumes: number[] }> {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 5);

  const res = await dhanDataRequest("/charts/intraday", {
    securityId,
    exchangeSegment: segment,
    instrument: "EQUITY",
    interval,
    oi: false,
    fromDate: from.toISOString().split("T")[0],
    toDate: now.toISOString().split("T")[0],
  }, token, clientId);

  if (!res.ok || !res.data) return { closes: [], highs: [], lows: [], volumes: [] };

  const data = res.data as Record<string, number[]>;
  return {
    closes: (data.close || []).filter((c: number | null) => c !== null),
    highs: (data.high || []).filter((h: number | null) => h !== null),
    lows: (data.low || []).filter((l: number | null) => l !== null),
    volumes: (data.volume || []).filter((v: number | null) => v !== null),
  };
}

// Option chain from Dhan
async function fetchDhanOptionChain(
  underlyingScrip: string,
  underlyingSeg: string,
  expiry: string,
  token: string,
  clientId: string
): Promise<OptionChainData | null> {
  const res = await dhanDataRequest("/optionchain", {
    UnderlyingScrip: Number(underlyingScrip),
    UnderlyingSeg: underlyingSeg,
    Expiry: expiry,
  }, token, clientId);

  if (!res.ok || !res.data) return null;

  try {
    const raw = res.data as Record<string, unknown>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chains = (raw.data || raw.optionChain || raw) as any[];
    if (!Array.isArray(chains) || chains.length === 0) return null;

    let totalCeOI = 0, totalPeOI = 0;
    let maxCeOI = 0, maxCeOIStrike = 0;
    let maxPeOI = 0, maxPeOIStrike = 0;
    let atmData: Record<string, unknown> | null = null;
    let minStrikeDist = Infinity;

    // Get underlying LTP from the first entry or response
    const underlyingLTP = Number(raw.underlyingLTP || raw.ltp || raw.spotPrice || 0);

    for (const strike of chains) {
      const sp = Number(strike.strikePrice || strike.strike_price || strike.StrikePrice || 0);
      if (!sp) continue;

      // CE data
      const ceOI = Number(strike.ce_oi || strike.ceOI || strike.CE_OI ||
        strike.ce?.oi || strike.CE?.oi || 0);
      const peOI = Number(strike.pe_oi || strike.peOI || strike.PE_OI ||
        strike.pe?.oi || strike.PE?.oi || 0);

      totalCeOI += ceOI;
      totalPeOI += peOI;

      if (ceOI > maxCeOI) { maxCeOI = ceOI; maxCeOIStrike = sp; }
      if (peOI > maxPeOI) { maxPeOI = peOI; maxPeOIStrike = sp; }

      // Find ATM strike
      const dist = Math.abs(sp - underlyingLTP);
      if (dist < minStrikeDist) {
        minStrikeDist = dist;
        atmData = strike;
      }
    }

    // Extract ATM Greeks
    const ce = (atmData as Record<string, unknown>)?.ce || (atmData as Record<string, unknown>)?.CE || atmData || {};
    const pe = (atmData as Record<string, unknown>)?.pe || (atmData as Record<string, unknown>)?.PE || atmData || {};
    const ceG = (ce as Record<string, unknown>)?.greeks || ce;
    const peG = (pe as Record<string, unknown>)?.greeks || pe;

    const getNum = (obj: unknown, ...keys: string[]) => {
      if (!obj || typeof obj !== "object") return 0;
      for (const k of keys) {
        const v = (obj as Record<string, unknown>)[k];
        if (v !== undefined && v !== null) return Number(v) || 0;
      }
      return 0;
    };

    return {
      totalCeOI,
      totalPeOI,
      pcr: totalCeOI > 0 ? +(totalPeOI / totalCeOI).toFixed(2) : 0,
      maxCeOIStrike,
      maxPeOIStrike,
      atmIV: getNum(ce, "ce_iv", "iv", "IV", "impliedVolatility"),
      atmCeDelta: getNum(ceG, "ce_delta", "delta", "Delta"),
      atmCeGamma: getNum(ceG, "ce_gamma", "gamma", "Gamma"),
      atmCeTheta: getNum(ceG, "ce_theta", "theta", "Theta"),
      atmCeVega: getNum(ceG, "ce_vega", "vega", "Vega"),
      atmPeDelta: getNum(peG, "pe_delta", "delta", "Delta"),
      atmPeGamma: getNum(peG, "pe_gamma", "gamma", "Gamma"),
      atmPeTheta: getNum(peG, "pe_theta", "theta", "Theta"),
      atmPeVega: getNum(peG, "pe_vega", "vega", "Vega"),
      strikes: chains.length,
    };
  } catch {
    return null;
  }
}

// Get nearest expiry from Dhan
async function fetchNearestExpiry(
  underlyingScrip: string,
  underlyingSeg: string,
  token: string,
  clientId: string
): Promise<string | null> {
  const res = await dhanDataRequest("/optionchain/expirylist", {
    UnderlyingScrip: Number(underlyingScrip),
    UnderlyingSeg: underlyingSeg,
  }, token, clientId);

  if (!res.ok || !res.data) return null;

  const data = res.data as Record<string, unknown>;
  const expiries = (data.data || data.expiryList || data) as string[];
  if (!Array.isArray(expiries) || expiries.length === 0) return null;

  // Return nearest future expiry
  const today = new Date().toISOString().split("T")[0];
  const future = expiries.filter(e => e >= today).sort();
  return future[0] || expiries[0] || null;
}

// ── Signal type ──
interface Signal {
  name: string;
  instrument: string;
  type: "CE" | "PE";
  strike: number;
  score: number;
  direction: "LONG" | "SHORT";
  reason: string;
  layers: {
    statArb: number;
    meanRev: number;
    momentum: number;
    volArb: number;
    flow: number;
    oiGreeks: number;
  };
  price: number;
  changePct: number;
  rsi: number;
  lotSize: number;
  estimatedPremium: number;
  // OI + Greeks enrichment
  oi?: {
    pcr: number;
    totalCeOI: number;
    totalPeOI: number;
    maxCeOIStrike: number;
    maxPeOIStrike: number;
    atmIV: number;
    atmDelta: number;
    atmTheta: number;
  };
  dhanSecurityId?: string;
}

// ══════════════════════════════════════════════════════════════════════
// MAIN SCANNER — All 209 F&O Stocks via Dhan
// ══════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action") || "scan";
  const autoExecute = req.nextUrl.searchParams.get("auto") === "true";
  const forceYahoo = req.nextUrl.searchParams.get("source") === "yahoo";

  if (action !== "scan") return NextResponse.json({ actions: ["scan"] });

  try {
    const creds = forceYahoo ? null : await getDhanCredentials();
    const useDhan = !!creds;
    const now = Date.now();

    // ══════════════════════════════════════════════════════════════════
    // PHASE 1: Fetch quotes for ALL 209 F&O stocks
    // ══════════════════════════════════════════════════════════════════

    const allStockSymbols = Object.keys(FNO_STOCKS);
    const allIndexSymbols = Object.keys(FNO_INDICES);
    const allSymbols = [...allIndexSymbols, ...allStockSymbols];

    // Build unified quote map: symbol → StockQuote
    const quoteMap = new Map<string, StockQuote>();
    let vixPrice = 15;

    // Security ID map: symbol → dhanSecurityId
    const secIdMap = new Map<string, string>();

    if (useDhan) {
      // ── Dhan path: batch LTP + OHLC for all 209 stocks ──
      const scripMap = await getDhanScripMap(new Set(allSymbols));

      // Build security ID arrays per segment
      const eqSecIds: string[] = [];
      const idxSecIds: string[] = [];

      for (const sym of allSymbols) {
        const scrip = scripMap.get(sym);
        if (scrip) {
          secIdMap.set(sym, scrip.securityId);
          if (scrip.segment === "I" || scrip.instrumentName === "INDEX") {
            idxSecIds.push(scrip.securityId);
          } else {
            eqSecIds.push(scrip.securityId);
          }
        }
      }

      // Parallel: LTP + OHLC for equities + indices
      const [eqLTP, eqOHLC, idxLTP, idxOHLC] = await Promise.all([
        fetchDhanLTP(eqSecIds, creds!.token, creds!.clientId, "NSE_EQ"),
        fetchDhanOHLC(eqSecIds, creds!.token, creds!.clientId, "NSE_EQ"),
        idxSecIds.length > 0 ? fetchDhanLTP(idxSecIds, creds!.token, creds!.clientId, "IDX_I") : Promise.resolve({}),
        idxSecIds.length > 0 ? fetchDhanOHLC(idxSecIds, creds!.token, creds!.clientId, "IDX_I") : Promise.resolve({}),
      ]);

      // Merge into quoteMap
      const allLTP: Record<string, { ltp: number; oi?: number }> = { ...eqLTP, ...idxLTP };
      const allOHLC: Record<string, { open: number; high: number; low: number; close: number; volume: number; prevClose: number }> = { ...eqOHLC, ...idxOHLC };

      for (const sym of allSymbols) {
        const secId = secIdMap.get(sym);
        if (!secId) continue;

        const ltp = allLTP[secId];
        const ohlc = allOHLC[secId];
        if (!ltp && !ohlc) continue;

        const price = ltp?.ltp || ohlc?.close || 0;
        const prevClose = ohlc?.prevClose || price;
        const change = price - prevClose;
        const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;

        quoteMap.set(sym, {
          price,
          change,
          changePct,
          high: ohlc?.high || price,
          low: ohlc?.low || price,
          prevClose,
          volume: ohlc?.volume || 0,
          avgVolume: 1, // Dhan doesn't give avg volume in OHLC, will estimate
          oi: ltp?.oi,
        });
      }

      // VIX — try India VIX scrip
      const vixScrip = scripMap.get("INDIA VIX") || scripMap.get("INDIAVIX");
      if (vixScrip) {
        const vixRes = await fetchDhanLTP([vixScrip.securityId], creds!.token, creds!.clientId, "IDX_I");
        const vixData = vixRes[vixScrip.securityId];
        if (vixData?.ltp) vixPrice = vixData.ltp;
      }
    }

    // ── Yahoo fallback (if Dhan returned < 20 quotes) ──
    if (quoteMap.size < 20) {
      const yahooSymbols = [
        ...Object.values(FNO_INDICES).map(i => i.yahoo),
        ...Object.values(FNO_STOCKS).map(s => s.yahoo),
        "%5EINDIAVIX",
      ];

      // Yahoo can handle ~200 symbols per call
      const YAHOO_BATCH = 200;
      for (let i = 0; i < yahooSymbols.length; i += YAHOO_BATCH) {
        const batch = yahooSymbols.slice(i, i + YAHOO_BATCH);
        const quotes = await fetchYahoo(batch);

        for (const sym of allSymbols) {
          if (quoteMap.has(sym)) continue;

          const info = FNO_STOCKS[sym] || FNO_INDICES[sym];
          if (!info) continue;

          const yq = quotes[info.yahoo] || quotes[info.yahoo.replace("%5E", "^")];
          if (yq) {
            quoteMap.set(sym, {
              price: yq.price,
              change: yq.change,
              changePct: yq.changePct,
              high: yq.high,
              low: yq.low,
              prevClose: yq.prevClose,
              volume: yq.volume,
              avgVolume: yq.avgVolume,
            });
          }
        }

        // VIX from Yahoo
        const vixQ = quotes["%5EINDIAVIX"] || quotes["^INDIAVIX"];
        if (vixQ?.price) vixPrice = vixQ.price;
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // PHASE 2: Identify top movers → fetch intraday + option chain
    // ══════════════════════════════════════════════════════════════════

    const sortedMovers = allSymbols
      .map(sym => {
        const q = quoteMap.get(sym);
        const isIndex = !!FNO_INDICES[sym];
        return { sym, quote: q, absChange: Math.abs(q?.changePct || 0), isIndex };
      })
      .filter(x => x.quote && x.quote.price > 0)
      .sort((a, b) => b.absChange - a.absChange);

    // Top 20 stocks + all indices (max ~24 symbols for deep analysis)
    const toDeepScan = [
      ...sortedMovers.filter(x => x.isIndex),
      ...sortedMovers.filter(x => !x.isIndex).slice(0, 20),
    ];

    // ── Parallel: intraday candles for top movers ──
    const intradayResults: Map<string, { closes: number[]; highs: number[]; lows: number[]; volumes: number[] }> = new Map();

    if (useDhan) {
      const intradayPromises = toDeepScan.map(async (x) => {
        const secId = secIdMap.get(x.sym);
        if (!secId) return;
        const segment = x.isIndex ? "IDX_I" : "NSE_EQ";
        const candles = await fetchDhanIntraday(secId, creds!.token, creds!.clientId, "15", segment);
        intradayResults.set(x.sym, candles);
      });
      await Promise.allSettled(intradayPromises);
    } else {
      // Yahoo fallback for candles
      const candlePromises = toDeepScan.slice(0, 10).map(async (x) => {
        const info = FNO_STOCKS[x.sym] || FNO_INDICES[x.sym];
        if (!info) return;
        try {
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${info.yahoo}?interval=15m&range=5d`;
          const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
          if (!res.ok) return;
          const data = await res.json();
          const q = data?.chart?.result?.[0]?.indicators?.quote?.[0];
          if (q) {
            intradayResults.set(x.sym, {
              closes: (q.close || []).filter((c: number | null) => c !== null),
              highs: (q.high || []).filter((h: number | null) => h !== null),
              lows: (q.low || []).filter((l: number | null) => l !== null),
              volumes: (q.volume || []).filter((v: number | null) => v !== null),
            });
          }
        } catch { /* */ }
      });
      await Promise.allSettled(candlePromises);
    }

    // ── Option Chain: OI + Greeks for top 15 movers (Dhan only) ──
    const optionChainMap = new Map<string, OptionChainData>();

    if (useDhan) {
      // Get nearest expiry (use NIFTY as reference)
      const niftySecId = secIdMap.get("NIFTY") || "13";
      const nearestExpiry = await fetchNearestExpiry(niftySecId, "IDX_I", creds!.token, creds!.clientId);

      if (nearestExpiry) {
        const ocPromises = toDeepScan.slice(0, 15).map(async (x) => {
          const secId = secIdMap.get(x.sym);
          if (!secId) return;
          const seg = x.isIndex ? "IDX_I" : "NSE_EQ";
          const oc = await fetchDhanOptionChain(secId, seg, nearestExpiry, creds!.token, creds!.clientId);
          if (oc) optionChainMap.set(x.sym, oc);
        });
        await Promise.allSettled(ocPromises);
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // PHASE 3: 6-Layer Scoring Engine
    // ══════════════════════════════════════════════════════════════════

    const allSignals: Signal[] = [];

    for (const x of toDeepScan) {
      const { sym, quote } = x;
      if (!quote || !quote.price) continue;

      const info = FNO_STOCKS[sym] || FNO_INDICES[sym];
      if (!info) continue;

      const candles = intradayResults.get(sym);
      const closes = candles?.closes || [];
      const highs = candles?.highs || [];
      const lows = candles?.lows || [];

      const rsi = calcRSI(closes);
      const sma20 = calcSMA(closes, 20);
      const sma50 = calcSMA(closes, 50);
      const atr = calcATR(highs, lows, closes);
      const zScore = calcZScore(closes);
      const realizedVol = calcRealizedVol(closes);
      const price = quote.price;
      const changePct = quote.changePct;
      const volRatio = quote.avgVolume > 1 ? quote.volume / quote.avgVolume : 1;
      const oc = optionChainMap.get(sym);

      const layers = {
        statArb: 0.5,
        meanRev: 0.4,
        momentum: 0.3,
        volArb: 0.5,
        flow: 0.5,
        oiGreeks: 0.5,
      };
      const reasons: string[] = [];
      let direction: "LONG" | "SHORT" = "LONG";

      // ── Layer 1 (10%): Stat Arb — IV vs Realized Vol (ported from crypto algo) ──
      if (oc && oc.atmIV > 0 && realizedVol > 0) {
        const ivRatio = oc.atmIV / realizedVol;
        if (ivRatio < 0.8) {
          layers.statArb = 0.85;
          reasons.push(`IV cheap (${oc.atmIV.toFixed(0)}% vs ${realizedVol.toFixed(0)}% realized)`);
        } else if (ivRatio > 1.3) {
          layers.statArb = 0.3;
          reasons.push(`IV expensive (${oc.atmIV.toFixed(0)}% vs ${realizedVol.toFixed(0)}% realized)`);
        } else {
          layers.statArb = 0.55;
        }
      } else {
        // VIX proxy when no option chain
        if (vixPrice > 22) { layers.statArb = 0.75; reasons.push(`VIX high (${vixPrice.toFixed(0)})`); }
        else if (vixPrice < 13) { layers.statArb = 0.75; reasons.push(`VIX low (${vixPrice.toFixed(0)})`); }
      }

      // ── Layer 2 (25%): Mean Reversion — RSI ──
      if (rsi < 25) { layers.meanRev = 0.9; direction = "LONG"; reasons.push(`RSI oversold (${rsi.toFixed(0)})`); }
      else if (rsi > 75) { layers.meanRev = 0.9; direction = "SHORT"; reasons.push(`RSI overbought (${rsi.toFixed(0)})`); }
      else if (rsi < 35) { layers.meanRev = 0.65; direction = "LONG"; reasons.push(`RSI low (${rsi.toFixed(0)})`); }
      else if (rsi > 65) { layers.meanRev = 0.65; direction = "SHORT"; reasons.push(`RSI high (${rsi.toFixed(0)})`); }

      // Z-Score extreme boost (from crypto algo)
      if (Math.abs(zScore) > 2) {
        layers.meanRev = Math.min(layers.meanRev + 0.2, 1);
        reasons.push(`Z-score extreme (${zScore.toFixed(1)}σ)`);
      } else if (Math.abs(zScore) > 1.5) {
        layers.meanRev = Math.min(layers.meanRev + 0.1, 1);
      }

      // ── Layer 3 (20%): Momentum ──
      if (price > sma20 && changePct > 1) {
        layers.momentum = 0.85; direction = "LONG";
        reasons.push(`Bull (+${changePct.toFixed(1)}%, >SMA20)`);
      } else if (price < sma20 && changePct < -1) {
        layers.momentum = 0.85; direction = "SHORT";
        reasons.push(`Bear (${changePct.toFixed(1)}%, <SMA20)`);
      } else if (Math.abs(changePct) > 2) {
        layers.momentum = 0.7;
        direction = changePct > 0 ? "LONG" : "SHORT";
        reasons.push(`Big move (${changePct > 0 ? "+" : ""}${changePct.toFixed(1)}%)`);
      }

      // SMA crossover
      if (sma20 > 0 && sma50 > 0) {
        if (sma20 > sma50 && price > sma20) {
          layers.momentum = Math.min(layers.momentum + 0.1, 1);
          reasons.push("SMA20>50 bullish");
        } else if (sma20 < sma50 && price < sma20) {
          layers.momentum = Math.min(layers.momentum + 0.1, 1);
        }
      }

      // PDC reaction
      if (quote.prevClose > 0) {
        const pdcDist = Math.abs(price - quote.prevClose) / price * 100;
        if (pdcDist < 0.3 && Math.abs(changePct) < 0.5) {
          layers.momentum = Math.min(layers.momentum + 0.15, 1);
          reasons.push("Near PDC");
        }
      }

      // ── Layer 4 (15%): Vol Arb — IV analysis ──
      if (oc && oc.atmIV > 0) {
        // Use actual IV from option chain
        if (oc.atmIV > 30) {
          layers.volArb = 0.8; reasons.push(`IV high (${oc.atmIV.toFixed(1)}%)`);
        } else if (oc.atmIV < 12) {
          layers.volArb = 0.8; reasons.push(`IV low (${oc.atmIV.toFixed(1)}%)`);
        } else if (oc.atmIV > 20) {
          layers.volArb = 0.65; reasons.push(`IV elevated (${oc.atmIV.toFixed(1)}%)`);
        }
      } else {
        // VIX proxy when no option chain
        if (vixPrice > 20) { layers.volArb = 0.7; reasons.push("Premium rich (VIX>20)"); }
        else if (vixPrice < 13) { layers.volArb = 0.8; reasons.push("Premium cheap (VIX<13)"); }
      }

      // ── Layer 5 (15%): Flow — volume + expiry ──
      if (volRatio > 1.5) {
        layers.flow = 0.75; reasons.push(`Vol spike (${volRatio.toFixed(1)}x)`);
      } else if (volRatio > 1.2) {
        layers.flow = 0.6;
      }

      const dow = new Date().getDay();
      if (dow === 4) {
        layers.flow = Math.min(layers.flow + 0.1, 1);
        reasons.push("Expiry day");
      }

      // ── Layer 6 (15%): OI + Greeks Analysis (Dhan option chain) ──
      if (oc) {
        // PCR analysis
        if (oc.pcr > 1.5) {
          layers.oiGreeks = 0.8;
          direction = "LONG";
          reasons.push(`PCR bullish (${oc.pcr.toFixed(2)})`);
        } else if (oc.pcr < 0.5) {
          layers.oiGreeks = 0.8;
          direction = "SHORT";
          reasons.push(`PCR bearish (${oc.pcr.toFixed(2)})`);
        } else if (oc.pcr > 1.2) {
          layers.oiGreeks = 0.65;
          reasons.push(`PCR mildly bullish (${oc.pcr.toFixed(2)})`);
        } else if (oc.pcr < 0.7) {
          layers.oiGreeks = 0.65;
          reasons.push(`PCR mildly bearish (${oc.pcr.toFixed(2)})`);
        }

        // Max OI strike = key support/resistance
        if (oc.maxPeOIStrike > 0 && price < oc.maxPeOIStrike * 1.01) {
          layers.oiGreeks = Math.min(layers.oiGreeks + 0.1, 1);
          reasons.push(`Near PE max OI ${oc.maxPeOIStrike} (support)`);
        }
        if (oc.maxCeOIStrike > 0 && price > oc.maxCeOIStrike * 0.99) {
          layers.oiGreeks = Math.min(layers.oiGreeks + 0.1, 1);
          reasons.push(`Near CE max OI ${oc.maxCeOIStrike} (resistance)`);
        }

        // Delta confirmation — high absolute delta = strong directional bet
        const absAtmDelta = Math.abs(oc.atmCeDelta);
        if (absAtmDelta > 0.55) {
          layers.oiGreeks = Math.min(layers.oiGreeks + 0.05, 1);
        }

        // Theta decay opportunity — high theta = premium selling opportunity
        if (Math.abs(oc.atmCeTheta) > 10) {
          reasons.push(`High theta decay (₹${Math.abs(oc.atmCeTheta).toFixed(0)}/day)`);
        }
      }

      // ── Composite Score (6 layers) ──
      const score =
        layers.statArb * 0.10 +
        layers.meanRev * 0.25 +
        layers.momentum * 0.20 +
        layers.volArb * 0.15 +
        layers.flow * 0.15 +
        layers.oiGreeks * 0.15;

      if (score >= 0.55) {
        const optType = direction === "LONG" ? "CE" as const : "PE" as const;
        const step = (info as { step?: number }).step || Math.pow(10, Math.floor(Math.log10(price / 20)));
        const atm = Math.round(price / step) * step;

        // Better premium estimate using ATR or option chain IV
        let estimatedPremium: number;
        if (oc && oc.atmIV > 0) {
          // Black-Scholes rough: premium ≈ S × IV% × sqrt(T) / sqrt(252)
          const daysToExpiry = dow === 4 ? 0.5 : (4 - dow + 7) % 7;
          estimatedPremium = price * (oc.atmIV / 100) * Math.sqrt(Math.max(daysToExpiry, 1) / 252);
        } else {
          const range = quote.high - quote.low;
          estimatedPremium = Math.max(atr > 0 ? atr * 0.5 : range * 0.4, price * 0.005);
        }

        const signal: Signal = {
          name: sym,
          instrument: `${sym}-${atm}-${optType}`,
          type: optType,
          strike: atm,
          score,
          direction,
          reason: reasons.join(" | "),
          layers,
          price,
          changePct,
          rsi,
          lotSize: info.lot,
          estimatedPremium: Math.round(estimatedPremium * 100) / 100,
          dhanSecurityId: secIdMap.get(sym),
        };

        // Attach OI data
        if (oc) {
          signal.oi = {
            pcr: oc.pcr,
            totalCeOI: oc.totalCeOI,
            totalPeOI: oc.totalPeOI,
            maxCeOIStrike: oc.maxCeOIStrike,
            maxPeOIStrike: oc.maxPeOIStrike,
            atmIV: oc.atmIV,
            atmDelta: direction === "LONG" ? oc.atmCeDelta : oc.atmPeDelta,
            atmTheta: direction === "LONG" ? oc.atmCeTheta : oc.atmPeTheta,
          };
        }

        allSignals.push(signal);
      }
    }

    // Sort by score
    allSignals.sort((a, b) => b.score - a.score);

    // ── Deduplicate ──
    const newSignals = allSignals.filter(s => {
      const last = alertedSignals.get(s.instrument) || 0;
      return now - last > ALERT_COOLDOWN;
    });

    // ══════════════════════════════════════════════════════════════════
    // PHASE 4: Build response
    // ══════════════════════════════════════════════════════════════════

    const topMovers = sortedMovers.slice(0, 10).map(x => ({
      name: x.sym,
      price: x.quote?.price,
      changePct: x.quote?.changePct,
      volume: x.quote?.volume,
      oi: x.quote?.oi,
      rsi: intradayResults.has(x.sym) ? calcRSI(intradayResults.get(x.sym)!.closes) : undefined,
    }));

    const response = {
      source: useDhan ? "dhan" : "yahoo",
      instruments: topMovers,
      vix: vixPrice,
      marketHours: isMarketHours(),
      totalScanned: quoteMap.size,
      totalFnOStocks: allStockSymbols.length,
      totalIndices: allIndexSymbols.length,
      deepScanned: toDeepScan.length,
      optionChainsLoaded: optionChainMap.size,
      signals: allSignals.slice(0, 10).map(s => ({
        ...s,
        layers: Object.fromEntries(Object.entries(s.layers).map(([k, v]) => [k, +v.toFixed(2)])),
        score: +s.score.toFixed(3),
      })),
      newSignals: newSignals.slice(0, 5).map(s => s.instrument),
      signalsAbove60: allSignals.filter(s => s.score >= 0.6).length,
      signalsAbove70: allSignals.filter(s => s.score >= 0.7).length,
      timestamp: now,
    };

    // ══════════════════════════════════════════════════════════════════
    // PHASE 5: Telegram alerts with OI + Greeks enrichment
    // ══════════════════════════════════════════════════════════════════

    if (newSignals.filter(s => s.score >= 0.6).length > 0) {
      const top3 = newSignals.filter(s => s.score >= 0.6).slice(0, 3);
      const lines = [
        `🇮🇳 *India Scanner* ${useDhan ? "(Dhan Live)" : "(Yahoo)"}`,
        `📊 Scanned: ${quoteMap.size} F&O stocks | VIX: ${vixPrice.toFixed(1)} | ${isMarketHours() ? "OPEN" : "CLOSED"}\n`,
      ];

      for (const s of top3) {
        const emoji = s.direction === "LONG" ? "🟢" : "🔴";
        lines.push(`${emoji} *${s.instrument}*`);
        lines.push(`  Score: ${(s.score * 100).toFixed(0)}% | ₹${s.price.toLocaleString()} (${s.changePct >= 0 ? "+" : ""}${s.changePct.toFixed(1)}%)`);
        lines.push(`  RSI: ${s.rsi.toFixed(0)} | Lot: ${s.lotSize} | Premium: ~₹${s.estimatedPremium}`);

        // OI + Greeks line
        if (s.oi) {
          lines.push(`  📈 PCR: ${s.oi.pcr.toFixed(2)} | IV: ${s.oi.atmIV.toFixed(1)}% | Δ: ${s.oi.atmDelta.toFixed(2)} | Θ: ${s.oi.atmTheta.toFixed(1)}`);
          lines.push(`  🎯 Support: ${s.oi.maxPeOIStrike} (PE OI) | Resistance: ${s.oi.maxCeOIStrike} (CE OI)`);
        }

        lines.push(`  _${s.reason}_\n`);
        alertedSignals.set(s.instrument, now);
      }

      // Top movers context
      lines.push(`📊 *Top Movers:*`);
      for (const m of topMovers.slice(0, 5)) {
        const emoji = (m.changePct || 0) >= 0 ? "🟢" : "🔴";
        lines.push(`  ${emoji} ${m.name}: ₹${m.price?.toLocaleString()} (${(m.changePct || 0) >= 0 ? "+" : ""}${m.changePct?.toFixed(1)}%)`);
      }

      await sendTg(lines.join("\n"));

      // ── Auto-execute via Dhan Super Orders (ported from crypto algo) ──
      if (autoExecute && isMarketHours() && useDhan && top3.length > 0) {
        // Get available margin
        let availableMargin = 200000; // default ₹2L
        try {
          const fundsRes = await dhanGetRequest("/fundlimit", creds!.token);
          if (fundsRes.ok) {
            const funds = fundsRes.data as Record<string, unknown>;
            availableMargin = Number(funds.availabelBalance || funds.availableBalance || funds.sodLimit || 200000);
          }
        } catch { /* use default */ }

        // Check open positions — max 5 trades/day
        let openPositions = 0;
        try {
          const posRes = await dhanGetRequest("/positions", creds!.token);
          if (posRes.ok && Array.isArray(posRes.data)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            openPositions = (posRes.data as any[]).filter((p: any) => p.netQty && p.netQty !== 0).length;
          }
        } catch { /* */ }

        if (openPositions < 5) {
          // Pick best signal with score >= 70% (A+ setups only)
          const execCandidates = top3.filter(s =>
            s.score >= 0.70 && s.dhanSecurityId && s.estimatedPremium > 0
          );

          if (execCandidates.length > 0) {
            const best = execCandidates[0];

            // Half-Kelly position sizing: risk max 20% of available margin
            const maxRisk = availableMargin * 0.20;
            const premiumPerLot = best.estimatedPremium * best.lotSize;
            const lots = Math.max(1, Math.floor(maxRisk / premiumPerLot));
            const totalQty = lots * best.lotSize;
            const cost = lots * premiumPerLot;

            if (cost <= maxRisk && cost > 0) {
              // Place Dhan Super Order: entry + target (3x) + SL (70% loss)
              const entryPrice = best.estimatedPremium;
              const targetPrice = +(entryPrice * 3).toFixed(2);    // 3x target
              const slPrice = +(entryPrice * 0.3).toFixed(2);      // 70% max loss

              try {
                const orderRes = await dhanDataRequest("/super/orders", {
                  dhanClientId: creds!.clientId,
                  correlationId: `scan_${Date.now()}`,
                  transactionType: "BUY",
                  exchangeSegment: "NSE_FNO",
                  productType: "INTRADAY",
                  orderType: "MARKET",
                  securityId: best.dhanSecurityId,
                  quantity: totalQty,
                  price: 0,
                  targetPrice,
                  stopLossPrice: slPrice,
                  trailingJump: +(entryPrice * 0.1).toFixed(2), // 10% trailing
                }, creds!.token, creds!.clientId);

                const execLines = [
                  `⚡ *AUTO-TRADE EXECUTED*`,
                  ``,
                  `📊 *${best.instrument}*`,
                  `🎯 Score: ${(best.score * 100).toFixed(0)}% | ${best.direction}`,
                  `📦 ${lots} lot(s) × ${best.lotSize} = ${totalQty} qty`,
                  `💰 Est Cost: ₹${cost.toFixed(0)} (${((cost / availableMargin) * 100).toFixed(0)}% of margin)`,
                  `🎯 TP: ₹${targetPrice} (3x) | SL: ₹${slPrice} (30%)`,
                ];

                if (best.oi) {
                  execLines.push(`📈 PCR: ${best.oi.pcr.toFixed(2)} | IV: ${best.oi.atmIV.toFixed(1)}% | Δ: ${best.oi.atmDelta.toFixed(2)}`);
                }

                execLines.push(``, `📋 *Layers:*`);
                execLines.push(`StatArb=${(best.layers.statArb * 100).toFixed(0)}% MeanRev=${(best.layers.meanRev * 100).toFixed(0)}% Mom=${(best.layers.momentum * 100).toFixed(0)}% VolArb=${(best.layers.volArb * 100).toFixed(0)}% Flow=${(best.layers.flow * 100).toFixed(0)}% OI=${(best.layers.oiGreeks * 100).toFixed(0)}%`);
                execLines.push(`_${best.reason}_`);

                if (orderRes.ok) {
                  execLines.push(``, `✅ Order placed! SecID: ${best.dhanSecurityId}`);
                } else {
                  execLines.push(``, `❌ Order failed: ${JSON.stringify(orderRes.data).slice(0, 100)}`);
                }

                await sendTg(execLines.join("\n"));

                // Add to response
                (response as Record<string, unknown>).executedTrade = {
                  symbol: best.instrument,
                  securityId: best.dhanSecurityId,
                  qty: totalQty,
                  lots,
                  entryPrice,
                  targetPrice,
                  slPrice,
                  score: best.score,
                  orderResult: orderRes.data,
                  success: orderRes.ok,
                };
              } catch (execErr) {
                await sendTg(`❌ *Auto-trade error:* ${String(execErr).slice(0, 200)}`);
              }
            }
          }
        } else {
          // Already at max positions
          await sendTg(`⚠️ Max positions (${openPositions}/5) — skipping auto-execute`);
        }
      } else if (autoExecute && isMarketHours() && !useDhan && top3.length > 0) {
        // Dhan not connected — send signal only
        const best = top3[0];
        await sendTg(`⚡ *Signal (no Dhan):* ${best.instrument}\nScore: ${(best.score * 100).toFixed(0)}% | ${best.direction}\nConnect Dhan for auto-execution!`);
      }
    }

    return NextResponse.json(response);

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
