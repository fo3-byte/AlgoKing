import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Proxy to the Groww Python bridge server.
 * Query params:
 *   action — quote | ltp | ohlc | option-chain | greeks | expiries | contracts | historical | historical-fno | health
 *   ...rest — forwarded to the bridge server
 *
 * The bridge runs at GROWW_BRIDGE_URL (default http://localhost:5050)
 */

const BRIDGE_URL = process.env.GROWW_BRIDGE_URL || "http://localhost:5050";

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action") || "health";
  const params = new URLSearchParams();

  // Forward all params except 'action'
  req.nextUrl.searchParams.forEach((v, k) => {
    if (k !== "action") params.set(k, v);
  });

  const url = `${BRIDGE_URL}/${action}?${params.toString()}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({
      error: `Cannot reach Groww bridge at ${BRIDGE_URL}. Make sure groww_bridge.py is running.`,
      detail: String(err),
      help: "Run: python groww_bridge.py",
    }, { status: 503 });
  }
}
