import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const KITE_API_KEY = process.env.KITE_API_KEY || "tnclwniweywe4h7u";
const KITE_API_SECRET = process.env.KITE_API_SECRET || "72e645q31saz36kmqzvfl9kgccqxl026";
const KITE_BASE = "https://api.kite.trade";

// Access token needs to be obtained via login flow
// For now we store it in memory after login
let accessToken: string | null = process.env.KITE_ACCESS_TOKEN || null;

interface KiteResponse {
  status: string;
  data?: unknown;
  error_type?: string;
  message?: string;
}

async function kiteRequest(path: string, method: string = "GET", body?: Record<string, unknown>): Promise<KiteResponse> {
  if (!accessToken) {
    return { status: "error", error_type: "TokenException", message: "Not logged in. Complete Kite login first." };
  }

  const headers: Record<string, string> = {
    "X-Kite-Version": "3",
    "Authorization": `token ${KITE_API_KEY}:${accessToken}`,
  };

  const options: RequestInit = { method, headers, cache: "no-store" };

  if (body && method !== "GET") {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    options.body = new URLSearchParams(body as Record<string, string>).toString();
  }

  const res = await fetch(`${KITE_BASE}${path}`, options);
  return await res.json();
}

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action");

  try {
    switch (action) {
      case "login-url": {
        // Generate Kite login URL
        const loginUrl = `https://kite.zerodha.com/connect/login?v=3&api_key=${KITE_API_KEY}`;
        return NextResponse.json({ url: loginUrl, status: "ok" });
      }

      case "status": {
        if (!accessToken) {
          return NextResponse.json({ logged_in: false, api_key: KITE_API_KEY });
        }
        const profile = await kiteRequest("/user/profile");
        if (profile.status === "success") {
          return NextResponse.json({ logged_in: true, profile: profile.data });
        }
        return NextResponse.json({ logged_in: false, error: profile.message });
      }

      case "profile": {
        const data = await kiteRequest("/user/profile");
        return NextResponse.json(data);
      }

      case "margins": {
        const data = await kiteRequest("/user/margins");
        return NextResponse.json(data);
      }

      case "holdings": {
        const data = await kiteRequest("/portfolio/holdings");
        return NextResponse.json(data);
      }

      case "positions": {
        const data = await kiteRequest("/portfolio/positions");
        return NextResponse.json(data);
      }

      case "orders": {
        const data = await kiteRequest("/orders");
        return NextResponse.json(data);
      }

      case "trades": {
        const data = await kiteRequest("/trades");
        return NextResponse.json(data);
      }

      case "ltp": {
        const instruments = req.nextUrl.searchParams.get("instruments") || "";
        const data = await kiteRequest(`/quote/ltp?${instruments.split(",").map(i => `i=${i}`).join("&")}`);
        return NextResponse.json(data);
      }

      case "quote": {
        const instruments = req.nextUrl.searchParams.get("instruments") || "";
        const data = await kiteRequest(`/quote?${instruments.split(",").map(i => `i=${i}`).join("&")}`);
        return NextResponse.json(data);
      }

      case "instruments": {
        const exchange = req.nextUrl.searchParams.get("exchange") || "NSE";
        const res = await fetch(`${KITE_BASE}/instruments/${exchange}`, {
          headers: { "X-Kite-Version": "3", "Authorization": `token ${KITE_API_KEY}:${accessToken}` },
          cache: "no-store",
        });
        const text = await res.text();
        // Parse CSV — just return first 100 rows as JSON
        const lines = text.split("\n").slice(0, 101);
        const headers = lines[0].split(",");
        const instruments = lines.slice(1).filter(l => l.trim()).map(line => {
          const vals = line.split(",");
          const obj: Record<string, string> = {};
          headers.forEach((h, i) => obj[h] = vals[i] || "");
          return obj;
        });
        return NextResponse.json({ status: "success", data: instruments });
      }

      default:
        return NextResponse.json({ error: "Unknown action. Use: status, profile, margins, holdings, positions, orders, trades, ltp, quote, login-url" }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ status: "error", message: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const action = body.action;

  try {
    switch (action) {
      case "set-token": {
        // Set access token after Kite login callback
        accessToken = body.access_token;
        return NextResponse.json({ status: "ok", message: "Access token set" });
      }

      case "generate-session": {
        // Exchange request_token for access_token
        const requestToken = body.request_token;
        if (!requestToken) {
          return NextResponse.json({ status: "error", message: "request_token required" });
        }

        // Generate checksum
        const encoder = new TextEncoder();
        const data = encoder.encode(KITE_API_KEY + requestToken + KITE_API_SECRET);
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        const checksum = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

        const res = await fetch(`${KITE_BASE}/session/token`, {
          method: "POST",
          headers: {
            "X-Kite-Version": "3",
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            api_key: KITE_API_KEY,
            request_token: requestToken,
            checksum,
          }).toString(),
        });

        const result = await res.json();
        if (result.status === "success" && result.data?.access_token) {
          accessToken = result.data.access_token;
          return NextResponse.json({ status: "success", data: result.data });
        }
        return NextResponse.json(result);
      }

      case "place-order": {
        const orderData = {
          tradingsymbol: body.tradingsymbol,
          exchange: body.exchange || "NSE",
          transaction_type: body.transaction_type || "BUY",
          order_type: body.order_type || "MARKET",
          quantity: String(body.quantity || 1),
          product: body.product || "MIS",
          validity: body.validity || "DAY",
          ...(body.price ? { price: String(body.price) } : {}),
          ...(body.trigger_price ? { trigger_price: String(body.trigger_price) } : {}),
        };
        const result = await kiteRequest("/orders/regular", "POST", orderData);
        return NextResponse.json(result);
      }

      case "modify-order": {
        const result = await kiteRequest(`/orders/regular/${body.order_id}`, "PUT", {
          order_type: body.order_type,
          quantity: String(body.quantity),
          ...(body.price ? { price: String(body.price) } : {}),
        });
        return NextResponse.json(result);
      }

      case "cancel-order": {
        const result = await kiteRequest(`/orders/regular/${body.order_id}`, "DELETE");
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json({ error: "Unknown action. Use: set-token, generate-session, place-order, modify-order, cancel-order" }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ status: "error", message: String(err) }, { status: 500 });
  }
}
