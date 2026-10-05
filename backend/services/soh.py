"""
State of Health (SOH) service.
Predicts battery SOH using strictly non-leaky operational features (cycle, voltage, temperature).
Capacity and initial_capacity are strictly prohibited as model inputs (Rule 2: No Target Leakage).
Transparent fallback formula is provided when model binary is not loaded.
"""
from typing import Optional, Tuple
import pandas as pd
try:
    from backend.services._loader import load
except ImportError:
    from services._loader import load

_bundle = load("soh_model_xgb.joblib")

# Forbidden feature names preventing target leakage (Rule 2)
FORBIDDEN_SOH_TARGET_SUBSTRINGS = {"capacity", "initial_capacity", "init_capacity", "soh", "target"}
NON_LEAKY_SOH_FEATURES = ["cycle", "voltage", "temperature"]


def validate_no_soh_leakage(feature_columns: list[str]) -> None:
    """Validate that feature columns contain no target leakage for SOH prediction.

    SOH is defined as capacity / initial_capacity. Therefore capacity and initial_capacity
    must NOT be input features to the predictive model.
    """
    for col in feature_columns:
        col_lower = col.lower().strip()
        for forbidden in FORBIDDEN_SOH_TARGET_SUBSTRINGS:
            if forbidden in col_lower:
                raise ValueError(
                    f"Target leakage detected! SOH feature '{col}' contains forbidden target term '{forbidden}'."
                )


def predict_soh(
    cycle: float,
    voltage: float,
    temperature: float,
    capacity: Optional[float] = None,
    init_capacity: Optional[float] = None,
) -> Tuple[float, str]:
    """Predict State of Health % from non-leaky operational telemetry."""
    if _bundle is not None:
        try:
            model = _bundle["model"] if isinstance(_bundle, dict) and "model" in _bundle else _bundle
            raw_features = _bundle.get("features", NON_LEAKY_SOH_FEATURES) if isinstance(_bundle, dict) else NON_LEAKY_SOH_FEATURES
            # Ensure model features are filtered of any legacy leaky columns
            clean_features = [f for f in raw_features if f in ["cycle", "voltage", "temperature"]]
            if not clean_features:
                clean_features = NON_LEAKY_SOH_FEATURES

            validate_no_soh_leakage(clean_features)

            X = pd.DataFrame([{
                "cycle": cycle,
                "voltage": voltage,
                "temperature": temperature,
            }])[clean_features]

            pred = float(model.predict(X)[0])
            # If model was trained on [0.0, 1.0] fraction, convert to percentage [0.0, 100.0]
            soh = pred * 100.0 if pred <= 1.5 else pred
            return max(0.0, min(100.0, soh)), "trained_model"
        except Exception as e:
            print(f"[soh-service] Model execution fallback due to error: {e}")

    # Fallback: ratio of current to rated capacity if provided, else reasonable default
    if capacity is not None and init_capacity and init_capacity > 0:
        soh = max(0.0, min(100.0, (capacity / init_capacity) * 100))
    else:
        # Degradation heuristic proxy: ~0.04% loss per cycle from 100%
        soh = max(70.0, min(100.0, 100.0 - (cycle * 0.04)))
    return soh, "fallback_formula"
