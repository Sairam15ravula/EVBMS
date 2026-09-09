"""
Charging classification service.

The PRD (section 13, Risks and Mitigations) explicitly flags "categorical
encoding mismatch" as a risk for this model. Addressed here by saving the
whole sklearn Pipeline (encoder + classifier) as one joblib object during
training, so inference always uses the exact encoding the model was
trained with — there's no separate encoder file that could drift out of
sync with the model file.
"""
import pandas as pd
from services._loader import load

_bundle = load("charging_class_model_xgb.joblib")

_LABEL_TIPS = {
    "aggressive_fast": ("Aggressive fast charge — high stress", "Frequent high-power charging in warm conditions accelerates wear. Prefer AC charging when time allows."),
    "full_charge_wear": ("Full charge — accelerates wear", "Charging past ~90% regularly adds stress at the top of the voltage window. Consider 20-80% for daily use."),
    "fast_moderate": ("Fast charge — moderate stress", "Fine occasionally; relying on it daily will shorten lifespan versus AC charging."),
    "cold_weather": ("Cold-weather charge — reduced efficiency", "Charging in cold conditions is lower-efficiency and briefly raises internal resistance."),
    "optimal": ("Optimal — battery-friendly", "Close to the ideal charging window for long-term battery health."),
    "standard": ("Standard charge — normal", "Within normal operating parameters."),
}


def predict_charging(payload: dict):
    if _bundle is not None:
        try:
            if isinstance(_bundle, dict) and "pipeline" in _bundle:
                pipe = _bundle["pipeline"]
                features = _bundle.get("num_features", []) + _bundle.get("cat_features", [])
                X = pd.DataFrame([payload])[features] if features else pd.DataFrame([payload])
                pred_idx = pipe.predict(X)[0]
                proba = float(pipe.predict_proba(X)[0].max()) if hasattr(pipe, "predict_proba") else None
                if "label_encoder" in _bundle:
                    label = _bundle["label_encoder"].inverse_transform([pred_idx])[0]
                else:
                    label = str(pred_idx)
                return str(label), proba, "trained_model"
            elif isinstance(_bundle, dict) and "model" in _bundle:
                model = _bundle["model"]
                features = _bundle.get("features", list(payload.keys()))
                X = pd.DataFrame([payload])[features]
                pred = model.predict(X)[0]
                proba = float(model.predict_proba(X)[0].max()) if hasattr(model, "predict_proba") else None
                return str(pred), proba, "trained_model"
            else:
                pred = _bundle.predict(pd.DataFrame([payload]))[0]
                proba = float(_bundle.predict_proba(pd.DataFrame([payload]))[0].max()) if hasattr(_bundle, "predict_proba") else None
                return str(pred), proba, "trained_model"
        except Exception as e:
            print(f"[charging-service] Model execution error: {e}")

    # Fallback: the same rule cascade used to generate the synthetic
    # training labels in training/generate_synthetic_data.py.
    mode = payload.get("Charging_Mode", "")
    power_kw_proxy = payload.get("Current", 0) * payload.get("Voltage", 380) / 1_000_000 * 1000  # rough
    battery_temp = payload.get("Battery_Temp", 25)
    end_soc = payload.get("SOC", 50)

    if mode == "DC Fast" and power_kw_proxy > 100 and battery_temp > 35:
        label = "aggressive_fast"
    elif end_soc >= 97:
        label = "full_charge_wear"
    elif mode == "DC Fast" and power_kw_proxy > 60:
        label = "fast_moderate"
    elif battery_temp < 8:
        label = "cold_weather"
    elif end_soc <= 82:
        label = "optimal"
    else:
        label = "standard"
    return label, None, "fallback_formula"


def describe(label: str):
    return _LABEL_TIPS.get(label, (label, ""))
