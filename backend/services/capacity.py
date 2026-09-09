"""
Capacity fade service. Deliberately minimal per the PRD: Cycle_Index is
the only input, so this is a population-level trend, coarser than the
per-cell SoH model on purpose (see training/train_all.py's note on this
model's R²).
"""
import pandas as pd
from services._loader import load

_bundle = load("capacity_fade_model.joblib")

RATED_CAPACITY_KWH = 75.0
# Rough population-average shape used only if no trained model is present.
_FALLBACK_KNEE_CYCLE = 140
_FALLBACK_END_CYCLE = 220
_FALLBACK_END_SOH = 0.75


def predict_capacity(cycle_index: float):
    if _bundle is not None:
        try:
            model = _bundle["model"] if isinstance(_bundle, dict) and "model" in _bundle else _bundle
            features = _bundle["features"] if isinstance(_bundle, dict) and "features" in _bundle else ["Cycle_Index"]

            X = pd.DataFrame([{"Cycle_Index": cycle_index}])[features]
            cap = float(model.predict(X)[0])
            return max(0.0, cap), "trained_model"
        except Exception as e:
            print(f"[capacity-service] Model execution fallback due to error: {e}")

    if cycle_index <= _FALLBACK_KNEE_CYCLE:
        frac = 1 - 0.09 * (cycle_index / _FALLBACK_KNEE_CYCLE)
    else:
        post = (cycle_index - _FALLBACK_KNEE_CYCLE) / max(1, _FALLBACK_END_CYCLE - _FALLBACK_KNEE_CYCLE)
        frac = 0.91 - (0.91 - _FALLBACK_END_SOH) * min(1.0, post)
    return RATED_CAPACITY_KWH * max(_FALLBACK_END_SOH - 0.1, frac), "fallback_formula"
