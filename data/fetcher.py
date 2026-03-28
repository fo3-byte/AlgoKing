"""
╔══════════════════════════════════════════════════════════════════════════════╗
║                         DATA FETCHING LAYER                                  ║
║              Yahoo Finance + Alpha Vantage + CoinGecko                       ║
║              Unified interface for all markets                               ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Tuple
from dataclasses import dataclass
import logging
import time
import os

try:
    import yfinance as yf
except ImportError:
    yf = None

try:
    import requests
except ImportError:
    requests = None

from config.settings import Market, MarketConfig, MARKET_CONFIGS, TimeFrame

logger = logging.getLogger(__name__)


@dataclass
class OHLCV:
    """Standard OHLCV data container"""
    timestamp: pd.DatetimeIndex
    open: pd.Series
    high: pd.Series
    low: pd.Series
    close: pd.Series
    volume: pd.Series

    def to_dataframe(self) -> pd.DataFrame:
        return pd.DataFrame({
            'open': self.open,
            'high': self.high,
            'low': self.low,
            'close': self.close,
            'volume': self.volume
        }, index=self.timestamp)


class DataFetcher:
    """
    Unified data fetcher for all markets.
    Sources: Yahoo Finance (primary), Alpha Vantage (backup), CoinGecko (crypto)
    """

    def __init__(self, alpha_vantage_key: str = ""):
        self.alpha_vantage_key = alpha_vantage_key or os.getenv("ALPHA_VANTAGE_KEY", "")
        self._cache: Dict[str, pd.DataFrame] = {}
        self._rate_limit_delay = 0.5  # seconds between API calls

    # ─────────────────── PRIMARY: YAHOO FINANCE ───────────────────

    def fetch_yahoo(
        self,
        ticker: str,
        start_date: str = "2016-01-01",
        end_date: str = "2026-03-27",
        interval: str = "1d"
    ) -> pd.DataFrame:
        """
        Fetch OHLCV data from Yahoo Finance.
        Supports: Indian stocks (.NS/.BO), US stocks, futures, crypto, commodities
        """
        if yf is None:
            raise ImportError("yfinance not installed. Run: pip install yfinance")

        cache_key = f"yahoo_{ticker}_{start_date}_{end_date}_{interval}"
        if cache_key in self._cache:
            logger.info(f"Cache hit: {cache_key}")
            return self._cache[cache_key]

        logger.info(f"Fetching Yahoo Finance: {ticker} [{start_date} to {end_date}] interval={interval}")

        try:
            data = yf.download(
                ticker,
                start=start_date,
                end=end_date,
                interval=interval,
                auto_adjust=True,
                progress=False
            )

            if data.empty:
                logger.warning(f"No data returned for {ticker}")
                return pd.DataFrame()

            # Flatten multi-level columns if present
            if isinstance(data.columns, pd.MultiIndex):
                data.columns = data.columns.get_level_values(0)

            # Standardize column names
            data.columns = [c.lower() for c in data.columns]

            # Ensure we have required columns
            required_cols = ['open', 'high', 'low', 'close', 'volume']
            for col in required_cols:
                if col not in data.columns:
                    logger.warning(f"Missing column: {col} for {ticker}")
                    data[col] = 0.0

            data = data[required_cols].copy()
            data.dropna(inplace=True)

            self._cache[cache_key] = data
            logger.info(f"Fetched {len(data)} rows for {ticker}")
            return data

        except Exception as e:
            logger.error(f"Yahoo Finance error for {ticker}: {e}")
            return pd.DataFrame()

    # ─────────────────── BACKUP: ALPHA VANTAGE ───────────────────

    def fetch_alpha_vantage(
        self,
        symbol: str,
        function: str = "TIME_SERIES_DAILY",
        outputsize: str = "full"
    ) -> pd.DataFrame:
        """Fetch from Alpha Vantage API (free tier: 25 requests/day)"""
        if not self.alpha_vantage_key:
            logger.warning("No Alpha Vantage API key provided")
            return pd.DataFrame()

        if requests is None:
            raise ImportError("requests not installed. Run: pip install requests")

        url = "https://www.alphavantage.co/query"
        params = {
            "function": function,
            "symbol": symbol,
            "apikey": self.alpha_vantage_key,
            "outputsize": outputsize,
            "datatype": "json"
        }

        try:
            response = requests.get(url, params=params, timeout=30)
            data = response.json()

            # Parse time series data
            ts_key = None
            for key in data:
                if "Time Series" in key:
                    ts_key = key
                    break

            if not ts_key:
                logger.warning(f"No time series data in Alpha Vantage response for {symbol}")
                return pd.DataFrame()

            df = pd.DataFrame.from_dict(data[ts_key], orient='index')
            df.index = pd.to_datetime(df.index)
            df = df.sort_index()

            # Standardize columns
            col_map = {}
            for col in df.columns:
                if 'open' in col.lower():
                    col_map[col] = 'open'
                elif 'high' in col.lower():
                    col_map[col] = 'high'
                elif 'low' in col.lower():
                    col_map[col] = 'low'
                elif 'close' in col.lower() and 'adj' not in col.lower():
                    col_map[col] = 'close'
                elif 'volume' in col.lower():
                    col_map[col] = 'volume'

            df = df.rename(columns=col_map)
            df = df[['open', 'high', 'low', 'close', 'volume']].astype(float)

            time.sleep(self._rate_limit_delay)
            return df

        except Exception as e:
            logger.error(f"Alpha Vantage error for {symbol}: {e}")
            return pd.DataFrame()

    # ─────────────────── CRYPTO: COINGECKO ───────────────────

    def fetch_coingecko(
        self,
        coin_id: str,
        vs_currency: str = "usd",
        days: int = 3650  # ~10 years (max available)
    ) -> pd.DataFrame:
        """Fetch crypto OHLCV from CoinGecko (free, no key needed)"""
        if requests is None:
            raise ImportError("requests not installed")

        url = f"https://api.coingecko.com/api/v3/coins/{coin_id}/ohlc"
        params = {"vs_currency": vs_currency, "days": days}

        try:
            response = requests.get(url, params=params, timeout=30)
            data = response.json()

            if not isinstance(data, list):
                logger.warning(f"CoinGecko unexpected response for {coin_id}")
                return pd.DataFrame()

            df = pd.DataFrame(data, columns=['timestamp', 'open', 'high', 'low', 'close'])
            df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
            df = df.set_index('timestamp')
            df['volume'] = 0  # CoinGecko OHLC doesn't include volume

            time.sleep(self._rate_limit_delay)
            return df

        except Exception as e:
            logger.error(f"CoinGecko error for {coin_id}: {e}")
            return pd.DataFrame()

    # ─────────────────── UNIFIED FETCH ───────────────────

    def fetch_market_data(
        self,
        market: Market,
        start_date: str = "2016-01-01",
        end_date: str = "2026-03-27",
        interval: str = "1d"
    ) -> pd.DataFrame:
        """
        Unified fetch: automatically routes to the best data source for each market.
        Falls back to alternative sources if primary fails.
        """
        config = MARKET_CONFIGS.get(market)
        if not config:
            raise ValueError(f"No config for market: {market}")

        # Try Yahoo Finance first (works for everything)
        df = self.fetch_yahoo(config.ticker_yahoo, start_date, end_date, interval)

        if df.empty and config.ticker_coingecko:
            # Fall back to CoinGecko for crypto
            logger.info(f"Falling back to CoinGecko for {market.value}")
            df = self.fetch_coingecko(config.ticker_coingecko)

        if df.empty and config.ticker_alpha_vantage and self.alpha_vantage_key:
            # Fall back to Alpha Vantage
            logger.info(f"Falling back to Alpha Vantage for {market.value}")
            df = self.fetch_alpha_vantage(config.ticker_alpha_vantage)

        if df.empty:
            logger.error(f"All data sources failed for {market.value}")

        return df

    def fetch_multiple_markets(
        self,
        markets: List[Market],
        start_date: str = "2016-01-01",
        end_date: str = "2026-03-27",
        interval: str = "1d"
    ) -> Dict[Market, pd.DataFrame]:
        """Fetch data for multiple markets"""
        results = {}
        for market in markets:
            logger.info(f"Fetching {market.value}...")
            results[market] = self.fetch_market_data(market, start_date, end_date, interval)
            time.sleep(self._rate_limit_delay)
        return results

    # ─────────────────── TECHNICAL INDICATORS ───────────────────

    @staticmethod
    def add_indicators(df: pd.DataFrame) -> pd.DataFrame:
        """Add all technical indicators needed by the sister algos"""
        if df.empty:
            return df

        df = df.copy()

        # ── Moving Averages ──
        for period in [9, 21, 50, 100, 200]:
            df[f'sma_{period}'] = df['close'].rolling(period).mean()
            df[f'ema_{period}'] = df['close'].ewm(span=period, adjust=False).mean()

        # ── RSI ──
        delta = df['close'].diff()
        gain = delta.where(delta > 0, 0.0)
        loss = -delta.where(delta < 0, 0.0)
        avg_gain = gain.rolling(14).mean()
        avg_loss = loss.rolling(14).mean()
        rs = avg_gain / avg_loss.replace(0, np.inf)
        df['rsi'] = 100 - (100 / (1 + rs))

        # ── MACD ──
        ema12 = df['close'].ewm(span=12, adjust=False).mean()
        ema26 = df['close'].ewm(span=26, adjust=False).mean()
        df['macd'] = ema12 - ema26
        df['macd_signal'] = df['macd'].ewm(span=9, adjust=False).mean()
        df['macd_histogram'] = df['macd'] - df['macd_signal']

        # ── Bollinger Bands ──
        df['bb_middle'] = df['close'].rolling(20).mean()
        bb_std = df['close'].rolling(20).std()
        df['bb_upper'] = df['bb_middle'] + 2 * bb_std
        df['bb_lower'] = df['bb_middle'] - 2 * bb_std
        df['bb_width'] = (df['bb_upper'] - df['bb_lower']) / df['bb_middle']

        # ── ATR (Average True Range) ──
        high_low = df['high'] - df['low']
        high_close = abs(df['high'] - df['close'].shift(1))
        low_close = abs(df['low'] - df['close'].shift(1))
        true_range = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
        df['atr'] = true_range.rolling(14).mean()
        df['atr_pct'] = df['atr'] / df['close'] * 100

        # ── ADX (Average Directional Index) ──
        plus_dm = df['high'].diff()
        minus_dm = -df['low'].diff()
        plus_dm = plus_dm.where((plus_dm > minus_dm) & (plus_dm > 0), 0)
        minus_dm = minus_dm.where((minus_dm > plus_dm) & (minus_dm > 0), 0)
        atr14 = true_range.rolling(14).mean()
        plus_di = 100 * (plus_dm.rolling(14).mean() / atr14.replace(0, np.inf))
        minus_di = 100 * (minus_dm.rolling(14).mean() / atr14.replace(0, np.inf))
        dx = 100 * abs(plus_di - minus_di) / (plus_di + minus_di).replace(0, np.inf)
        df['adx'] = dx.rolling(14).mean()
        df['plus_di'] = plus_di
        df['minus_di'] = minus_di

        # ── VWAP (approximation for daily data) ──
        typical_price = (df['high'] + df['low'] + df['close']) / 3
        df['vwap'] = (typical_price * df['volume']).cumsum() / df['volume'].cumsum().replace(0, np.inf)

        # ── Z-Score (for mean reversion) ──
        rolling_mean = df['close'].rolling(20).mean()
        rolling_std = df['close'].rolling(20).std()
        df['z_score'] = (df['close'] - rolling_mean) / rolling_std.replace(0, np.inf)

        # ── Volume indicators ──
        df['volume_sma_20'] = df['volume'].rolling(20).mean()
        df['volume_ratio'] = df['volume'] / df['volume_sma_20'].replace(0, np.inf)
        df['obv'] = (np.sign(df['close'].diff()) * df['volume']).cumsum()

        # ── PDC / PDH / PDL (Previous Day Close/High/Low) ──
        df['pdc'] = df['close'].shift(1)
        df['pdh'] = df['high'].shift(1)
        df['pdl'] = df['low'].shift(1)

        # ── Returns ──
        df['returns'] = df['close'].pct_change()
        df['log_returns'] = np.log(df['close'] / df['close'].shift(1))
        df['returns_5d'] = df['close'].pct_change(5)
        df['returns_20d'] = df['close'].pct_change(20)
        df['volatility_20d'] = df['returns'].rolling(20).std() * np.sqrt(252)

        # ── Stochastic Oscillator ──
        low_14 = df['low'].rolling(14).min()
        high_14 = df['high'].rolling(14).max()
        df['stoch_k'] = 100 * (df['close'] - low_14) / (high_14 - low_14).replace(0, np.inf)
        df['stoch_d'] = df['stoch_k'].rolling(3).mean()

        # ── Supertrend (ATR-based) ──
        multiplier = 3.0
        hl2 = (df['high'] + df['low']) / 2
        df['supertrend_upper'] = hl2 + multiplier * df['atr']
        df['supertrend_lower'] = hl2 - multiplier * df['atr']

        return df

    # ─────────────────── VOLUME PROFILE ───────────────────

    @staticmethod
    def compute_volume_profile(
        df: pd.DataFrame,
        num_bins: int = 50,
        value_area_pct: float = 0.70
    ) -> Dict:
        """
        Compute Volume Profile: POC, Value Area High/Low, HVN/LVN nodes.
        Critical for the Volume Profile sister algo.
        """
        if df.empty:
            return {}

        price_range = df['high'].max() - df['low'].min()
        bin_size = price_range / num_bins

        # Create price bins and distribute volume
        bins = np.linspace(df['low'].min(), df['high'].max(), num_bins + 1)
        volume_at_price = np.zeros(num_bins)

        for _, row in df.iterrows():
            # Distribute each candle's volume across its price range
            candle_low_bin = int((row['low'] - bins[0]) / bin_size)
            candle_high_bin = int((row['high'] - bins[0]) / bin_size)
            candle_low_bin = max(0, min(candle_low_bin, num_bins - 1))
            candle_high_bin = max(0, min(candle_high_bin, num_bins - 1))

            if candle_high_bin == candle_low_bin:
                volume_at_price[candle_low_bin] += row['volume']
            else:
                vol_per_bin = row['volume'] / (candle_high_bin - candle_low_bin + 1)
                for b in range(candle_low_bin, candle_high_bin + 1):
                    volume_at_price[b] += vol_per_bin

        # POC = Point of Control (price with highest volume)
        poc_bin = np.argmax(volume_at_price)
        poc_price = (bins[poc_bin] + bins[poc_bin + 1]) / 2

        # Value Area (70% of volume around POC)
        total_volume = volume_at_price.sum()
        target_volume = total_volume * value_area_pct

        va_volume = volume_at_price[poc_bin]
        va_low_bin = poc_bin
        va_high_bin = poc_bin

        while va_volume < target_volume:
            expand_up = volume_at_price[va_high_bin + 1] if va_high_bin + 1 < num_bins else 0
            expand_down = volume_at_price[va_low_bin - 1] if va_low_bin - 1 >= 0 else 0

            if expand_up >= expand_down and va_high_bin + 1 < num_bins:
                va_high_bin += 1
                va_volume += expand_up
            elif va_low_bin - 1 >= 0:
                va_low_bin -= 1
                va_volume += expand_down
            else:
                break

        vah = (bins[va_high_bin] + bins[va_high_bin + 1]) / 2  # Value Area High
        val = (bins[va_low_bin] + bins[va_low_bin + 1]) / 2    # Value Area Low

        # Identify High Volume Nodes (HVN) and Low Volume Nodes (LVN)
        avg_volume = volume_at_price.mean()
        hvn_threshold = avg_volume * 1.5
        lvn_threshold = avg_volume * 0.5

        hvn_prices = [(bins[i] + bins[i+1])/2 for i in range(num_bins) if volume_at_price[i] > hvn_threshold]
        lvn_prices = [(bins[i] + bins[i+1])/2 for i in range(num_bins) if 0 < volume_at_price[i] < lvn_threshold]

        return {
            'poc': poc_price,
            'vah': vah,
            'val': val,
            'hvn_prices': hvn_prices,
            'lvn_prices': lvn_prices,
            'bins': bins.tolist(),
            'volume_at_price': volume_at_price.tolist(),
            'total_volume': total_volume,
        }
