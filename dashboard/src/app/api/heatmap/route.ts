import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface HeatmapStock {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  change: number;
  changePct: number;
  marketCap: number;
  volume: number;
}

// Sector mapping for NSE NIFTY 50 stocks
const NSE_SECTORS: Record<string, string> = {
  HDFCBANK: "Banking", ICICIBANK: "Banking", SBIN: "Banking", KOTAKBANK: "Banking", AXISBANK: "Banking", INDUSINDBK: "Banking",
  TCS: "IT", INFY: "IT", HCLTECH: "IT", WIPRO: "IT", TECHM: "IT", LTIM: "IT",
  RELIANCE: "Energy", ONGC: "Energy", NTPC: "Power", POWERGRID: "Power", ADANIGREEN: "Power", TATAPOWER: "Power",
  HINDUNILVR: "FMCG", ITC: "FMCG", NESTLEIND: "FMCG", BRITANNIA: "FMCG", DABUR: "FMCG", MARICO: "FMCG",
  BHARTIARTL: "Telecom",
  LT: "Infrastructure", ADANIENT: "Conglomerate", ADANIPORTS: "Infrastructure",
  BAJFINANCE: "Finance", BAJAJFINSV: "Finance", HDFCLIFE: "Finance", SBILIFE: "Finance",
  SUNPHARMA: "Pharma", DRREDDY: "Pharma", CIPLA: "Pharma", DIVISLAB: "Pharma", APOLLOHOSP: "Healthcare",
  TATAMOTORS: "Auto", MARUTI: "Auto", "M&M": "Auto", BAJAJ_AUTO: "Auto", HEROMOTOCO: "Auto", EICHERMOT: "Auto",
  TATASTEEL: "Metals", JSWSTEEL: "Metals", HINDALCO: "Metals", COALINDIA: "Mining",
  ULTRACEMCO: "Cement", GRASIM: "Cement", SHREECEM: "Cement",
  TITAN: "Consumer", ASIANPAINT: "Consumer",
  BPCL: "Oil & Gas", IOC: "Oil & Gas", GAIL: "Oil & Gas",
};

// US stock list for Yahoo Finance
const US_STOCKS = [
  { symbol: "AAPL", name: "Apple", sector: "Technology", mcap: 3000000 },
  { symbol: "MSFT", name: "Microsoft", sector: "Technology", mcap: 2800000 },
  { symbol: "NVDA", name: "NVIDIA", sector: "Technology", mcap: 2500000 },
  { symbol: "GOOGL", name: "Google", sector: "Technology", mcap: 2100000 },
  { symbol: "AMZN", name: "Amazon", sector: "Consumer", mcap: 1900000 },
  { symbol: "META", name: "Meta", sector: "Technology", mcap: 1300000 },
  { symbol: "TSLA", name: "Tesla", sector: "Auto", mcap: 800000 },
  { symbol: "BRK-B", name: "Berkshire", sector: "Finance", mcap: 900000 },
  { symbol: "JPM", name: "JPMorgan", sector: "Banking", mcap: 550000 },
  { symbol: "V", name: "Visa", sector: "Finance", mcap: 530000 },
  { symbol: "UNH", name: "UnitedHealth", sector: "Healthcare", mcap: 480000 },
  { symbol: "XOM", name: "Exxon", sector: "Energy", mcap: 460000 },
  { symbol: "JNJ", name: "J&J", sector: "Healthcare", mcap: 390000 },
  { symbol: "WMT", name: "Walmart", sector: "Retail", mcap: 450000 },
  { symbol: "MA", name: "Mastercard", sector: "Finance", mcap: 400000 },
  { symbol: "PG", name: "P&G", sector: "Consumer", mcap: 370000 },
  { symbol: "HD", name: "Home Depot", sector: "Retail", mcap: 350000 },
  { symbol: "CVX", name: "Chevron", sector: "Energy", mcap: 300000 },
  { symbol: "AVGO", name: "Broadcom", sector: "Technology", mcap: 600000 },
  { symbol: "NFLX", name: "Netflix", sector: "Media", mcap: 280000 },
  { symbol: "AMD", name: "AMD", sector: "Technology", mcap: 250000 },
  { symbol: "KO", name: "Coca-Cola", sector: "Consumer", mcap: 260000 },
  { symbol: "BAC", name: "BofA", sector: "Banking", mcap: 270000 },
  { symbol: "ABBV", name: "AbbVie", sector: "Pharma", mcap: 280000 },
  { symbol: "PEP", name: "PepsiCo", sector: "Consumer", mcap: 240000 },
];

const CRYPTO_STOCKS = [
  { symbol: "BTC-USD", name: "Bitcoin", sector: "L1", mcap: 1300000 },
  { symbol: "ETH-USD", name: "Ethereum", sector: "L1", mcap: 400000 },
  { symbol: "BNB-USD", name: "BNB", sector: "L1", mcap: 90000 },
  { symbol: "SOL-USD", name: "Solana", sector: "L1", mcap: 70000 },
  { symbol: "XRP-USD", name: "XRP", sector: "Payments", mcap: 65000 },
  { symbol: "ADA-USD", name: "Cardano", sector: "L1", mcap: 20000 },
  { symbol: "DOGE-USD", name: "Dogecoin", sector: "Meme", mcap: 18000 },
  { symbol: "AVAX-USD", name: "Avalanche", sector: "L1", mcap: 14000 },
  { symbol: "DOT-USD", name: "Polkadot", sector: "L1", mcap: 10000 },
  { symbol: "LINK-USD", name: "Chainlink", sector: "Oracle", mcap: 9000 },
  { symbol: "MATIC-USD", name: "Polygon", sector: "L2", mcap: 8000 },
  { symbol: "ATOM-USD", name: "Cosmos", sector: "L1", mcap: 4000 },
  { symbol: "UNI-USD", name: "Uniswap", sector: "DeFi", mcap: 7000 },
  { symbol: "AAVE-USD", name: "Aave", sector: "DeFi", mcap: 3000 },
  { symbol: "SHIB-USD", name: "Shiba Inu", sector: "Meme", mcap: 6000 },
  { symbol: "LTC-USD", name: "Litecoin", sector: "Payments", mcap: 5000 },
  { symbol: "NEAR-USD", name: "NEAR", sector: "L1", mcap: 4500 },
  { symbol: "APT-USD", name: "Aptos", sector: "L1", mcap: 3500 },
];

const COMMODITY_STOCKS = [
  { symbol: "CL=F", name: "WTI Crude Oil", sector: "Energy", mcap: 500000 },
  { symbol: "BZ=F", name: "Brent Crude", sector: "Energy", mcap: 450000 },
  { symbol: "NG=F", name: "Natural Gas", sector: "Energy", mcap: 200000 },
  { symbol: "GC=F", name: "Gold", sector: "Precious Metals", mcap: 400000 },
  { symbol: "SI=F", name: "Silver", sector: "Precious Metals", mcap: 150000 },
  { symbol: "PL=F", name: "Platinum", sector: "Precious Metals", mcap: 50000 },
  { symbol: "HG=F", name: "Copper", sector: "Industrial Metals", mcap: 180000 },
  { symbol: "ZC=F", name: "Corn", sector: "Agriculture", mcap: 100000 },
  { symbol: "ZW=F", name: "Wheat", sector: "Agriculture", mcap: 90000 },
  { symbol: "ZS=F", name: "Soybean", sector: "Agriculture", mcap: 85000 },
  { symbol: "KC=F", name: "Coffee", sector: "Agriculture", mcap: 70000 },
  { symbol: "CT=F", name: "Cotton", sector: "Agriculture", mcap: 40000 },
  { symbol: "PA=F", name: "Palladium", sector: "Precious Metals", mcap: 30000 },
  { symbol: "RB=F", name: "Gasoline", sector: "Energy", mcap: 120000 },
  { symbol: "HO=F", name: "Heating Oil", sector: "Energy", mcap: 110000 },
];

// ─── NSE India: Fetch directly from NSE API ───────────────────

async function fetchNSEData(): Promise<HeatmapStock[]> {
  try {
    // NSE requires specific headers to not block requests
    const headers = {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json",
      "Accept-Language": "en-US,en;q=0.9",
      "Referer": "https://www.nseindia.com/market-data/live-equity-market",
    };

    // First hit NSE homepage to get cookies
    const homeRes = await fetch("https://www.nseindia.com", {
      headers,
      cache: "no-store",
      redirect: "follow",
    });
    const cookies = homeRes.headers.getSetCookie?.()?.join("; ") || "";

    // Now fetch NIFTY 50 live data
    const niftyRes = await fetch("https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%2050", {
      headers: { ...headers, Cookie: cookies },
      cache: "no-store",
    });

    if (!niftyRes.ok) throw new Error(`NSE returned ${niftyRes.status}`);

    const data = await niftyRes.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stocks: HeatmapStock[] = (data.data || [])
      .filter((s: any) => s.symbol !== "NIFTY 50") // Remove index row
      .map((s: any) => ({
        symbol: s.symbol,
        name: s.symbol,
        sector: NSE_SECTORS[s.symbol] || "Other",
        price: s.lastPrice || 0,
        change: s.change || 0,
        changePct: s.pChange || 0,
        marketCap: (s.ffmc || s.totalTradedValue || 0) * 10000000,
        volume: s.totalTradedVolume || 0,
      }));

    return stocks;
  } catch (e) {
    console.error("NSE fetch failed:", e);
    // Fallback to Yahoo Finance for Indian stocks
    return fetchYahooIndiaData();
  }
}

async function fetchYahooIndiaData(): Promise<HeatmapStock[]> {
  const symbols = Object.keys(NSE_SECTORS).slice(0, 30).map(s => `${s}.NS`).join(",");
  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}`, {
      headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data?.quoteResponse?.result || []).map((q: any) => {
      const sym = (q.symbol || "").replace(".NS", "");
      return {
        symbol: sym,
        name: sym,
        sector: NSE_SECTORS[sym] || "Other",
        price: q.regularMarketPrice || 0,
        change: q.regularMarketChange || 0,
        changePct: q.regularMarketChangePercent || 0,
        marketCap: q.marketCap || 0,
        volume: q.regularMarketVolume || 0,
      };
    });
  } catch { return []; }
}

// ─── US/Crypto: Yahoo Finance ─────────────────────────────────

async function fetchYahooData(stocks: typeof US_STOCKS): Promise<HeatmapStock[]> {
  // Try v7 first, then fall back to v8 chart endpoint (which works on Vercel)
  const symbols = stocks.map(s => s.symbol).join(",");
  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}`, {
      headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      const results = data?.quoteResponse?.result || [];
      if (results.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return results.map((q: any) => {
          const meta = stocks.find(s => s.symbol === q.symbol);
          return {
            symbol: (q.symbol || "").replace("-USD", "").replace("=F", ""),
            name: meta?.name || q.shortName || q.symbol,
            sector: meta?.sector || "Other",
            price: q.regularMarketPrice || 0,
            change: q.regularMarketChange || 0,
            changePct: q.regularMarketChangePercent || 0,
            marketCap: q.marketCap || (meta?.mcap || 0) * 1000000,
            volume: q.regularMarketVolume || 0,
          };
        });
      }
    }
  } catch { /* v7 failed, try v8 */ }

  // Fallback: fetch each stock individually via v8 chart endpoint
  try {
    const results = await Promise.allSettled(
      stocks.map(async (s) => {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s.symbol)}?interval=1d&range=1d`;
        const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
        if (!res.ok) return null;
        const data = await res.json();
        const meta = data?.chart?.result?.[0]?.meta;
        if (!meta) return null;
        const price = meta.regularMarketPrice ?? 0;
        const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
        const change = price - prevClose;
        const changePct = prevClose ? (change / prevClose) * 100 : 0;
        return {
          symbol: s.symbol.replace("-USD", "").replace("=F", ""),
          name: s.name,
          sector: s.sector,
          price: +price.toFixed(2),
          change: +change.toFixed(2),
          changePct: +changePct.toFixed(2),
          marketCap: (s.mcap || 0) * 1000000,
          volume: meta.regularMarketVolume || 0,
        } as HeatmapStock;
      })
    );
    return results
      .filter((r): r is PromiseFulfilledResult<HeatmapStock | null> => r.status === "fulfilled")
      .map(r => r.value)
      .filter((v): v is HeatmapStock => v !== null);
  } catch { return []; }
}

// ─── Main Handler ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const geo = req.nextUrl.searchParams.get("geo") || "india";

  let stocks: HeatmapStock[] = [];

  switch (geo) {
    case "india":
      stocks = await fetchNSEData();
      break;
    case "us":
      stocks = await fetchYahooData(US_STOCKS);
      break;
    case "crypto":
      stocks = await fetchYahooData(CRYPTO_STOCKS);
      break;
    case "commodities":
      stocks = await fetchYahooData(COMMODITY_STOCKS);
      break;
    default:
      stocks = await fetchNSEData();
  }

  return NextResponse.json({
    stocks,
    geo,
    source: geo === "india" ? "NSE" : "Yahoo Finance",
    timestamp: Date.now(),
    count: stocks.length,
  });
}
