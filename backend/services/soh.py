"""
State of Health service. Real model when backend/models/soh_model_xgb.joblib
exists (produced by training/train_all.py); otherwise a transparent
capacity-ratio fallback so the endpoint still returns a sensible answer.
"""
import pandas as pd
from services._loader import load

_bundle = load("soh_model_xgb.joblib")


def predict_soh(cycle: float, voltage: float, temperature: float, capacity: float, init_capacity: float):
    if _bundle is not None:
        try:
            model = _bundle["model"] if isinstance(_bundle, dict) and "model" in _bundle else _bundle
            features = _bundle["features"] if isinstance(_bundle, dict) and "features" in _bundle else ["cycle", "voltage", "temperature", "capacity", "init_capacity"]

            X = pd.DataFrame([{
                "cycle": cycle, "voltage": voltage, "temperature": temperature,
                "capacity": capacity, "init_capacity": init_capacity,
            }])[features]
            soh = float(model.predict(X)[0])
            return max(0.0, min(100.0, soh)), "trained_model"
        except Exception as e:
            print(f"[soh-service] Model execution fallback due to error: {e}")

    # Fallback: SoH is, by definition, the ratio of current to rated capacity.
    soh = max(0.0, min(100.0, (capacity / init_capacity) * 100)) if init_capacity else 0.0
    return soh, "fallback_formula"
