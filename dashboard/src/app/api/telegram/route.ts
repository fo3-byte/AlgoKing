import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8440970690:AAFOHoVTCw6Gyx4Mla7Q4pOUnfzeb8fDDoE";
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || "6776228988";
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;
const DASHBOARD_URL = "https://algomaster-pro.vercel.app";

// ── Helper: send message ──
async function sendTg(text: string, parseMode = "Markdown") {
  const res = await fetch(`${API_BASE}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: parseMode, disable_web_page_preview: true }),
  });
  return res.json();
}

// ── Helper: fetch from our own API (tries local first, then Vercel) ──
async function selfFetch(path: string, body?: Record<string, unknown>) {
  const bases = ["http://localhost:3000", DASHBOARD_URL];
  for (const base of bases) {
    try {
      const url = `${base}${path}`;
      const opts: RequestInit = { cache: "no-store" };
      if (body) {
        opts.method = "POST";
        opts.headers = { "Content-Type": "application/json" };
        opts.body = JSON.stringify(body);
      }
      const res = await fetch(url, opts);
      if (res.ok) return res.json();
    } catch { /* try next */ }
  }
  return { error: "Could not reach dashboard" };
}

// ══════════════════════════════════════════════════════════════════
// GET — setup webhook + status
// ══════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action");

  if (action === "setup-webhook") {
    const webhookUrl = `${DASHBOARD_URL}/api/telegram`;
    const res = await fetch(`${API_BASE}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl, allowed_updates: ["message"] }),
    });
    const data = await res.json();
    return NextResponse.json({ webhook: webhookUrl, ...data });
  }

  if (action === "remove-webhook") {
    const res = await fetch(`${API_BASE}/deleteWebhook`, { method: "POST" });
    const data = await res.json();
    return NextResponse.json(data);
  }

  if (action === "status") {
    const res = await fetch(`${API_BASE}/getWebhookInfo`);
    const data = await res.json();
    return NextResponse.json(data);
  }

  return NextResponse.json({ actions: ["setup-webhook", "remove-webhook", "status"] });
}

// ══════════════════════════════════════════════════════════════════
// POST — handles both internal actions AND Telegram webhook
// ══════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  const body = await req.json();

  // ── Telegram Webhook (incoming message from user) ──
  if (body.update_id && body.message) {
    const msg = body.message;
    const text = (msg.text || "").trim();
    const chatId = msg.chat?.id;

    // Only respond to our chat
    if (String(chatId) !== CHAT_ID) {
      return NextResponse.json({ ok: true });
    }

    await handleCommand(text);
    return NextResponse.json({ ok: true });
  }

  // ── Internal API actions (from dashboard) ──
  const action = body.action as string;

  try {
    switch (action) {
      case "trade-alert": {
        const { strategy, market, direction, entry, sl, tp, mcScore, probProfit, confidence } = body;
        const dirEmoji = direction === "LONG" ? "🔼" : "🔽";
        const confEmoji = confidence === "HIGH" ? "⚡" : confidence === "MEDIUM" ? "🔶" : "⚪";
        const message = `👑 *AlgoKing Signal*\n\n🎯 *High Probability Trade*\n\n📊 Strategy: ${strategy}\n📈 Market: ${market}\n${dirEmoji} Direction: ${direction}\n\n💰 Entry: ₹${Number(entry).toLocaleString()}\n🛑 SL: ₹${Number(sl).toLocaleString()}\n🎯 TP: ₹${Number(tp).toLocaleString()}\n\n📊 MC Score: ${mcScore}\n📈 P(profit): ${probProfit}%\n${confEmoji} Confidence: ${confidence}\n\n_Trade the process, not the P&L._`;
        const data = await sendTg(message);
        return NextResponse.json({ sent: data.ok });
      }

      case "send": {
        const data = await sendTg(body.message, body.parseMode || "Markdown");
        return NextResponse.json({ sent: data.ok });
      }

      case "morning-reminder": {
        const message = `🌅 *Good Morning, Kunaal!*\n\n⏰ Time to update your Dhan API token.\n\n1️⃣ Login to api.dhan.co\n2️⃣ Generate new access token\n3️⃣ Dashboard → Workflows → Connect Dhan\n4️⃣ Client ID: \`b1e4d838\`\n\nOr run: \`python3 dhan_auto_login.py\`\n\n🔗 [Open Dashboard](${DASHBOARD_URL})`;
        const data = await sendTg(message);
        return NextResponse.json({ sent: data.ok });
      }

      case "order-executed": {
        const { orderId, symbol, side, qty, price, broker } = body;
        const message = `✅ *Order Executed*\n\n🏦 Broker: ${broker || "Dhan"}\n📋 Order ID: \`${orderId}\`\n📊 ${symbol}\n${side === "BUY" ? "🟢" : "🔴"} ${side} × ${qty}\n💰 Price: ₹${Number(price).toLocaleString()}`;
        const data = await sendTg(message);
        return NextResponse.json({ sent: data.ok });
      }

      case "daily-summary": {
        const { totalPnl, trades, winRate, capital } = body;
        const pnlEmoji = totalPnl >= 0 ? "📈" : "📉";
        const message = `📊 *Daily Trading Summary*\n\n${pnlEmoji} P&L: ${totalPnl >= 0 ? "+" : ""}₹${Number(totalPnl).toLocaleString()}\n📋 Trades: ${trades}\n🎯 Win Rate: ${winRate}%\n💰 Capital: ₹${Number(capital).toLocaleString()}\n\n_Keep compounding. 5L → 50L._`;
        const data = await sendTg(message);
        return NextResponse.json({ sent: data.ok });
      }

      default:
        return NextResponse.json({ error: "Unknown action", actions: ["trade-alert", "send", "morning-reminder", "order-executed", "daily-summary"] }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ══════════════════════════════════════════════════════════════════
// COMMAND HANDLER — processes Telegram messages from user
// ══════════════════════════════════════════════════════════════════

async function handleCommand(text: string) {
  const cmd = text.toLowerCase().split(" ")[0];

  switch (cmd) {
    case "/start":
    case "/help": {
      await sendTg([
        `👑 *AlgoKing Bot*`,
        ``,
        `*Indian Markets (Dhan):*`,
        `/status — All account statuses`,
        `/positions — Open positions (Dhan)`,
        `/orders — Today's orders (Dhan)`,
        `/funds — Account balance`,
        `/pnl — Today's P&L`,
        `/market — NIFTY, BANKNIFTY, VIX`,
        `/squareoff — Square off all Dhan positions`,
        ``,
        `*Crypto (Delta Exchange):*`,
        `/crypto — BTC + ETH prices & positions`,
        `/delta — Delta Exchange wallet & positions`,
        `/scan — Scan for cheap BTC/ETH options NOW`,
        `/buy — Buy crypto option (e.g. /buy C-BTC-70000-030426 5)`,
        `/sell — Sell/close position (e.g. /sell C-BTC-70000-030426 5)`,
        `/closeall — Close all Delta positions`,
        ``,
        `*Or just talk to me naturally:*`,
        `"Buy ETH puts", "What's BTC doing?", "Find me a trade"`,
        ``,
        `🔗 [Dashboard](${DASHBOARD_URL})`,
      ].join("\n"));
      break;
    }

    case "/status": {
      try {
        const dhan = await selfFetch("/api/dhan?action=status");
        const delta = await selfFetch("/api/delta?action=status");
        const dhanStatus = dhan.connected ? `✅ Connected (${dhan.clientId})` : `❌ Not connected`;
        const deltaStatus = delta.connected ? `✅ Connected` : `❌ Not connected`;

        let deltaWallet = "";
        if (delta.connected) {
          const w = await selfFetch("/api/delta?action=wallet");
          deltaWallet = w.meta ? `\n   Equity: $${parseFloat(w.meta.net_equity).toFixed(2)}` : "";
        }

        await sendTg([
          `📊 *System Status*`,
          ``,
          `🏦 Dhan: ${dhanStatus}`,
          `💎 Delta: ${deltaStatus}${deltaWallet}`,
          `🌐 Dashboard: ✅ Online`,
          `🔗 [Dashboard](${DASHBOARD_URL})`,
        ].join("\n"));
      } catch {
        await sendTg("⚠️ Could not reach dashboard.");
      }
      break;
    }

    case "/crypto": {
      try {
        const scan = await selfFetch("/api/delta-scanner?action=scan");
        const delta = await selfFetch("/api/delta?action=positions");
        const positions = delta.result || [];
        const openPos = positions.filter((p: { size?: string }) => parseFloat(p.size || "0") > 0);

        let posLines = "No open positions";
        if (openPos.length > 0) {
          posLines = openPos.map((p: { product_symbol?: string; size?: string; entry_price?: string; unrealized_pnl?: string }) => {
            const pnl = parseFloat(p.unrealized_pnl || "0");
            return `${pnl >= 0 ? "🟢" : "🔴"} ${p.product_symbol} | ${p.size}x @ $${p.entry_price} | PnL: $${pnl.toFixed(2)}`;
          }).join("\n");
        }

        await sendTg([
          `💎 *Crypto Markets*`,
          ``,
          `₿ BTC: $${scan.btcPrice?.toLocaleString() || "?"} (${scan.btc24hChange >= 0 ? "+" : ""}${scan.btc24hChange?.toFixed(1) || "0"}%)`,
          `Ξ ETH: $${scan.ethPrice?.toLocaleString() || "?"}`,
          `Bias: ${scan.bias || "?"}`,
          `Options available: ${scan.totalOptions || 0}`,
          ``,
          `📊 *Positions:*`,
          posLines,
        ].join("\n"));
      } catch (e) {
        await sendTg(`⚠️ Error: ${String(e).slice(0, 200)}`);
      }
      break;
    }

    case "/delta": {
      try {
        const wallet = await selfFetch("/api/delta?action=wallet");
        const positions = await selfFetch("/api/delta?action=positions");

        if (wallet.meta) {
          const equity = parseFloat(wallet.meta.net_equity).toFixed(2);
          const openPos = (positions.result || []).filter((p: { size?: string }) => parseFloat(p.size || "0") > 0);

          let posLines = "No open positions";
          if (openPos.length > 0) {
            posLines = openPos.map((p: { product_symbol?: string; size?: string; entry_price?: string; unrealized_pnl?: string }) => {
              const pnl = parseFloat(p.unrealized_pnl || "0");
              return `  ${pnl >= 0 ? "🟢" : "🔴"} ${p.product_symbol}\n    ${p.size}x @ $${p.entry_price} | PnL: $${pnl.toFixed(2)}`;
            }).join("\n");
          }

          await sendTg([
            `💎 *Delta Exchange*`,
            ``,
            `💰 Equity: $${equity}`,
            ``,
            `📊 Positions:`,
            posLines,
          ].join("\n"));
        } else {
          await sendTg("⚠️ Delta not connected. Check API keys.");
        }
      } catch {
        await sendTg("⚠️ Delta not reachable.");
      }
      break;
    }

    case "/scan": {
      await sendTg("🔍 _Running 5-layer algo scan on BTC + ETH + NIFTY + BANKNIFTY..._");
      try {
        // Run both scanners in parallel
        const [cryptoScan, indiaScan] = await Promise.allSettled([
          selfFetch("/api/delta-scanner?action=scan"),
          selfFetch("/api/india-scanner?action=scan"),
        ]);

        const crypto = cryptoScan.status === "fulfilled" ? cryptoScan.value : {};
        const india = indiaScan.status === "fulfilled" ? indiaScan.value : {};

        const lines = [`🔍 *AlgoKing Full Scan*\n`];

        // Crypto section
        if (crypto.btc) {
          lines.push(`💎 *CRYPTO*`);
          lines.push(`₿ BTC: $${crypto.btc.price?.toLocaleString() || "?"} | RSI: ${crypto.btc.rsi?.toFixed(0) || "?"} | ${crypto.btc.bias || "?"}`);
          lines.push(`Ξ ETH: $${crypto.eth?.price?.toLocaleString() || "?"} | RSI: ${crypto.eth?.rsi?.toFixed(0) || "?"} | ${crypto.eth?.bias || "?"}`);
          lines.push(`Options: ${crypto.totalOptions || 0} | Signals >60%: ${crypto.signalsAbove60 || 0}`);

          if (crypto.topSignals?.length > 0) {
            lines.push(`\n🎯 *Crypto Signals:*`);
            for (const s of crypto.topSignals.slice(0, 3)) {
              lines.push(`  ${s.symbol} | Score: ${(s.score * 100).toFixed(0)}% | ${s.direction}`);
              lines.push(`  _${s.reason.slice(0, 80)}_`);
            }
          } else {
            lines.push(`  No signals above threshold — algo is waiting for A+ setup`);
          }
        } else if (crypto.error) {
          lines.push(`💎 Crypto: ⚠️ ${crypto.error}`);
        }

        // India section
        if (india.nifty) {
          lines.push(`\n🇮🇳 *INDIAN MARKETS*`);
          lines.push(`NIFTY: ₹${india.nifty.price?.toLocaleString() || "?"} | RSI: ${india.nifty.rsi?.toFixed(0) || "?"} | ${india.nifty.bias || "?"}`);
          lines.push(`BANKNIFTY: ₹${india.banknifty?.price?.toLocaleString() || "?"} | RSI: ${india.banknifty?.rsi?.toFixed(0) || "?"} | ${india.banknifty?.bias || "?"}`);
          lines.push(`VIX: ${india.vix?.toFixed(1) || "?"} | Market: ${india.marketHours ? "OPEN" : "CLOSED"}`);

          if (india.signals?.length > 0) {
            lines.push(`\n🎯 *India Signals:*`);
            for (const s of india.signals.slice(0, 3)) {
              lines.push(`  ${s.instrument} | Score: ${(s.score * 100).toFixed(0)}% | ${s.direction}`);
              lines.push(`  _${s.reason.slice(0, 80)}_`);
            }
          } else {
            lines.push(`  No signals — algo waiting`);
          }
        }

        if (lines.length <= 2) {
          lines.push("⚠️ Could not reach scanners. Try again.");
        }

        await sendTg(lines.join("\n"));
      } catch (e) {
        await sendTg(`⚠️ Scanner error: ${String(e).slice(0, 150)}`);
      }
      break;
    }

    case "/buy": {
      const parts = text.split(/\s+/);
      if (parts.length < 2) {
        await sendTg("Usage: /buy SYMBOL SIZE [PRICE]\nExample: `/buy C-BTC-70000-030426 5`\nOr: `/buy C-BTC-70000-030426 5 10.50`");
        break;
      }
      const symbol = parts[1];
      const size = parseInt(parts[2] || "1");
      const price = parts[3] ? parseFloat(parts[3]) : undefined;

      await sendTg(`📦 _Placing order: Buy ${size}x ${symbol}${price ? ` @ $${price}` : " at market"}..._`);
      try {
        const orderBody: Record<string, unknown> = {
          action: "place-order",
          productSymbol: symbol,
          size,
          side: "buy",
          orderType: price ? "limit_order" : "market_order",
          timeInForce: price ? "gtc" : "ioc",
          clientOrderId: `tg_buy_${Date.now()}`,
        };
        if (price) orderBody.limitPrice = String(price);

        const result = await selfFetch("/api/delta", orderBody);
        if (result.success !== false && result.result) {
          const oid = result.result.id || "?";
          const state = result.result.state || "?";
          await sendTg(`✅ *Order Placed*\n\nBuy ${size}x ${symbol}\nOrder ID: \`${oid}\`\nState: ${state}`);
        } else {
          await sendTg(`❌ Order failed: ${JSON.stringify(result.error || result).slice(0, 300)}`);
        }
      } catch (e) {
        await sendTg(`❌ Error: ${String(e).slice(0, 200)}`);
      }
      break;
    }

    case "/sell": {
      const parts = text.split(/\s+/);
      if (parts.length < 2) {
        await sendTg("Usage: /sell SYMBOL SIZE [PRICE]\nExample: `/sell C-BTC-70000-030426 5`");
        break;
      }
      const symbol = parts[1];
      const size = parseInt(parts[2] || "1");
      const price = parts[3] ? parseFloat(parts[3]) : undefined;

      await sendTg(`📦 _Selling ${size}x ${symbol}..._`);
      try {
        const orderBody: Record<string, unknown> = {
          action: "place-order",
          productSymbol: symbol,
          size,
          side: "sell",
          orderType: price ? "limit_order" : "market_order",
          timeInForce: price ? "gtc" : "ioc",
          reduceOnly: true,
          clientOrderId: `tg_sell_${Date.now()}`,
        };
        if (price) orderBody.limitPrice = String(price);

        const result = await selfFetch("/api/delta", orderBody);
        if (result.success !== false && result.result) {
          await sendTg(`✅ *Sold*\n\n${size}x ${symbol}\nOrder: \`${result.result.id}\` | ${result.result.state}`);
        } else {
          await sendTg(`❌ Sell failed: ${JSON.stringify(result.error || result).slice(0, 300)}`);
        }
      } catch (e) {
        await sendTg(`❌ Error: ${String(e).slice(0, 200)}`);
      }
      break;
    }

    case "/closeall": {
      await sendTg("🔴 _Closing all Delta positions..._");
      try {
        const positions = await selfFetch("/api/delta?action=positions");
        const openPos = (positions.result || []).filter((p: { size?: string }) => parseFloat(p.size || "0") > 0);

        if (openPos.length === 0) {
          await sendTg("📋 No open positions to close.");
          break;
        }

        let closed = 0;
        for (const p of openPos) {
          const result = await selfFetch("/api/delta", {
            action: "close-position",
            productId: p.product_id || p.product?.id,
          });
          if (result.success !== false) closed++;
        }
        await sendTg(`✅ Closed ${closed}/${openPos.length} positions.`);
      } catch {
        await sendTg("⚠️ Error closing positions.");
      }
      break;
    }

    case "/positions": {
      try {
        const data = await selfFetch("/api/dhan?action=positions");
        if (Array.isArray(data) && data.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const openPositions = data.filter((p: any) => p.netQty && p.netQty !== 0);
          if (openPositions.length === 0) {
            await sendTg("📋 No open positions.");
            break;
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const lines = openPositions.map((p: any) =>
            `${p.netQty > 0 ? "🟢" : "🔴"} ${p.tradingSymbol || p.securityId} | Qty: ${p.netQty} | P&L: ₹${(p.realizedProfit || 0 + p.unrealizedProfit || 0).toLocaleString()}`
          );
          await sendTg(`📋 *Open Positions (${openPositions.length})*\n\n${lines.join("\n")}`);
        } else {
          await sendTg("📋 No open positions. " + (data?.error ? `(${data.error})` : ""));
        }
      } catch {
        await sendTg("⚠️ Dhan not connected. Update token first.");
      }
      break;
    }

    case "/orders": {
      try {
        const data = await selfFetch("/api/dhan?action=orders");
        if (Array.isArray(data) && data.length > 0) {
          const recent = data.slice(-5);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const lines = recent.map((o: any) =>
            `${o.transactionType === "BUY" ? "🟢" : "🔴"} ${o.tradingSymbol || o.securityId} | ${o.transactionType} × ${o.quantity} | ${o.orderStatus}`
          );
          await sendTg(`📋 *Recent Orders (${data.length} today)*\n\n${lines.join("\n")}`);
        } else {
          await sendTg("📋 No orders today. " + (data?.error ? `(${data.error})` : ""));
        }
      } catch {
        await sendTg("⚠️ Dhan not connected.");
      }
      break;
    }

    case "/funds": {
      try {
        const data = await selfFetch("/api/dhan?action=funds");
        if (data && !data.error) {
          const avail = data.availabelBalance || data.availableBalance || data.sodLimit || "N/A";
          const used = data.utilizedAmount || data.usedMargin || "N/A";
          await sendTg(`💰 *Account Funds*\n\n💵 Available: ₹${Number(avail).toLocaleString()}\n📊 Used: ₹${Number(used).toLocaleString()}`);
        } else {
          await sendTg("⚠️ Dhan not connected. " + (data?.error || ""));
        }
      } catch {
        await sendTg("⚠️ Dhan not connected.");
      }
      break;
    }

    case "/pnl": {
      try {
        const data = await selfFetch("/api/dhan?action=positions");
        if (Array.isArray(data)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const totalPnl = data.reduce((s: number, p: any) => s + (p.realizedProfit || 0) + (p.unrealizedProfit || 0), 0);
          const pnlEmoji = totalPnl >= 0 ? "📈" : "📉";
          await sendTg(`${pnlEmoji} *Today's P&L*\n\n💰 ${totalPnl >= 0 ? "+" : ""}₹${totalPnl.toLocaleString()}\n📋 Positions: ${data.length}`);
        } else {
          await sendTg("⚠️ Dhan not connected.");
        }
      } catch {
        await sendTg("⚠️ Dhan not connected.");
      }
      break;
    }

    case "/market": {
      try {
        const symbols = "^NSEI,^NSEBANK,^VIX";
        const data = await selfFetch(`/api/prices?symbols=${encodeURIComponent(symbols)}`);
        if (data.quotes?.length) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const lines = data.quotes.map((q: any) => {
            const emoji = q.changePct >= 0 ? "🟢" : "🔴";
            return `${emoji} *${q.displayName || q.symbol}*: ${q.price.toLocaleString()} (${q.changePct >= 0 ? "+" : ""}${q.changePct.toFixed(2)}%)`;
          });
          await sendTg(`📊 *Market Overview*\n\n${lines.join("\n")}`);
        } else {
          await sendTg("⚠️ Could not fetch market data.");
        }
      } catch {
        await sendTg("⚠️ Market data unavailable.");
      }
      break;
    }

    case "/signals": {
      await sendTg(`🎯 *Algo Signals*\n\nSignals are generated when the Mother Algo runs during market hours.\n\nCheck the dashboard for live signals:\n🔗 [Signals Panel](${DASHBOARD_URL})`);
      break;
    }

    case "/squareoff": {
      try {
        const data = await selfFetch("/api/dhan", { action: "square-off-all" });
        await sendTg(`🔴 *Square Off*\n\n${data.message || "Sent square-off request."}\nPositions closed: ${data.squaredOff || 0}`);
      } catch {
        await sendTg("⚠️ Dhan not connected. Cannot square off.");
      }
      break;
    }

    default: {
      if (text.startsWith("/")) {
        await sendTg(`❓ Unknown command: \`${cmd}\`\n\nType /help for available commands.`);
        break;
      }

      // ── Natural language → AI with full live context ──
      await sendTg("🤔 _Analyzing..._");
      try {
        // Fetch ALL live data in parallel
        const [deltaPos, deltaWallet, scanResult, dhanStatus] = await Promise.allSettled([
          selfFetch("/api/delta?action=positions"),
          selfFetch("/api/delta?action=wallet"),
          selfFetch("/api/delta-scanner?action=scan"),
          selfFetch("/api/dhan?action=status"),
        ]);

        const positions = deltaPos.status === "fulfilled" ? deltaPos.value : {};
        const wallet = deltaWallet.status === "fulfilled" ? deltaWallet.value : {};
        const scan = scanResult.status === "fulfilled" ? scanResult.value : {};
        const dhan = dhanStatus.status === "fulfilled" ? dhanStatus.value : {};

        const openPos = (positions.result || []).filter((p: {size?: string}) => parseFloat(p.size || "0") > 0);
        const posLines = openPos.map((p: {product_symbol?: string; size?: string; entry_price?: string; unrealized_pnl?: string}) =>
          `${p.product_symbol}: ${p.size}x @ $${p.entry_price} | PnL: $${p.unrealized_pnl}`
        ).join("\n") || "None";

        const topSignals = (scan.topSignals || []).slice(0, 5).map((s: {symbol: string; score: number; direction: string; reason: string; mark: number; ask: number; dte: number; sizing: {contracts: number; costUsd: number}}) =>
          `${s.symbol} | Score: ${(s.score * 100).toFixed(0)}% | ${s.direction} | $${s.ask || s.mark} | ${s.dte}DTE | ${s.reason}`
        ).join("\n") || "No signals above threshold";

        const systemPrompt = `You are AlgoKing — an elite crypto options trading AI running on Delta Exchange India. You make decisions like Renaissance Technologies and Two Sigma: data-driven, calculated, no emotion.

## YOUR LIVE ACCOUNT (real-time data):
Equity: $${wallet.meta?.net_equity || "?"}
Open Positions:
${posLines}

## MARKET STATE (live):
BTC: $${scan.btc?.price?.toLocaleString() || "?"} | RSI: ${scan.btc?.rsi?.toFixed(0) || "?"} | 24h: ${scan.btc?.change24h?.toFixed(1) || "0"}% | Bias: ${scan.btc?.bias || "?"}
ETH: $${scan.eth?.price?.toLocaleString() || "?"} | RSI: ${scan.eth?.rsi?.toFixed(0) || "?"} | 24h: ${scan.eth?.change24h?.toFixed(1) || "0"}% | Bias: ${scan.eth?.bias || "?"}
Dhan (Indian Markets): ${dhan.connected ? "Connected" : "Not connected"}

## TOP ALGO SIGNALS (scored by 5-layer engine):
${topSignals}

## YOUR CAPABILITIES:
You CAN execute trades. When you decide a trade is good, output the command:
/buy SYMBOL SIZE PRICE — to buy options
/sell SYMBOL SIZE — to sell/close
/scan — to re-scan markets

## RULES:
1. Never risk more than 20% of equity on one trade
2. Always explain WHY before suggesting a trade (which layers triggered)
3. If no good setup exists, say "No trade — waiting for better setup"
4. Be specific: exact symbol, size, price, TP, SL
5. Max 5 concurrent positions
6. Think like a hedge fund PM — every dollar matters at this account size`;

        const chatRes = await fetch(`${DASHBOARD_URL}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [
              { role: "user", content: text },
            ],
            systemOverride: systemPrompt,
          }),
        });

        if (chatRes.ok) {
          const chatData = await chatRes.json();
          if (chatData.response && !chatData.error) {
            const response = chatData.response as string;

            // Send the AI response
            if (response.length <= 4000) {
              await sendTg(response);
            } else {
              const chunks = response.match(/[\s\S]{1,4000}/g) || [response];
              for (const chunk of chunks) {
                await sendTg(chunk);
              }
            }

            // ── AUTO-EXECUTE: detect /buy or /sell commands in AI response ──
            const buyMatch = response.match(/\/buy\s+([\w-]+)\s+(\d+)(?:\s+([\d.]+))?/);
            const sellMatch = response.match(/\/sell\s+([\w-]+)\s+(\d+)(?:\s+([\d.]+))?/);

            if (buyMatch) {
              const [, symbol, size, price] = buyMatch;
              await sendTg(`⚡ _Auto-executing: Buy ${size}x ${symbol}..._`);
              const orderBody: Record<string, unknown> = {
                action: "place-order", productSymbol: symbol, size: parseInt(size),
                side: "buy", orderType: price ? "limit_order" : "market_order",
                timeInForce: price ? "gtc" : "ioc", clientOrderId: `ai_${Date.now()}`,
              };
              if (price) orderBody.limitPrice = price;
              const result = await selfFetch("/api/delta", orderBody);
              if (result.result?.id) {
                await sendTg(`✅ *Executed:* Buy ${size}x ${symbol}\nOrder: \`${result.result.id}\` | ${result.result.state}`);
              } else {
                await sendTg(`❌ Execution failed: ${JSON.stringify(result.error || result).slice(0, 200)}`);
              }
            } else if (sellMatch) {
              const [, symbol, size, price] = sellMatch;
              await sendTg(`⚡ _Auto-executing: Sell ${size}x ${symbol}..._`);
              const orderBody: Record<string, unknown> = {
                action: "place-order", productSymbol: symbol, size: parseInt(size),
                side: "sell", orderType: price ? "limit_order" : "market_order",
                timeInForce: price ? "gtc" : "ioc", reduceOnly: true, clientOrderId: `ai_sell_${Date.now()}`,
              };
              if (price) orderBody.limitPrice = price;
              const result = await selfFetch("/api/delta", orderBody);
              if (result.result?.id) {
                await sendTg(`✅ *Sold:* ${size}x ${symbol}\nOrder: \`${result.result.id}\` | ${result.result.state}`);
              } else {
                await sendTg(`❌ Sell failed: ${JSON.stringify(result.error || result).slice(0, 200)}`);
              }
            }
          } else {
            await sendTg(chatData.response || "⚠️ AI not available. Set ANTHROPIC\\_API\\_KEY in Vercel env vars.");
          }
        } else {
          await sendTg("⚠️ Could not reach AI. Dashboard may be down.");
        }
      } catch (err) {
        await sendTg(`⚠️ Error: ${String(err).slice(0, 200)}`);
      }
      break;
    }
  }
}
