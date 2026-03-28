import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BRIDGE_URL = process.env.GROWW_BRIDGE_URL || "http://localhost:5050";

/**
 * Attempts to fetch live market context from Groww bridge + Yahoo to inject into chat.
 * Returns whatever data is available; never fails.
 */
async function fetchMarketContext(userMessage: string): Promise<string> {
  const ctx: string[] = [];

  // Detect symbols mentioned in the message
  const symbolPatterns = [
    { re: /nifty|banknifty|finnifty/i, symbols: "NSE_NIFTY,NSE_BANKNIFTY", underlying: "NIFTY" },
    { re: /reliance/i, symbols: "NSE_RELIANCE", underlying: "RELIANCE" },
    { re: /tcs/i, symbols: "NSE_TCS", underlying: "TCS" },
    { re: /hdfc/i, symbols: "NSE_HDFCBANK", underlying: "HDFCBANK" },
    { re: /infy|infosys/i, symbols: "NSE_INFY", underlying: "INFY" },
    { re: /sbi/i, symbols: "NSE_SBIN", underlying: "SBIN" },
    { re: /icici/i, symbols: "NSE_ICICIBANK", underlying: "ICICIBANK" },
    { re: /tata\s*motor/i, symbols: "NSE_TATAMOTORS", underlying: "TATAMOTORS" },
    { re: /itc/i, symbols: "NSE_ITC", underlying: "ITC" },
  ];

  const detectedSymbols: string[] = [];
  const detectedUnderlyings: string[] = [];
  for (const p of symbolPatterns) {
    if (p.re.test(userMessage)) {
      detectedSymbols.push(p.symbols);
      detectedUnderlyings.push(p.underlying);
    }
  }

  // Always include NIFTY context
  if (detectedSymbols.length === 0) {
    detectedSymbols.push("NSE_NIFTY,NSE_BANKNIFTY");
    detectedUnderlyings.push("NIFTY");
  }

  // ── Try Groww bridge for LTP ──
  try {
    const allSyms = detectedSymbols.join(",");
    const ltpRes = await fetch(`${BRIDGE_URL}/ltp?symbols=${allSyms}&segment=CASH`, { cache: "no-store" });
    if (ltpRes.ok) {
      const ltp = await ltpRes.json();
      if (ltp.data) {
        ctx.push("=== LIVE PRICES (Groww) ===");
        for (const [sym, price] of Object.entries(ltp.data)) {
          ctx.push(`${sym}: ₹${price}`);
        }
      }
    }
  } catch { /* bridge not running */ }

  // ── Fetch Option Chain data (from our own /api/oi which tries Groww → Fyers → Mock) ──
  const wantsOptions = /option|oi|open interest|chain|strike|call|put|ce\b|pe\b|straddle|strangle|spread|iron|condor|greeks|delta|theta|gamma|vega|iv\b|implied vol|which.*buy|recommend|position|trade/i.test(userMessage);
  if (wantsOptions) {
    try {
      const underlying = detectedUnderlyings[0] || "NIFTY";
      const symbol = underlying === "NIFTY" ? "NSE:NIFTY50-INDEX" : underlying === "BANKNIFTY" ? "NSE:BANKNIFTY-INDEX" : `NSE:${underlying}-EQ`;
      const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";
      const ocRes = await fetch(`${baseUrl}/api/oi?symbol=${encodeURIComponent(symbol)}&strikecount=10`, { cache: "no-store" });
      if (ocRes.ok) {
        const oc = await ocRes.json();
        if (oc.data?.optionsChain) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const chain: any[] = oc.data.optionsChain;
          const spotEntry = chain.find((c) => c.strike_price === -1);
          const spotPrice = spotEntry?.ltp || spotEntry?.fp || 0;
          const calls = chain.filter((c) => c.option_type === "CE").sort((a, b) => a.strike_price - b.strike_price);
          const puts = chain.filter((c) => c.option_type === "PE").sort((a, b) => a.strike_price - b.strike_price);
          const pcr = oc.data.callOi > 0 ? (oc.data.putOi / oc.data.callOi).toFixed(2) : "N/A";

          ctx.push(`\n=== OPTION CHAIN: ${underlying} (Spot: ${spotPrice}) ===`);
          ctx.push(`PCR: ${pcr} | Call OI: ${oc.data.callOi} | Put OI: ${oc.data.putOi}`);
          ctx.push(`Bias: ${+pcr > 1.2 ? "BULLISH (heavy put writing = support)" : +pcr < 0.8 ? "BEARISH (heavy call writing = resistance)" : "NEUTRAL"}`);
          ctx.push(`Source: ${oc.source}`);
          ctx.push("Strike | CE_LTP | CE_OI | CE_OI_Change | PE_LTP | PE_OI | PE_OI_Change");

          const allStrikes = [...new Set([...calls, ...puts].map((c) => c.strike_price))].sort((a: number, b: number) => a - b);
          const atmStrike = allStrikes.reduce((prev: number, curr: number) => Math.abs(curr - spotPrice) < Math.abs(prev - spotPrice) ? curr : prev, allStrikes[0] || 0);

          for (const s of allStrikes.filter((st: number) => Math.abs(st - atmStrike) <= spotPrice * 0.02)) {
            const ce = calls.find((c) => c.strike_price === s);
            const pe = puts.find((p) => p.strike_price === s);
            const isATM = s === atmStrike ? " ← ATM" : "";
            ctx.push(`${s}${isATM} | ${ce?.ltp ?? "—"} | ${ce?.oi ?? "—"} | ${ce?.oich > 0 ? "+" : ""}${ce?.oich ?? "—"} | ${pe?.ltp ?? "—"} | ${pe?.oi ?? "—"} | ${pe?.oich > 0 ? "+" : ""}${pe?.oich ?? "—"}`);
          }

          // Max pain
          const maxPain = allStrikes.reduce((best: { s: number; p: number }, strike: number) => {
            const pain = allStrikes.reduce((t: number, s: number) => {
              const cOI = calls.find((c) => c.strike_price === s)?.oi || 0;
              const pOI = puts.find((p) => p.strike_price === s)?.oi || 0;
              return t + (s > strike ? cOI * (s - strike) : 0) + (s < strike ? pOI * (strike - s) : 0);
            }, 0);
            return pain < best.p ? { s: strike, p: pain } : best;
          }, { s: 0, p: Infinity });
          ctx.push(`Max Pain: ${maxPain.s} | Spot distance: ${(spotPrice - maxPain.s).toFixed(0)} pts`);
        }
      }
    } catch { /* noop */ }
  }

  // ── Always fetch from our own prices API (reliable, works on Vercel) ──
  try {
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";
    const yfRes = await fetch(`${baseUrl}/api/prices`, { cache: "no-store" });
    if (yfRes.ok) {
      const yf = await yfRes.json();
      if (yf.quotes?.length > 0) {
        ctx.push("\n=== LIVE MARKET DATA (All Instruments) ===");
        for (const q of yf.quotes) {
          ctx.push(`${q.displayName || q.symbol}: ${q.price} (${q.changePct >= 0 ? "+" : ""}${q.changePct}%) | High: ${q.high} | Low: ${q.low} | Vol: ${q.volume}`);
        }
      }
    }
  } catch { /* noop */ }

  // Also fetch extended symbols if user asks about specific assets
  try {
    const extraSymbols = "^GSPC,^IXIC,^DJI,^RUT,^FTSE,^N225,AAPL,MSFT,NVDA,TSLA,GOOGL,AMZN";
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";
    const extRes = await fetch(`${baseUrl}/api/prices?symbols=${encodeURIComponent(extraSymbols)}`, { cache: "no-store" });
    if (extRes.ok) {
      const ext = await extRes.json();
      if (ext.quotes?.length > 0) {
        ctx.push("\n=== GLOBAL INDICES & US STOCKS ===");
        for (const q of ext.quotes) {
          ctx.push(`${q.displayName || q.symbol}: ${q.price} (${q.changePct >= 0 ? "+" : ""}${q.changePct}%)`);
        }
      }
    }
  } catch { /* noop */ }

  // ── Try to get historical data if user asks about past ──
  const wantsHistory = /past|history|historical|yesterday|last week|backtest|previous|earlier|ago|chart data/i.test(userMessage);
  if (wantsHistory && detectedUnderlyings.length > 0) {
    try {
      const now = new Date();
      const end = now.toISOString().slice(0, 10) + " 15:30:00";
      const start = new Date(now.getTime() - 5 * 86400000).toISOString().slice(0, 10) + " 09:15:00";
      const histRes = await fetch(
        `${BRIDGE_URL}/historical?symbol=${detectedUnderlyings[0]}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&interval=60`,
        { cache: "no-store" }
      );
      if (histRes.ok) {
        const hist = await histRes.json();
        if (hist.data?.candles?.length > 0) {
          ctx.push(`\n=== HISTORICAL DATA: ${detectedUnderlyings[0]} (last 5 days, 1hr candles) ===`);
          ctx.push("Time | Open | High | Low | Close | Volume");
          for (const c of hist.data.candles.slice(-20)) {
            const ts = typeof c[0] === "string" ? c[0] : new Date(c[0] * 1000).toISOString().slice(0, 16);
            ctx.push(`${ts} | ${c[1]} | ${c[2]} | ${c[3]} | ${c[4]} | ${c[5]}`);
          }
        }
      }
    } catch { /* noop */ }
  }

  return ctx.length > 0 ? "\n\n--- LIVE MARKET DATA (auto-fetched) ---\n" + ctx.join("\n") : "";
}

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        response: "Anthropic API key not configured. Add ANTHROPIC_API_KEY to your .env.local file or Vercel environment variables to enable the AI chatbot.",
        error: true,
      });
    }

    // Get latest user message for context fetching
    const lastUserMsg = [...messages].reverse().find((m: { role: string }) => m.role === "user")?.content || "";

    // Fetch live market data relevant to the question
    const marketCtx = await fetchMarketContext(lastUserMsg);

    const systemPrompt = `You are Mother Algo's AI trading assistant — an expert in Indian and global markets with deep knowledge of options, derivatives, and quantitative trading.

## Your capabilities:
- **Live Market Analysis**: You have access to real-time prices, option chains with Greeks (delta, gamma, theta, vega, IV), and OI data injected into the conversation context
- **Historical Pattern Recognition**: When given historical data, identify chart patterns, support/resistance levels, and similar past setups
- **Options Strategy**: Analyze option chains, suggest strategies based on Greeks/OI/IV, identify mispriced options
- **T+0 Trade Identification**: When asked, find current-day option contracts with similar setups to historical patterns and suggest specific entry/exit levels
- **Risk Management**: Always include position sizing, max loss, and risk-reward ratios

## How to respond:
1. **Always use the injected market data** — reference specific numbers from the live data
2. **Be specific**: Give exact strike prices, premium levels, stop losses, targets
3. **Show your work**: Explain WHY a setup is interesting (e.g., "ATM 24500CE has delta 0.50, theta -8.1, and IV at 12.3% which is below 20-day average")
4. **Structure trade ideas** as:
   - **Setup**: What pattern/condition you see
   - **Entry**: Specific contract + price
   - **Stop Loss**: Where to exit if wrong
   - **Target**: Expected move / exit level
   - **Risk-Reward**: Quantified ratio
   - **Max Loss**: In rupees for the position size
5. **Compare to history**: When you have historical data, mention similar setups and outcomes
6. **Indian market context**: Use NSE lot sizes, Indian trading hours (9:15-15:30), weekly expiries (Thu), monthly expiries (last Thu)

## NIFTY lot sizes: NIFTY=25, BANKNIFTY=15, FINNIFTY=25
## Important: Never say "I recommend" — always say "The data suggests" or "Based on the setup". Frame as analysis, not advice.

${marketCtx}`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: systemPrompt,
        messages: messages.map((m: { role: string; content: string }) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ response: `API error: ${res.status}`, error: true });
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || "No response";

    return NextResponse.json({ response: text, error: false, hasMarketData: !!marketCtx });
  } catch (err) {
    return NextResponse.json({ response: `Error: ${String(err)}`, error: true });
  }
}
