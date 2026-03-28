"use client";
import { useState, useEffect, useMemo } from "react";
import {
  Grid3X3,
  AlertTriangle,
  RefreshCw,
  Shield,
  TrendingUp,
  Info,
} from "lucide-react";
import { useMarketData, type LiveTicker } from "@/hooks/useYahooData";

// ─── Asset Definitions ────────────────────────────────────────
interface AssetDef {
  key: string;
  label: string;
  symbols: string[]; // possible symbol matches from yahoo data
}

const ASSETS: AssetDef[] = [
  { key: "NIFTY", label: "NIFTY", symbols: ["^NSEI", "NIFTY"] },
  { key: "BANKNIFTY", label: "BANKNIFTY", symbols: ["^NSEBANK", "BANKNIFTY"] },
  { key: "VIX", label: "VIX", symbols: ["^VIX", "VIX", "^INDIAVIX", "INDIAVIX"] },
  { key: "CRUDE", label: "Crude Oil", symbols: ["CL=F", "WTI", "CRUDE"] },
  { key: "GOLD", label: "Gold", symbols: ["GC=F", "GOLD"] },
  { key: "SILVER", label: "Silver", symbols: ["SI=F", "SILVER"] },
  { key: "USDINR", label: "USD/INR", symbols: ["USDINR=X", "USDINR", "INR=X"] },
  { key: "BTC", label: "BTC", symbols: ["BTC-USD", "BTC"] },
  { key: "SP500", label: "S&P 500", symbols: ["ES=F", "^GSPC", "S&P500", "SPX"] },
  { key: "NASDAQ", label: "NASDAQ", symbols: ["NQ=F", "^IXIC", "NASDAQ", "QQQ"] },
];

// ─── Helpers ──────────────────────────────────────────────────
function findTicker(tickers: LiveTicker[], asset: AssetDef): LiveTicker | undefined {
  for (const sym of asset.symbols) {
    const t = tickers.find(
      (tk) =>
        tk.symbol === sym ||
        tk.displayName === sym ||
        tk.symbol.toUpperCase() === sym.toUpperCase()
    );
    if (t) return t;
  }
  return undefined;
}

// Generate a deterministic pseudo-correlation from price data
// Since we don't have historical timeseries for full Pearson, we derive
// an approximation from the % change relationship between two assets
function computeCorrelation(a: LiveTicker | undefined, b: LiveTicker | undefined): number {
  if (!a || !b) return 0;

  // Use the change percentages to create a seed-based correlation estimate
  const aPct = a.changePct || 0;
  const bPct = b.changePct || 0;

  // If both move in the same direction with similar magnitude, high positive correlation
  // If opposite, negative. If unrelated magnitude, low correlation.
  if (aPct === 0 && bPct === 0) return 0;

  const maxAbs = Math.max(Math.abs(aPct), Math.abs(bPct), 0.01);
  const direction = aPct * bPct >= 0 ? 1 : -1;
  const magnitudeRatio =
    1 - Math.abs(Math.abs(aPct) - Math.abs(bPct)) / (maxAbs * 2);

  // Base the correlation on known market relationships + live adjustment
  const liveComponent = direction * magnitudeRatio * 0.3;

  return liveComponent;
}

// Known base correlations (typical market relationships)
const BASE_CORRELATIONS: Record<string, number> = {
  "NIFTY-BANKNIFTY": 0.92,
  "NIFTY-VIX": -0.78,
  "BANKNIFTY-VIX": -0.75,
  "NIFTY-SP500": 0.65,
  "NIFTY-NASDAQ": 0.62,
  "BANKNIFTY-SP500": 0.58,
  "BANKNIFTY-NASDAQ": 0.55,
  "SP500-NASDAQ": 0.95,
  "NIFTY-GOLD": 0.15,
  "BANKNIFTY-GOLD": 0.12,
  "GOLD-SILVER": 0.88,
  "GOLD-USDINR": -0.35,
  "CRUDE-GOLD": 0.32,
  "CRUDE-USDINR": 0.45,
  "CRUDE-SILVER": 0.38,
  "NIFTY-CRUDE": 0.18,
  "BANKNIFTY-CRUDE": 0.15,
  "NIFTY-USDINR": -0.42,
  "BANKNIFTY-USDINR": -0.38,
  "VIX-SP500": -0.82,
  "VIX-NASDAQ": -0.80,
  "VIX-GOLD": 0.22,
  "BTC-SP500": 0.45,
  "BTC-NASDAQ": 0.52,
  "BTC-GOLD": 0.12,
  "BTC-NIFTY": 0.30,
  "BTC-BANKNIFTY": 0.25,
  "BTC-VIX": -0.28,
  "BTC-CRUDE": 0.20,
  "BTC-SILVER": 0.18,
  "BTC-USDINR": -0.15,
  "SILVER-USDINR": -0.30,
  "SILVER-SP500": 0.20,
  "SILVER-NASDAQ": 0.18,
  "GOLD-SP500": 0.08,
  "GOLD-NASDAQ": 0.05,
  "CRUDE-SP500": 0.25,
  "CRUDE-NASDAQ": 0.22,
  "CRUDE-VIX": -0.18,
  "USDINR-SP500": -0.30,
  "USDINR-NASDAQ": -0.28,
  "USDINR-VIX": 0.35,
  "SILVER-VIX": 0.10,
  "SILVER-NIFTY": 0.10,
  "SILVER-BANKNIFTY": 0.08,
};

function getBaseCorrelation(a: string, b: string): number {
  if (a === b) return 1;
  const key1 = `${a}-${b}`;
  const key2 = `${b}-${a}`;
  return BASE_CORRELATIONS[key1] ?? BASE_CORRELATIONS[key2] ?? 0;
}

// ─── Color helpers ────────────────────────────────────────────
function corrColor(val: number): string {
  const abs = Math.abs(val);
  if (val > 0) {
    // Green scale
    const g = Math.round(100 + abs * 155);
    const r = Math.round(40 - abs * 40);
    return `rgb(${r}, ${g}, ${Math.round(40 - abs * 20)})`;
  } else if (val < 0) {
    // Red scale
    const r = Math.round(100 + abs * 155);
    const g = Math.round(40 - abs * 40);
    return `rgb(${r}, ${g}, ${Math.round(40 - abs * 20)})`;
  }
  return "rgb(60, 60, 60)";
}

function corrTextColor(val: number): string {
  return Math.abs(val) > 0.5 ? "#fff" : "#aaa";
}

// ─── Component ────────────────────────────────────────────────
export default function CorrelationMatrixPanel() {
  const { tickers, source, lastUpdate } = useMarketData(5000);
  const [hoveredCell, setHoveredCell] = useState<{
    row: number;
    col: number;
  } | null>(null);

  // Compute correlation matrix
  const matrix = useMemo(() => {
    const n = ASSETS.length;
    const result: number[][] = Array.from({ length: n }, () =>
      Array(n).fill(0)
    );

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          result[i][j] = 1;
          continue;
        }
        if (j < i) {
          result[i][j] = result[j][i];
          continue;
        }

        // Base correlation from known relationships
        const base = getBaseCorrelation(ASSETS[i].key, ASSETS[j].key);

        // Live adjustment from current market data
        const ta = findTicker(tickers, ASSETS[i]);
        const tb = findTicker(tickers, ASSETS[j]);
        const liveAdj = computeCorrelation(ta, tb);

        // Blend: 80% base + 20% live adjustment, clamp to [-1, 1]
        const blended = Math.max(-1, Math.min(1, base * 0.8 + liveAdj));
        result[i][j] = Math.round(blended * 100) / 100;
      }
    }

    return result;
  }, [tickers]);

  // Risk alerts - find dangerous correlations
  const alerts = useMemo(() => {
    const warnings: { a: string; b: string; corr: number; type: "high" | "inverse" }[] = [];
    const n = ASSETS.length;

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const val = matrix[i][j];
        if (val > 0.8) {
          warnings.push({
            a: ASSETS[i].label,
            b: ASSETS[j].label,
            corr: val,
            type: "high",
          });
        } else if (val < -0.8) {
          warnings.push({
            a: ASSETS[i].label,
            b: ASSETS[j].label,
            corr: val,
            type: "inverse",
          });
        }
      }
    }

    return warnings;
  }, [matrix]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Grid3X3 className="w-5 h-5 text-[#BFFF00]" />
          <h2 className="text-lg font-bold text-white">
            Correlation Matrix
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 uppercase">
            Source: {source}
          </span>
          <RefreshCw
            className={`w-3 h-3 text-gray-500 ${
              source === "loading" ? "animate-spin" : ""
            }`}
          />
        </div>
      </div>

      {/* Color legend */}
      <div className="glass-card p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Info className="w-3 h-3 text-gray-500" />
          <span className="text-[10px] text-gray-400">Correlation Scale</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-red-400">-1.0</span>
          <div className="flex h-3">
            {Array.from({ length: 20 }).map((_, i) => {
              const val = -1 + (i / 19) * 2;
              return (
                <div
                  key={i}
                  className="w-2 h-full"
                  style={{ backgroundColor: corrColor(val) }}
                />
              );
            })}
          </div>
          <span className="text-[10px] text-[#BFFF00]">+1.0</span>
        </div>
      </div>

      {/* Matrix */}
      <div className="glass-card p-3 overflow-x-auto">
        {tickers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <RefreshCw className="w-10 h-10 mb-3 opacity-30 animate-spin" />
            <p className="text-sm">Loading market data...</p>
          </div>
        ) : (
          <div className="min-w-[600px]">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="p-1 text-[9px] text-gray-500 w-16" />
                  {ASSETS.map((a) => (
                    <th
                      key={a.key}
                      className="p-1 text-[9px] text-gray-400 font-medium"
                      style={{ writingMode: "vertical-rl", height: 60 }}
                    >
                      {a.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ASSETS.map((rowAsset, i) => (
                  <tr key={rowAsset.key}>
                    <td className="p-1 text-[9px] text-gray-400 font-medium text-right pr-2 whitespace-nowrap">
                      {rowAsset.label}
                    </td>
                    {ASSETS.map((colAsset, j) => {
                      const val = matrix[i][j];
                      const isDiagonal = i === j;
                      const isDangerous =
                        !isDiagonal && (val > 0.8 || val < -0.8);
                      const isHovered =
                        hoveredCell?.row === i &&
                        hoveredCell?.col === j;

                      return (
                        <td
                          key={colAsset.key}
                          className={`p-0 text-center cursor-default transition-all ${
                            isHovered ? "ring-1 ring-[#BFFF00]" : ""
                          }`}
                          onMouseEnter={() =>
                            setHoveredCell({ row: i, col: j })
                          }
                          onMouseLeave={() => setHoveredCell(null)}
                        >
                          <div
                            className={`text-[10px] font-mono py-1.5 px-0.5 ${
                              isDangerous
                                ? "ring-1 ring-inset ring-yellow-500/50"
                                : ""
                            }`}
                            style={{
                              backgroundColor: corrColor(val),
                              color: isDiagonal
                                ? "#666"
                                : corrTextColor(val),
                            }}
                          >
                            {isDiagonal ? "1.00" : val.toFixed(2)}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Hover detail */}
      {hoveredCell && (
        <div className="glass-card p-3 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {ASSETS[hoveredCell.row].label} vs{" "}
            {ASSETS[hoveredCell.col].label}
          </span>
          <span
            className={`text-sm font-bold ${
              matrix[hoveredCell.row][hoveredCell.col] > 0.5
                ? "text-[#BFFF00]"
                : matrix[hoveredCell.row][hoveredCell.col] < -0.5
                ? "text-red-400"
                : "text-gray-300"
            }`}
          >
            {matrix[hoveredCell.row][hoveredCell.col].toFixed(4)}
          </span>
        </div>
      )}

      {/* Risk Alerts */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-[#BFFF00]" />
          <span className="text-sm font-semibold text-white">
            Risk Alerts
          </span>
          {alerts.length > 0 && (
            <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">
              {alerts.length} warning{alerts.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {alerts.length === 0 ? (
          <div className="flex items-center gap-2 text-gray-500">
            <TrendingUp className="w-4 h-4 opacity-30" />
            <p className="text-xs">
              No dangerous correlations detected. Portfolio diversification
              looks healthy.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map((alert, i) => (
              <div
                key={i}
                className="flex items-start gap-2 p-2 rounded-lg bg-[#1a1a1a] border border-[#3a3a3a]"
              >
                <AlertTriangle
                  className={`w-4 h-4 mt-0.5 shrink-0 ${
                    alert.type === "high"
                      ? "text-yellow-400"
                      : "text-red-400"
                  }`}
                />
                <div className="flex-1">
                  <p className="text-xs text-gray-300">
                    <span className="font-semibold text-white">
                      {alert.a}
                    </span>{" "}
                    and{" "}
                    <span className="font-semibold text-white">
                      {alert.b}
                    </span>{" "}
                    have{" "}
                    {alert.type === "high"
                      ? "high positive"
                      : "strong inverse"}{" "}
                    correlation ({alert.corr.toFixed(2)})
                  </p>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    {alert.type === "high"
                      ? "Holding both amplifies directional risk. Consider reducing one position."
                      : "These assets move inversely. Good for hedging, but watch for double exposure."}
                  </p>
                </div>
              </div>
            ))}

            {alerts.filter((a) => a.type === "high").length >= 3 && (
              <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/30">
                <p className="text-xs text-red-300 font-medium">
                  Portfolio Concentration Warning: Multiple highly
                  correlated positions detected. A single market move could
                  impact multiple positions simultaneously.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
