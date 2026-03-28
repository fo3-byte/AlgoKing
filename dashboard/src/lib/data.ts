// ═══════════════════════════════════════════════════════════════════
//  TRADING DASHBOARD — DATA LAYER
//  Simulated data generators. Replace with real API calls.
// ═══════════════════════════════════════════════════════════════════

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// ── TYPES ────────────────────────────────────────────────────────

export interface Vessel {
  id: string; name: string; type: "VLCC" | "Suezmax" | "Aframax" | "Panamax";
  flag: string; lat: number; lng: number; speed: number; heading: number;
  destination: string; origin: string; cargo: string; cargoVolume: number;
  dwt: number; eta: string; status: "underway" | "anchored" | "loading" | "discharging";
  built: number; draught: number; lastPort: string;
}

export interface FlowData { route: string; volume: number; vessels: number; change: number; }
export interface PortCongestion { port: string; waiting: number; avgWait: number; trend: "up" | "down" | "flat"; }
export interface TankerRate { type: string; rate: number; change: number; weekChange: number; }

export interface GeopoliticalEvent {
  id: string; timestamp: string; region: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string; summary: string; impact: string;
  affectedAssets: string[]; riskScore: number;
  source: string; category: string;
}
export interface RegionRisk { region: string; score: number; change: number; events: number; }

export interface WhaleTrade {
  id: string; timestamp: string; asset: string; side: "BUY" | "SELL";
  size: number; price: number; exchange: string; notional: number;
  percentOfVolume: number; blockTrade: boolean; darkPool: boolean;
  priceImpact: number;
}
export interface FlowBucket { time: string; buyFlow: number; sellFlow: number; net: number; }
export interface AssetFlow { asset: string; buyVol: number; sellVol: number; net: number; count: number; }

export interface VolumeSpike {
  asset: string; currentVolume: number; avgVolume: number; spikeRatio: number;
  priceChange: number; timestamp: string; openInterestChange: number;
  sparkline: number[]; sector: string;
}

export interface AlgoPosition {
  id: string; strategy: string; asset: string; side: "LONG" | "SHORT";
  entry: number; current: number; target: number; stopLoss: number;
  size: number; pnl: number; pnlPercent: number; confidence: number;
  mcScore: number; status: "active" | "pending" | "closed";
  openTime: string; riskReward: number; market: string;
  drawdown: number; maxFavorable: number;
}
export interface EquityPoint { time: string; equity: number; drawdown: number; }
export interface StrategyPerf { name: string; pnl: number; winRate: number; trades: number; sharpe: number; greeks: OptionGreeks; }
export interface OptionGreeks { delta: number; gamma: number; theta: number; vega: number; rho: number; iv: number; }

export interface MarketTicker {
  symbol: string; price: number; change: number; changePct: number; volume: string;
}

export interface PriceCandle {
  time: string; open: number; high: number; low: number; close: number;
  volume: number; sma20: number; sma50: number; bbUpper: number; bbLower: number;
}

export interface NewsItem {
  id: string; time: string; headline: string; source: string;
  sentiment: "bullish" | "bearish" | "neutral"; tickers: string[];
}

// ── VIEW + PAPER TRADING TYPES ───────────────────────────────
export type ViewId = "overview" | "vessel-tracker" | "geopolitical" | "whale-trades" | "volume-monitor" | "algo-positions" | "price-charts" | "risk-manager" | "backtester" | "ai-chat" | "heatmap" | "calendar" | "screener" | "forex" | "kite" | "world-indices" | "social-intel" | "news-terminal" | "macro" | "workflows" | "options-chain" | "strategy-backtest" | "algo-signals"
| "equity-tracker" | "correlation" | "econ-calendar" | "payoff-diagram" | "sector-rotation" | "trade-journal" | "algo-blueprint";

export interface PaperOrder {
  id: string; asset: string; side: "BUY" | "SELL"; quantity: number;
  orderType: "MARKET" | "LIMIT"; limitPrice?: number;
  status: "open" | "filled" | "cancelled"; filledPrice?: number;
  filledAt?: string; createdAt: string;
}
export interface PaperPosition {
  id: string; asset: string; side: "BUY" | "SELL"; quantity: number;
  avgEntry: number; currentPrice: number; unrealizedPnl: number; unrealizedPnlPct: number;
}
export interface PaperTradeRecord {
  id: string; asset: string; side: "BUY" | "SELL"; quantity: number;
  entryPrice: number; exitPrice: number; pnl: number; enteredAt: string; exitedAt: string;
}
export interface BacktestResult {
  equityCurve: { time: string; equity: number }[];
  trades: { entry: string; exit: string; side: "BUY"|"SELL"; entryPrice: number; exitPrice: number; pnl: number }[];
  totalReturn: number; sharpe: number; maxDrawdown: number; winRate: number; totalTrades: number;
}

// ── GENERATORS ───────────────────────────────────────────────────

const VESSEL_PREFIXES = ["FRONT","EAGLE","PACIFIC","MINERVA","NORDIC","DHT","TORM","HAFNIA","CELSIUS","RIDGEBURY","ALPINE","DESERT","SUEZ","BAHRI","OLYMPIC","STENA","MARAN","SEA","OCEAN","TITAN","GULF","ARABIAN","CRUDE","FALCON","DIAMOND","GOLDEN","SILVER","ROYAL","GRAND","FORTUNE","STAR","BLUE","CORAL","CRYSTAL","PEARL","RUBY","JADE","AMBER","EMERALD","ONYX"];
const VESSEL_SUFFIXES = ["ALTA","VANCOUVER","VOYAGER","CLARA","HUNTER","ULYSSES","CONDOR","LAURA","AFRICA","RIGA","PROGRESS","SELENE","MYSTERY","VISTA","FALCON","FORTUNE","JASMINE","LION","SUPREME","CANOPUS","HORIZON","CARRIER","PRIDE","GLORY","CHALLENGER","SPIRIT","DAWN","WAVE","BREEZE","NAVIGATOR","EXPLORER","PIONEER","VENTURE","TRIUMPH","LIBERTY","PHOENIX","CROWN","BLADE","GUARDIAN","SENTINEL"];
const destinations = ["Fujairah","Jebel Ali","Ras Tanura","Kharg Island","Basra OT","Mina Al Ahmadi","Yanbu","Mumbai","Singapore","Rotterdam","Houston","Qingdao","Yokohama","Ulsan","Daesan","Sikka","Mongla","Sohar Port","Al Shaheen","Ruwais"];
const origins = ["Ras Tanura","Kharg Island","Basra OT","Das Island","Mina Al Ahmadi","Fujairah","Jebel Ali","Muscat","Sohar","Al Shaheen","Ruwais","Juaymah","Zirku Island","Fateh Terminal","Lavan Island"];
const flags = ["🇱🇷","🇲🇭","🇵🇦","🇧🇸","🇸🇬","🇬🇷","🇳🇴","🇬🇧","🇯🇵","🇭🇰","🇮🇳","🇨🇳","🇦🇪","🇸🇦","🇰🇼","🇮🇷","🇴🇲","🇶🇦","🇧🇭","🇰🇷"];
const VESSEL_COUNT = 200;

// Cluster zones around real maritime areas in the Persian Gulf + Gulf of Oman
const VESSEL_CLUSTERS = [
  { lat: 26.1, lng: 56.2, spread: 0.3, weight: 0.15, name: "Strait of Hormuz" },
  { lat: 25.0, lng: 55.1, spread: 0.2, weight: 0.12, name: "Jebel Ali/Dubai" },
  { lat: 25.2, lng: 56.4, spread: 0.15, weight: 0.10, name: "Fujairah Anchorage" },
  { lat: 26.6, lng: 50.1, spread: 0.3, weight: 0.10, name: "Ras Tanura" },
  { lat: 29.2, lng: 50.3, spread: 0.2, weight: 0.08, name: "Kharg Island" },
  { lat: 29.7, lng: 48.8, spread: 0.25, weight: 0.08, name: "Basra" },
  { lat: 27.2, lng: 56.3, spread: 0.15, weight: 0.06, name: "Bandar Abbas" },
  { lat: 23.6, lng: 58.5, spread: 0.2, weight: 0.05, name: "Muscat" },
  { lat: 25.5, lng: 54.5, spread: 0.3, weight: 0.05, name: "Abu Dhabi" },
  { lat: 24.5, lng: 52.0, spread: 1.5, weight: 0.08, name: "Open Gulf" },
  { lat: 24.0, lng: 58.0, spread: 1.5, weight: 0.07, name: "Gulf of Oman" },
  { lat: 26.0, lng: 52.0, spread: 2.0, weight: 0.06, name: "Central Gulf" },
];

export function generateVessels(): Vessel[] {
  const types: Vessel["type"][] = ["VLCC","Suezmax","Aframax","Panamax"];
  const statuses: Vessel["status"][] = ["underway","anchored","loading","discharging"];
  const cargos = ["Crude Oil","Fuel Oil","Condensate","LPG","LNG","Refined Products","Chemicals","Naphtha"];
  const now = Date.now();

  return Array.from({ length: VESSEL_COUNT }, (_, i) => {
    const seed = now / 100000 + i * 1.7;
    const r = (o: number) => seededRandom(seed + o);

    // Pick a cluster based on weights
    let cumWeight = 0;
    const roll = r(100);
    let cluster = VESSEL_CLUSTERS[0];
    for (const c of VESSEL_CLUSTERS) {
      cumWeight += c.weight;
      if (roll < cumWeight) { cluster = c; break; }
    }

    const name = VESSEL_PREFIXES[Math.floor(r(0) * VESSEL_PREFIXES.length)] + " " + VESSEL_SUFFIXES[Math.floor(r(1) * VESSEL_SUFFIXES.length)];
    const type = types[Math.floor(r(2) * types.length)];
    const status = statuses[Math.floor(r(10) * statuses.length)];

    // Position: cluster center + gaussian-ish spread
    const latOffset = (r(3) - 0.5) * 2 * cluster.spread;
    const lngOffset = (r(4) - 0.5) * 2 * cluster.spread;

    return {
      id: `IMO${9000000 + i * 37}`, name, type,
      flag: flags[Math.floor(r(5) * flags.length)],
      lat: +(cluster.lat + latOffset).toFixed(4),
      lng: +(cluster.lng + lngOffset).toFixed(4),
      speed: status === "anchored" ? 0 : status === "loading" || status === "discharging" ? +(r(6) * 2).toFixed(1) : +(r(6) * 14 + 2).toFixed(1),
      heading: Math.floor(r(7) * 360),
      destination: destinations[Math.floor(r(8) * destinations.length)],
      origin: origins[Math.floor(r(9) * origins.length)],
      cargo: cargos[Math.floor(r(11) * cargos.length)],
      cargoVolume: Math.floor(r(12) * 2000000 + 200000),
      dwt: type === "VLCC" ? 300000 : type === "Suezmax" ? 160000 : type === "Aframax" ? 110000 : 75000,
      eta: new Date(now + r(13) * 7 * 86400000).toISOString(),
      status,
      built: 2005 + Math.floor(r(14) * 20),
      draught: +(10 + r(15) * 12).toFixed(1),
      lastPort: origins[Math.floor(r(16) * origins.length)],
    };
  });
}

export function generateShippingInsights(vessels: Vessel[]): string[] {
  const underway = vessels.filter(v => v.status === "underway").length;
  const anchored = vessels.filter(v => v.status === "anchored").length;
  const cargo = vessels.reduce((s, v) => s + v.cargoVolume, 0);
  const avgSpd = (vessels.reduce((s, v) => s + v.speed, 0) / vessels.length).toFixed(1);
  const vlcc = vessels.filter(v => v.type === "VLCC").length;
  return [
    `${underway} vessels underway through Strait of Hormuz — ${anchored} anchored. Fleet avg speed ${avgSpd} kn`,
    `Total cargo in transit: ${(cargo/1e6).toFixed(1)}M bbl across ${vessels.length} tankers (${vlcc} VLCCs)`,
    +avgSpd < 10 ? "⚠ Below-average fleet speed indicates potential congestion or weather delays" : "Fleet pace normal — no transit bottlenecks detected",
    anchored > 8 ? "🔴 High anchorage count at Gulf ports — supply chain delays likely, bullish for tanker spot rates" : "Port throughput nominal — no congestion signal",
    `Primary flow: Ras Tanura/Kharg Is → East Asia. Fujairah hub seeing elevated bunkering activity`,
    cargo > 15e6 ? "📈 Elevated cargo volumes vs 20-day avg — watch for crude oversupply at destination ports" : "Cargo volumes within seasonal norms",
  ];
}

export function generateFlowData(): FlowData[] {
  const now = Date.now();
  return [
    { route: "Persian Gulf → East Asia", volume: Math.floor(seededRandom(now/1e5)*5e6+12e6), vessels: Math.floor(seededRandom(now/1e5+1)*8+15), change: +((seededRandom(now/1e5+2)-0.4)*8).toFixed(1) as unknown as number },
    { route: "Persian Gulf → Europe", volume: Math.floor(seededRandom(now/1e5+3)*3e6+4e6), vessels: Math.floor(seededRandom(now/1e5+4)*5+6), change: +((seededRandom(now/1e5+5)-0.5)*6).toFixed(1) as unknown as number },
    { route: "Persian Gulf → India", volume: Math.floor(seededRandom(now/1e5+6)*2e6+3e6), vessels: Math.floor(seededRandom(now/1e5+7)*4+5), change: +((seededRandom(now/1e5+8)-0.45)*5).toFixed(1) as unknown as number },
    { route: "Persian Gulf → Americas", volume: Math.floor(seededRandom(now/1e5+9)*1e6+1e6), vessels: Math.floor(seededRandom(now/1e5+10)*3+2), change: +((seededRandom(now/1e5+11)-0.5)*10).toFixed(1) as unknown as number },
  ];
}

export function generatePortCongestion(): PortCongestion[] {
  const now = Date.now();
  const ports = ["Ras Tanura","Fujairah","Jebel Ali","Kharg Island","Basra OT","Mina Al Ahmadi"];
  return ports.map((port, i) => ({
    port, waiting: Math.floor(seededRandom(now/1e5+i*3)*12+1),
    avgWait: +(seededRandom(now/1e5+i*3+1)*48+6).toFixed(0) as unknown as number,
    trend: seededRandom(now/1e5+i*3+2) > 0.6 ? "up" : seededRandom(now/1e5+i*3+2) > 0.3 ? "flat" : "down",
  }));
}

export function generateTankerRates(): TankerRate[] {
  const now = Date.now();
  return [
    { type: "VLCC (TD3C)", rate: +(seededRandom(now/1e5)*30+35).toFixed(0) as unknown as number, change: +((seededRandom(now/1e5+1)-0.4)*5).toFixed(1) as unknown as number, weekChange: +((seededRandom(now/1e5+2)-0.45)*12).toFixed(1) as unknown as number },
    { type: "Suezmax (TD20)", rate: +(seededRandom(now/1e5+3)*20+25).toFixed(0) as unknown as number, change: +((seededRandom(now/1e5+4)-0.45)*4).toFixed(1) as unknown as number, weekChange: +((seededRandom(now/1e5+5)-0.5)*8).toFixed(1) as unknown as number },
    { type: "Aframax (TD7)", rate: +(seededRandom(now/1e5+6)*15+20).toFixed(0) as unknown as number, change: +((seededRandom(now/1e5+7)-0.5)*3).toFixed(1) as unknown as number, weekChange: +((seededRandom(now/1e5+8)-0.45)*7).toFixed(1) as unknown as number },
  ];
}

export function generateGeopoliticalEvents(): GeopoliticalEvent[] {
  return [
    { id:"g1", timestamp: new Date(Date.now()-1800000).toISOString(), region:"Middle East", severity:"critical", title:"Houthi drone strike near Bab el-Mandeb strait", summary:"Commercial tanker targeted, narrow miss. US/UK naval forces on high alert. Insurance premiums spiking.", impact:"War risk premiums +45bps, Brent +$2.40", affectedAssets:["BZ","CL","EURN","FRO","INSW"], riskScore:92, source:"Reuters", category:"Maritime Security" },
    { id:"g2", timestamp: new Date(Date.now()-3600000).toISOString(), region:"Middle East", severity:"high", title:"Iran nuclear talks collapse — sanctions tightening", summary:"EU/US preparing secondary sanctions targeting Chinese teapot refineries buying Iranian crude.", impact:"Iranian crude discount narrowing, CL +1.8%", affectedAssets:["CL","BZ","PBR","SU"], riskScore:78, source:"FT", category:"Sanctions" },
    { id:"g3", timestamp: new Date(Date.now()-7200000).toISOString(), region:"Eastern Europe", severity:"high", title:"Russia reroutes Urals crude via Kozmino port", summary:"Shift from Druzhba pipeline to Pacific exports. Chinese refiners increasing Russian crude intake.", impact:"Brent-Urals spread $14→$11, WTI-Brent narrowing", affectedAssets:["BZ","CL","ROSNEFT"], riskScore:71, source:"Bloomberg", category:"Trade Flow" },
    { id:"g4", timestamp: new Date(Date.now()-14400000).toISOString(), region:"Africa", severity:"critical", title:"Libya Sharara oilfield — force majeure declared", summary:"Armed militia blockade halting 300k bpd. Es Sider terminal also at risk. No resolution timeline.", impact:"Light sweet premium +$3.20, Brent +2.8%", affectedAssets:["BZ","CL","NOC"], riskScore:88, source:"Argus", category:"Supply Disruption" },
    { id:"g5", timestamp: new Date(Date.now()-21600000).toISOString(), region:"Americas", severity:"medium", title:"US SPR drawdown: 30M barrel release announced", summary:"Biden admin releasing strategic reserves ahead of election. Cushing stocks already below 5yr avg.", impact:"WTI front-month -$1.60, backwardation flattening", affectedAssets:["CL","USO","XOP"], riskScore:55, source:"EIA", category:"Policy" },
    { id:"g6", timestamp: new Date(Date.now()-28800000).toISOString(), region:"Asia Pacific", severity:"medium", title:"China teapot refineries cut run rates 15%", summary:"Weak domestic demand + margin compression forcing independent refiners to slash throughput.", impact:"Demand destruction signal, bearish medium-term", affectedAssets:["CL","BZ","9988.HK","SNP"], riskScore:63, source:"Platts", category:"Demand" },
    { id:"g7", timestamp: new Date(Date.now()-43200000).toISOString(), region:"Middle East", severity:"high", title:"OPEC+ emergency meeting — deeper cuts proposed", summary:"Saudi pushing 1M bpd additional cut. Russia compliance questionable. Market pricing 50% probability.", impact:"Contango→backwardation shift, CL +3.2%", affectedAssets:["CL","BZ","2222.SR","ADNOC"], riskScore:75, source:"OPEC", category:"Supply" },
    { id:"g8", timestamp: new Date(Date.now()-64800000).toISOString(), region:"Asia Pacific", severity:"low", title:"India raises windfall tax on crude producers", summary:"₹9,800/tonne levy reinstated after 6-week pause. Hits ONGC, Oil India margins.", impact:"ONGC -4.2%, Oil India -3.8%", affectedAssets:["ONGC.NS","OIL.NS","RELIANCE.NS"], riskScore:32, source:"MoF India", category:"Policy" },
  ];
}

export function generateRegionRisks(): RegionRisk[] {
  const now = Date.now();
  return [
    { region: "Middle East", score: Math.floor(seededRandom(now/1e5)*20+70), change: +((seededRandom(now/1e5+1)-0.4)*8).toFixed(0) as unknown as number, events: 3 },
    { region: "Eastern Europe", score: Math.floor(seededRandom(now/1e5+2)*15+55), change: +((seededRandom(now/1e5+3)-0.5)*6).toFixed(0) as unknown as number, events: 1 },
    { region: "Africa", score: Math.floor(seededRandom(now/1e5+4)*20+60), change: +((seededRandom(now/1e5+5)-0.4)*10).toFixed(0) as unknown as number, events: 1 },
    { region: "Asia Pacific", score: Math.floor(seededRandom(now/1e5+6)*15+30), change: +((seededRandom(now/1e5+7)-0.5)*5).toFixed(0) as unknown as number, events: 2 },
    { region: "Americas", score: Math.floor(seededRandom(now/1e5+8)*10+25), change: +((seededRandom(now/1e5+9)-0.5)*4).toFixed(0) as unknown as number, events: 1 },
  ];
}

export function generateWhaleTrades(): WhaleTrade[] {
  const assets = ["CL","BZ","NG","GC","SI","ES","NQ","BTC","ETH","NIFTY","BANKNIFTY","RELIANCE"];
  const exchanges = ["CME","ICE","NYMEX","Binance","Coinbase","COMEX","NSE","Deribit"];
  const now = Date.now();
  return Array.from({ length: 20 }, (_, i) => {
    const r = (o: number) => seededRandom(now/60000 + i*7 + o);
    const asset = assets[Math.floor(r(0)*assets.length)];
    const side = r(1) > 0.48 ? "BUY" : "SELL";
    const price = asset==="BTC"?65000+r(2)*5000:asset==="ETH"?3200+r(2)*500:asset==="CL"?78+r(2)*8:asset==="GC"?2300+r(2)*100:asset==="ES"?5400+r(2)*200:asset==="NQ"?19000+r(2)*1000:asset==="NIFTY"?24500+r(2)*300:asset==="BANKNIFTY"?52000+r(2)*500:asset==="RELIANCE"?2800+r(2)*100:50+r(2)*50;
    const size = Math.floor(r(3)*8000+500);
    return {
      id:`wt-${i}`, timestamp: new Date(now-r(4)*3600000*6).toISOString(), asset,
      side: side as "BUY"|"SELL", size, price:+price.toFixed(2),
      exchange: exchanges[Math.floor(r(5)*exchanges.length)],
      notional:+(size*price).toFixed(0), percentOfVolume:+(r(6)*8+1).toFixed(1),
      blockTrade: r(7) > 0.7, darkPool: r(8) > 0.75,
      priceImpact: +((r(9)-0.45)*0.5).toFixed(3) as unknown as number,
    };
  }).sort((a,b) => new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime());
}

export function generateFlowBuckets(): FlowBucket[] {
  const now = Date.now();
  return Array.from({ length: 24 }, (_,i) => {
    const r = (o: number) => seededRandom(now/120000+i*5+o);
    const buy = Math.floor(r(0)*50e6+10e6);
    const sell = Math.floor(r(1)*50e6+10e6);
    return { time: `${String(i).padStart(2,"0")}:00`, buyFlow: buy, sellFlow: -sell, net: buy-sell };
  });
}

export function generateAssetFlows(): AssetFlow[] {
  const assets = ["CL","BZ","GC","ES","NQ","BTC","ETH","NG","NIFTY"];
  const now = Date.now();
  return assets.map((asset, i) => {
    const r = (o: number) => seededRandom(now/60000+i*11+o);
    const buy = Math.floor(r(0)*100e6+20e6);
    const sell = Math.floor(r(1)*100e6+20e6);
    return { asset, buyVol: buy, sellVol: sell, net: buy-sell, count: Math.floor(r(2)*50+5) };
  }).sort((a,b) => Math.abs(b.net)-Math.abs(a.net));
}

export function generateVolumeSpikes(): VolumeSpike[] {
  const assets = [
    {name:"CL (WTI Crude)",base:450000,sector:"Energy"},{name:"BZ (Brent)",base:380000,sector:"Energy"},
    {name:"NG (NatGas)",base:320000,sector:"Energy"},{name:"GC (Gold)",base:280000,sector:"Metals"},
    {name:"SI (Silver)",base:180000,sector:"Metals"},{name:"ES (S&P 500)",base:1200000,sector:"Equity Index"},
    {name:"NQ (Nasdaq)",base:800000,sector:"Equity Index"},{name:"BTC/USD",base:45000,sector:"Crypto"},
    {name:"ETH/USD",base:35000,sector:"Crypto"},{name:"NIFTY 50",base:520000,sector:"Equity Index"},
    {name:"BANKNIFTY",base:310000,sector:"Equity Index"},{name:"HG (Copper)",base:150000,sector:"Metals"},
  ];
  const now = Date.now();
  return assets.map((a,i) => {
    const r = (o: number) => seededRandom(now/30000+i*13+o);
    const spike = 1+r(0)*4.5;
    return {
      asset:a.name, currentVolume:Math.floor(a.base*spike), avgVolume:a.base,
      spikeRatio:+spike.toFixed(2), priceChange:+((r(1)-0.45)*6).toFixed(2),
      timestamp:new Date(now-r(2)*1800000).toISOString(),
      openInterestChange:+((r(3)-0.45)*8).toFixed(1) as unknown as number,
      sparkline: Array.from({length:20},(_,j)=>Math.floor(a.base*(1+seededRandom(now/60000+i*20+j)*spike/3))),
      sector: a.sector,
    };
  }).sort((a,b)=>b.spikeRatio-a.spikeRatio);
}

export function generateAlgoPositions(): AlgoPosition[] {
  const strategies=["Mean Reversion","MA Crossover","PDC/PDH","ORB","Volume Profile","Momentum","VWAP Reversion","1Hr HL"];
  const assetList=[
    {name:"NIFTY 50 FUT",base:24500,market:"NSE"},{name:"BANKNIFTY FUT",base:52000,market:"NSE"},
    {name:"RELIANCE",base:2800,market:"NSE"},{name:"HDFCBANK",base:1650,market:"NSE"},
    {name:"CL FUT",base:82,market:"NYMEX"},{name:"GC FUT",base:2350,market:"COMEX"},
    {name:"BTC/USD",base:67000,market:"Crypto"},{name:"ETH/USD",base:3400,market:"Crypto"},
    {name:"ES FUT",base:5500,market:"CME"},{name:"NQ FUT",base:19500,market:"CME"},
    {name:"BZ FUT",base:86,market:"ICE"},{name:"NG FUT",base:3.2,market:"NYMEX"},
  ];
  const now=Date.now();
  return Array.from({length:12},(_,i)=>{
    const r=(o: number)=>seededRandom(now/120000+i*17+o);
    const side=r(0)>0.45?"LONG":"SHORT";
    const al=assetList[i%assetList.length];
    const entry=+(al.base*(1+(r(1)-0.5)*0.02)).toFixed(2);
    const current=+(entry*(1+(r(2)-0.45)*0.03)).toFixed(2);
    const pnl=side==="LONG"?current-entry:entry-current;
    const pnlPct=(pnl/entry)*100;
    return {
      id:`pos-${i}`, strategy:strategies[Math.floor(r(3)*strategies.length)],
      asset:al.name, side:side as "LONG"|"SHORT", entry, current,
      target:+(entry*(side==="LONG"?1.025:0.975)).toFixed(2),
      stopLoss:+(entry*(side==="LONG"?0.985:1.015)).toFixed(2),
      size:Math.floor(r(4)*50+5), pnl:+pnl.toFixed(2), pnlPercent:+pnlPct.toFixed(2),
      confidence:Math.floor(r(5)*40+60), mcScore:+(r(6)*30+70).toFixed(1),
      status:r(7)>0.15?"active":"pending" as "active"|"pending",
      openTime:new Date(now-r(8)*86400000*2).toISOString(),
      riskReward:+(r(9)*3+1).toFixed(1) as unknown as number,
      market:al.market,
      drawdown:+(r(10)*2).toFixed(2) as unknown as number,
      maxFavorable:+(r(11)*3).toFixed(2) as unknown as number,
    };
  });
}

export function generateEquityCurve(): EquityPoint[] {
  let eq=500000; const data:EquityPoint[]=[];
  for(let i=0;i<60;i++){
    const r=seededRandom(i*31+42);
    eq=eq*(1+(r-0.47)*0.015);
    const peak=Math.max(...data.map(d=>d.equity),eq);
    data.push({ time:`D${i+1}`, equity:+eq.toFixed(0), drawdown:+((eq-peak)/peak*100).toFixed(2) });
  }
  return data;
}

export function generateStrategyPerf(): StrategyPerf[] {
  const now=Date.now();
  return ["Mean Reversion","MA Crossover","PDC/PDH","ORB","Volume Profile","Momentum","VWAP Rev","1Hr HL"].map((name,i)=>{
    const r=(o: number)=>seededRandom(now/300000+i*7+o);
    return {
      name,
      pnl:+((r(0)-0.35)*50000).toFixed(0) as unknown as number,
      winRate:+(r(1)*30+50).toFixed(0) as unknown as number,
      trades:Math.floor(r(2)*100+20),
      sharpe:+(r(3)*2+0.5).toFixed(2) as unknown as number,
      greeks: {
        delta: +((r(4)-0.5)*1.6).toFixed(3),
        gamma: +(r(5)*0.08).toFixed(4),
        theta: +(-(r(6)*0.05+0.005)).toFixed(4),
        vega: +(r(7)*0.4+0.05).toFixed(3),
        rho: +((r(8)-0.5)*0.1).toFixed(4),
        iv: +(r(9)*40+15).toFixed(1) as unknown as number,
      },
    };
  });
}

export function generatePriceCandles(asset: string, count:number=60): PriceCandle[] {
  const baseMap: Record<string,number> = {CL:82,BZ:86,GC:2350,BTC:67000,ES:5500,NQ:19500,NG:3.2};
  let price=baseMap[asset]||82;
  const data:PriceCandle[]=[];
  const now=Date.now();
  const prices:number[]=[];
  for(let i=0;i<count;i++){
    const r=(o: number)=>seededRandom(i*31+baseMap[asset]+o);
    const change=(r(0)-0.48)*0.012;
    const open=price;
    const close=price*(1+change);
    const high=Math.max(open,close)*(1+r(1)*0.004);
    const low=Math.min(open,close)*(1-r(2)*0.004);
    price=close;
    prices.push(close);
    const sma20=prices.length>=20?prices.slice(-20).reduce((s,p)=>s+p,0)/20:close;
    const sma50=prices.length>=50?prices.slice(-50).reduce((s,p)=>s+p,0)/50:close;
    const std20=prices.length>=20?Math.sqrt(prices.slice(-20).reduce((s,p)=>s+(p-sma20)**2,0)/20):0;
    data.push({
      time:new Date(now-(count-i)*1800000).toISOString().slice(11,16),
      open:+open.toFixed(2),high:+high.toFixed(2),low:+low.toFixed(2),close:+close.toFixed(2),
      volume:Math.floor(seededRandom(i*7+baseMap[asset])*50000+10000),
      sma20:+sma20.toFixed(2),sma50:+sma50.toFixed(2),
      bbUpper:+(sma20+2*std20).toFixed(2),bbLower:+(sma20-2*std20).toFixed(2),
    });
  }
  return data;
}

export function generateMarketTickers(): MarketTicker[] {
  const now=Date.now();
  const tickers=[
    {symbol:"WTI",base:82},{symbol:"BRENT",base:86},{symbol:"GOLD",base:2350},{symbol:"SILVER",base:28},
    {symbol:"NATGAS",base:3.2},{symbol:"S&P500",base:5500},{symbol:"NASDAQ",base:19500},{symbol:"BTC",base:67000},
    {symbol:"ETH",base:3400},{symbol:"NIFTY",base:24500},{symbol:"BANKNIFTY",base:52000},{symbol:"DXY",base:104.5},
    {symbol:"EUR/USD",base:1.085},{symbol:"VIX",base:14.5},{symbol:"10Y UST",base:4.35},{symbol:"COPPER",base:4.2},
  ];
  return tickers.map((t,i)=>{
    const r=seededRandom(now/60000+i*3);
    const change=t.base*((r-0.48)*0.02);
    return { symbol:t.symbol, price:+(t.base+change).toFixed(t.base<10?3:t.base<100?2:t.base<1000?1:0), change:+change.toFixed(t.base<10?4:2), changePct:+(change/t.base*100).toFixed(2), volume: Math.floor(seededRandom(now/60000+i*3+1)*500+50)+"K" };
  });
}

export function generateNewsItems(): NewsItem[] {
  return [
    {id:"n1",time:new Date(Date.now()-300000).toISOString(),headline:"OPEC+ considering emergency production cut of 1M bpd — crude futures surge",source:"Reuters",sentiment:"bullish",tickers:["CL","BZ"]},
    {id:"n2",time:new Date(Date.now()-900000).toISOString(),headline:"Houthi forces fire anti-ship missiles near Bab el-Mandeb — war risk premiums spike",source:"Bloomberg",sentiment:"bullish",tickers:["CL","BZ","EURN"]},
    {id:"n3",time:new Date(Date.now()-1800000).toISOString(),headline:"US EIA reports surprise crude draw of -6.2M barrels vs -1.5M expected",source:"EIA",sentiment:"bullish",tickers:["CL","USO"]},
    {id:"n4",time:new Date(Date.now()-3600000).toISOString(),headline:"Fed minutes reveal hawkish tilt — dollar strengthens, commodities under pressure",source:"FOMC",sentiment:"bearish",tickers:["GC","ES","DXY"]},
    {id:"n5",time:new Date(Date.now()-5400000).toISOString(),headline:"China PMI misses at 49.1 — manufacturing contraction deepens, demand fears grow",source:"NBS China",sentiment:"bearish",tickers:["CL","HG","BZ"]},
    {id:"n6",time:new Date(Date.now()-7200000).toISOString(),headline:"Libya Sharara field offline — 300k bpd removed from market",source:"Argus",sentiment:"bullish",tickers:["BZ","CL"]},
    {id:"n7",time:new Date(Date.now()-9000000).toISOString(),headline:"India cuts fuel taxes — positive for refining margins, demand outlook",source:"MoF India",sentiment:"neutral",tickers:["RELIANCE.NS","IOC.NS"]},
    {id:"n8",time:new Date(Date.now()-10800000).toISOString(),headline:"Bitcoin ETF sees $450M daily inflow — institutional momentum continues",source:"CoinDesk",sentiment:"bullish",tickers:["BTC","ETH"]},
  ];
}
