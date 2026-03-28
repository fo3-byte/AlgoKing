"""
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║                          ███╗   ███╗ ██████╗ ████████╗██╗  ██╗███████╗██████╗║
║                          ████╗ ████║██╔═══██╗╚══██╔══╝██║  ██║██╔════╝██╔══██║
║                          ██╔████╔██║██║   ██║   ██║   ███████║█████╗  ██████╔║
║                          ██║╚██╔╝██║██║   ██║   ██║   ██╔══██║██╔══╝  ██╔══██║
║                          ██║ ╚═╝ ██║╚██████╔╝   ██║   ██║  ██║███████╗██║  ██║
║                          ╚═╝     ╚═╝ ╚═════╝    ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═║
║                                                                              ║
║                              MOTHER ALGO                                     ║
║                 Multi-Market HFT Orchestrator with Monte Carlo               ║
║                                                                              ║
║  Architecture:                                                               ║
║  ┌─────────────────────────────────────────────────────────────┐             ║
║  │                      MOTHER ALGO                            │             ║
║  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │             ║
║  │  │ Sister 1 │ │ Sister 2 │ │ Sister 3 │ │ Sister N │       │             ║
║  │  │MeanRev   │ │MA Cross  │ │PDC/PDH   │ │  ORB     │       │             ║
║  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘       │             ║
║  │       │             │            │             │             │             ║
║  │       └──────┬──────┘──────┬─────┘─────────────┘             │             ║
║  │              │ SIGNALS     │                                 │             ║
║  │              ▼             ▼                                 │             ║
║  │  ┌──────────────────────────────────────────┐               │             ║
║  │  │        MONTE CARLO ENGINE                │               │             ║
║  │  │   10,000 simulations per signal          │               │             ║
║  │  │   All permutations & combinations        │               │             ║
║  │  │   Composite scoring & ranking            │               │             ║
║  │  └─────────────────┬────────────────────────┘               │             ║
║  │                    │ RANKED TRADES                           │             ║
║  │                    ▼                                         │             ║
║  │  ┌──────────────────────────────────────────┐               │             ║
║  │  │         RISK MANAGER                     │               │             ║
║  │  │   Kelly Criterion sizing                 │               │             ║
║  │  │   Drawdown controls                      │               │             ║
║  │  │   Correlation checks                     │               │             ║
║  │  │   Daily/weekly limits                    │               │             ║
║  │  └─────────────────┬────────────────────────┘               │             ║
║  │                    │ APPROVED TRADES                         │             ║
║  │                    ▼                                         │             ║
║  │  ┌──────────────────────────────────────────┐               │             ║
║  │  │      EXECUTION (Broker-Agnostic)         │               │             ║
║  │  └──────────────────────────────────────────┘               │             ║
║  └─────────────────────────────────────────────────────────────┘             ║
║                                                                              ║
║  Target: ₹5,00,000 → ₹50,00,000 in 12 months                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""
import logging
import time
from datetime import datetime
from typing import List, Dict, Optional, Tuple
import pandas as pd
import numpy as np

from config.settings import (
    MasterConfig, Market, StrategyType, MARKET_CONFIGS,
    STRATEGY_MARKET_AFFINITY
)
from strategies.base import BaseStrategy, Signal, SignalType
from strategies.mean_reversion import MeanReversionStrategy
from strategies.ma_crossover import MACrossoverStrategy
from strategies.pdc_pdh import PDCPDHStrategy
from strategies.one_hr_hl import OneHrHighLowStrategy
from strategies.volume_profile import VolumeProfileStrategy
from strategies.momentum import MomentumStrategy
from strategies.vwap_reversion import VWAPReversionStrategy
from strategies.orb import ORBStrategy
from engines.monte_carlo import MonteCarloEngine, MonteCarloResult
from engines.risk_manager import RiskManager
from engines.backtester import BacktestEngine
from data.fetcher import DataFetcher

logger = logging.getLogger(__name__)


class MotherAlgo:
    """
    THE MOTHER ALGO — Master Orchestrator.

    Controls all 8 sister algos, runs Monte Carlo arbitration,
    manages risk, and executes the highest-scoring trade.

    Flow per tick/candle:
    1. Feed new data to ALL sister algos simultaneously
    2. Collect all signals from all algos across all markets
    3. If multiple signals: Run Monte Carlo on each (10K sims)
    4. Rank by composite score
    5. Top trade goes through Risk Manager for approval
    6. If approved: Execute via broker interface
    7. If rejected: Try next-ranked trade
    8. Log everything
    """

    def __init__(self, config: MasterConfig = None):
        self.config = config or MasterConfig()

        # Initialize sister algos
        self.sisters: List[BaseStrategy] = [
            MeanReversionStrategy(),
            MACrossoverStrategy(),
            PDCPDHStrategy(),
            OneHrHighLowStrategy(),
            VolumeProfileStrategy(),
            MomentumStrategy(),
            VWAPReversionStrategy(),
            ORBStrategy(),
        ]

        # Initialize engines
        self.monte_carlo = MonteCarloEngine(
            config=self.config.monte_carlo,
            risk_config=self.config.risk
        )
        self.risk_manager = RiskManager(
            risk_config=self.config.risk,
            account_config=self.config.account
        )
        self.fetcher = DataFetcher()
        self.backtester = BacktestEngine(config=self.config)

        # State
        self.market_data: Dict[str, pd.DataFrame] = {}
        self.market_enum_map: Dict[str, Market] = {}
        self.execution_log: List[Dict] = []
        self.is_running = False

        logger.info("Mother Algo initialized.")
        logger.info(f"  Sister algos: {[s.name for s in self.sisters]}")
        logger.info(f"  Initial capital: ₹{self.config.account.initial_capital:,.0f}")
        logger.info(f"  Target: ₹{self.config.account.target_capital:,.0f}")
        logger.info(f"  Required monthly return: {self.config.account.required_monthly_return:.1%}")
        logger.info(f"  MC simulations: {self.config.monte_carlo.num_simulations:,}")

    # ─────────────────── DATA LOADING ───────────────────

    def load_market_data(self, markets: List[Market] = None):
        """Pre-load historical data for all markets"""
        if markets is None:
            markets = list(MARKET_CONFIGS.keys())

        logger.info(f"Loading data for {len(markets)} markets...")

        for market in markets:
            name = market.value
            df = self.fetcher.fetch_market_data(
                market,
                start_date=self.config.backtest_start_date,
                end_date=self.config.backtest_end_date
            )

            if not df.empty:
                df = self.fetcher.add_indicators(df)
                self.market_data[name] = df
                self.market_enum_map[name] = market
                logger.info(f"  Loaded {name}: {len(df)} rows")
            else:
                logger.warning(f"  FAILED to load {name}")

    # ─────────────────── SIGNAL GENERATION ───────────────────

    def scan_all_markets(self) -> List[Signal]:
        """
        Run ALL sister algos on ALL markets simultaneously.
        Returns all generated signals.
        """
        all_signals = []

        for market_name, df in self.market_data.items():
            if df.empty:
                continue

            for sister in self.sisters:
                try:
                    signals = sister.generate_signals(df, market_name)
                    # Only take the most recent signal per strategy-market pair
                    if signals:
                        latest = signals[-1]  # Most recent signal
                        if sister.validate_signal(latest, df):
                            all_signals.append(latest)
                except Exception as e:
                    logger.error(f"Error in {sister.name} on {market_name}: {e}")

        logger.info(f"Scan complete: {len(all_signals)} signals from {len(self.sisters)} algos × {len(self.market_data)} markets")
        return all_signals

    # ─────────────────── MONTE CARLO ARBITRATION ───────────────────

    def arbitrate(self, signals: List[Signal]) -> List[MonteCarloResult]:
        """
        THE CORE DECISION ENGINE.

        When Nifty Futures, Gold Options, and Bitcoin all have signals
        simultaneously — which trade do you take?

        Answer: The one with the highest Monte Carlo composite score.

        Process:
        1. Run 10,000 MC simulations on each signal
        2. Score each on: P(profit), E[return], Sharpe, VaR, affinity, regime
        3. Rank by composite score
        4. Return ranked list for Risk Manager approval
        """
        if not signals:
            return []

        if len(signals) == 1:
            # Only one signal — still run MC for validation
            signal = signals[0]
            market_key = signal.market
            df = self.market_data.get(market_key, pd.DataFrame())
            if df.empty:
                return []

            hist_returns = df['returns'].dropna() if 'returns' in df.columns else df['close'].pct_change().dropna()
            market_enum = self.market_enum_map.get(market_key)

            result = self.monte_carlo.simulate_trade(
                signal=signal,
                historical_returns=hist_returns,
                df=df,
                market=market_enum,
            )
            return [result] if result.composite_score >= self.config.risk.min_mc_score else []

        # Multiple signals — full MC comparison
        logger.info(f"\n{'─'*60}")
        logger.info(f"  MONTE CARLO ARBITRATION: {len(signals)} competing signals")
        logger.info(f"  Running {self.config.monte_carlo.num_simulations:,} simulations each...")
        logger.info(f"{'─'*60}")

        ranked = self.monte_carlo.rank_signals(
            signals=signals,
            market_data=self.market_data,
            markets=self.market_enum_map,
        )

        # Log results
        for i, result in enumerate(ranked):
            logger.info(
                f"  #{i+1}: {result.signal.strategy_name} | {result.signal.market} | "
                f"Score={result.composite_score:.3f} | "
                f"P(profit)={result.probability_of_profit:.1%} | "
                f"E[R]=₹{result.expected_return:,.0f} | "
                f"Kelly={result.kelly_criterion:.2f}"
            )

        return ranked

    # ─────────────────── EXECUTION PIPELINE ───────────────────

    def execute_best_trade(self, ranked_results: List[MonteCarloResult]) -> Optional[Dict]:
        """
        Try to execute the highest-scoring trade.
        If Risk Manager rejects it, try the next one.
        """
        for mc_result in ranked_results:
            signal = mc_result.signal

            # Risk Manager approval
            approved, reason, position_size = self.risk_manager.approve_trade(signal, mc_result)

            if approved:
                # Execute the trade
                position = self.risk_manager.open_position(signal, position_size)

                execution_record = {
                    'timestamp': datetime.now().isoformat(),
                    'strategy': signal.strategy_name,
                    'market': signal.market,
                    'direction': signal.signal_type.value,
                    'entry_price': signal.entry_price,
                    'stop_loss': signal.stop_loss,
                    'take_profit': signal.take_profit,
                    'position_size': position_size,
                    'mc_score': mc_result.composite_score,
                    'mc_prob_profit': mc_result.probability_of_profit,
                    'mc_expected_return': mc_result.expected_return,
                    'kelly': mc_result.kelly_criterion,
                    'risk_reward': signal.risk_reward_ratio,
                    'confidence': signal.confidence,
                }
                self.execution_log.append(execution_record)

                logger.info(f"\n{'★'*60}")
                logger.info(f"  TRADE EXECUTED!")
                logger.info(f"  Strategy: {signal.strategy_name}")
                logger.info(f"  Market: {signal.market}")
                logger.info(f"  Direction: {signal.signal_type.value}")
                logger.info(f"  Entry: {signal.entry_price:.2f}")
                logger.info(f"  SL: {signal.stop_loss:.2f} | TP: {signal.take_profit:.2f}")
                logger.info(f"  Position Size: {position_size:.2f}")
                logger.info(f"  MC Score: {mc_result.composite_score:.3f}")
                logger.info(f"  P(profit): {mc_result.probability_of_profit:.1%}")
                logger.info(f"  Kelly: {mc_result.kelly_criterion:.3f}")
                logger.info(f"  Capital: ₹{self.risk_manager.portfolio.capital:,.0f}")
                logger.info(f"{'★'*60}\n")

                return execution_record
            else:
                logger.info(f"  REJECTED: {signal.strategy_name}|{signal.market} — {reason}")

        logger.info("No trades approved this cycle.")
        return None

    # ─────────────────── MAIN LOOP ───────────────────

    def run_cycle(self) -> Optional[Dict]:
        """
        Run one complete cycle of the Mother Algo:
        1. Scan all markets with all sister algos
        2. Arbitrate via Monte Carlo
        3. Execute best trade
        """
        # Step 1: Generate signals
        signals = self.scan_all_markets()

        if not signals:
            logger.info("No signals generated this cycle.")
            return None

        # Step 2: Monte Carlo arbitration
        ranked = self.arbitrate(signals)

        if not ranked:
            logger.info("No signals passed Monte Carlo thresholds.")
            return None

        # Step 3: Execute
        return self.execute_best_trade(ranked)

    def run_backtest_mode(self, markets: List[Market] = None) -> Dict:
        """
        Run the full system in backtest mode:
        1. Load 10 years of data
        2. Backtest each sister algo independently
        3. Run the Mother Algo's MC arbitration
        4. Generate performance report
        """
        logger.info("\n" + "█" * 70)
        logger.info("  MOTHER ALGO — FULL BACKTEST MODE")
        logger.info("  10-Year Historical Backtest with Monte Carlo Arbitration")
        logger.info("█" * 70 + "\n")

        # Load data
        if not self.market_data:
            self.load_market_data(markets)

        # Phase 1: Individual strategy backtests
        logger.info("\n── PHASE 1: Individual Strategy Backtests ──")
        reports = self.backtester.run_full_backtest(
            strategies=self.sisters,
            markets=markets or list(self.market_data.keys()),
            preloaded_data={self.market_enum_map.get(k, k): v for k, v in self.market_data.items()
                          if isinstance(self.market_enum_map.get(k), Market)},
        )

        # Phase 2: Best strategies per market
        logger.info("\n── PHASE 2: Best Strategies Per Market ──")
        rankings = self.backtester.get_best_strategies_per_market()
        for market, ranked in rankings.items():
            top3 = ranked[:3]
            logger.info(f"  {market}: {', '.join(f'{s}({score:.2f})' for s, score in top3)}")

        # Phase 3: Empirical affinity matrix
        logger.info("\n── PHASE 3: Empirical Affinity Matrix ──")
        affinity = self.backtester.generate_affinity_matrix()

        # Phase 4: Portfolio simulation with MC
        logger.info("\n── PHASE 4: Mother Algo MC Arbitration Simulation ──")
        portfolio_result = self._simulate_portfolio()

        result = {
            'individual_reports': {name: rep.summary() for name, rep in reports.items()},
            'market_rankings': rankings,
            'affinity_matrix': affinity,
            'portfolio_result': portfolio_result,
            'final_capital': self.risk_manager.portfolio.capital,
            'total_return': (self.risk_manager.portfolio.capital / self.config.account.initial_capital - 1) * 100,
            'summary': self.risk_manager.get_portfolio_summary(),
        }

        logger.info("\n" + "═" * 70)
        logger.info("  BACKTEST COMPLETE")
        logger.info(f"  Final Capital: ₹{self.risk_manager.portfolio.capital:,.0f}")
        logger.info(f"  Total Return: {result['total_return']:.1f}%")
        logger.info(f"  Win Rate: {self.risk_manager.portfolio.win_rate:.0%}")
        logger.info(f"  Max Drawdown: {self.risk_manager.portfolio.max_drawdown_seen:.1%}")
        logger.info(f"  Total Trades: {self.risk_manager.portfolio.total_trades}")
        logger.info("═" * 70 + "\n")

        return result

    def _simulate_portfolio(self) -> Dict:
        """
        Simulate the Mother Algo's portfolio management:
        - Walk through time
        - At each step, collect signals from all sister algos
        - MC arbitrate and pick the best
        - Track portfolio performance
        """
        if not self.market_data:
            return {'error': 'No market data loaded'}

        # Get common date range
        all_dates = set()
        for df in self.market_data.values():
            if not df.empty:
                all_dates.update(df.index.tolist())

        if not all_dates:
            return {'error': 'No dates found'}

        sorted_dates = sorted(all_dates)
        total_days = len(sorted_dates)
        trade_count = 0
        wins = 0
        pnl_history = []

        # Walk through each trading day
        step_size = max(1, total_days // 200)  # Sample ~200 decision points
        for i in range(50, total_days, step_size):
            date = sorted_dates[i]

            # Reset daily counters periodically
            if i % (step_size * 5) == 0:
                self.risk_manager.reset_daily()

            # Collect signals from all strategies on all markets
            signals = []
            for market_name, df in self.market_data.items():
                # Get data up to this date
                mask = df.index <= date
                if mask.sum() < 30:
                    continue
                historical = df[mask]

                for sister in self.sisters:
                    try:
                        sigs = sister.generate_signals(historical, market_name)
                        if sigs:
                            latest = sigs[-1]
                            if sister.validate_signal(latest, historical):
                                signals.append(latest)
                    except Exception:
                        pass

            if not signals:
                continue

            # MC Arbitrate
            ranked = self.arbitrate(signals)
            if not ranked:
                continue

            # Try to execute
            result = self.execute_best_trade(ranked)
            if result:
                trade_count += 1
                # Simulate exit (simplified)
                mc_top = ranked[0]
                # Random exit based on MC probability
                if np.random.random() < mc_top.probability_of_profit:
                    pnl = mc_top.expected_return * 0.8  # Conservative estimate
                    wins += 1
                else:
                    pnl = -abs(mc_top.signal.risk_per_unit) * result['position_size'] * 0.6
                    self.risk_manager.portfolio.consecutive_losses += 1

                self.risk_manager.portfolio.capital += pnl
                self.risk_manager.portfolio.update_peak()
                pnl_history.append({
                    'date': str(date),
                    'pnl': pnl,
                    'capital': self.risk_manager.portfolio.capital,
                })

        return {
            'total_trades': trade_count,
            'wins': wins,
            'win_rate': wins / max(trade_count, 1),
            'final_capital': self.risk_manager.portfolio.capital,
            'max_drawdown': self.risk_manager.portfolio.max_drawdown_seen,
            'pnl_history': pnl_history[-50:],  # Last 50 trades
        }

    # ─────────────────── BROKER INTERFACE (ABSTRACT) ───────────────────

    def connect_broker(self, broker_config: Dict):
        """
        Abstract broker connection. Override for specific brokers:
        - Zerodha Kite Connect
        - Angel One SmartAPI
        - Dhan API
        - Interactive Brokers
        etc.
        """
        logger.info("Broker connection is abstract. Override for your broker.")
        logger.info("Supported adapters to implement:")
        logger.info("  - place_order(symbol, qty, side, order_type, price)")
        logger.info("  - cancel_order(order_id)")
        logger.info("  - get_positions()")
        logger.info("  - get_ltp(symbol)")
        logger.info("  - subscribe_ws(symbols, callback)")
        pass

    def get_system_status(self) -> Dict:
        """Get comprehensive system status"""
        return {
            'is_running': self.is_running,
            'paper_trading': self.config.paper_trading,
            'portfolio': self.risk_manager.get_portfolio_summary(),
            'open_positions': len(self.risk_manager.portfolio.open_positions),
            'sister_algos': [s.name for s in self.sisters],
            'markets_loaded': list(self.market_data.keys()),
            'execution_log_count': len(self.execution_log),
            'last_execution': self.execution_log[-1] if self.execution_log else None,
        }
