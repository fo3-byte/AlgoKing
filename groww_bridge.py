"""
Groww API Bridge Server
Wraps the growwapi Python SDK and exposes REST endpoints
for the Next.js dashboard to consume.

Usage:
  pip install growwapi flask flask-cors
  export GROWW_API_TOKEN=your_token
  python groww_bridge.py

Runs on http://localhost:5050
"""

import os
import json
import time
import traceback
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# ── Initialize Groww API ────────────────────────────────────────────────────

TOKEN = os.environ.get("GROWW_API_TOKEN", "")
groww = None

def init_groww():
    global groww
    if not TOKEN:
        print("⚠️  GROWW_API_TOKEN not set. Run: export GROWW_API_TOKEN=your_token")
        return False
    try:
        from growwapi import GrowwAPI
        groww = GrowwAPI(TOKEN)
        print("✅ Groww API initialized successfully")
        return True
    except ImportError:
        print("⚠️  growwapi not installed. Run: pip install growwapi")
        return False
    except Exception as e:
        print(f"❌ Groww API init failed: {e}")
        return False

# ── Health check ────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok" if groww else "no_token",
        "token_set": bool(TOKEN),
        "groww_initialized": groww is not None,
        "timestamp": int(time.time()),
    })

# ── Quote (full depth) ─────────────────────────────────────────────────────

@app.route("/quote", methods=["GET"])
def get_quote():
    if not groww:
        return jsonify({"error": "Groww API not initialized"}), 503
    try:
        symbol = request.args.get("symbol", "NIFTY")
        exchange = request.args.get("exchange", "NSE")
        segment = request.args.get("segment", "CASH")

        exc = groww.EXCHANGE_NSE if exchange == "NSE" else groww.EXCHANGE_BSE
        seg = groww.SEGMENT_CASH if segment == "CASH" else groww.SEGMENT_FNO

        result = groww.get_quote(exchange=exc, segment=seg, trading_symbol=symbol)
        return jsonify({"data": result, "source": "groww-live", "symbol": symbol})
    except Exception as e:
        return jsonify({"error": str(e), "traceback": traceback.format_exc()}), 500

# ── LTP (multi-instrument) ─────────────────────────────────────────────────

@app.route("/ltp", methods=["GET"])
def get_ltp():
    if not groww:
        return jsonify({"error": "Groww API not initialized"}), 503
    try:
        symbols = request.args.get("symbols", "NSE_NIFTY")  # comma-separated
        segment = request.args.get("segment", "CASH")
        seg = groww.SEGMENT_CASH if segment == "CASH" else groww.SEGMENT_FNO

        symbol_list = tuple(symbols.split(","))
        if len(symbol_list) == 1:
            symbol_list = symbol_list[0]

        result = groww.get_ltp(segment=seg, exchange_trading_symbols=symbol_list)
        return jsonify({"data": result, "source": "groww-live"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ── OHLC (multi-instrument) ────────────────────────────────────────────────

@app.route("/ohlc", methods=["GET"])
def get_ohlc():
    if not groww:
        return jsonify({"error": "Groww API not initialized"}), 503
    try:
        symbols = request.args.get("symbols", "NSE_NIFTY")
        segment = request.args.get("segment", "CASH")
        seg = groww.SEGMENT_CASH if segment == "CASH" else groww.SEGMENT_FNO

        symbol_list = tuple(symbols.split(","))
        if len(symbol_list) == 1:
            symbol_list = symbol_list[0]

        result = groww.get_ohlc(segment=seg, exchange_trading_symbols=symbol_list)
        return jsonify({"data": result, "source": "groww-live"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ── Option Chain (with Greeks) ─────────────────────────────────────────────

@app.route("/option-chain", methods=["GET"])
def get_option_chain():
    if not groww:
        return jsonify({"error": "Groww API not initialized"}), 503
    try:
        underlying = request.args.get("underlying", "NIFTY")
        expiry = request.args.get("expiry", "")
        exchange = request.args.get("exchange", "NSE")
        exc = groww.EXCHANGE_NSE if exchange == "NSE" else groww.EXCHANGE_BSE

        if not expiry:
            # Auto-fetch nearest expiry
            import datetime
            now = datetime.datetime.now()
            expiries_resp = groww.get_expiries(
                exchange=exc, underlying_symbol=underlying,
                year=now.year, month=now.month
            )
            if expiries_resp and "expiries" in expiries_resp and len(expiries_resp["expiries"]) > 0:
                # Find nearest future expiry
                today = now.strftime("%Y-%m-%d")
                future = [e for e in expiries_resp["expiries"] if e >= today]
                expiry = future[0] if future else expiries_resp["expiries"][-1]
            else:
                return jsonify({"error": "No expiries found"}), 404

        result = groww.get_option_chain(exchange=exc, underlying=underlying, expiry_date=expiry)
        return jsonify({
            "data": result,
            "source": "groww-live",
            "underlying": underlying,
            "expiry": expiry,
        })
    except Exception as e:
        return jsonify({"error": str(e), "traceback": traceback.format_exc()}), 500

# ── Greeks (single contract) ───────────────────────────────────────────────

@app.route("/greeks", methods=["GET"])
def get_greeks():
    if not groww:
        return jsonify({"error": "Groww API not initialized"}), 503
    try:
        underlying = request.args.get("underlying", "NIFTY")
        trading_symbol = request.args.get("trading_symbol", "")
        expiry = request.args.get("expiry", "")
        exchange = request.args.get("exchange", "NSE")
        exc = groww.EXCHANGE_NSE if exchange == "NSE" else groww.EXCHANGE_BSE

        if not trading_symbol or not expiry:
            return jsonify({"error": "trading_symbol and expiry are required"}), 400

        result = groww.get_greeks(
            exchange=exc, underlying=underlying,
            trading_symbol=trading_symbol, expiry=expiry
        )
        return jsonify({"data": result, "source": "groww-live"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ── Expiries ────────────────────────────────────────────────────────────────

@app.route("/expiries", methods=["GET"])
def get_expiries():
    if not groww:
        return jsonify({"error": "Groww API not initialized"}), 503
    try:
        underlying = request.args.get("underlying", "NIFTY")
        year = int(request.args.get("year", time.localtime().tm_year))
        month = int(request.args.get("month", time.localtime().tm_mon))
        exchange = request.args.get("exchange", "NSE")
        exc = groww.EXCHANGE_NSE if exchange == "NSE" else groww.EXCHANGE_BSE

        result = groww.get_expiries(exchange=exc, underlying_symbol=underlying, year=year, month=month)
        return jsonify({"data": result, "source": "groww-live"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ── Contracts ───────────────────────────────────────────────────────────────

@app.route("/contracts", methods=["GET"])
def get_contracts():
    if not groww:
        return jsonify({"error": "Groww API not initialized"}), 503
    try:
        underlying = request.args.get("underlying", "NIFTY")
        expiry = request.args.get("expiry", "")
        exchange = request.args.get("exchange", "NSE")
        exc = groww.EXCHANGE_NSE if exchange == "NSE" else groww.EXCHANGE_BSE

        if not expiry:
            return jsonify({"error": "expiry is required"}), 400

        result = groww.get_contracts(exchange=exc, underlying_symbol=underlying, expiry_date=expiry)
        return jsonify({"data": result, "source": "groww-live"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ── Historical Candles ──────────────────────────────────────────────────────

@app.route("/historical", methods=["GET"])
def get_historical():
    if not groww:
        return jsonify({"error": "Groww API not initialized"}), 503
    try:
        symbol = request.args.get("symbol", "")
        exchange = request.args.get("exchange", "NSE")
        segment = request.args.get("segment", "CASH")
        start = request.args.get("start", "")
        end = request.args.get("end", "")
        interval = int(request.args.get("interval", "5"))

        exc = groww.EXCHANGE_NSE if exchange == "NSE" else groww.EXCHANGE_BSE
        seg = groww.SEGMENT_CASH if segment == "CASH" else groww.SEGMENT_FNO

        if not symbol or not start or not end:
            return jsonify({"error": "symbol, start, end are required"}), 400

        # Use get_historical_candle_data for cash, get_historical_candles for F&O
        if segment == "FNO":
            result = groww.get_historical_candles(
                exchange=exc, segment=seg, groww_symbol=symbol,
                start_time=start, end_time=end, candle_interval=interval
            )
        else:
            result = groww.get_historical_candle_data(
                trading_symbol=symbol, exchange=exc, segment=seg,
                start_time=start, end_time=end, interval_in_minutes=interval
            )

        return jsonify({"data": result, "source": "groww-live"})
    except Exception as e:
        return jsonify({"error": str(e), "traceback": traceback.format_exc()}), 500

# ── Historical Candles for F&O with contract resolution ─────────────────────

@app.route("/historical-fno", methods=["GET"])
def get_historical_fno():
    """Convenience: pass underlying + expiry + strike + type, auto-resolves contract."""
    if not groww:
        return jsonify({"error": "Groww API not initialized"}), 503
    try:
        underlying = request.args.get("underlying", "NIFTY")
        expiry = request.args.get("expiry", "")
        strike = request.args.get("strike", "")
        opt_type = request.args.get("type", "CE")  # CE or PE
        start = request.args.get("start", "")
        end = request.args.get("end", "")
        interval = int(request.args.get("interval", "5"))
        exchange = request.args.get("exchange", "NSE")
        exc = groww.EXCHANGE_NSE if exchange == "NSE" else groww.EXCHANGE_BSE

        if not expiry or not strike or not start or not end:
            return jsonify({"error": "expiry, strike, start, end required"}), 400

        # Get contracts for the expiry
        contracts = groww.get_contracts(exchange=exc, underlying_symbol=underlying, expiry_date=expiry)
        contract_list = contracts.get("contracts", [])

        # Find matching contract
        target = f"{strike}-{opt_type}"
        matched = [c for c in contract_list if target in c]
        if not matched:
            return jsonify({"error": f"No contract found for {underlying} {strike} {opt_type} exp {expiry}", "available": contract_list[:10]}), 404

        result = groww.get_historical_candles(
            exchange=exc, segment=groww.SEGMENT_FNO, groww_symbol=matched[0],
            start_time=start, end_time=end, candle_interval=interval
        )
        return jsonify({"data": result, "source": "groww-live", "contract": matched[0]})
    except Exception as e:
        return jsonify({"error": str(e), "traceback": traceback.format_exc()}), 500

# ── Run server ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    init_groww()
    print("\n🚀 Groww Bridge Server starting on http://localhost:5050")
    print("   Endpoints: /health, /quote, /ltp, /ohlc, /option-chain, /greeks,")
    print("              /expiries, /contracts, /historical, /historical-fno\n")
    app.run(host="0.0.0.0", port=5050, debug=True)
