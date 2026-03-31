// Dhan Scrip Master Cache — fetches once, caches 24h
// Maps NSE F&O stock symbols → Dhan security IDs for market data APIs

const SCRIP_MASTER_URL = "https://images.dhan.co/api-data/api-scrip-master.csv";

export interface DhanScrip {
  securityId: string;
  tradingSymbol: string;
  segment: string;       // "E" = equity, "D" = derivatives
  instrumentName: string; // "EQUITY", "OPTSTK", "FUTIDX", etc.
  lotSize: number;
}

// In-memory cache
let scripMap: Map<string, DhanScrip> | null = null;
let cacheTime = 0;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

// Column indices (resolved dynamically from header row)
interface ColIdx {
  exchange: number;
  segment: number;
  securityId: number;
  instrument: number;
  tradingSymbol: number;
  customSymbol: number;
  lotSize: number;
}

function resolveColumns(header: string): ColIdx | null {
  const cols = header.split(",").map(c => c.trim().toUpperCase());
  const find = (pattern: string) => cols.findIndex(c => c.includes(pattern));

  const exchange = find("EXM_EXCH_ID");
  const segment = find("SEGMENT");
  const securityId = find("SECURITY_ID");
  const instrument = find("INSTRUMENT");
  const tradingSymbol = find("TRADING_SYMBOL");
  const customSymbol = find("CUSTOM_SYMBOL");
  const lotSize = find("LOT_UNITS");

  if (exchange < 0 || securityId < 0) return null;
  return { exchange, segment, securityId, instrument, tradingSymbol, customSymbol, lotSize };
}

export async function getDhanScripMap(targetSymbols?: Set<string>): Promise<Map<string, DhanScrip>> {
  // Return cache if fresh
  if (scripMap && Date.now() - cacheTime < CACHE_TTL) {
    return scripMap;
  }

  const map = new Map<string, DhanScrip>();

  try {
    const res = await fetch(SCRIP_MASTER_URL, {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
    });

    if (!res.ok) throw new Error(`Scrip master fetch failed: ${res.status}`);

    const text = await res.text();
    const lines = text.split("\n");
    if (lines.length < 2) throw new Error("Empty scrip master");

    const idx = resolveColumns(lines[0]);
    if (!idx) throw new Error("Cannot parse scrip master header");

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;

      const cols = line.split(",");
      const exchange = (cols[idx.exchange] || "").trim();
      const segment = (cols[idx.segment] || "").trim();
      const instrument = (cols[idx.instrument] || "").trim();

      // Only NSE equity and index instruments
      if (exchange !== "NSE") continue;
      if (segment !== "E" && segment !== "I") continue;
      if (instrument !== "EQUITY" && instrument !== "INDEX") continue;

      const secId = (cols[idx.securityId] || "").trim();
      const tradingSym = (cols[idx.tradingSymbol] || "").trim();
      const customSym = (cols[idx.customSymbol] || "").trim();
      const lot = parseInt(cols[idx.lotSize] || "1") || 1;

      // Normalize symbol: remove -EQ suffix, trim
      const sym = (customSym || tradingSym).replace(/-EQ$/i, "").trim();

      if (!sym || !secId) continue;

      // If target set provided, only keep matching symbols
      if (targetSymbols && !targetSymbols.has(sym)) continue;

      map.set(sym, {
        securityId: secId,
        tradingSymbol: tradingSym,
        segment,
        instrumentName: instrument,
        lotSize: lot,
      });
    }

    scripMap = map;
    cacheTime = Date.now();
    console.log(`[DhanScripCache] Loaded ${map.size} NSE equity/index scrips`);
  } catch (err) {
    console.error(`[DhanScripCache] Error:`, err);
    // Return partial/stale cache if available
    if (scripMap) return scripMap;
  }

  return map;
}

// Lookup single symbol
export async function getDhanSecurityId(symbol: string): Promise<string | null> {
  const map = await getDhanScripMap();
  return map.get(symbol)?.securityId || null;
}

// Batch lookup: returns { symbol → securityId }
export async function batchLookupSecurityIds(
  symbols: string[]
): Promise<Map<string, string>> {
  const targetSet = new Set(symbols);
  const map = await getDhanScripMap(targetSet);
  const result = new Map<string, string>();
  for (const sym of symbols) {
    const scrip = map.get(sym);
    if (scrip) result.set(sym, scrip.securityId);
  }
  return result;
}

// Clear cache (for testing/refresh)
export function clearScripCache() {
  scripMap = null;
  cacheTime = 0;
}
