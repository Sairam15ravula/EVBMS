"""
Remaining Useful Life (RUL) service with Quantile Gradient Boosting uncertainty intervals.

Predicts median RUL (50th percentile) alongside 90% prediction intervals [q_0.05, q_0.95].
Rule 2: NO TARGET LEAKAGE. Capacity, initial capacity, and SOH must NOT be model inputs.
"""
from typing import Optional, Tuple
import pandas as pd
try:
    from backend.services._loader import load
except ImportError:
    from services._loader import load

_bundle = load("rul_model_xgb.joblib")

EOL_THRESHOLD = 80.0
GENERIC_FADE_RATE_PER_CYCLE = 0.045  # %SoH/cycle — rough population-average placeholder

FORBIDDEN_RUL_TARGET_SUBSTRINGS = {"capacity", "initial_capacity", "init_capacity", "soh", "rul", "target", "eol"}
NON_LEAKY_RUL_FEATURES = ["cycle", "voltage", "temperature"]


def validate_no_rul_target_leakage(feature_columns: list[str]) -> None:
    """Validate that feature columns contain no target leakage for RUL prediction.

    Capacity, initial_capacity, and SOH must NOT be input features to the model.
    """
    for col in feature_columns:
        col_lower = col.lower().strip()
        for forbidden in FORBIDDEN_RUL_TARGET_SUBSTRINGS:
            if forbidden in col_lower:
                raise ValueError(
                    f"Target leakage detected! RUL feature '{col}' contains forbidden target term '{forbidden}'."
                )


def predict_rul(
    cycle: float,
    voltage: float,
    temperature: float,
    capacity: Optional[float] = None,
    soh: Optional[float] = None,
    init_capacity: Optional[float] = None,
) -> Tuple[float, str, str, Optional[float], Optional[float], Optional[float]]:
    """Predict RUL median, status, source, lower bound, upper bound, interval width.

    Returns:
        (rul_median, status, source, rul_lower, rul_upper, interval_width)
    """
    effective_soh = soh if soh is not None else max(0.0, 100.0 - (cycle * 0.04))

    if _bundle is not None:
        try:
            raw_features = (
                _bundle.get("features", NON_LEAKY_RUL_FEATURES)
                if isinstance(_bundle, dict)
                else NON_LEAKY_RUL_FEATURES
            )
            clean_features = [f for f in raw_features if f in ["cycle", "voltage", "temperature"]]
            if not clean_features:
                clean_features = NON_LEAKY_RUL_FEATURES

            validate_no_rul_target_leakage(clean_features)

            X = pd.DataFrame([{
                "cycle": cycle,
                "voltage": voltage,
                "temperature": temperature,
            }])[clean_features]

            reg_lower = _bundle.get("regressor_lower") if isinstance(_bundle, dict) else None
            reg_median = (
                _bundle.get("regressor_median")
                or (_bundle.get("model") if isinstance(_bundle, dict) else _bundle)
            )
            reg_upper = _bundle.get("regressor_upper") if isinstance(_bundle, dict) else None

            if reg_median is not None:
                raw_median = float(reg_median.predict(X)[0])
                rul_median = max(0.0, raw_median)

                if reg_lower is not None and reg_upper is not None:
                    raw_lower = float(reg_lower.predict(X)[0])
                    raw_upper = float(reg_upper.predict(X)[0])
                    # Enforce non-crossing: lower <= median <= upper
                    rul_lower = max(0.0, min(raw_lower, rul_median))
                    rul_upper = max(0.0, max(raw_upper, rul_median))
                else:
                    rul_lower = max(0.0, rul_median * 0.85)
                    rul_upper = max(0.0, rul_median * 1.15)

                interval_width = rul_upper - rul_lower
                status = "past-threshold" if effective_soh <= EOL_THRESHOLD else "normal"
                return rul_median, status, "trained_model", rul_lower, rul_upper, interval_width
        except Exception as e:
            print(f"[rul-service] Model execution fallback due to error: {e}")

    if effective_soh <= EOL_THRESHOLD:
        return 0.0, "past-threshold", "fallback_formula", 0.0, 0.0, 0.0

    rul_cycles = max(0.0, (effective_soh - EOL_THRESHOLD) / GENERIC_FADE_RATE_PER_CYCLE)
    rul_lower = max(0.0, rul_cycles * 0.80)
    rul_upper = max(0.0, rul_cycles * 1.20)
    return rul_cycles, "normal", "fallback_formula", rul_lower, rul_upper, rul_upper - rul_lower
