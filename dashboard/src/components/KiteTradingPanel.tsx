"use client";
import { useState, useEffect, useCallback } from "react";
import { LogIn, RefreshCw, TrendingUp, TrendingDown, Send, X, Wallet, BarChart3, ShoppingCart, FileText, AlertCircle } from "lucide-react";

interface KiteProfile { user_name: string; user_id: string; email: string; broker: string; }
interface KiteMargins { equity?: { available?: { live_balance?: number; collateral?: number }; net?: number; utilised?: { debits?: number } }; }
interface KitePosition { tradingsymbol: string; exchange: string; product: string; quantity: number; average_price: number; last_price: number; pnl: number; buy_quantity: number; sell_quantity: number; }
interface KiteOrder { order_id: string; tradingsymbol: string; exchange: string; transaction_type: string; order_type: string; quantity: number; price: number; status: string; status_message: string; filled_quantity: number; }
interface KiteHolding { tradingsymbol: string; exchange: string; quantity: number; average_price: number; last_price: number; pnl: number; t1_quantity: number; }

const TABS = ["Portfolio", "Orders", "Place Order"] as const;

function fmtINR(n: number): string {
  const abs = Math.abs(n);
  const prefix = n < 0 ? "-" : n > 0 ? "+" : "";
  if (abs >= 10000000) return `${prefix}₹${(abs / 10000000).toFixed(2)}Cr`;
  if (abs >= 100000) return `${prefix}₹${(abs / 100000).toFixed(2)}L`;
  if (abs >= 1000) return `${prefix}₹${(abs / 1000).toFixed(1)}K`;
  return `${prefix}₹${abs.toFixed(0)}`;
}

export default function KiteTradingPanel() {
  const [tab, setTab] = useState<typeof TABS[number]>("Portfolio");
  const [loggedIn, setLoggedIn] = useState(false);
  const [profile, setProfile] = useState<KiteProfile | null>(null);
  const [margins, setMargins] = useState<KiteMargins | null>(null);
  const [positions, setPositions] = useState<KitePosition[]>([]);
  const [orders, setOrders] = useState<KiteOrder[]>([]);
  const [holdings, setHoldings] = useState<KiteHolding[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [requestToken, setRequestToken] = useState("");

  // Order form
  const [orderSymbol, setOrderSymbol] = useState("RELIANCE");
  const [orderExchange, setOrderExchange] = useState("NSE");
  const [orderSide, setOrderSide] = useState<"BUY" | "SELL">("BUY");
  const [orderType, setOrderType] = useState<"MARKET" | "LIMIT">("MARKET");
  const [orderQty, setOrderQty] = useState(1);
  const [orderPrice, setOrderPrice] = useState(0);
  const [orderProduct, setOrderProduct] = useState("MIS");
  const [orderResult, setOrderResult] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/kite?action=status");
      const data = await res.json();
      setLoggedIn(data.logged_in);
      if (data.profile) setProfile(data.profile);
    } catch { /* noop */ }
  }, []);

  const fetchPortfolio = useCallback(async () => {
    if (!loggedIn) return;
    setLoading(true);
    try {
      const [marginsRes, posRes, ordersRes, holdingsRes] = await Promise.all([
        fetch("/api/kite?action=margins").then(r => r.json()),
        fetch("/api/kite?action=positions").then(r => r.json()),
        fetch("/api/kite?action=orders").then(r => r.json()),
        fetch("/api/kite?action=holdings").then(r => r.json()),
      ]);
      if (marginsRes.data) setMargins(marginsRes.data);
      if (posRes.data?.net) setPositions(posRes.data.net);
      if (ordersRes.data) setOrders(ordersRes.data);
      if (holdingsRes.data) setHoldings(holdingsRes.data);
    } catch (e) { setError(String(e)); }
    setLoading(false);
  }, [loggedIn]);

  useEffect(() => { checkStatus(); }, [checkStatus]);
  useEffect(() => { if (loggedIn) fetchPortfolio(); }, [loggedIn, fetchPortfolio]);

  // Auto-refresh every 5s when logged in
  useEffect(() => {
    if (!loggedIn) return;
    const i = setInterval(fetchPortfolio, 5000);
    return () => clearInterval(i);
  }, [loggedIn, fetchPortfolio]);

  const handleLogin = async () => {
    const res = await fetch("/api/kite?action=login-url");
    const data = await res.json();
    window.open(data.url, "_blank", "width=600,height=700");
  };

  const handleSetToken = async () => {
    if (!requestToken.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/kite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate-session", request_token: requestToken.trim() }),
      });
      const data = await res.json();
      if (data.status === "success") {
        setLoggedIn(true);
        setError("");
        checkStatus();
      } else {
        setError(data.message || "Login failed");
      }
    } catch (e) { setError(String(e)); }
    setLoading(false);
  };

  const handlePlaceOrder = async () => {
    setLoading(true);
    setOrderResult(null);
    try {
      const res = await fetch("/api/kite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "place-order",
          tradingsymbol: orderSymbol,
          exchange: orderExchange,
          transaction_type: orderSide,
          order_type: orderType,
          quantity: orderQty,
          product: orderProduct,
          ...(orderType === "LIMIT" ? { price: orderPrice } : {}),
        }),
      });
      const data = await res.json();
      if (data.status === "success") {
        setOrderResult(`Order placed! ID: ${data.data?.order_id}`);
        fetchPortfolio();
      } else {
        setOrderResult(`Error: ${data.message || "Order failed"}`);
      }
    } catch (e) { setOrderResult(`Error: ${String(e)}`); }
    setLoading(false);
  };

  const totalPositionPnl = positions.reduce((s, p) => s + (p.pnl || 0), 0);
  const totalHoldingPnl = holdings.reduce((s, h) => s + (h.pnl || 0), 0);
  const availableMargin = margins?.equity?.available?.live_balance || 0;

  return (
    <div className="bg-[#262626] rounded-xl border border-[#3a3a3a] flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#3a3a3a] flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
            <span className="text-[8px] font-black text-white">K</span>
          </div>
          <h2 className="text-[11px] font-bold text-white">Kite Trading</h2>
          {loggedIn ? (
            <span className="text-[8px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 font-bold flex items-center gap-0.5">
              <span className="w-1 h-1 rounded-full bg-green-400" /> LIVE
            </span>
          ) : (
            <span className="text-[8px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 font-bold">OFFLINE</span>
          )}
        </div>
        {loggedIn && profile && (
          <div className="flex items-center gap-2 text-[9px] text-slate-400">
            <span>{profile.user_name} ({profile.user_id})</span>
            <button onClick={fetchPortfolio} className="text-slate-600 hover:text-white transition"><RefreshCw className="w-3 h-3" /></button>
          </div>
        )}
      </div>

      {/* Not logged in — show login */}
      {!loggedIn && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center mb-2">
            <span className="text-2xl font-black text-white">K</span>
          </div>
          <h3 className="text-sm font-bold text-white">Connect to Zerodha Kite</h3>
          <p className="text-[10px] text-slate-500 text-center max-w-xs">Login to your Kite account to enable live trading, view portfolio, and place orders directly from the dashboard.</p>

          <button onClick={handleLogin}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 transition font-semibold text-[11px]">
            <LogIn className="w-4 h-4" /> Login with Kite
          </button>

          <div className="mt-4 w-full max-w-xs">
            <div className="text-[9px] text-slate-500 mb-1">After login, paste the request_token from the redirect URL:</div>
            <div className="flex gap-1">
              <input value={requestToken} onChange={e => setRequestToken(e.target.value)} placeholder="request_token from redirect"
                className="flex-1 bg-[#333333] border border-[#3a3a3a] rounded px-2 py-1 text-[10px] text-white outline-none" />
              <button onClick={handleSetToken} disabled={loading}
                className="px-2 py-1 rounded bg-blue-500/20 text-blue-400 text-[9px] font-bold hover:bg-blue-500/30 transition disabled:opacity-50">
                Connect
              </button>
            </div>
          </div>

          {error && <div className="text-[9px] text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</div>}
        </div>
      )}

      {/* Logged in — show dashboard */}
      {loggedIn && (
        <>
          {/* Margin stats */}
          <div className="grid grid-cols-4 gap-0 border-b border-[#3a3a3a] text-[9px] flex-shrink-0">
            <div className="px-3 py-1.5 text-center border-r border-[#3a3a3a]/50">
              <div className="text-slate-500 flex items-center justify-center gap-0.5"><Wallet className="w-2.5 h-2.5" />Margin</div>
              <div className="text-white font-bold">{fmtINR(availableMargin)}</div>
            </div>
            <div className="px-3 py-1.5 text-center border-r border-[#3a3a3a]/50">
              <div className="text-slate-500">Day P&L</div>
              <div className={`font-bold ${totalPositionPnl >= 0 ? "text-green-400" : "text-red-400"}`}>{fmtINR(totalPositionPnl)}</div>
            </div>
            <div className="px-3 py-1.5 text-center border-r border-[#3a3a3a]/50">
              <div className="text-slate-500">Holdings P&L</div>
              <div className={`font-bold ${totalHoldingPnl >= 0 ? "text-green-400" : "text-red-400"}`}>{fmtINR(totalHoldingPnl)}</div>
            </div>
            <div className="px-3 py-1.5 text-center">
              <div className="text-slate-500">Positions</div>
              <div className="text-white font-bold">{positions.length}</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-0 px-3 border-b border-[#3a3a3a] flex-shrink-0">
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`text-[9px] px-3 py-1.5 font-semibold border-b-2 transition ${tab === t ? "border-orange-400 text-orange-400" : "border-transparent text-slate-500 hover:text-slate-300"}`}>
                {t}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-auto">
            {tab === "Portfolio" && (
              <div>
                {/* Positions */}
                <div className="px-3 py-1.5 border-b border-[#3a3a3a] text-[9px] text-slate-500 font-semibold uppercase tracking-wider flex items-center gap-1 sticky top-0 bg-[#262626] z-10">
                  <BarChart3 className="w-3 h-3" /> Day Positions ({positions.length})
                </div>
                {positions.length === 0 ? (
                  <div className="text-center py-6 text-[10px] text-slate-600">No open positions today</div>
                ) : (
                  <table className="w-full text-[10px]">
                    <thead className="sticky top-[26px] bg-[#262626] z-10">
                      <tr className="text-slate-600 border-b border-[#3a3a3a]">
                        <th className="text-left px-3 py-1 font-medium">Symbol</th>
                        <th className="text-right px-1 py-1 font-medium">Qty</th>
                        <th className="text-right px-1 py-1 font-medium">Avg</th>
                        <th className="text-right px-1 py-1 font-medium">LTP</th>
                        <th className="text-right px-3 py-1 font-medium">P&L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map((p, i) => (
                        <tr key={i} className="border-b border-[#3a3a3a]/30 hover:bg-[#2e2e2e]/60">
                          <td className="px-3 py-1.5"><span className="font-bold text-white">{p.tradingsymbol}</span><span className="text-[7px] text-slate-600 ml-1">{p.exchange} · {p.product}</span></td>
                          <td className={`px-1 py-1.5 text-right font-bold ${p.quantity > 0 ? "text-green-400" : p.quantity < 0 ? "text-red-400" : "text-slate-500"}`}>{p.quantity}</td>
                          <td className="px-1 py-1.5 text-right text-slate-400">₹{p.average_price.toFixed(2)}</td>
                          <td className="px-1 py-1.5 text-right text-white">₹{p.last_price.toFixed(2)}</td>
                          <td className={`px-3 py-1.5 text-right font-bold ${p.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>{fmtINR(p.pnl)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* Holdings */}
                <div className="px-3 py-1.5 border-y border-[#3a3a3a] text-[9px] text-slate-500 font-semibold uppercase tracking-wider flex items-center gap-1 sticky top-0 bg-[#262626] z-10 mt-2">
                  <Wallet className="w-3 h-3" /> Holdings ({holdings.length})
                </div>
                {holdings.length === 0 ? (
                  <div className="text-center py-6 text-[10px] text-slate-600">No holdings</div>
                ) : (
                  <table className="w-full text-[10px]">
                    <thead className="sticky top-[26px] bg-[#262626] z-10">
                      <tr className="text-slate-600 border-b border-[#3a3a3a]">
                        <th className="text-left px-3 py-1 font-medium">Symbol</th>
                        <th className="text-right px-1 py-1 font-medium">Qty</th>
                        <th className="text-right px-1 py-1 font-medium">Avg</th>
                        <th className="text-right px-1 py-1 font-medium">LTP</th>
                        <th className="text-right px-3 py-1 font-medium">P&L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {holdings.map((h, i) => (
                        <tr key={i} className="border-b border-[#3a3a3a]/30 hover:bg-[#2e2e2e]/60">
                          <td className="px-3 py-1.5 font-bold text-white">{h.tradingsymbol}</td>
                          <td className="px-1 py-1.5 text-right text-slate-300">{h.quantity}</td>
                          <td className="px-1 py-1.5 text-right text-slate-400">₹{h.average_price.toFixed(2)}</td>
                          <td className="px-1 py-1.5 text-right text-white">₹{h.last_price.toFixed(2)}</td>
                          <td className={`px-3 py-1.5 text-right font-bold ${h.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>{fmtINR(h.pnl)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {tab === "Orders" && (
              <div>
                <div className="px-3 py-1.5 border-b border-[#3a3a3a] text-[9px] text-slate-500 font-semibold uppercase tracking-wider flex items-center gap-1 sticky top-0 bg-[#262626] z-10">
                  <FileText className="w-3 h-3" /> Today&apos;s Orders ({orders.length})
                </div>
                {orders.length === 0 ? (
                  <div className="text-center py-6 text-[10px] text-slate-600">No orders today</div>
                ) : (
                  <table className="w-full text-[10px]">
                    <thead className="sticky top-[26px] bg-[#262626] z-10">
                      <tr className="text-slate-600 border-b border-[#3a3a3a]">
                        <th className="text-left px-3 py-1 font-medium">Symbol</th>
                        <th className="text-left px-1 py-1 font-medium">Type</th>
                        <th className="text-right px-1 py-1 font-medium">Qty</th>
                        <th className="text-right px-1 py-1 font-medium">Price</th>
                        <th className="text-left px-3 py-1 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((o, i) => (
                        <tr key={i} className="border-b border-[#3a3a3a]/30 hover:bg-[#2e2e2e]/60">
                          <td className="px-3 py-1.5 font-bold text-white">{o.tradingsymbol}<span className="text-[7px] text-slate-600 ml-1">{o.exchange}</span></td>
                          <td className="px-1 py-1.5"><span className={`text-[8px] px-1 py-0.5 rounded font-bold ${o.transaction_type === "BUY" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>{o.transaction_type}</span></td>
                          <td className="px-1 py-1.5 text-right text-slate-300">{o.filled_quantity}/{o.quantity}</td>
                          <td className="px-1 py-1.5 text-right text-slate-400">₹{o.price || "MKT"}</td>
                          <td className="px-3 py-1.5"><span className={`text-[8px] px-1.5 py-0.5 rounded font-bold ${o.status === "COMPLETE" ? "bg-green-500/15 text-green-400" : o.status === "REJECTED" ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-400"}`}>{o.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {tab === "Place Order" && (
              <div className="p-4 space-y-3">
                <div className="bg-[#333333] rounded-lg p-4 border border-[#3a3a3a]/50 space-y-3">
                  <div className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider flex items-center gap-1">
                    <ShoppingCart className="w-3 h-3" /> New Order
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[8px] text-slate-600 block mb-0.5">Symbol</label>
                      <input value={orderSymbol} onChange={e => setOrderSymbol(e.target.value.toUpperCase())} placeholder="RELIANCE"
                        className="w-full bg-[#333333] text-white text-[11px] px-2 py-1.5 rounded border border-[#334155] outline-none font-bold" />
                    </div>
                    <div>
                      <label className="text-[8px] text-slate-600 block mb-0.5">Exchange</label>
                      <select value={orderExchange} onChange={e => setOrderExchange(e.target.value)}
                        className="w-full bg-[#333333] text-white text-[11px] px-2 py-1.5 rounded border border-[#334155] outline-none">
                        <option value="NSE">NSE</option>
                        <option value="BSE">BSE</option>
                        <option value="NFO">NFO</option>
                        <option value="MCX">MCX</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[8px] text-slate-600 block mb-0.5">Side</label>
                      <div className="flex rounded overflow-hidden border border-[#334155]">
                        <button onClick={() => setOrderSide("BUY")} className={`flex-1 text-[10px] py-1.5 font-bold transition ${orderSide === "BUY" ? "bg-green-500/20 text-green-400" : "bg-[#333333] text-slate-500"}`}>BUY</button>
                        <button onClick={() => setOrderSide("SELL")} className={`flex-1 text-[10px] py-1.5 font-bold transition ${orderSide === "SELL" ? "bg-red-500/20 text-red-400" : "bg-[#333333] text-slate-500"}`}>SELL</button>
                      </div>
                    </div>
                    <div>
                      <label className="text-[8px] text-slate-600 block mb-0.5">Quantity</label>
                      <input type="number" value={orderQty} onChange={e => setOrderQty(+e.target.value)} min={1}
                        className="w-full bg-[#333333] text-white text-[11px] px-2 py-1.5 rounded border border-[#334155] outline-none" />
                    </div>
                    <div>
                      <label className="text-[8px] text-slate-600 block mb-0.5">Product</label>
                      <select value={orderProduct} onChange={e => setOrderProduct(e.target.value)}
                        className="w-full bg-[#333333] text-white text-[11px] px-2 py-1.5 rounded border border-[#334155] outline-none">
                        <option value="MIS">MIS (Intraday)</option>
                        <option value="CNC">CNC (Delivery)</option>
                        <option value="NRML">NRML (F&O)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[8px] text-slate-600 block mb-0.5">Order Type</label>
                      <div className="flex rounded overflow-hidden border border-[#334155]">
                        <button onClick={() => setOrderType("MARKET")} className={`flex-1 text-[9px] py-1.5 font-medium transition ${orderType === "MARKET" ? "bg-blue-500/20 text-blue-400" : "bg-[#333333] text-slate-500"}`}>MARKET</button>
                        <button onClick={() => setOrderType("LIMIT")} className={`flex-1 text-[9px] py-1.5 font-medium transition ${orderType === "LIMIT" ? "bg-blue-500/20 text-blue-400" : "bg-[#333333] text-slate-500"}`}>LIMIT</button>
                      </div>
                    </div>
                    {orderType === "LIMIT" && (
                      <div>
                        <label className="text-[8px] text-slate-600 block mb-0.5">Price</label>
                        <input type="number" value={orderPrice} onChange={e => setOrderPrice(+e.target.value)} step={0.05}
                          className="w-full bg-[#333333] text-white text-[11px] px-2 py-1.5 rounded border border-[#334155] outline-none" />
                      </div>
                    )}
                  </div>

                  <button onClick={handlePlaceOrder} disabled={loading}
                    className={`w-full py-2.5 rounded-lg font-bold text-[11px] transition flex items-center justify-center gap-2 ${
                      orderSide === "BUY"
                        ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                        : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                    } disabled:opacity-50`}>
                    <Send className="w-3.5 h-3.5" />
                    {loading ? "Placing..." : `${orderSide} ${orderQty} ${orderSymbol} @ ${orderType}`}
                  </button>

                  {orderResult && (
                    <div className={`text-[10px] p-2 rounded ${orderResult.startsWith("Error") ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400"}`}>
                      {orderResult}
                    </div>
                  )}
                </div>

                {/* Quick order buttons */}
                <div className="text-[8px] text-slate-600 uppercase tracking-wider font-semibold">Quick Symbols</div>
                <div className="flex flex-wrap gap-1">
                  {["RELIANCE", "HDFCBANK", "INFY", "TCS", "ICICIBANK", "SBIN", "TATAMOTORS", "NIFTY 50", "BANKNIFTY", "ITC", "AXISBANK", "BAJFINANCE"].map(s => (
                    <button key={s} onClick={() => setOrderSymbol(s)}
                      className={`text-[8px] px-2 py-0.5 rounded transition ${orderSymbol === s ? "bg-blue-500/20 text-blue-400" : "bg-[#333333] text-slate-500 hover:text-white"}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
