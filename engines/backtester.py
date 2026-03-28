"""
╔══════════════════════════════════════════════════════════════════════════════╗
║                       BACKTESTING ENGINE                                     ║
║                                                                              ║
║  Runs all 8 sister algos against 10 years of historical data                ║
║  across all markets. Generates performance reports per strategy/market.       ║
║  Results feed into the Strategy-Market Affinity Matrix and Monte Carlo.      ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""
import pandas as pd
import numpy as np
from typing import List, Dict, Tuple, Type
from dataclasses import dataclass, field
import logging
from datetime import datetime
import json

from strategies.base import BaseStrategy, BacktestResult
from data.fetcher import DataFetcher
from config.settings import Market, MARKET_CONFIGS, MasterConfig

logger = logging.getLogger(__name__)


@dataclass
class BacktestReport:
    """Comprehensive backtest report for one strategy across all markets"""
    strategy_name: str
    results: Dict[str, BacktestResult] = field(default_factory=dict)

    @property
    def best_market(self) -> str:
        if not self.results:
            return "N/A"
        return max(self.results.items(), key=lambda x: x[1].sharpe_ratio)[0]

    @property
    def avg_win_rate(self) -> float:
        rates = [r.win_rate for r in self.results.values() if r.total_trades > 0]
        return np.mean(rates) if rates else 0

    @property
    def total_trades_all_markets(self) -> int:
        return sum(r.total_trades for r in self.results.values())

    def summary(self) -> str:
        lines = [f"\n{'='*70}"]
        lines.append(f"  BACKTEST REPORT: {self.strategy_name}")
        lines.append(f"{'='*70}")

        for market, result in sorted(self.results.items(), key=lambda x: -x[1].sharpe_ratio):
            if result.total_trades == 0:
                continue
            lines.append(
                f"  {market:20s} | Trades: {result.total_trades:4d} | "
                f"Win: {result.win_rate:.0%} | "
                f"PF: {result.profit_factor:.2f} | "
                f"Sharpe: {result.sharpe_ratio:.2f} | "
                f"MaxDD: {result.max_drawdown_pct:.1%} | "
                f"R:R: {result.avg_risk_reward:.1f} | "
                f"Return: {result.total_return_pct:.1f}%"
            )

        lines.append(f"\n  Best market: {self.best_market}")
        lines.append(f"  Avg win rate: {self.avg_win_rate:.0%}")
        lines.append(f"  Total trades: {self.total_trades_all_markets}")
        lines.append(f"{'='*70}\n")
        return '\n'.join(lines)


class BacktestEngine:
    """
    Master backtesting engine.
    Tests all strategy-market combinations over 10 years of data.
    """

    def __init__(self, config: MasterConfig = None):
        self.config = config or MasterConfig()
        self.fetcher = DataFetcher()
        self.reports: Dict[str, BacktestReport] = {}

    def run_single_backtest(
        self,
        strategy: BaseStrategy,
        market: Market,
        df: pd.DataFrame = None,
    ) -> BacktestResult:
        """Run one strategy on one market"""
        market_name = market.value

        if df is None or df.empty:
            logger.info(f"Fetching data for {market_name}...")
            df = self.fetcher.fetch_market_data(
                market,
                start_date=self.config.backtest_start_date,
                end_date=self.config.backtest_end_date
            )

        if df.empty:
            logger.warning(f"No data for {market_name}")
            return BacktestResult(strategy_name=strategy.name, market=market_name)

        # Add indicators
        df = self.fetcher.add_indicators(df)

        # Run backtest
        result = strategy.backtest(
            df=df,
            market=market_name,
            initial_capital=self.config.account.initial_capital,
            risk_per_trade=self.config.risk.default_risk_per_trade,
            commission=self.config.risk.commission_per_trade,
            slippage_bps=self.config.risk.slippage_bps,
        )

        logger.info(
            f"  {strategy.name} on {market_name}: "
            f"{result.total_trades} trades, "
            f"Win: {result.win_rate:.0%}, "
            f"Sharpe: {result.sharpe_ratio:.2f}"
        )

        return result

    def run_full_backtest(
        self,
        strategies: List[BaseStrategy],
        markets: List[Market] = None,
        preloaded_data: Dict[Market, pd.DataFrame] = None,
    ) -> Dict[str, BacktestReport]:
        """
        Run all strategies against all markets.
        This is the comprehensive 10-year backtest.
        """
        if markets is None:
            markets = list(MARKET_CONFIGS.keys())

        logger.info(f"\n{'#'*70}")
        logger.info(f"  STARTING FULL BACKTEST: {len(strategies)} strategies × {len(markets)} markets")
        logger.info(f"  Period: {self.config.backtest_start_date} to {self.config.backtest_end_date}")
        logger.info(f"{'#'*70}\n")

        # Pre-fetch all market data
        data = preloaded_data or {}
        for market in markets:
            if market not in data:
                logger.info(f"Fetching {market.value}...")
                df = self.fetcher.fetch_market_data(
                    market,
                    start_date=self.config.backtest_start_date,
                    end_date=self.config.backtest_end_date
                )
                if not df.empty:
                    df = self.fetcher.add_indicators(df)
                data[market] = df

        # Run all combinations
        reports = {}
        for strategy in strategies:
            report = BacktestReport(strategy_name=strategy.name)

            for market in markets:
                df = data.get(market, pd.DataFrame())
                if df.empty:
                    continue

                result = strategy.backtest(
                    df=df,
                    market=market.value,
                    initial_capital=self.config.account.initial_capital,
                    risk_per_trade=self.config.risk.default_risk_per_trade,
                )
                report.results[market.value] = result

            reports[strategy.name] = report
            print(report.summary())

        self.reports = reports
        return reports

    def generate_affinity_matrix(self) -> Dict:
        """
        Generate empirical Strategy-Market Affinity Matrix from backtest results.
        This replaces the theoretical matrix with actual performance data.
        """
        matrix = {}

        for strategy_name, report in self.reports.items():
            matrix[strategy_name] = {}
            max_sharpe = max(
                (r.sharpe_ratio for r in report.results.values() if r.total_trades > 5),
                default=1.0
            )

            for market_name, result in report.results.items():
                if result.total_trades < 5:
                    matrix[strategy_name][market_name] = 0.0
                else:
                    # Normalize Sharpe ratio to 0-1 scale
                    affinity = min(max(result.sharpe_ratio / max(max_sharpe, 0.01), 0), 1.0)
                    # Weight by win rate and profit factor
                    affinity = affinity * 0.5 + result.win_rate * 0.3 + min(result.profit_factor / 3, 1) * 0.2
                    matrix[strategy_name][market_name] = round(affinity, 3)

        return matrix

    def get_best_strategies_per_market(self) -> Dict[str, List[Tuple[str, float]]]:
        """For each market, rank strategies by performance"""
        market_rankings = {}

        all_markets = set()
        for report in self.reports.values():
            all_markets.update(report.results.keys())

        for market in all_markets:
            rankings = []
            for strategy_name, report in self.reports.items():
                result = report.results.get(market)
                if result and result.total_trades > 5:
                    score = (
                        result.sharpe_ratio * 0.3 +
                        result.win_rate * 0.25 +
                        min(result.profit_factor / 3, 1) * 0.2 +
                        (1 - result.max_drawdown_pct) * 0.15 +
                        result.expectancy / max(abs(result.avg_loss), 1) * 0.1
                    )
                    rankings.append((strategy_name, round(score, 3)))

            rankings.sort(key=lambda x: -x[1])
            market_rankings[market] = rankings

        return market_rankings

    def export_results(self, filepath: str = "backtest_results.json"):
        """Export all backtest results to JSON"""
        export = {}
        for strategy_name, report in self.reports.items():
            export[strategy_name] = {}
            for market_name, result in report.results.items():
                export[strategy_name][market_name] = {
                    'total_trades': result.total_trades,
                    'win_rate': round(result.win_rate, 3),
                    'profit_factor': round(result.profit_factor, 3),
                    'sharpe_ratio': round(result.sharpe_ratio, 3),
                    'sortino_ratio': round(result.sortino_ratio, 3),
                    'max_drawdown': round(result.max_drawdown_pct, 3),
                    'total_return_pct': round(result.total_return_pct, 1),
                    'avg_risk_reward': round(result.avg_risk_reward, 2),
                    'expectancy': round(result.expectancy, 2),
                }

        with open(filepath, 'w') as f:
            json.dump(export, f, indent=2)

        logger.info(f"Backtest results exported to {filepath}")
        return export
