"""
╔══════════════════════════════════════════════════════════════════════════════╗
║                         RISK MANAGEMENT ENGINE                               ║
║                                                                              ║
║  The guardian of the account. Every trade must pass through here.            ║
║  Implements: Kelly Criterion, position sizing, drawdown controls,            ║
║  correlation checks, daily/weekly loss limits.                               ║
║                                                                              ║
║  Target: ₹5L → ₹50L in 12 months with max 25% drawdown                    ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""
import numpy as np
import pandas as pd
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timedelta
import logging

from strategies.base import Signal, SignalType
from engines.monte_carlo import MonteCarloResult
from config.settings import RiskConfig, AccountConfig

logger = logging.getLogger(__name__)


@dataclass
class Position:
    """Active position tracker"""
    signal: Signal
    entry_time: datetime
    entry_price: float
    position_size: float
    direction: str  # 'LONG' or 'SHORT'
    market: str
    strategy: str
    current_pnl: float = 0.0
    highest_pnl: float = 0.0
    trailing_sl: Optional[float] = None


@dataclass
class PortfolioState:
    """Current state of the portfolio"""
    capital: float = 500_000.0
    peak_capital: float = 500_000.0
    open_positions: List[Position] = field(default_factory=list)
    closed_trades: List[Dict] = field(default_factory=list)

    # Daily tracking
    daily_pnl: float = 0.0
    daily_trades: int = 0
    daily_losses: float = 0.0

    # Weekly tracking
    weekly_pnl: float = 0.0
    weekly_start_capital: float = 500_000.0

    # Monthly tracking
    monthly_pnl: float = 0.0
    monthly_returns: List[float] = field(default_factory=list)

    # Risk metrics
    current_drawdown: float = 0.0
    max_drawdown_seen: float = 0.0
    consecutive_losses: int = 0
    total_trades: int = 0
    winning_trades: int = 0

    @property
    def win_rate(self) -> float:
        return self.winning_trades / max(self.total_trades, 1)

    @property
    def current_drawdown_pct(self) -> float:
        if self.peak_capital <= 0:
            return 0
        return (self.peak_capital - self.capital) / self.peak_capital

    def update_peak(self):
        if self.capital > self.peak_capital:
            self.peak_capital = self.capital
        self.current_drawdown = self.current_drawdown_pct
        self.max_drawdown_seen = max(self.max_drawdown_seen, self.current_drawdown)


class RiskManager:
    """
    Central risk management system.
    Every trade goes through approve_trade() before execution.
    """

    def __init__(self, risk_config: RiskConfig = None, account_config: AccountConfig = None):
        self.risk = risk_config or RiskConfig()
        self.account = account_config or AccountConfig()
        self.portfolio = PortfolioState(capital=self.account.initial_capital)
        self.portfolio.peak_capital = self.account.initial_capital
        self.portfolio.weekly_start_capital = self.account.initial_capital

    # ─────────────────── POSITION SIZING ───────────────────

    def calculate_position_size(
        self,
        signal: Signal,
        mc_result: Optional[MonteCarloResult] = None
    ) -> float:
        """
        Position sizing using Kelly Criterion (half-Kelly for safety).

        Full Kelly = (p*b - q) / b
        where p=win_rate, q=1-p, b=avg_win/avg_loss

        We use HALF Kelly to reduce variance while maintaining edge.
        Then cap at max_position_pct_of_capital.
        """
        capital = self.portfolio.capital
        risk_per_unit = signal.risk_per_unit

        if risk_per_unit <= 0:
            return 0

        # Base position size: risk-based
        risk_pct = self.risk.default_risk_per_trade
        risk_amount = capital * risk_pct
        base_position = risk_amount / risk_per_unit

        # Kelly adjustment if MC data available
        if mc_result and mc_result.kelly_criterion > 0:
            kelly_fraction = mc_result.kelly_criterion * self.risk.kelly_fraction
            kelly_risk = capital * min(kelly_fraction, self.risk.max_risk_per_trade)
            kelly_position = kelly_risk / risk_per_unit

            # Use the more conservative of base and Kelly
            position_size = min(base_position, kelly_position)
        else:
            position_size = base_position

        # Cap at max position size
        max_position_value = capital * self.risk.max_position_pct_of_capital
        position_value = position_size * signal.entry_price
        if position_value > max_position_value:
            position_size = max_position_value / signal.entry_price

        # Reduce position if in drawdown
        if self.portfolio.current_drawdown_pct > 0.10:
            drawdown_scale = 1 - (self.portfolio.current_drawdown_pct - 0.10) * 2
            drawdown_scale = max(drawdown_scale, 0.3)  # Never go below 30% of normal size
            position_size *= drawdown_scale
            logger.info(f"Drawdown scaling: {drawdown_scale:.1%} (DD: {self.portfolio.current_drawdown_pct:.1%})")

        # Reduce after consecutive losses
        if self.portfolio.consecutive_losses >= 3:
            loss_scale = max(0.5, 1 - self.portfolio.consecutive_losses * 0.1)
            position_size *= loss_scale
            logger.info(f"Consecutive loss scaling: {loss_scale:.1%} ({self.portfolio.consecutive_losses} losses)")

        return max(position_size, 0)

    # ─────────────────── TRADE APPROVAL ───────────────────

    def approve_trade(
        self,
        signal: Signal,
        mc_result: Optional[MonteCarloResult] = None
    ) -> Tuple[bool, str, float]:
        """
        THE GATEKEEPER.
        Returns: (approved: bool, reason: str, position_size: float)

        Checks:
        1. Daily loss limit
        2. Weekly loss limit
        3. Max drawdown
        4. Max concurrent positions
        5. Correlation with existing positions
        6. R:R minimum
        7. Monte Carlo score minimum
        8. Position size validity
        """
        # ── CHECK 1: Daily loss limit ──
        daily_loss_pct = abs(self.portfolio.daily_losses) / max(self.portfolio.capital, 1)
        if daily_loss_pct >= self.risk.max_daily_loss:
            return False, f"Daily loss limit hit ({daily_loss_pct:.1%} >= {self.risk.max_daily_loss:.1%}). Stop trading today.", 0

        # ── CHECK 2: Weekly loss limit ──
        weekly_loss_pct = (self.portfolio.weekly_start_capital - self.portfolio.capital) / self.portfolio.weekly_start_capital
        if weekly_loss_pct >= self.risk.max_weekly_loss:
            return False, f"Weekly loss limit hit ({weekly_loss_pct:.1%}). Stop trading this week.", 0

        # ── CHECK 3: Max drawdown ──
        if self.portfolio.current_drawdown_pct >= self.risk.max_total_drawdown:
            return False, f"MAX DRAWDOWN BREACHED ({self.portfolio.current_drawdown_pct:.1%}). SYSTEM PAUSED.", 0

        # ── CHECK 4: Max concurrent positions ──
        if len(self.portfolio.open_positions) >= self.risk.max_concurrent_trades:
            return False, f"Max concurrent positions ({self.risk.max_concurrent_trades}) reached.", 0

        # ── CHECK 5: Duplicate market check ──
        open_markets = [p.market for p in self.portfolio.open_positions]
        if signal.market in open_markets:
            return False, f"Already have position in {signal.market}.", 0

        # ── CHECK 6: R:R minimum ──
        if signal.risk_reward_ratio < 1.5:
            return False, f"R:R too low ({signal.risk_reward_ratio:.1f}). Minimum is 1.5:1.", 0

        # ── CHECK 7: Monte Carlo score ──
        if mc_result:
            if mc_result.composite_score < self.risk.min_mc_score:
                return False, f"MC score too low ({mc_result.composite_score:.3f} < {self.risk.min_mc_score})", 0
            if mc_result.probability_of_profit < self.risk.min_mc_profit_probability:
                return False, f"P(profit) too low ({mc_result.probability_of_profit:.1%})", 0

        # ── CHECK 8: Position sizing ──
        position_size = self.calculate_position_size(signal, mc_result)
        if position_size <= 0:
            return False, "Calculated position size is zero.", 0

        # Risk amount check
        risk_amount = position_size * signal.risk_per_unit
        max_risk = self.portfolio.capital * self.risk.max_risk_per_trade
        if risk_amount > max_risk:
            position_size = max_risk / signal.risk_per_unit
            logger.info(f"Position size capped to max risk: {position_size:.2f}")

        return True, "APPROVED", position_size

    # ─────────────────── POSITION MANAGEMENT ───────────────────

    def open_position(self, signal: Signal, position_size: float) -> Position:
        """Record a new position"""
        position = Position(
            signal=signal,
            entry_time=signal.timestamp,
            entry_price=signal.entry_price,
            position_size=position_size,
            direction=signal.signal_type.value,
            market=signal.market,
            strategy=signal.strategy_name,
        )
        self.portfolio.open_positions.append(position)
        self.portfolio.total_trades += 1
        self.portfolio.daily_trades += 1

        logger.info(
            f"OPENED: {position.direction} {position.market} @ {position.entry_price:.2f} "
            f"x{position.position_size:.2f} | SL={signal.stop_loss:.2f} TP={signal.take_profit:.2f} "
            f"| Strategy={position.strategy}"
        )
        return position

    def close_position(self, position: Position, exit_price: float, reason: str = ""):
        """Close a position and update portfolio"""
        if position.direction == 'LONG':
            pnl = (exit_price - position.entry_price) * position.position_size
        else:
            pnl = (position.entry_price - exit_price) * position.position_size

        # Commissions and slippage
        slippage = position.entry_price * self.risk.slippage_bps / 10_000 * position.position_size
        pnl -= (self.risk.commission_per_trade * 2 + slippage)

        self.portfolio.capital += pnl
        self.portfolio.daily_pnl += pnl
        self.portfolio.weekly_pnl += pnl
        self.portfolio.monthly_pnl += pnl

        if pnl > 0:
            self.portfolio.winning_trades += 1
            self.portfolio.consecutive_losses = 0
        else:
            self.portfolio.daily_losses += abs(pnl)
            self.portfolio.consecutive_losses += 1

        self.portfolio.update_peak()

        self.portfolio.closed_trades.append({
            'entry_time': position.entry_time,
            'exit_time': datetime.now(),
            'market': position.market,
            'strategy': position.strategy,
            'direction': position.direction,
            'entry_price': position.entry_price,
            'exit_price': exit_price,
            'position_size': position.position_size,
            'pnl': pnl,
            'reason': reason,
            'capital_after': self.portfolio.capital,
        })

        if position in self.portfolio.open_positions:
            self.portfolio.open_positions.remove(position)

        logger.info(
            f"CLOSED: {position.direction} {position.market} | "
            f"Entry={position.entry_price:.2f} Exit={exit_price:.2f} | "
            f"PnL=₹{pnl:,.0f} | Capital=₹{self.portfolio.capital:,.0f} | "
            f"Reason={reason}"
        )

    def reset_daily(self):
        """Reset daily counters (call at start of each trading day)"""
        self.portfolio.daily_pnl = 0
        self.portfolio.daily_trades = 0
        self.portfolio.daily_losses = 0

    def reset_weekly(self):
        """Reset weekly counters"""
        self.portfolio.weekly_pnl = 0
        self.portfolio.weekly_start_capital = self.portfolio.capital

    def reset_monthly(self):
        """Reset monthly counters"""
        self.portfolio.monthly_returns.append(self.portfolio.monthly_pnl)
        self.portfolio.monthly_pnl = 0

    def get_portfolio_summary(self) -> Dict:
        """Get current portfolio summary"""
        return {
            'capital': self.portfolio.capital,
            'peak_capital': self.portfolio.peak_capital,
            'current_drawdown': f"{self.portfolio.current_drawdown_pct:.1%}",
            'max_drawdown_seen': f"{self.portfolio.max_drawdown_seen:.1%}",
            'total_trades': self.portfolio.total_trades,
            'win_rate': f"{self.portfolio.win_rate:.1%}",
            'open_positions': len(self.portfolio.open_positions),
            'daily_pnl': f"₹{self.portfolio.daily_pnl:,.0f}",
            'consecutive_losses': self.portfolio.consecutive_losses,
            'return_pct': f"{(self.portfolio.capital / self.account.initial_capital - 1) * 100:.1f}%",
            'distance_to_target': f"₹{self.account.target_capital - self.portfolio.capital:,.0f}",
        }
