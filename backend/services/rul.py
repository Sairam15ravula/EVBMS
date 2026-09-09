"""
Remaining Useful Life service.

Note on the fallback path: the PRD defines this endpoint's input as a
single snapshot (cycle, voltage, temperature, capacity, soh,
init_capacity) rather than a full cycle history. The trained model
handles that fine — it learned typical degradation trajectories across
many cells during training and interpolates for a new single point.
Without a trained model, a single snapshot alone isn't enough to fit a
per-cell trend line (that needs history, which is what the React demo
artifact does client-side with its full in-memory history). So the
fallback here uses a generic reference fade rate instead — clearly
cruder than either the trained model or the artifact's own per-cell
trend fit, and labelled as such in the response.
"""
import pandas as pd
from services._loader import load

_bundle = load("rul_model_xgb.joblib")

EOL_THRESHOLD = 80.0
GENERIC_FADE_RATE_PER_CYCLE = 0.045  # %SoH/cycle — rough population-average placeholder


def predict_rul(cycle: float, voltage: float, temperature: float, capacity: float, soh: float, init_capacity: float):
    if _bundle is not None:
        try:
            model = _bundle["model"] if isinstance(_bundle, dict) and "model" in _bundle else _bundle
            features = _bundle["features"] if isinstance(_bundle, dict) and "features" in _bundle else ["cycle", "voltage", "temperature", "capacity", "soh", "init_capacity"]

            X = pd.DataFrame([{
                "cycle": cycle, "voltage": voltage, "temperature": temperature,
                "capacity": capacity, "soh": soh, "init_capacity": init_capacity,
            }])[features]
            rul = float(model.predict(X)[0])
            rul = max(0.0, rul)
            status = "past-threshold" if soh <= EOL_THRESHOLD else "normal"
            return rul, status, "trained_model"
        except Exception as e:
            print(f"[rul-service] Model execution fallback due to error: {e}")

    if soh <= EOL_THRESHOLD:
        return 0.0, "past-threshold", "fallback_formula"
    rul_cycles = max(0.0, (soh - EOL_THRESHOLD) / GENERIC_FADE_RATE_PER_CYCLE)
    return rul_cycles, "normal", "fallback_formula"
