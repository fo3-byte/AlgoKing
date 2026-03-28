"""
╔══════════════════════════════════════════════════════════════════════════════╗
║                    MONTE CARLO SIMULATION ENGINE                             ║
║                                                                              ║
║  Core of the Mother Algo's decision-making process.                          ║
║  When multiple sister algos find trades simultaneously, this engine          ║
║  runs 10,000 simulations of all possible outcomes and selects the            ║
║  trade with the highest composite Monte Carlo score.                         ║
║                                                                              ║
║  Uses: Fat-tailed distributions, correlation modeling, regime detection      ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""
import numpy as np
import pandas as pd
from dataclasses import dataclass, field
from typing import List, Dict, Tuple, Optional
from scipy import stats
import logging
from datetime import datetime

from strategies.base import Signal, SignalType
from config.settings import (
    MonteCarloConfig, RiskConfig, Market, StrategyType,
    STRATEGY_MARKET_AFFINITY
)

logger = logging.getLogger(__name__)


@dataclass
class MonteCarloResult:
    """Results from Monte Carlo simulation for a single trade signal"""
    signal: Signal
    num_simulations: int = 10_000

    # Core metrics
    probability_of_profit: float = 0.0     # % of sims that were profitable
    expected_return: float = 0.0           # Mean return across all sims
    expected_return_pct: float = 0.0
    median_return: float = 0.0
    std_return: float = 0.0

    # Risk metrics
    max_simulated_loss: float = 0.0
    max_simulated_gain: float = 0.0
    value_at_risk_95: float = 0.0          # 95% VaR
    value_at_risk_99: float = 0.0          # 99% VaR
    conditional_var_95: float = 0.0        # Expected shortfall
    max_drawdown_avg: float = 0.0

    # Performance metrics
    sharpe_ratio: float = 0.0
    sortino_ratio: float = 0.0
    calmar_ratio: float = 0.0
    kelly_criterion: float = 0.0

    # Strategy-specific
    strategy_affinity: float = 0.0         # How well this strategy fits this market
    market_regime_fit: float = 0.0         # Does current regime favor this strategy?

    # COMPOSITE SCORE — the final arbiter
    composite_score: float = 0.0

    # Raw simulation data
    simulated_pnls: np.ndarray = field(default_factory=lambda: np.array([]))
    simulated_paths: np.ndarray = field(default_factory=lambda: np.array([]))

    def __repr__(self):
        return (
            f"MC[{self.signal.strategy_name}|{self.signal.market}] "
            f"Score={self.composite_score:.3f} "
            f"P(profit)={self.probability_of_profit:.1%} "
            f"E[R]={self.expected_return:.0f} "
            f"VaR95={self.value_at_risk_95:.0f} "
            f"Kelly={self.kelly_criterion:.2f}"
        )


class MonteCarloEngine:
    """
    Monte Carlo Simulation Engine.

    For each candidate trade signal:
    1. Estimates return distribution from historical data
    2. Runs 10,000 simulations using fat-tailed distributions
    3. Computes probability of profit, expected return, risk metrics
    4. Calculates composite score incorporating strategy-market affinity
    5. Returns ranked results — Mother Algo picks the highest score
    """

    def __init__(self, config: MonteCarloConfig = None, risk_config: RiskConfig = None):
        self.config = config or MonteCarloConfig()
        self.risk_config = risk_config or RiskConfig()
        self.rng = np.random.default_rng(seed=42)

    def detect_market_regime(self, df: pd.DataFrame) -> str:
        """
        Detect current market regime using multiple indicators.
        Returns: 'trending_up', 'trending_down', 'mean_reverting', 'volatile', 'quiet'
        """
        if df.empty or len(df) < 50:
            return 'unknown'

        recent = df.tail(20)

        # ADX for trend strength
        adx = recent['adx'].iloc[-1] if 'adx' in recent.columns else 0

        # Returns direction
        returns_20d = recent['close'].pct_change(20).iloc[-1] if len(recent) >= 20 else 0

        # Volatility regime
        vol_current = recent['returns'].std() if 'returns' in recent.columns else 0
        vol_long = df['returns'].tail(60).std() if 'returns' in df.columns and len(df) > 60 else vol_current
        vol_ratio = vol_current / max(vol_long, 1e-10)

        # Classify
        if adx > 30 and returns_20d > 0.02:
            return 'trending_up'
        elif adx > 30 and returns_20d < -0.02:
            return 'trending_down'
        elif adx < 20 and vol_ratio < 0.8:
            return 'quiet'
        elif vol_ratio > 1.5:
            return 'volatile'
        else:
            return 'mean_reverting'

    def _get_regime_strategy_fit(self, regime: str, strategy_name: str) -> float:
        """How well does the current regime suit this strategy?"""
        fitness = {
            'trending_up': {
                'MACrossoverAlgo': 0.9, 'MomentumAlgo': 0.95, 'ORBAlgo': 0.8,
                'PDCPDHAlgo': 0.7, 'OneHrHighLowAlgo': 0.75,
                'MeanReversionAlgo': 0.3, 'VWAPReversionAlgo': 0.4,
                'VolumeProfileAlgo': 0.6,
            },
            'trending_down': {
                'MACrossoverAlgo': 0.85, 'MomentumAlgo': 0.9, 'ORBAlgo': 0.75,
                'PDCPDHAlgo': 0.7, 'OneHrHighLowAlgo': 0.7,
                'MeanReversionAlgo': 0.35, 'VWAPReversionAlgo': 0.4,
                'VolumeProfileAlgo': 0.6,
            },
            'mean_reverting': {
                'MeanReversionAlgo': 0.95, 'VWAPReversionAlgo': 0.9,
                'VolumeProfileAlgo': 0.85, 'PDCPDHAlgo': 0.8,
                'MACrossoverAlgo': 0.3, 'MomentumAlgo': 0.2,
                'ORBAlgo': 0.5, 'OneHrHighLowAlgo': 0.6,
            },
            'volatile': {
                'MomentumAlgo': 0.7, 'ORBAlgo': 0.85,
                'OneHrHighLowAlgo': 0.8, 'PDCPDHAlgo': 0.6,
                'MeanReversionAlgo': 0.5, 'VWAPReversionAlgo': 0.5,
                'MACrossoverAlgo': 0.5, 'VolumeProfileAlgo': 0.55,
            },
            'quiet': {
                'MeanReversionAlgo': 0.7, 'VWAPReversionAlgo': 0.7,
                'VolumeProfileAlgo': 0.75, 'PDCPDHAlgo': 0.65,
                'MACrossoverAlgo': 0.3, 'MomentumAlgo': 0.2,
                'ORBAlgo': 0.3, 'OneHrHighLowAlgo': 0.4,
            },
        }
        return fitness.get(regime, {}).get(strategy_name, 0.5)

    def simulate_trade(
        self,
        signal: Signal,
        historical_returns: pd.Series,
        df: pd.DataFrame,
        market: Market = None,
    ) -> MonteCarloResult:
        """
        Run Monte Carlo simulation for a single trade signal.

        Process:
        1. Fit return distribution from historical data
        2. Generate 10,000 price paths
        3. For each path, check if TP or SL is hit first
        4. Compute probability of profit, expected return, risk metrics
        5. Calculate composite score
        """
        n_sims = self.config.num_simulations
        result = MonteCarloResult(signal=signal, num_simulations=n_sims)

        if historical_returns.empty or len(historical_returns) < 30:
            logger.warning(f"Insufficient historical data for MC simulation")
            return result

        # Clean returns
        clean_returns = historical_returns.dropna()
        clean_returns = clean_returns[np.isfinite(clean_returns)]

        if len(clean_returns) < 30:
            return result

        mu = clean_returns.mean()
        sigma = clean_returns.std()

        if sigma <= 0:
            return result

        # ── STEP 1: Fit distribution (fat-tailed t-distribution) ──
        if self.config.use_fat_tails:
            df_t = self.config.tail_degrees_freedom
            # Scale t-distribution to match historical vol
            scale = sigma * np.sqrt((df_t - 2) / df_t) if df_t > 2 else sigma
            simulated_daily_returns = stats.t.rvs(
                df=df_t, loc=mu, scale=scale,
                size=(n_sims, self.config.max_days_forward),
                random_state=self.rng
            )
        else:
            simulated_daily_returns = self.rng.normal(
                loc=mu, scale=sigma,
                size=(n_sims, self.config.max_days_forward)
            )

        # ── STEP 2: Generate price paths ──
        entry_price = signal.entry_price
        price_paths = entry_price * np.cumprod(1 + simulated_daily_returns, axis=1)
        result.simulated_paths = price_paths

        # ── STEP 3: For each path, determine outcome (TP/SL/hold) ──
        pnls = np.zeros(n_sims)

        for sim in range(n_sims):
            path = price_paths[sim]
            hit_tp = False
            hit_sl = False

            for day_price in path:
                if signal.signal_type == SignalType.LONG:
                    if day_price >= signal.take_profit:
                        pnls[sim] = signal.take_profit - entry_price
                        hit_tp = True
                        break
                    elif day_price <= signal.stop_loss:
                        pnls[sim] = signal.stop_loss - entry_price
                        hit_sl = True
                        break
                elif signal.signal_type == SignalType.SHORT:
                    if day_price <= signal.take_profit:
                        pnls[sim] = entry_price - signal.take_profit
                        hit_tp = True
                        break
                    elif day_price >= signal.stop_loss:
                        pnls[sim] = entry_price - signal.stop_loss
                        hit_sl = True
                        break

            if not hit_tp and not hit_sl:
                # Exit at last simulated price
                last_price = path[-1]
                if signal.signal_type == SignalType.LONG:
                    pnls[sim] = last_price - entry_price
                else:
                    pnls[sim] = entry_price - last_price

        result.simulated_pnls = pnls

        # ── STEP 4: Compute metrics ──
        result.probability_of_profit = np.mean(pnls > 0)
        result.expected_return = np.mean(pnls)
        result.expected_return_pct = result.expected_return / entry_price * 100
        result.median_return = np.median(pnls)
        result.std_return = np.std(pnls)

        result.max_simulated_loss = np.min(pnls)
        result.max_simulated_gain = np.max(pnls)
        result.value_at_risk_95 = np.percentile(pnls, 5)   # 5th percentile = 95% VaR
        result.value_at_risk_99 = np.percentile(pnls, 1)
        result.conditional_var_95 = np.mean(pnls[pnls <= np.percentile(pnls, 5)])

        # Sharpe of simulated outcomes
        if result.std_return > 0:
            result.sharpe_ratio = result.expected_return / result.std_return

        # Sortino
        downside_pnls = pnls[pnls < 0]
        if len(downside_pnls) > 0:
            downside_std = np.std(downside_pnls)
            if downside_std > 0:
                result.sortino_ratio = result.expected_return / downside_std

        # Kelly Criterion
        p_win = result.probability_of_profit
        avg_win = np.mean(pnls[pnls > 0]) if np.any(pnls > 0) else 0
        avg_loss = abs(np.mean(pnls[pnls < 0])) if np.any(pnls < 0) else 1
        if avg_loss > 0:
            b = avg_win / avg_loss  # Win/loss ratio
            result.kelly_criterion = max(0, (p_win * b - (1 - p_win)) / b)

        # ── STEP 5: Strategy-Market Affinity ──
        if market:
            strategy_type_map = {
                'MeanReversionAlgo': StrategyType.MEAN_REVERSION,
                'MACrossoverAlgo': StrategyType.MOVING_AVERAGE_CROSSOVER,
                'PDCPDHAlgo': StrategyType.PDC_PDH,
                'OneHrHighLowAlgo': StrategyType.ONE_HR_HIGH_LOW,
                'VolumeProfileAlgo': StrategyType.VOLUME_PROFILE,
                'MomentumAlgo': StrategyType.MOMENTUM,
                'VWAPReversionAlgo': StrategyType.VWAP_REVERSION,
                'ORBAlgo': StrategyType.ORB,
            }
            st = strategy_type_map.get(signal.strategy_name)
            if st and st in STRATEGY_MARKET_AFFINITY:
                result.strategy_affinity = STRATEGY_MARKET_AFFINITY[st].get(market, 0.5)

        # ── STEP 6: Market Regime Fit ──
        regime = self.detect_market_regime(df)
        result.market_regime_fit = self._get_regime_strategy_fit(regime, signal.strategy_name)

        # ── STEP 7: COMPOSITE SCORE ──
        w = self.config.scoring_weights
        score = (
            w['probability_of_profit'] * result.probability_of_profit +
            w['expected_return'] * min(max(result.expected_return_pct / 5.0, 0), 1) +
            w['sharpe_ratio'] * min(max(result.sharpe_ratio / 2.0, 0), 1) +
            w['max_drawdown_risk'] * (1 - min(abs(result.value_at_risk_95) / entry_price / 0.1, 1)) +
            w['strategy_affinity'] * result.strategy_affinity +
            w['market_regime_fit'] * result.market_regime_fit
        )

        # Bonus: signal confidence from the sister algo itself
        score = score * 0.85 + signal.confidence * 0.15

        result.composite_score = round(score, 4)

        return result

    def rank_signals(
        self,
        signals: List[Signal],
        market_data: Dict[str, pd.DataFrame],
        markets: Dict[str, Market] = None,
    ) -> List[MonteCarloResult]:
        """
        THE CORE ARBITRATION FUNCTION.

        Takes all concurrent signals from all sister algos,
        runs 10,000 MC simulations on each,
        and returns them ranked by composite score.

        The Mother Algo will execute the top-ranked trade(s).
        """
        results = []

        for signal in signals:
            market_key = signal.market
            df = market_data.get(market_key, pd.DataFrame())

            if df.empty:
                continue

            # Get historical returns for this market
            if 'returns' in df.columns:
                hist_returns = df['returns'].dropna()
            else:
                hist_returns = df['close'].pct_change().dropna()

            market_enum = markets.get(market_key) if markets else None

            mc_result = self.simulate_trade(
                signal=signal,
                historical_returns=hist_returns,
                df=df,
                market=market_enum,
            )

            # Filter: only pass signals meeting minimum thresholds
            if (mc_result.probability_of_profit >= self.risk_config.min_mc_profit_probability and
                mc_result.composite_score >= self.risk_config.min_mc_score):
                results.append(mc_result)
            else:
                logger.info(
                    f"REJECTED: {signal.strategy_name}|{signal.market} "
                    f"P(profit)={mc_result.probability_of_profit:.1%} "
                    f"Score={mc_result.composite_score:.3f}"
                )

        # Sort by composite score (highest first)
        results.sort(key=lambda r: r.composite_score, reverse=True)

        logger.info(f"Monte Carlo ranked {len(results)} viable trades from {len(signals)} signals")
        return results

    def permutation_analysis(
        self,
        signals: List[Signal],
        market_data: Dict[str, pd.DataFrame],
        max_concurrent: int = 5,
    ) -> Dict:
        """
        Run all permutations and combinations analysis.
        Given N signals, analyze all C(N, k) combinations for k=1..max_concurrent.
        Find the portfolio combination with the highest expected Sharpe.
        """
        from itertools import combinations

        all_results = []
        for signal in signals:
            market_key = signal.market
            df = market_data.get(market_key, pd.DataFrame())
            if df.empty:
                continue
            hist_returns = df['close'].pct_change().dropna() if 'returns' not in df.columns else df['returns'].dropna()
            mc = self.simulate_trade(signal, hist_returns, df)
            all_results.append(mc)

        if not all_results:
            return {'best_combo': [], 'best_sharpe': 0, 'all_combos_tested': 0}

        best_combo = []
        best_sharpe = -np.inf
        total_combos = 0

        for k in range(1, min(max_concurrent + 1, len(all_results) + 1)):
            for combo in combinations(all_results, k):
                total_combos += 1
                # Portfolio PnL = sum of individual simulated PnLs (assuming independence)
                # This is simplified; real correlation modeling would require joint simulation
                portfolio_pnls = np.zeros(self.config.num_simulations)
                for mc_result in combo:
                    if len(mc_result.simulated_pnls) == self.config.num_simulations:
                        portfolio_pnls += mc_result.simulated_pnls

                port_mean = np.mean(portfolio_pnls)
                port_std = np.std(portfolio_pnls)
                port_sharpe = port_mean / max(port_std, 1e-10)

                if port_sharpe > best_sharpe:
                    best_sharpe = port_sharpe
                    best_combo = list(combo)

        return {
            'best_combo': best_combo,
            'best_sharpe': round(best_sharpe, 4),
            'all_combos_tested': total_combos,
            'combo_signals': [r.signal for r in best_combo],
        }
