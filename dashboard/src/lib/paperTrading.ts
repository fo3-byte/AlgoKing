import type { PaperOrder, PaperPosition, PaperTradeRecord, BacktestResult } from "./data";

export interface PaperState {
  orders: PaperOrder[];
  positions: PaperPosition[];
  history: PaperTradeRecord[];
  cash: number;
  equityCurve: { time: string; equity: number }[];
}

const STORAGE_KEY = "motherAlgo_paperTradingState";
const DEFAULT_CASH = 500_000; // ₹5 Lakh margin

export function loadState(): PaperState {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return JSON.parse(raw) as PaperState;
  } catch { return defaultState(); }
}

export function saveState(state: PaperState): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* noop */ }
}

export function defaultState(): PaperState {
  return { orders: [], positions: [], history: [], cash: DEFAULT_CASH, equityCurve: [] };
}

export function placeOrder(state: PaperState, asset: string, side: "BUY" | "SELL", quantity: number, orderType: "MARKET" | "LIMIT", currentPrice: number, limitPrice?: number): PaperState {
  const id = `ord-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  if (orderType === "MARKET") {
    // Fill immediately at current price
    const cost = currentPrice * quantity;
    const newPos: PaperPosition = {
      id: `pos-${Date.now()}`, asset, side, quantity, avgEntry: currentPrice,
      currentPrice, unrealizedPnl: 0, unrealizedPnlPct: 0,
    };
    const order: PaperOrder = {
      id, asset, side, quantity, orderType, status: "filled",
      filledPrice: currentPrice, filledAt: now, createdAt: now,
    };

    // Merge with existing position if same asset+side
    const existing = state.positions.find(p => p.asset === asset && p.side === side);
    let positions: PaperPosition[];
    if (existing) {
      const totalQty = existing.quantity + quantity;
      const avgEntry = (existing.avgEntry * existing.quantity + currentPrice * quantity) / totalQty;
      positions = state.positions.map(p =>
        p.id === existing.id ? { ...p, quantity: totalQty, avgEntry } : p
      );
    } else {
      positions = [...state.positions, newPos];
    }

    return {
      ...state,
      orders: [...state.orders, order],
      positions,
      cash: state.cash - (side === "BUY" ? cost : -cost),
    };
  }

  // LIMIT order — stays open
  const order: PaperOrder = {
    id, asset, side, quantity, orderType, limitPrice, status: "open", createdAt: now,
  };
  return { ...state, orders: [...state.orders, order] };
}

export function tickPositions(state: PaperState, prices: Record<string, number>): PaperState {
  const positions = state.positions.map(p => {
    const price = prices[p.asset] ?? p.currentPrice;
    const pnl = p.side === "BUY"
      ? (price - p.avgEntry) * p.quantity
      : (p.avgEntry - price) * p.quantity;
    return { ...p, currentPrice: price, unrealizedPnl: +pnl.toFixed(2), unrealizedPnlPct: +((pnl / (p.avgEntry * p.quantity)) * 100).toFixed(2) };
  });

  // Check limit orders
  let orders = [...state.orders];
  let newPositions = [...positions];
  let cash = state.cash;
  const filledNow: PaperOrder[] = [];

  orders = orders.map(o => {
    if (o.status !== "open" || o.orderType !== "LIMIT" || !o.limitPrice) return o;
    const price = prices[o.asset];
    if (!price) return o;
    const shouldFill = (o.side === "BUY" && price <= o.limitPrice) || (o.side === "SELL" && price >= o.limitPrice);
    if (!shouldFill) return o;

    const filled: PaperOrder = { ...o, status: "filled", filledPrice: price, filledAt: new Date().toISOString() };
    filledNow.push(filled);

    const existing = newPositions.find(p => p.asset === o.asset && p.side === o.side);
    if (existing) {
      const totalQty = existing.quantity + o.quantity;
      const avgEntry = (existing.avgEntry * existing.quantity + price * o.quantity) / totalQty;
      newPositions = newPositions.map(p => p.id === existing.id ? { ...p, quantity: totalQty, avgEntry } : p);
    } else {
      newPositions.push({
        id: `pos-${Date.now()}`, asset: o.asset, side: o.side, quantity: o.quantity,
        avgEntry: price, currentPrice: price, unrealizedPnl: 0, unrealizedPnlPct: 0,
      });
    }
    cash -= o.side === "BUY" ? price * o.quantity : -(price * o.quantity);
    return filled;
  });

  // Equity snapshot
  const posValue = newPositions.reduce((s, p) => s + p.currentPrice * p.quantity, 0);
  const totalEquity = cash + posValue;
  const curve = [...state.equityCurve, { time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }), equity: +totalEquity.toFixed(0) }].slice(-200);

  return { ...state, positions: newPositions, orders, cash, equityCurve: curve };
}

export function closePosition(state: PaperState, positionId: string): PaperState {
  const pos = state.positions.find(p => p.id === positionId);
  if (!pos) return state;

  const pnl = pos.unrealizedPnl;
  const record: PaperTradeRecord = {
    id: `trade-${Date.now()}`, asset: pos.asset, side: pos.side, quantity: pos.quantity,
    entryPrice: pos.avgEntry, exitPrice: pos.currentPrice, pnl,
    enteredAt: new Date(Date.now() - 3600000).toISOString(), exitedAt: new Date().toISOString(),
  };

  return {
    ...state,
    positions: state.positions.filter(p => p.id !== positionId),
    history: [record, ...state.history],
    cash: state.cash + pos.currentPrice * pos.quantity * (pos.side === "BUY" ? 1 : -1) + pnl,
  };
}

export function resetState(): PaperState { return defaultState(); }

// ── Simple Backtest Engine ────────────────────────────────────
export function runBacktest(
  strategy: string,
  prices: { close: number; time: string }[],
  initialCapital: number = 1_000_000
): BacktestResult {
  const trades: BacktestResult["trades"] = [];
  const equityCurve: { time: string; equity: number }[] = [];
  let cash = initialCapital;
  let position: { side: "BUY" | "SELL"; entryPrice: number; entryTime: string } | null = null;

  // Simple MA crossover: buy when short MA > long MA, sell when opposite
  const shortPeriod = strategy === "Mean Reversion" ? 5 : 10;
  const longPeriod = strategy === "Mean Reversion" ? 20 : 30;

  for (let i = longPeriod; i < prices.length; i++) {
    const shortMA = prices.slice(i - shortPeriod, i).reduce((s, p) => s + p.close, 0) / shortPeriod;
    const longMA = prices.slice(i - longPeriod, i).reduce((s, p) => s + p.close, 0) / longPeriod;
    const price = prices[i].close;

    if (strategy === "Mean Reversion") {
      // Buy when price < longMA * 0.98, sell when > longMA * 1.02
      if (!position && price < longMA * 0.98) {
        position = { side: "BUY", entryPrice: price, entryTime: prices[i].time };
      } else if (position && price > longMA * 1.01) {
        const pnl = position.side === "BUY" ? (price - position.entryPrice) * 100 : (position.entryPrice - price) * 100;
        trades.push({ entry: position.entryTime, exit: prices[i].time, side: position.side, entryPrice: position.entryPrice, exitPrice: price, pnl: +pnl.toFixed(2) });
        cash += pnl;
        position = null;
      }
    } else {
      // MA Crossover
      if (!position && shortMA > longMA) {
        position = { side: "BUY", entryPrice: price, entryTime: prices[i].time };
      } else if (position && shortMA < longMA) {
        const pnl = (price - position.entryPrice) * 100;
        trades.push({ entry: position.entryTime, exit: prices[i].time, side: position.side, entryPrice: position.entryPrice, exitPrice: price, pnl: +pnl.toFixed(2) });
        cash += pnl;
        position = null;
      }
    }

    equityCurve.push({ time: prices[i].time, equity: +cash.toFixed(0) });
  }

  const wins = trades.filter(t => t.pnl > 0).length;
  const returns = equityCurve.map((e, i) => i > 0 ? (e.equity - equityCurve[i - 1].equity) / equityCurve[i - 1].equity : 0);
  const avgReturn = returns.reduce((s, r) => s + r, 0) / returns.length;
  const stdReturn = Math.sqrt(returns.reduce((s, r) => s + (r - avgReturn) ** 2, 0) / returns.length);
  const sharpe = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252) : 0;

  let peak = initialCapital; let maxDD = 0;
  equityCurve.forEach(e => { peak = Math.max(peak, e.equity); maxDD = Math.min(maxDD, (e.equity - peak) / peak * 100); });

  return {
    equityCurve, trades,
    totalReturn: +((cash - initialCapital) / initialCapital * 100).toFixed(2),
    sharpe: +sharpe.toFixed(2),
    maxDrawdown: +maxDD.toFixed(2),
    winRate: trades.length > 0 ? +((wins / trades.length) * 100).toFixed(0) : 0,
    totalTrades: trades.length,
  };
}
