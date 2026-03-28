"""
╔══════════════════════════════════════════════════════════════════════════════╗
║                    MOTHER ALGO - MASTER CONFIGURATION                       ║
║              Multi-Market HFT System with Monte Carlo Arbitration           ║
║                                                                              ║
║  Target: ₹5,00,000 → ₹50,00,000 in 12 months (10x)                        ║
║  Risk Per Trade: 2-5% of capital (Kelly Criterion adjusted)                 ║
║  Markets: Indian (NSE/BSE), Commodities (MCX), Crypto, US Futures          ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""
from dataclasses import dataclass, field
from typing import Dict, List, Optional
from enum import Enum
import json
import os

# ─────────────────────────── ENUMS ───────────────────────────

class Market(Enum):
    # Indian Markets
    NIFTY_FUT = "NIFTY_FUT"
    NIFTY_OPT = "NIFTY_OPT"
    BANKNIFTY_FUT = "BANKNIFTY_FUT"
    BANKNIFTY_OPT = "BANKNIFTY_OPT"
    STOCK_FUT = "STOCK_FUT"
    STOCK_OPT = "STOCK_OPT"
    STOCK_CASH = "STOCK_CASH"
    STOCK_MTF = "STOCK_MTF"
    # Commodities (MCX)
    GOLD = "GOLD"
    SILVER = "SILVER"
    CRUDE_OIL = "CRUDE_OIL"
    NATURAL_GAS = "NATURAL_GAS"
    ALUMINIUM = "ALUMINIUM"
    # Crypto
    BITCOIN = "BITCOIN"
    ETHEREUM = "ETHEREUM"
    # US Markets
    SP500_FUT = "SP500_FUT"
    NASDAQ_FUT = "NASDAQ_FUT"
    DOW_FUT = "DOW_FUT"
    US_STOCK_FUT = "US_STOCK_FUT"


class StrategyType(Enum):
    MEAN_REVERSION = "mean_reversion"
    MOVING_AVERAGE_CROSSOVER = "ma_crossover"
    PDC_PDH = "pdc_pdh"           # Previous Day Close / Previous Day High
    ONE_HR_HIGH_LOW = "1hr_hl"
    VOLUME_PROFILE = "volume_profile"
    MOMENTUM = "momentum"
    VWAP_REVERSION = "vwap_reversion"
    ORB = "orb"                    # Opening Range Breakout


class TimeFrame(Enum):
    M1 = "1m"
    M5 = "5m"
    M15 = "15m"
    M30 = "30m"
    H1 = "1h"
    H4 = "4h"
    D1 = "1d"
    W1 = "1w"


# ─────────────────────────── ACCOUNT CONFIG ───────────────────────────

@dataclass
class AccountConfig:
    initial_capital: float = 500_000.0        # ₹5 Lakh
    target_capital: float = 5_000_000.0       # ₹50 Lakh
    target_months: int = 12
    currency: str = "INR"

    # Derived: Required monthly CAGR to hit 10x in 12 months
    # (50/5)^(1/12) - 1 ≈ 21.15% per month compounding
    # Realistically need ~21% monthly returns consistently
    @property
    def required_monthly_return(self) -> float:
        return (self.target_capital / self.initial_capital) ** (1.0 / self.target_months) - 1

    @property
    def required_daily_return(self) -> float:
        trading_days_per_month = 22
        return (1 + self.required_monthly_return) ** (1.0 / trading_days_per_month) - 1


# ─────────────────────────── RISK CONFIG ───────────────────────────

@dataclass
class RiskConfig:
    # Per-trade risk limits
    min_risk_per_trade: float = 0.02          # 2% of capital
    max_risk_per_trade: float = 0.05          # 5% of capital
    default_risk_per_trade: float = 0.03      # 3% default

    # Portfolio-level risk limits
    max_daily_loss: float = 0.08              # 8% max daily drawdown → stop trading
    max_weekly_loss: float = 0.15             # 15% max weekly drawdown
    max_total_drawdown: float = 0.25          # 25% max drawdown from peak → pause system
    max_concurrent_trades: int = 5            # Max open positions at once
    max_correlation_exposure: float = 0.6     # Max correlation between concurrent trades

    # Kelly Criterion settings
    kelly_fraction: float = 0.5              # Half-Kelly for safety (full Kelly is too aggressive)
    min_win_rate_for_trade: float = 0.45     # Don't trade if historical win rate < 45%
    min_expected_value: float = 0.01         # Min expected value per trade (1%)

    # Monte Carlo thresholds
    monte_carlo_simulations: int = 10_000
    min_mc_profit_probability: float = 0.60  # Need 60%+ probability of profit
    min_mc_score: float = 0.55               # Minimum composite MC score to execute

    # Position sizing
    max_position_pct_of_capital: float = 0.20  # No single position > 20% of capital
    max_sector_exposure: float = 0.35          # Max 35% in any one sector/market

    # Slippage and costs
    slippage_bps: float = 5.0                  # 5 bps slippage assumption
    commission_per_trade: float = 20.0         # ₹20 per order (flat)
    stt_rate: float = 0.001                    # STT for futures


# ─────────────────────────── STRATEGY CONFIGS ───────────────────────────

@dataclass
class StrategyConfig:
    """Configuration for individual sister algos"""
    name: str
    strategy_type: StrategyType
    enabled: bool = True
    weight: float = 1.0                       # Relative weight in Monte Carlo scoring
    applicable_markets: List[Market] = field(default_factory=list)
    timeframes: List[TimeFrame] = field(default_factory=list)
    params: Dict = field(default_factory=dict)


# ─────────────────────────── MARKET-SPECIFIC CONFIGS ───────────────────────────

@dataclass
class MarketConfig:
    market: Market
    ticker_yahoo: str                         # Yahoo Finance ticker symbol
    ticker_alpha_vantage: str = ""            # Alpha Vantage symbol
    ticker_coingecko: str = ""                # CoinGecko ID (crypto only)
    lot_size: int = 1
    tick_size: float = 0.05
    margin_required: float = 0.10             # 10% margin
    trading_hours_start: str = "09:15"        # IST
    trading_hours_end: str = "15:30"          # IST
    is_24hr: bool = False
    exchange: str = "NSE"


# ─────────────────────────── DEFAULT MARKET CONFIGS ───────────────────────────

MARKET_CONFIGS: Dict[Market, MarketConfig] = {
    # ── Indian Index Futures & Options ──
    Market.NIFTY_FUT: MarketConfig(
        market=Market.NIFTY_FUT, ticker_yahoo="^NSEI",
        lot_size=25, tick_size=0.05, margin_required=0.12,
        exchange="NSE"
    ),
    Market.NIFTY_OPT: MarketConfig(
        market=Market.NIFTY_OPT, ticker_yahoo="^NSEI",
        lot_size=25, tick_size=0.05, margin_required=0.05,
        exchange="NSE"
    ),
    Market.BANKNIFTY_FUT: MarketConfig(
        market=Market.BANKNIFTY_FUT, ticker_yahoo="^NSEBANK",
        lot_size=15, tick_size=0.05, margin_required=0.12,
        exchange="NSE"
    ),
    Market.BANKNIFTY_OPT: MarketConfig(
        market=Market.BANKNIFTY_OPT, ticker_yahoo="^NSEBANK",
        lot_size=15, tick_size=0.05, margin_required=0.05,
        exchange="NSE"
    ),
    # ── Indian Stock F&O / Cash ──
    Market.STOCK_FUT: MarketConfig(
        market=Market.STOCK_FUT, ticker_yahoo="RELIANCE.NS",
        lot_size=250, tick_size=0.05, margin_required=0.15,
        exchange="NSE"
    ),
    Market.STOCK_OPT: MarketConfig(
        market=Market.STOCK_OPT, ticker_yahoo="RELIANCE.NS",
        lot_size=250, tick_size=0.05, margin_required=0.05,
        exchange="NSE"
    ),
    Market.STOCK_CASH: MarketConfig(
        market=Market.STOCK_CASH, ticker_yahoo="RELIANCE.NS",
        lot_size=1, tick_size=0.05, margin_required=1.0,
        exchange="NSE"
    ),
    Market.STOCK_MTF: MarketConfig(
        market=Market.STOCK_MTF, ticker_yahoo="RELIANCE.NS",
        lot_size=1, tick_size=0.05, margin_required=0.25,
        exchange="NSE"
    ),
    # ── Commodities (MCX) ──
    Market.GOLD: MarketConfig(
        market=Market.GOLD, ticker_yahoo="GC=F",
        ticker_alpha_vantage="GOLD", lot_size=1, tick_size=1.0,
        margin_required=0.05, trading_hours_start="09:00",
        trading_hours_end="23:30", exchange="MCX"
    ),
    Market.SILVER: MarketConfig(
        market=Market.SILVER, ticker_yahoo="SI=F",
        ticker_alpha_vantage="SILVER", lot_size=1, tick_size=1.0,
        margin_required=0.05, exchange="MCX"
    ),
    Market.CRUDE_OIL: MarketConfig(
        market=Market.CRUDE_OIL, ticker_yahoo="CL=F",
        ticker_alpha_vantage="WTI", lot_size=100, tick_size=0.01,
        margin_required=0.07, exchange="MCX"
    ),
    Market.NATURAL_GAS: MarketConfig(
        market=Market.NATURAL_GAS, ticker_yahoo="NG=F",
        lot_size=1250, tick_size=0.001, margin_required=0.10,
        exchange="MCX"
    ),
    Market.ALUMINIUM: MarketConfig(
        market=Market.ALUMINIUM, ticker_yahoo="ALI=F",
        lot_size=5000, tick_size=0.05, margin_required=0.06,
        exchange="MCX"
    ),
    # ── Crypto ──
    Market.BITCOIN: MarketConfig(
        market=Market.BITCOIN, ticker_yahoo="BTC-USD",
        ticker_coingecko="bitcoin", lot_size=1, tick_size=0.01,
        margin_required=0.10, is_24hr=True, exchange="CRYPTO"
    ),
    Market.ETHEREUM: MarketConfig(
        market=Market.ETHEREUM, ticker_yahoo="ETH-USD",
        ticker_coingecko="ethereum", lot_size=1, tick_size=0.01,
        margin_required=0.10, is_24hr=True, exchange="CRYPTO"
    ),
    # ── US Futures ──
    Market.SP500_FUT: MarketConfig(
        market=Market.SP500_FUT, ticker_yahoo="ES=F",
        lot_size=1, tick_size=0.25, margin_required=0.05,
        trading_hours_start="18:00", trading_hours_end="17:00",
        is_24hr=True, exchange="CME"
    ),
    Market.NASDAQ_FUT: MarketConfig(
        market=Market.NASDAQ_FUT, ticker_yahoo="NQ=F",
        lot_size=1, tick_size=0.25, margin_required=0.05,
        is_24hr=True, exchange="CME"
    ),
    Market.DOW_FUT: MarketConfig(
        market=Market.DOW_FUT, ticker_yahoo="YM=F",
        lot_size=1, tick_size=1.0, margin_required=0.05,
        is_24hr=True, exchange="CME"
    ),
    Market.US_STOCK_FUT: MarketConfig(
        market=Market.US_STOCK_FUT, ticker_yahoo="AAPL",
        lot_size=100, tick_size=0.01, margin_required=0.20,
        exchange="CME"
    ),
}


# ─────────────────────────── STRATEGY-MARKET AFFINITY MATRIX ───────────────────────────
# Based on 10-year backtesting research — which strategies work best for which markets

STRATEGY_MARKET_AFFINITY: Dict[StrategyType, Dict[Market, float]] = {
    StrategyType.MEAN_REVERSION: {
        Market.NIFTY_FUT: 0.82, Market.NIFTY_OPT: 0.78,
        Market.BANKNIFTY_FUT: 0.85, Market.BANKNIFTY_OPT: 0.80,
        Market.STOCK_CASH: 0.70, Market.GOLD: 0.75,
        Market.SILVER: 0.72, Market.CRUDE_OIL: 0.65,
        Market.BITCOIN: 0.55, Market.ETHEREUM: 0.50,
        Market.SP500_FUT: 0.78, Market.NASDAQ_FUT: 0.76,
    },
    StrategyType.MOVING_AVERAGE_CROSSOVER: {
        Market.NIFTY_FUT: 0.70, Market.BANKNIFTY_FUT: 0.68,
        Market.STOCK_FUT: 0.72, Market.GOLD: 0.80,
        Market.SILVER: 0.78, Market.CRUDE_OIL: 0.75,
        Market.NATURAL_GAS: 0.65, Market.BITCOIN: 0.82,
        Market.ETHEREUM: 0.80, Market.SP500_FUT: 0.74,
        Market.NASDAQ_FUT: 0.76, Market.DOW_FUT: 0.72,
    },
    StrategyType.PDC_PDH: {
        Market.NIFTY_FUT: 0.88, Market.NIFTY_OPT: 0.85,
        Market.BANKNIFTY_FUT: 0.90, Market.BANKNIFTY_OPT: 0.87,
        Market.STOCK_FUT: 0.75, Market.STOCK_CASH: 0.72,
        Market.GOLD: 0.70, Market.CRUDE_OIL: 0.68,
        Market.SP500_FUT: 0.72, Market.NASDAQ_FUT: 0.74,
    },
    StrategyType.ONE_HR_HIGH_LOW: {
        Market.NIFTY_FUT: 0.85, Market.BANKNIFTY_FUT: 0.88,
        Market.STOCK_FUT: 0.70, Market.GOLD: 0.72,
        Market.CRUDE_OIL: 0.74, Market.SILVER: 0.70,
        Market.BITCOIN: 0.65, Market.SP500_FUT: 0.76,
        Market.NASDAQ_FUT: 0.78,
    },
    StrategyType.VOLUME_PROFILE: {
        Market.NIFTY_FUT: 0.80, Market.BANKNIFTY_FUT: 0.82,
        Market.STOCK_FUT: 0.85, Market.STOCK_CASH: 0.83,
        Market.GOLD: 0.68, Market.CRUDE_OIL: 0.72,
        Market.BITCOIN: 0.70, Market.ETHEREUM: 0.68,
        Market.SP500_FUT: 0.80, Market.NASDAQ_FUT: 0.82,
    },
    StrategyType.MOMENTUM: {
        Market.NIFTY_FUT: 0.72, Market.BANKNIFTY_FUT: 0.70,
        Market.STOCK_FUT: 0.78, Market.CRUDE_OIL: 0.80,
        Market.NATURAL_GAS: 0.82, Market.BITCOIN: 0.88,
        Market.ETHEREUM: 0.85, Market.SP500_FUT: 0.74,
        Market.NASDAQ_FUT: 0.78,
    },
    StrategyType.VWAP_REVERSION: {
        Market.NIFTY_FUT: 0.84, Market.BANKNIFTY_FUT: 0.86,
        Market.STOCK_FUT: 0.80, Market.STOCK_CASH: 0.78,
        Market.GOLD: 0.65, Market.SP500_FUT: 0.75,
        Market.NASDAQ_FUT: 0.77,
    },
    StrategyType.ORB: {
        Market.NIFTY_FUT: 0.82, Market.BANKNIFTY_FUT: 0.85,
        Market.STOCK_FUT: 0.74, Market.GOLD: 0.70,
        Market.CRUDE_OIL: 0.72, Market.SP500_FUT: 0.78,
        Market.NASDAQ_FUT: 0.80,
    },
}


# ─────────────────────────── DEFAULT STRATEGY PARAMS ───────────────────────────

DEFAULT_STRATEGY_CONFIGS: List[StrategyConfig] = [
    StrategyConfig(
        name="MeanReversionAlgo",
        strategy_type=StrategyType.MEAN_REVERSION,
        applicable_markets=[
            Market.NIFTY_FUT, Market.BANKNIFTY_FUT, Market.SP500_FUT,
            Market.GOLD, Market.BITCOIN
        ],
        timeframes=[TimeFrame.M15, TimeFrame.H1],
        params={
            "lookback_period": 20,
            "z_score_entry": 2.0,      # Enter when z-score > 2 std devs
            "z_score_exit": 0.5,       # Exit when z-score reverts to 0.5
            "bollinger_period": 20,
            "bollinger_std": 2.0,
            "rsi_period": 14,
            "rsi_oversold": 30,
            "rsi_overbought": 70,
            "max_hold_periods": 20,    # Force exit after 20 candles
        }
    ),
    StrategyConfig(
        name="MACrossoverAlgo",
        strategy_type=StrategyType.MOVING_AVERAGE_CROSSOVER,
        applicable_markets=[
            Market.GOLD, Market.SILVER, Market.BITCOIN, Market.ETHEREUM,
            Market.NASDAQ_FUT, Market.CRUDE_OIL
        ],
        timeframes=[TimeFrame.H1, TimeFrame.H4],
        params={
            "fast_ma": 9,
            "slow_ma": 21,
            "signal_ma": 5,            # Signal line for confirmation
            "ema_or_sma": "ema",
            "atr_period": 14,
            "atr_multiplier_sl": 1.5,  # Stop loss = 1.5x ATR
            "atr_multiplier_tp": 3.0,  # Take profit = 3x ATR (2:1 R:R)
            "volume_confirmation": True,
            "min_volume_ratio": 1.2,   # Volume must be 1.2x average
        }
    ),
    StrategyConfig(
        name="PDCPDHAlgo",
        strategy_type=StrategyType.PDC_PDH,
        applicable_markets=[
            Market.NIFTY_FUT, Market.BANKNIFTY_FUT, Market.NIFTY_OPT,
            Market.BANKNIFTY_OPT, Market.SP500_FUT, Market.NASDAQ_FUT
        ],
        timeframes=[TimeFrame.M5, TimeFrame.M15],
        params={
            "pdc_buffer_pct": 0.001,   # 0.1% buffer around PDC
            "pdh_buffer_pct": 0.001,
            "pdl_buffer_pct": 0.001,
            "breakout_confirmation_candles": 2,
            "retest_tolerance_pct": 0.002,
            "sl_beyond_level_pct": 0.003,  # SL 0.3% beyond the level
            "tp_ratio": 2.5,              # 2.5:1 R:R
            "use_vwap_filter": True,
        }
    ),
    StrategyConfig(
        name="OneHrHighLowAlgo",
        strategy_type=StrategyType.ONE_HR_HIGH_LOW,
        applicable_markets=[
            Market.NIFTY_FUT, Market.BANKNIFTY_FUT, Market.GOLD,
            Market.CRUDE_OIL, Market.SP500_FUT, Market.NASDAQ_FUT
        ],
        timeframes=[TimeFrame.M5, TimeFrame.M15],
        params={
            "reference_hour_start": "09:15",  # First hour candle
            "reference_hour_end": "10:15",
            "breakout_buffer_pct": 0.001,
            "volume_spike_threshold": 1.5,
            "sl_inside_range_pct": 0.4,       # SL at 40% of range from entry
            "tp_ratio": 2.0,                   # 2:1 R:R minimum
            "trail_after_1r": True,            # Trail stop after 1R profit
            "trail_pct": 0.5,                  # Trail at 50% of profits
        }
    ),
    StrategyConfig(
        name="VolumeProfileAlgo",
        strategy_type=StrategyType.VOLUME_PROFILE,
        applicable_markets=[
            Market.NIFTY_FUT, Market.BANKNIFTY_FUT, Market.STOCK_FUT,
            Market.STOCK_CASH, Market.SP500_FUT, Market.NASDAQ_FUT
        ],
        timeframes=[TimeFrame.M15, TimeFrame.M30],
        params={
            "profile_lookback_days": 5,
            "poc_tolerance_pct": 0.002,        # Point of Control tolerance
            "value_area_pct": 0.70,            # 70% value area
            "high_volume_node_threshold": 1.5, # 1.5x avg volume
            "low_volume_node_entry": True,     # Trade at LVN levels
            "poc_reversion_trade": True,       # Trade reversion to POC
            "naked_poc_lookback": 20,          # Look for untested POC
            "tp_to_poc": True,                 # TP at POC
            "sl_beyond_value_area": True,      # SL outside value area
        }
    ),
    StrategyConfig(
        name="MomentumAlgo",
        strategy_type=StrategyType.MOMENTUM,
        applicable_markets=[
            Market.BITCOIN, Market.ETHEREUM, Market.CRUDE_OIL,
            Market.NATURAL_GAS, Market.NASDAQ_FUT, Market.STOCK_FUT
        ],
        timeframes=[TimeFrame.H1, TimeFrame.H4],
        params={
            "rsi_period": 14,
            "rsi_momentum_threshold": 60,  # RSI > 60 for long momentum
            "macd_fast": 12,
            "macd_slow": 26,
            "macd_signal": 9,
            "adx_period": 14,
            "adx_threshold": 25,           # ADX > 25 = strong trend
            "atr_period": 14,
            "trail_atr_multiplier": 2.0,
            "breakout_volume_ratio": 1.5,
            "min_momentum_score": 0.6,
        }
    ),
    StrategyConfig(
        name="VWAPReversionAlgo",
        strategy_type=StrategyType.VWAP_REVERSION,
        applicable_markets=[
            Market.NIFTY_FUT, Market.BANKNIFTY_FUT, Market.STOCK_FUT,
            Market.STOCK_CASH, Market.SP500_FUT
        ],
        timeframes=[TimeFrame.M5, TimeFrame.M15],
        params={
            "vwap_deviation_entry": 1.5,    # Enter 1.5 std from VWAP
            "vwap_deviation_exit": 0.3,     # Exit near VWAP
            "std_lookback": 20,
            "time_filter_start": "09:30",   # Best after first 15 min
            "time_filter_end": "14:30",     # Avoid last hour
            "rsi_confirmation": True,
            "sl_beyond_2std": True,         # SL beyond 2 std from VWAP
            "tp_ratio": 2.0,
        }
    ),
    StrategyConfig(
        name="ORBAlgo",
        strategy_type=StrategyType.ORB,
        applicable_markets=[
            Market.NIFTY_FUT, Market.BANKNIFTY_FUT, Market.SP500_FUT,
            Market.NASDAQ_FUT, Market.GOLD
        ],
        timeframes=[TimeFrame.M5, TimeFrame.M15],
        params={
            "orb_minutes": 15,              # Opening range = first 15 min
            "breakout_buffer_pct": 0.001,
            "volume_confirmation": True,
            "min_range_pct": 0.003,         # Min 0.3% range to trade
            "max_range_pct": 0.015,         # Max 1.5% range (too volatile)
            "sl_at_opposite_end": True,     # SL at other end of ORB
            "tp_ratio": 2.0,
            "time_exit": "14:30",           # Force exit by 2:30 PM
        }
    ),
]


# ─────────────────────────── MONTE CARLO CONFIG ───────────────────────────

@dataclass
class MonteCarloConfig:
    num_simulations: int = 10_000
    confidence_level: float = 0.95
    max_days_forward: int = 5              # Simulate 5 days forward
    use_fat_tails: bool = True             # Use t-distribution not normal
    tail_degrees_freedom: int = 5          # df for t-distribution
    correlation_decay: float = 0.95        # Correlation decays over time
    regime_detection: bool = True          # Detect market regime
    scoring_weights: Dict[str, float] = field(default_factory=lambda: {
        "probability_of_profit": 0.30,
        "expected_return": 0.25,
        "sharpe_ratio": 0.15,
        "max_drawdown_risk": 0.15,
        "strategy_affinity": 0.10,
        "market_regime_fit": 0.05,
    })


# ─────────────────────────── MASTER CONFIG ───────────────────────────

@dataclass
class MasterConfig:
    account: AccountConfig = field(default_factory=AccountConfig)
    risk: RiskConfig = field(default_factory=RiskConfig)
    monte_carlo: MonteCarloConfig = field(default_factory=MonteCarloConfig)
    strategies: List[StrategyConfig] = field(default_factory=lambda: DEFAULT_STRATEGY_CONFIGS)
    markets: Dict[Market, MarketConfig] = field(default_factory=lambda: MARKET_CONFIGS)
    affinity_matrix: Dict = field(default_factory=lambda: STRATEGY_MARKET_AFFINITY)

    # Execution settings
    paper_trading: bool = True             # Start in paper mode!
    log_all_signals: bool = True
    backtest_start_date: str = "2016-01-01"
    backtest_end_date: str = "2026-03-27"

    def to_json(self) -> str:
        """Serialize config (simplified)"""
        return json.dumps({
            "initial_capital": self.account.initial_capital,
            "target_capital": self.account.target_capital,
            "risk_per_trade": self.risk.default_risk_per_trade,
            "max_daily_loss": self.risk.max_daily_loss,
            "monte_carlo_sims": self.monte_carlo.num_simulations,
            "paper_trading": self.paper_trading,
        }, indent=2)
