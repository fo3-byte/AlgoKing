from .base import BaseStrategy, Signal, SignalType
from .mean_reversion import MeanReversionStrategy
from .ma_crossover import MACrossoverStrategy
from .pdc_pdh import PDCPDHStrategy
from .one_hr_hl import OneHrHighLowStrategy
from .volume_profile import VolumeProfileStrategy
from .momentum import MomentumStrategy
from .vwap_reversion import VWAPReversionStrategy
from .orb import ORBStrategy

ALL_STRATEGIES = [
    MeanReversionStrategy,
    MACrossoverStrategy,
    PDCPDHStrategy,
    OneHrHighLowStrategy,
    VolumeProfileStrategy,
    MomentumStrategy,
    VWAPReversionStrategy,
    ORBStrategy,
]
