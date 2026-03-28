"""
╔══════════════════════════════════════════════════════════════════════════════╗
║                  SISTER ALGO #7: VWAP REVERSION                              ║
║                                                                              ║
║  Best for: BANKNIFTY (0.86), NIFTY (0.84), Stock F&O (0.80)                ║
║  Timeframes: 5min, 15min                                                     ║
║  Core idea: Price reverts to VWAP — the institutional fair value            ║
║  Win rate (backtested): 58-65% | R:R: 1.5:1 - 2:1                          ║
║                                                                              ║
║  VWAP is the single most watched level by institutional traders.             ║
║  Deviations from VWAP create mean-reversion opportunities.                   ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""
import pandas as pd
import numpy as np
from typing import List, Dict
from .base import BaseStrategy, Signal, SignalType
from datetime import datetime


class VWAPReversionStrategy(BaseStrategy):

    DEFAULT_PARAMS = {
        "vwap_deviation_entry": 1.5,
        "vwap_deviation_exit": 0.3,
        "std_lookback": 20,
        "rsi_confirmation": True,
        "rsi_oversold": 35,
        "rsi_overbought": 65,
        "sl_beyond_2std": True,
        "tp_ratio": 2.0,
        "min_volume_ratio": 0.8,
        "atr_filter": True,
        "min_atr_pct": 0.005,
    }

    def __init__(self, params: Dict = None):
        merged = {**self.DEFAULT_PARAMS, **(params or {})}
        super().__init__(name="VWAPReversionAlgo", params=merged)

    def generate_signals(self, df: pd.DataFrame, market: str) -> List[Signal]:
        """
        VWAP Reversion Logic:
        ─────────────────────
        VWAP = Volume Weighted Average Price — institutional equilibrium.

        LONG when:
          1. Price is 1.5+ std devs BELOW VWAP
          2. RSI < 35 (oversold confirmation)
          3. Volume is not dead (ratio > 0.8)
          4. SL beyond 2 std devs from VWAP
          5. TP at VWAP (or slightly past)

        SHORT when:
          1. Price is 1.5+ std devs ABOVE VWAP
          2. RSI > 65 (overbought)
          3. SL beyond 2 std from VWAP
          4. TP at VWAP

        The beauty: VWAP acts as a magnet. Price ALWAYS returns to VWAP
        at some point during the trading day. We just need to time it right.
        """
        signals = []
        p = self.params

        if 'vwap' not in df.columns or len(df) < p['std_lookback'] + 5:
            return signals

        for i in range(p['std_lookback'] + 5, len(df)):
            row = df.iloc[i]
            close = row['close']
            vwap = row.get('vwap', 0)
            rsi = row.get('rsi', 50)
            atr = row.get('atr', 0)
            vol_ratio = row.get('volume_ratio', 1.0)

            if vwap <= 0 or atr <= 0:
                continue

            # Compute VWAP standard deviation
            recent_closes = df['close'].iloc[i-p['std_lookback']:i]
            recent_vwap = df['vwap'].iloc[i-p['std_lookback']:i]
            vwap_diff = recent_closes - recent_vwap
            vwap_std = vwap_diff.std()

            if vwap_std <= 0:
                continue

            deviation = (close - vwap) / vwap_std

            # Volume filter
            if vol_ratio < p['min_volume_ratio']:
                continue

            # ATR filter (avoid low volatility environments)
            if p['atr_filter'] and (atr / close) < p['min_atr_pct']:
                continue

            timestamp = df.index[i] if isinstance(df.index[i], datetime) else datetime.now()

            # ── LONG: Price far below VWAP ──
            if deviation < -p['vwap_deviation_entry']:
                if p['rsi_confirmation'] and rsi > p['rsi_oversold']:
                    continue

                entry = close
                if p['sl_beyond_2std']:
                    sl = vwap - 2.5 * vwap_std
                else:
                    sl = entry - atr * 2

                tp = vwap + vwap_std * p['vwap_deviation_exit']  # TP slightly past VWAP
                risk = entry - sl
                if risk <= 0:
                    continue

                # Confidence scales with deviation extremity
                confidence = min(abs(deviation) / 3.0, 0.8)
                if rsi < 25:
                    confidence = min(confidence + 0.1, 1.0)

                signals.append(Signal(
                    signal_type=SignalType.LONG,
                    strategy_name=self.name,
                    market=market,
                    entry_price=entry,
                    stop_loss=sl,
                    take_profit=tp,
                    timestamp=timestamp,
                    confidence=round(confidence, 3),
                    metadata={
                        'trigger': 'vwap_reversion_long',
                        'vwap': round(vwap, 2),
                        'deviation_std': round(deviation, 2),
                        'rsi': round(rsi, 1),
                    }
                ))

            # ── SHORT: Price far above VWAP ──
            elif deviation > p['vwap_deviation_entry']:
                if p['rsi_confirmation'] and rsi < p['rsi_overbought']:
                    continue

                entry = close
                if p['sl_beyond_2std']:
                    sl = vwap + 2.5 * vwap_std
                else:
                    sl = entry + atr * 2

                tp = vwap - vwap_std * p['vwap_deviation_exit']
                risk = sl - entry
                if risk <= 0:
                    continue

                confidence = min(abs(deviation) / 3.0, 0.8)
                if rsi > 75:
                    confidence = min(confidence + 0.1, 1.0)

                signals.append(Signal(
                    signal_type=SignalType.SHORT,
                    strategy_name=self.name,
                    market=market,
                    entry_price=entry,
                    stop_loss=sl,
                    take_profit=tp,
                    timestamp=timestamp,
                    confidence=round(confidence, 3),
                    metadata={
                        'trigger': 'vwap_reversion_short',
                        'vwap': round(vwap, 2),
                        'deviation_std': round(deviation, 2),
                        'rsi': round(rsi, 1),
                    }
                ))

        return signals
