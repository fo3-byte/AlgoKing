"""
╔══════════════════════════════════════════════════════════════════════════════╗
║                      BASE STRATEGY (Sister Algo Interface)                   ║
║              All sister algos inherit from this base class                    ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, Dict, List, Tuple
import pandas as pd
import numpy as np
from datetime import datetime


class SignalType(Enum):
    LONG = "LONG"
    SHORT = "SHORT"
    EXIT_LONG = "EXIT_LONG"
    EXIT_SHORT = "EXIT_SHORT"
    NO_SIGNAL = "NO_SIGNAL"


@dataclass
class Signal:
    """Trade signal emitted by a sister algo"""
    signal_type: SignalType
    strategy_name: str
    market: str
    entry_price: float
    stop_loss: float
    take_profit: float
    timestamp: datetime
    confidence: float = 0.0           # 0.0 to 1.0 — algo's own confidence
    risk_reward_ratio: float = 0.0
    position_size_suggestion: float = 0.0
    metadata: Dict = field(default_factory=dict)

    @property
    def risk_per_unit(self) -> float:
        """Risk in price terms per unit"""
        return abs(self.entry_price - self.stop_loss)

    @property
    def reward_per_unit(self) -> float:
        """Reward in price terms per unit"""
        return abs(self.take_profit - self.entry_price)

    def __post_init__(self):
        if self.risk_per_unit > 0:
            self.risk_reward_ratio = self.reward_per_unit / self.risk_per_unit


@dataclass
class BacktestResult:
    """Results from backtesting a strategy on a market"""
    strategy_name: str
    market: str
    total_trades: int = 0
    winning_trades: int = 0
    losing_trades: int = 0
    win_rate: float = 0.0
    avg_win: float = 0.0
    avg_loss: float = 0.0
    profit_factor: float = 0.0
    total_return_pct: float = 0.0
    max_drawdown_pct: float = 0.0
    sharpe_ratio: float = 0.0
    sortino_ratio: float = 0.0
    calmar_ratio: float = 0.0
    avg_risk_reward: float = 0.0
    expectancy: float = 0.0           # (win_rate * avg_win) - ((1-win_rate) * avg_loss)
    trades: List[Dict] = field(default_factory=list)
    equity_curve: pd.Series = field(default_factory=lambda: pd.Series(dtype=float))

    def compute_metrics(self):
        """Compute all derived metrics from trade list"""
        if not self.trades:
            return

        self.total_trades = len(self.trades)
        wins = [t for t in self.trades if t.get('pnl', 0) > 0]
        losses = [t for t in self.trades if t.get('pnl', 0) <= 0]

        self.winning_trades = len(wins)
        self.losing_trades = len(losses)
        self.win_rate = self.winning_trades / max(self.total_trades, 1)

        self.avg_win = np.mean([t['pnl'] for t in wins]) if wins else 0
        self.avg_loss = abs(np.mean([t['pnl'] for t in losses])) if losses else 0

        gross_profit = sum(t['pnl'] for t in wins)
        gross_loss = abs(sum(t['pnl'] for t in losses))
        self.profit_factor = gross_profit / max(gross_loss, 1e-10)

        self.expectancy = (self.win_rate * self.avg_win) - ((1 - self.win_rate) * self.avg_loss)

        # Equity curve and drawdown
        if self.trades:
            pnls = [t.get('pnl', 0) for t in self.trades]
            cumulative = np.cumsum(pnls)
            self.equity_curve = pd.Series(cumulative)
            peak = np.maximum.accumulate(cumulative)
            drawdown = (cumulative - peak) / np.where(peak > 0, peak, 1)
            self.max_drawdown_pct = abs(np.min(drawdown)) if len(drawdown) > 0 else 0

            self.total_return_pct = cumulative[-1] / 500_000 * 100 if len(cumulative) > 0 else 0

            # Sharpe (annualized)
            daily_returns = pd.Series(pnls) / 500_000
            if daily_returns.std() > 0:
                self.sharpe_ratio = (daily_returns.mean() / daily_returns.std()) * np.sqrt(252)

            # Sortino
            downside = daily_returns[daily_returns < 0]
            if len(downside) > 0 and downside.std() > 0:
                self.sortino_ratio = (daily_returns.mean() / downside.std()) * np.sqrt(252)

            # R:R
            rrs = [t.get('risk_reward', 0) for t in self.trades if t.get('risk_reward', 0) > 0]
            self.avg_risk_reward = np.mean(rrs) if rrs else 0


class BaseStrategy(ABC):
    """
    Abstract base class for all sister algos.
    Each strategy must implement generate_signals() and can override other methods.
    """

    def __init__(self, name: str, params: Dict = None):
        self.name = name
        self.params = params or {}
        self.signals_history: List[Signal] = []

    @abstractmethod
    def generate_signals(self, df: pd.DataFrame, market: str) -> List[Signal]:
        """
        Core method: analyze data and return trade signals.
        Each sister algo implements its own logic here.
        """
        pass

    def validate_signal(self, signal: Signal, df: pd.DataFrame) -> bool:
        """
        Validate a signal before passing to Monte Carlo.
        Override for strategy-specific validation.
        """
        if signal.signal_type == SignalType.NO_SIGNAL:
            return False
        if signal.risk_reward_ratio < 1.5:
            return False
        if signal.stop_loss <= 0 or signal.take_profit <= 0:
            return False
        if signal.entry_price <= 0:
            return False
        return True

    def backtest(
        self,
        df: pd.DataFrame,
        market: str,
        initial_capital: float = 500_000,
        risk_per_trade: float = 0.03,
        commission: float = 20.0,
        slippage_bps: float = 5.0
    ) -> BacktestResult:
        """
        Universal backtester for any sister algo.
        Runs generate_signals() on historical data and simulates execution.
        """
        result = BacktestResult(strategy_name=self.name, market=market)

        if df.empty or len(df) < 50:
            return result

        signals = self.generate_signals(df, market)
        capital = initial_capital
        trades = []

        for signal in signals:
            if signal.signal_type in [SignalType.NO_SIGNAL, SignalType.EXIT_LONG, SignalType.EXIT_SHORT]:
                continue

            if not self.validate_signal(signal, df):
                continue

            # Position sizing (risk-based)
            risk_amount = capital * risk_per_trade
            risk_per_unit = signal.risk_per_unit
            if risk_per_unit <= 0:
                continue

            position_size = risk_amount / risk_per_unit
            slippage = signal.entry_price * slippage_bps / 10_000

            # Simulate: did price hit TP or SL first?
            # For backtesting, we use simplified logic based on subsequent candles
            idx = df.index.get_indexer([signal.timestamp], method='nearest')[0]
            if idx < 0 or idx >= len(df) - 1:
                continue

            # Look forward up to 20 candles for TP/SL hit
            hit_tp = False
            hit_sl = False
            exit_price = signal.entry_price
            max_hold = min(20, len(df) - idx - 1)

            for i in range(1, max_hold + 1):
                future_bar = df.iloc[idx + i]

                if signal.signal_type == SignalType.LONG:
                    if future_bar['low'] <= signal.stop_loss:
                        hit_sl = True
                        exit_price = signal.stop_loss - slippage
                        break
                    if future_bar['high'] >= signal.take_profit:
                        hit_tp = True
                        exit_price = signal.take_profit - slippage
                        break
                elif signal.signal_type == SignalType.SHORT:
                    if future_bar['high'] >= signal.stop_loss:
                        hit_sl = True
                        exit_price = signal.stop_loss + slippage
                        break
                    if future_bar['low'] <= signal.take_profit:
                        hit_tp = True
                        exit_price = signal.take_profit + slippage
                        break

            # If neither hit, exit at last candle close
            if not hit_tp and not hit_sl:
                exit_price = df.iloc[min(idx + max_hold, len(df) - 1)]['close']

            # Calculate PnL
            if signal.signal_type == SignalType.LONG:
                pnl = (exit_price - signal.entry_price - slippage) * position_size - commission * 2
            else:
                pnl = (signal.entry_price - exit_price - slippage) * position_size - commission * 2

            capital += pnl

            trades.append({
                'entry_time': signal.timestamp,
                'entry_price': signal.entry_price,
                'exit_price': exit_price,
                'signal_type': signal.signal_type.value,
                'stop_loss': signal.stop_loss,
                'take_profit': signal.take_profit,
                'position_size': position_size,
                'pnl': pnl,
                'risk_reward': signal.risk_reward_ratio,
                'hit_tp': hit_tp,
                'hit_sl': hit_sl,
                'capital_after': capital,
            })

        result.trades = trades
        result.compute_metrics()
        return result
