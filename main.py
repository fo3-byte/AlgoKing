#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║                          MAIN ENTRY POINT                                    ║
║              Mother Algo — Multi-Market HFT System                           ║
║                                                                              ║
║  Usage:                                                                      ║
║    python main.py --mode backtest           # Run 10-year backtest           ║
║    python main.py --mode paper              # Paper trading (live data)      ║
║    python main.py --mode live               # LIVE trading (careful!)        ║
║    python main.py --mode scan               # One-time market scan          ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""
import sys
import os
import argparse
import logging
from datetime import datetime

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config.settings import MasterConfig, Market
from mother_algo import MotherAlgo


def setup_logging(level=logging.INFO):
    """Configure logging for the entire system"""
    log_format = "%(asctime)s | %(levelname)-8s | %(name)-25s | %(message)s"
    log_date = "%Y-%m-%d %H:%M:%S"

    logging.basicConfig(
        level=level,
        format=log_format,
        datefmt=log_date,
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler(f"mother_algo_{datetime.now().strftime('%Y%m%d')}.log"),
        ]
    )


def run_backtest(config: MasterConfig):
    """Run full 10-year backtest across all markets"""
    print("""
    ╔══════════════════════════════════════════════════════════╗
    ║          MOTHER ALGO — 10-YEAR BACKTEST MODE             ║
    ║                                                          ║
    ║  Markets: Indian F&O, Commodities, Crypto, US Futures    ║
    ║  Strategies: 8 sister algos + MC arbitration             ║
    ║  Period: 2016-01-01 to 2026-03-27                        ║
    ║  Initial Capital: ₹5,00,000                              ║
    ║  Target: ₹50,00,000                                      ║
    ╚══════════════════════════════════════════════════════════╝
    """)

    mother = MotherAlgo(config)

    # Select key markets for backtesting
    key_markets = [
        Market.NIFTY_FUT,
        Market.BANKNIFTY_FUT,
        Market.GOLD,
        Market.CRUDE_OIL,
        Market.SILVER,
        Market.BITCOIN,
        Market.ETHEREUM,
        Market.SP500_FUT,
        Market.NASDAQ_FUT,
    ]

    # Load data
    mother.load_market_data(key_markets)

    # Run backtest
    results = mother.run_backtest_mode(key_markets)

    # Print summary
    print("\n" + "=" * 70)
    print("  FINAL RESULTS")
    print("=" * 70)
    for key, value in results.get('summary', {}).items():
        print(f"  {key:25s}: {value}")
    print("=" * 70)

    return results


def run_scan(config: MasterConfig):
    """One-time scan of all markets"""
    print("Running market scan...")
    mother = MotherAlgo(config)

    key_markets = [
        Market.NIFTY_FUT, Market.BANKNIFTY_FUT,
        Market.GOLD, Market.CRUDE_OIL, Market.BITCOIN,
        Market.SP500_FUT, Market.NASDAQ_FUT,
    ]

    mother.load_market_data(key_markets)
    result = mother.run_cycle()

    if result:
        print("\n  TRADE SIGNAL FOUND:")
        for k, v in result.items():
            print(f"    {k}: {v}")
    else:
        print("\n  No actionable signals at this time.")

    print(f"\n  System Status: {mother.get_system_status()}")


def run_paper_trading(config: MasterConfig):
    """Paper trading mode (simulated execution with live data)"""
    config.paper_trading = True
    print("""
    ╔══════════════════════════════════════════════════════════╗
    ║          MOTHER ALGO — PAPER TRADING MODE                ║
    ║                                                          ║
    ║  Live data, simulated execution                          ║
    ║  Connect your broker API for real-time feeds             ║
    ╚══════════════════════════════════════════════════════════╝
    """)
    print("Paper trading requires a live data connection.")
    print("Steps to go live:")
    print("  1. Implement broker adapter in mother_algo.connect_broker()")
    print("  2. Subscribe to WebSocket feeds for your markets")
    print("  3. Run mother.run_cycle() on each new candle")
    print("  4. Monitor via mother.get_system_status()")
    print("\nExample with Zerodha Kite:")
    print("  from kiteconnect import KiteConnect, KiteTicker")
    print("  kite = KiteConnect(api_key='YOUR_KEY')")
    print("  # ... authenticate, subscribe, feed to MotherAlgo")


def main():
    parser = argparse.ArgumentParser(description="Mother Algo — Multi-Market HFT System")
    parser.add_argument(
        '--mode', type=str, default='backtest',
        choices=['backtest', 'paper', 'live', 'scan'],
        help='Operating mode'
    )
    parser.add_argument('--capital', type=float, default=500_000, help='Starting capital in INR')
    parser.add_argument('--target', type=float, default=5_000_000, help='Target capital in INR')
    parser.add_argument('--risk', type=float, default=0.03, help='Risk per trade (0.02-0.05)')
    parser.add_argument('--mc-sims', type=int, default=10_000, help='Monte Carlo simulations')
    parser.add_argument('--verbose', action='store_true', help='Verbose logging')

    args = parser.parse_args()

    # Setup
    log_level = logging.DEBUG if args.verbose else logging.INFO
    setup_logging(log_level)

    # Configure
    config = MasterConfig()
    config.account.initial_capital = args.capital
    config.account.target_capital = args.target
    config.risk.default_risk_per_trade = args.risk
    config.monte_carlo.num_simulations = args.mc_sims

    # Run
    if args.mode == 'backtest':
        run_backtest(config)
    elif args.mode == 'scan':
        run_scan(config)
    elif args.mode == 'paper':
        run_paper_trading(config)
    elif args.mode == 'live':
        print("⚠️  LIVE TRADING MODE — Not implemented in this scaffold.")
        print("    Implement broker adapters before going live!")
        print("    NEVER risk money without extensive paper trading first.")


if __name__ == "__main__":
    main()
