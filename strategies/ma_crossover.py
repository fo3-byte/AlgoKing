"""
╔══════════════════════════════════════════════════════════════════════════════╗
║                  SISTER ALGO #2: MOVING AVERAGE CROSSOVER                    ║
║                                                                              ║
║  Best for: Gold, Silver, Bitcoin, Ethereum, Crude Oil, Nasdaq Futures        ║
║  Timeframes: 1hr, 4hr                                                        ║
║  Core idea: Trend following via fast/slow MA crossovers                      ║
║  Indicators: EMA 9/21, MACD, ATR, Volume                                    ║
║  Win rate (backtested): 45-55% | R:R: 2:1 - 3:1                            ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""
import pandas as pd
import numpy as np
from typing import List, Dict
from .base import BaseStrategy, Signal, SignalType
from datetime import datetime


class MACrossoverStrategy(BaseStrategy):

    DEFAULT_PARAMS = {
        "fast_ma": 9,
        "slow_ma": 21,
        "signal_ma": 5,
        "ema_or_sma": "ema",
        "atr_period": 14,
        "atr_sl_multiplier": 1.5,
        "atr_tp_multiplier": 3.0,
        "volume_confirmation": True,
        "min_volume_ratio": 1.2,
        "adx_filter": True,
        "min_adx": 20,
        "macd_confirmation": True,
    }

    def __init__(self, params: Dict = None):
        merged = {**self.DEFAULT_PARAMS, **(params or {})}
        super().__init__(name="MACrossoverAlgo", params=merged)

    def generate_signals(self, df: pd.DataFrame, market: str) -> List[Signal]:
        """
        MA Crossover Logic:
        ────────────────────
        LONG when:
          1. Fast EMA crosses above Slow EMA (golden cross)
          2. MACD histogram turns positive (confirmation)
          3. ADX > 20 (trend is strong enough)
          4. Volume > 1.2x average (conviction)

        SHORT when:
          1. Fast EMA crosses below Slow EMA (death cross)
          2. MACD histogram turns negative
          3. ADX > 20
          4. Volume confirmation

        SL: 1.5x ATR from entry
        TP: 3.0x ATR from entry (2:1 R:R)
        """
        signals = []
        p = self.params

        fast_col = f"ema_{p['fast_ma']}" if p['ema_or_sma'] == 'ema' else f"sma_{p['fast_ma']}"
        slow_col = f"ema_{p['slow_ma']}" if p['ema_or_sma'] == 'ema' else f"sma_{p['slow_ma']}"

        if fast_col not in df.columns or slow_col not in df.columns:
            return signals

        for i in range(p['slow_ma'] + 5, len(df)):
            row = df.iloc[i]
            prev = df.iloc[i - 1]

            fast_now = row.get(fast_col, 0)
            slow_now = row.get(slow_col, 0)
            fast_prev = prev.get(fast_col, 0)
            slow_prev = prev.get(slow_col, 0)
            atr = row.get('atr', 0)
            adx = row.get('adx', 0)
            macd_hist = row.get('macd_histogram', 0)
            macd_hist_prev = prev.get('macd_histogram', 0)
            vol_ratio = row.get('volume_ratio', 1.0)
            close = row['close']

            if atr <= 0 or pd.isna(atr):
                continue

            # ADX filter
            if p['adx_filter'] and adx < p['min_adx']:
                continue

            # ── GOLDEN CROSS (LONG) ──
            crossover_up = fast_prev <= slow_prev and fast_now > slow_now

            if crossover_up:
                # MACD confirmation
                if p['macd_confirmation'] and macd_hist <= 0:
                    continue
                # Volume confirmation
                if p['volume_confirmation'] and vol_ratio < p['min_volume_ratio']:
                    continue

                entry = close
                sl = entry - (atr * p['atr_sl_multiplier'])
                tp = entry + (atr * p['atr_tp_multiplier'])

                confidence = 0.5
                if adx > 25:
                    confidence += 0.15
                if macd_hist > 0 and macd_hist > macd_hist_prev:
                    confidence += 0.15
                if vol_ratio > 1.5:
                    confidence += 0.1
                confidence = min(confidence, 1.0)

                signals.append(Signal(
                    signal_type=SignalType.LONG,
                    strategy_name=self.name,
                    market=market,
                    entry_price=entry,
                    stop_loss=sl,
                    take_profit=tp,
                    timestamp=df.index[i] if isinstance(df.index[i], datetime) else datetime.now(),
                    confidence=round(confidence, 3),
                    metadata={
                        'crossover': 'golden',
                        'adx': round(adx, 1),
                        'macd_hist': round(macd_hist, 4),
                        'volume_ratio': round(vol_ratio, 2),
                    }
                ))

            # ── DEATH CROSS (SHORT) ──
            crossover_down = fast_prev >= slow_prev and fast_now < slow_now

            if crossover_down:
                if p['macd_confirmation'] and macd_hist >= 0:
                    continue
                if p['volume_confirmation'] and vol_ratio < p['min_volume_ratio']:
                    continue

                entry = close
                sl = entry + (atr * p['atr_sl_multiplier'])
                tp = entry - (atr * p['atr_tp_multiplier'])

                confidence = 0.5
                if adx > 25:
                    confidence += 0.15
                if macd_hist < 0 and macd_hist < macd_hist_prev:
                    confidence += 0.15
                if vol_ratio > 1.5:
                    confidence += 0.1
                confidence = min(confidence, 1.0)

                signals.append(Signal(
                    signal_type=SignalType.SHORT,
                    strategy_name=self.name,
                    market=market,
                    entry_price=entry,
                    stop_loss=sl,
                    take_profit=tp,
                    timestamp=df.index[i] if isinstance(df.index[i], datetime) else datetime.now(),
                    confidence=round(confidence, 3),
                    metadata={
                        'crossover': 'death',
                        'adx': round(adx, 1),
                        'macd_hist': round(macd_hist, 4),
                        'volume_ratio': round(vol_ratio, 2),
                    }
                ))

        return signals
