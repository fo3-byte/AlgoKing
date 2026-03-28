"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import type { YFQuote } from "@/app/api/prices/route";
import type { ChartPoint } from "@/app/api/chart/route";
import { generateMarketTickers } from "@/lib/data";

// ─── Market Ticker Hook (2s polling) ───────────────────────────

export interface LiveTicker {
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
}

export function useMarketData(intervalMs = 2000) {
  const [tickers, setTickers] = useState<LiveTicker[]>([]);
  const [source, setSource] = useState<string>("loading");
  const [lastUpdate, setLastUpdate] = useState(0);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/prices", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!mountedRef.current) return;

      if (data.quotes && data.quotes.length > 0) {
        setTickers(
          data.quotes.map((q: YFQuote) => ({
            symbol: q.symbol,
            displayName: q.displayName,
            price: q.price,
            change: q.change,
            changePct: q.changePct,
            volume: q.volume,
            high: q.high,
            low: q.low,
            open: q.open,
            prevClose: q.prevClose,
            marketState: q.marketState,
          }))
        );
        setSource(data.source || "yahoo");
        setLastUpdate(Date.now());
      } else {
        // Fallback to simulated
        fallbackToSimulated();
      }
    } catch {
      if (mountedRef.current) fallbackToSimulated();
    }
  }, []);

  const fallbackToSimulated = () => {
    const sim = generateMarketTickers();
    setTickers(
      sim.map((t) => ({
        symbol: t.symbol,
        displayName: t.symbol,
        price: t.price,
        change: t.change,
        changePct: t.changePct,
        volume: t.volume,
        high: t.price * 1.01,
        low: t.price * 0.99,
        open: t.price - t.change,
        prevClose: t.price - t.change,
        marketState: "SIM",
      }))
    );
    setSource("simulated");
    setLastUpdate(Date.now());
  };

  useEffect(() => {
    mountedRef.current = true;
    fetchData();
    const id = setInterval(fetchData, intervalMs);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [fetchData, intervalMs]);

  return { tickers, source, lastUpdate };
}

// ─── Chart Data Hook (2s polling) ──────────────────────────────

export interface LiveChartPoint extends ChartPoint {
  sma20: number;
  sma50: number;
  bbUpper: number;
  bbLower: number;
}

export function useChartData(asset: string, interval = "5m", range = "1d", pollMs = 2000) {
  const [points, setPoints] = useState<LiveChartPoint[]>([]);
  const [meta, setMeta] = useState<{ price?: number; prevClose?: number; high?: number; low?: number }>({});
  const [source, setSource] = useState("loading");
  const mountedRef = useRef(true);

  const fetchChart = useCallback(async () => {
    try {
      const res = await fetch(`/api/chart?asset=${asset}&interval=${interval}&range=${range}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!mountedRef.current) return;

      if (data.points && data.points.length > 0) {
        setPoints(data.points);
        setMeta(data.meta || {});
        setSource("yahoo");
      } else {
        setSource("no-data");
      }
    } catch {
      if (mountedRef.current) setSource("error");
    }
  }, [asset, interval, range]);

  useEffect(() => {
    mountedRef.current = true;
    fetchChart();
    const id = setInterval(fetchChart, pollMs);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [fetchChart, pollMs]);

  return { points, meta, source };
}
