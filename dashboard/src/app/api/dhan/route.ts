import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DHAN_BASE = "https://api.dhan.co/v2";

// In-memory token storage — always falls back to env vars so serverless cold
// starts on different instances don't lose the token between requests.
let _dhanAccessToken: string | null = null;
let _dhanClientId: string | null = null;

function getToken() { return (_dhanAccessToken || process.env.DHAN_ACCESS_TOKEN || "").trim() || null; }
function getClientId() { return (_dhanClientId || process.env.DHAN_CLIENT_ID || "").trim() || null; }

// keep legacy names for set-token / disconnect actions
let dhanAccessToken: string | null = null;
let dhanClientId: string | null = null;

// ── Dhan API request helper ──────────────────────────────────────────────

async function dhanRequest(
  path: string,
  method: string = "GET",
  body?: Record<string, unknown>
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const tok = getToken();
  if (!tok) {
    return { ok: false, status: 401, data: { error: "Not connected. Set Dhan access token first." } };
  }

  const headers: Record<string, string> = {
    "access-token": tok,
    "Content-Type": "application/json",
    "Accept": "application/json",
  };

  const options: RequestInit = { method, headers, cache: "no-store" };

  if (body && method !== "GET" && method !== "DELETE") {
    options.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(`${DHAN_BASE}${path}`, options);
    const contentType = res.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const data = await res.json();
      return { ok: res.ok, status: res.status, data };
    }

    // Some Dhan endpoints (like DELETE) return no body
    return { ok: res.ok, status: res.status, data: { message: res.ok ? "Success" : "Failed" } };
  } catch (err) {
    return { ok: false, status: 500, data: { error: String(err) } };
  }
}

// ── Dhan market data request helper (needs client-id header) ─────────────

async function dhanDataRequest(
  path: string,
  body: unknown
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const tok = getToken();
  const cid = getClientId();
  if (!tok || !cid) {
    return { ok: false, status: 401, data: { error: "Not connected" } };
  }

  try {
    const res = await fetch(`${DHAN_BASE}${path}`, {
      method: "POST",
      headers: {
        "access-token": tok,
        "client-id": cid,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await res.json();
      return { ok: res.ok, status: res.status, data };
    }
    return { ok: res.ok, status: res.status, data: { message: res.ok ? "Success" : "Failed" } };
  } catch (err) {
    return { ok: false, status: 500, data: { error: String(err) } };
  }
}

// ── GET handler ──────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action");

  try {
    switch (action) {
      case "status": {
        const tok = getToken();
        return NextResponse.json({
          connected: !!tok,
          clientId: getClientId(),
          broker: "dhan",
        });
      }

      case "orders": {
        const result = await dhanRequest("/orders");
        return NextResponse.json(result.data, { status: result.status });
      }

      case "order": {
        const orderId = req.nextUrl.searchParams.get("orderId");
        if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });
        const result = await dhanRequest(`/orders/${orderId}`);
        return NextResponse.json(result.data, { status: result.status });
      }

      case "positions": {
        const result = await dhanRequest("/positions");
        return NextResponse.json(result.data, { status: result.status });
      }

      case "holdings": {
        const result = await dhanRequest("/holdings");
        return NextResponse.json(result.data, { status: result.status });
      }

      case "trades": {
        const result = await dhanRequest("/trades");
        return NextResponse.json(result.data, { status: result.status });
      }

      case "funds": {
        const result = await dhanRequest("/fundlimit");
        return NextResponse.json(result.data, { status: result.status });
      }

      default:
        return NextResponse.json({ error: "Unknown action", actions: ["status", "orders", "order", "positions", "holdings", "trades", "funds"] }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ── POST handler ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json();
  const action = body.action as string;

  try {
    switch (action) {
      // ── Connect: store token ──
      case "set-token": {
        const { accessToken, clientId } = body;
        if (!accessToken || !clientId) {
          return NextResponse.json({ error: "accessToken and clientId required" }, { status: 400 });
        }
        _dhanAccessToken = accessToken;
        _dhanClientId = clientId;
        dhanAccessToken = accessToken;
        dhanClientId = clientId;

        // Verify by hitting funds endpoint
        const verify = await dhanRequest("/fundlimit");
        if (verify.ok) {
          // Auto-trigger India scanner + alert on Telegram
          try {
            fetch(`https://algomaster-pro.vercel.app/api/india-scanner?action=scan&auto=true`, { cache: "no-store" }).catch(() => {});
            fetch(`https://api.telegram.org/bot8440970690:AAFOHoVTCw6Gyx4Mla7Q4pOUnfzeb8fDDoE/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: "6776228988", text: `✅ *Dhan Connected!*\n\nClient: ${clientId}\nBalance: ₹${JSON.stringify(verify.data).includes("availabelBalance") ? (verify.data as Record<string,unknown>).availabelBalance : "?"}\n\n🔍 Running India market scan automatically...\nType /scan for full analysis.`, parse_mode: "Markdown" }),
            }).catch(() => {});
          } catch { /* non-blocking */ }
          return NextResponse.json({ connected: true, clientId, message: "Dhan connected successfully" });
        }
        // Reset on failure
        _dhanAccessToken = null;
        _dhanClientId = null;
        dhanAccessToken = null;
        dhanClientId = null;
        return NextResponse.json({ connected: false, error: "Invalid token or clientId", details: verify.data }, { status: 401 });
      }

      // ── Disconnect ──
      case "disconnect": {
        _dhanAccessToken = null;
        _dhanClientId = null;
        dhanAccessToken = null;
        dhanClientId = null;
        return NextResponse.json({ connected: false, message: "Dhan disconnected" });
      }

      // ── Place order ──
      case "place-order": {
        if (!getClientId()) return NextResponse.json({ error: "Not connected" }, { status: 401 });

        const order = {
          dhanClientId: getClientId()!,
          correlationId: body.correlationId || `wf_${Date.now()}`,
          transactionType: body.transactionType || "BUY", // BUY | SELL
          exchangeSegment: body.exchangeSegment || "NSE_FNO", // NSE_EQ | NSE_FNO | BSE_EQ | MCX_COMM
          productType: body.productType || "INTRADAY", // CNC | INTRADAY | MARGIN | CO | BO
          orderType: body.orderType || "MARKET", // LIMIT | MARKET | STOP_LOSS | STOP_LOSS_MARKET
          validity: body.validity || "DAY", // DAY | IOC
          securityId: body.securityId, // Dhan security ID (required)
          quantity: String(body.quantity || 1),
          price: body.price ? String(body.price) : "",
          triggerPrice: body.triggerPrice ? String(body.triggerPrice) : "",
          disclosedQuantity: "",
          afterMarketOrder: false,
          amoTime: "",
          boProfitValue: body.boProfitValue ? String(body.boProfitValue) : "",
          boStopLossValue: body.boStopLossValue ? String(body.boStopLossValue) : "",
        };

        if (!order.securityId) {
          return NextResponse.json({ error: "securityId is required" }, { status: 400 });
        }

        const result = await dhanRequest("/orders", "POST", order);
        return NextResponse.json({
          success: result.ok,
          ...result.data as object,
          broker: "dhan",
          correlationId: order.correlationId,
        }, { status: result.status });
      }

      // ── Place Super Order (entry + target + SL + trailing in one) ──
      case "place-super-order": {
        if (!getClientId()) return NextResponse.json({ error: "Not connected" }, { status: 401 });

        const superOrder = {
          dhanClientId: getClientId()!,
          correlationId: body.correlationId || `super_${Date.now()}`,
          transactionType: body.transactionType || "BUY",
          exchangeSegment: body.exchangeSegment || "NSE_FNO",
          productType: body.productType || "CNC",
          orderType: body.orderType || "LIMIT",
          securityId: body.securityId,
          quantity: body.quantity || 1,
          price: body.price || 0,
          targetPrice: body.targetPrice || 0,
          stopLossPrice: body.stopLossPrice || 0,
          trailingJump: body.trailingJump || 0,
        };

        if (!superOrder.securityId) {
          return NextResponse.json({ error: "securityId is required" }, { status: 400 });
        }

        const result = await dhanRequest("/super/orders", "POST", superOrder);
        return NextResponse.json({
          success: result.ok,
          ...result.data as object,
          broker: "dhan",
          orderType: "SUPER",
          correlationId: superOrder.correlationId,
        }, { status: result.status });
      }

      // ── Modify Super Order (entry/target/SL legs independently) ──
      case "modify-super-order": {
        if (!getClientId()) return NextResponse.json({ error: "Not connected" }, { status: 401 });
        const superOrderId = body.orderId;
        if (!superOrderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

        const modSuperBody: Record<string, unknown> = {
          dhanClientId: getClientId()!,
          orderId: superOrderId,
          legName: body.legName || "ENTRY_LEG", // ENTRY_LEG | TARGET_LEG | STOP_LOSS_LEG
        };

        // ENTRY_LEG fields
        if (body.legName === "ENTRY_LEG" || !body.legName) {
          if (body.orderType) modSuperBody.orderType = body.orderType;
          if (body.quantity) modSuperBody.quantity = String(body.quantity);
          if (body.price) modSuperBody.price = String(body.price);
          if (body.targetPrice) modSuperBody.targetPrice = body.targetPrice;
          if (body.stopLossPrice) modSuperBody.stopLossPrice = body.stopLossPrice;
          if (body.trailingJump) modSuperBody.trailingJump = body.trailingJump;
        }

        // TARGET_LEG fields
        if (body.legName === "TARGET_LEG") {
          if (body.targetPrice) modSuperBody.targetPrice = body.targetPrice;
        }

        // STOP_LOSS_LEG fields
        if (body.legName === "STOP_LOSS_LEG") {
          if (body.stopLossPrice) modSuperBody.stopLossPrice = body.stopLossPrice;
          if (body.trailingJump) modSuperBody.trailingJump = body.trailingJump;
        }

        const modResult = await dhanRequest(`/super/orders/${superOrderId}`, "PUT", modSuperBody);
        return NextResponse.json({
          success: modResult.ok,
          ...modResult.data as object,
          leg: body.legName || "ENTRY_LEG",
        }, { status: modResult.status });
      }

      // ── Modify order ──
      case "modify-order": {
        if (!getClientId()) return NextResponse.json({ error: "Not connected" }, { status: 401 });
        const { orderId, ...modifications } = body;
        if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

        const modBody = {
          dhanClientId: getClientId()!,
          orderId,
          orderType: modifications.orderType || "LIMIT",
          quantity: modifications.quantity ? String(modifications.quantity) : undefined,
          price: modifications.price ? String(modifications.price) : undefined,
          triggerPrice: modifications.triggerPrice ? String(modifications.triggerPrice) : undefined,
          validity: modifications.validity || "DAY",
        };

        const result = await dhanRequest(`/orders/${orderId}`, "PUT", modBody);
        return NextResponse.json({ success: result.ok, ...result.data as object }, { status: result.status });
      }

      // ── Cancel order ──
      case "cancel-order": {
        if (!getClientId()) return NextResponse.json({ error: "Not connected" }, { status: 401 });
        const cancelOrderId = body.orderId;
        if (!cancelOrderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

        const result = await dhanRequest(`/orders/${cancelOrderId}`, "DELETE");
        return NextResponse.json({ success: result.ok, message: "Order cancellation requested" }, { status: result.status });
      }

      // ── Square off all positions ──
      case "square-off-all": {
        if (!getClientId()) return NextResponse.json({ error: "Not connected" }, { status: 401 });

        // Get all open positions
        const posResult = await dhanRequest("/positions");
        if (!posResult.ok) {
          return NextResponse.json({ error: "Failed to fetch positions", details: posResult.data }, { status: 500 });
        }

        const positions = Array.isArray(posResult.data) ? posResult.data : [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const openPositions = positions.filter((p: any) => p.netQty && p.netQty !== 0);
        const results = [];

        for (const pos of openPositions) {
          const exitOrder = {
            dhanClientId: getClientId()!,
            correlationId: `sqoff_${Date.now()}_${pos.securityId}`,
            transactionType: pos.netQty > 0 ? "SELL" : "BUY",
            exchangeSegment: pos.exchangeSegment || "NSE_FNO",
            productType: pos.productType || "INTRADAY",
            orderType: "MARKET",
            validity: "DAY",
            securityId: String(pos.securityId),
            quantity: String(Math.abs(pos.netQty)),
            price: "",
            triggerPrice: "",
            disclosedQuantity: "",
            afterMarketOrder: false,
            amoTime: "",
            boProfitValue: "",
            boStopLossValue: "",
          };

          const r = await dhanRequest("/orders", "POST", exitOrder);
          results.push({ securityId: pos.securityId, success: r.ok, data: r.data });
        }

        return NextResponse.json({
          squaredOff: results.length,
          results,
          message: results.length > 0 ? `Squared off ${results.length} positions` : "No open positions to square off",
        });
      }

      // ══════════════════════════════════════════════════════════════════
      // MARKET DATA APIs
      // ══════════════════════════════════════════════════════════════════

      // ── LTP (Last Traded Price) ──
      case "ltp": {
        // body: { "NSE_EQ": [11536], "NSE_FNO": [49081, 49082] }
        const { action: _a, ...instruments } = body;
        const result = await dhanDataRequest("/marketfeed/ltp", instruments);
        return NextResponse.json(result.data, { status: result.status });
      }

      // ── OHLC Data ──
      case "ohlc": {
        const { action: _b, ...instruments } = body;
        const result = await dhanDataRequest("/marketfeed/ohlc", instruments);
        return NextResponse.json(result.data, { status: result.status });
      }

      // ── Market Depth / Full Quote ──
      case "quote": {
        const { action: _c, ...instruments } = body;
        const result = await dhanDataRequest("/marketfeed/quote", instruments);
        return NextResponse.json(result.data, { status: result.status });
      }

      // ── Daily Historical Data ──
      case "historical": {
        const result = await dhanDataRequest("/charts/historical", {
          securityId: body.securityId,
          exchangeSegment: body.exchangeSegment || "NSE_EQ",
          instrument: body.instrument || "EQUITY",
          expiryCode: body.expiryCode || 0,
          oi: body.oi || false,
          fromDate: body.fromDate,
          toDate: body.toDate,
        });
        return NextResponse.json(result.data, { status: result.status });
      }

      // ── Intraday Historical Data ──
      case "intraday": {
        const result = await dhanDataRequest("/charts/intraday", {
          securityId: body.securityId,
          exchangeSegment: body.exchangeSegment || "NSE_EQ",
          instrument: body.instrument || "EQUITY",
          interval: body.interval || "5",
          oi: body.oi || false,
          fromDate: body.fromDate,
          toDate: body.toDate,
        });
        return NextResponse.json(result.data, { status: result.status });
      }

      // ── Historical Rolling Option Data ──
      case "rolling-option": {
        const result = await dhanDataRequest("/charts/rollingoption", {
          exchangeSegment: body.exchangeSegment || "NSE_FNO",
          interval: body.interval || "1",
          securityId: body.securityId,
          instrument: body.instrument || "OPTIDX",
          expiryFlag: body.expiryFlag || "MONTH",
          expiryCode: body.expiryCode || 1,
          strike: body.strike || "ATM",
          drvOptionType: body.drvOptionType || "CALL",
          requiredData: body.requiredData || ["open", "high", "low", "close", "volume"],
          fromDate: body.fromDate,
          toDate: body.toDate,
        });
        return NextResponse.json(result.data, { status: result.status });
      }

      // ── Option Chain ──
      case "option-chain": {
        const result = await dhanDataRequest("/optionchain", {
          UnderlyingScrip: body.underlyingScrip || body.securityId || 13,
          UnderlyingSeg: body.underlyingSeg || "IDX_I",
          Expiry: body.expiry,
        });
        return NextResponse.json(result.data, { status: result.status });
      }

      // ── Expiry List ──
      case "expiry-list": {
        const result = await dhanDataRequest("/optionchain/expirylist", {
          UnderlyingScrip: body.underlyingScrip || body.securityId || 13,
          UnderlyingSeg: body.underlyingSeg || "IDX_I",
        });
        return NextResponse.json(result.data, { status: result.status });
      }

      default:
        return NextResponse.json({
          error: "Unknown action",
          actions: [
            "set-token", "disconnect",
            "place-order", "place-super-order", "modify-order", "modify-super-order", "cancel-order", "square-off-all",
            "ltp", "ohlc", "quote", "historical", "intraday", "rolling-option", "option-chain", "expiry-list",
          ],
        }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
