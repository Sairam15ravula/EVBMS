"""
Telemetry Anomaly Service with Independent Physical Safety Rule Engine & Isolation Forest Supplement.
"""
import os
from typing import Dict, Optional, Tuple
import pandas as pd
from backend.services.model_loader import model_loader

# Configurable Safety Rule Thresholds (overridable via Environment Variables or Pack Metadata)
CRITICAL_THERMAL_WARNING_TEMP = float(os.getenv("CRITICAL_THERMAL_TEMP", "55.0"))
DEFAULT_MAX_CELL_DELTA_MV = float(os.getenv("MAX_CELL_DELTA_MV", "50.0"))
DEFAULT_RESISTANCE_SPIKE_MOHM = float(os.getenv("MAX_RESISTANCE_MOHM", "35.0"))

_clf_bundle, _clf_ready = model_loader.load_model("telemetry_anomaly_model.joblib")
_iso_bundle, _iso_ready = model_loader.load_model("telemetry_isolation_forest.joblib")


def check_independent_safety_rules(
    soc: float,
    voltage: float,
    current: float,
    temperature: Optional[float] = None,
    resistance: Optional[float] = None,
    cell_delta_mv: Optional[float] = None,
    critical_temp_thresh: float = CRITICAL_THERMAL_WARNING_TEMP,
    cell_delta_thresh: float = DEFAULT_MAX_CELL_DELTA_MV,
    resistance_thresh: float = DEFAULT_RESISTANCE_SPIKE_MOHM,
) -> Dict[str, bool]:
    """
    Independent physical safety checks. Fails independently of ML models.
    """
    safety_violations = {
        "critical_thermal_warning": bool(temperature is not None and temperature >= critical_temp_thresh),
        "voltage_sag_or_overvoltage": bool(voltage < 2.5 or voltage > 4.3),
        "overcurrent_fault": bool(abs(current) > 350.0),
        "invalid_soc_bounds": bool(soc < 0.0 or soc > 100.0),
        "resistance_spike_warning": bool(resistance is not None and resistance > resistance_thresh),
        "cell_voltage_imbalance_warning": bool(cell_delta_mv is not None and cell_delta_mv > cell_delta_thresh),
    }

    return safety_violations


def predict_anomaly(
    soc: float,
    voltage: float,
    current: float,
    hour: int,
    dayofweek: int,
    temperature: Optional[float] = None,
    resistance: Optional[float] = None,
    cell_delta_mv: Optional[float] = None,
) -> Tuple[bool, Optional[float], Optional[bool], str]:
    """
    Dual-engine anomaly detection:
    1. Independent physical safety rules evaluate first.
    2. ML Isolation Forest outlier score supplements safety checks.
       ML scores CANNOT override physical safety rule violations.
    """
    safety_checks = check_independent_safety_rules(
        soc=soc,
        voltage=voltage,
        current=current,
        temperature=temperature,
        resistance=resistance,
        cell_delta_mv=cell_delta_mv,
    )
    has_safety_violation = any(safety_checks.values())

    proba: Optional[float] = None
    iso_flag: Optional[bool] = None
    source = "physical_safety_engine"

    # Supervised XGBoost Classifier Prediction
    if _clf_bundle is not None and _clf_ready:
        try:
            model = _clf_bundle["model"] if isinstance(_clf_bundle, dict) and "model" in _clf_bundle else _clf_bundle
            features = _clf_bundle["features"] if isinstance(_clf_bundle, dict) and "features" in _clf_bundle else ["soc", "voltage", "current", "hour", "dayofweek"]
            X = pd.DataFrame([{"soc": soc, "voltage": voltage, "current": current, "hour": hour, "dayofweek": dayofweek}])[features]
            if hasattr(model, "predict_proba"):
                proba = float(model.predict_proba(X)[0][1])
            source = "trained_model"
        except Exception as e:
            print(f"[anomaly-service] Supervised model prediction error: {e}")

    # Unsupervised Isolation Forest Prediction
    if _iso_bundle is not None and _iso_ready:
        try:
            iso_model = _iso_bundle["model"] if isinstance(_iso_bundle, dict) and "model" in _iso_bundle else _iso_bundle
            iso_features = _iso_bundle["features"] if isinstance(_iso_bundle, dict) and "features" in _iso_bundle else ["soc", "voltage", "current"]

            payload = {"soc": soc, "voltage": voltage, "current": current, "hour": hour, "dayofweek": dayofweek}
            if temperature is not None:
                payload["temperature"] = temperature
            if resistance is not None:
                payload["resistance"] = resistance

            available_feats = [f for f in iso_features if f in payload]
            Xi = pd.DataFrame([payload])[available_feats]
            iso_flag = bool(iso_model.predict(Xi)[0] == -1)
            source = "trained_model"
        except Exception as e:
            print(f"[anomaly-service] Isolation Forest model error: {e}")

    # Final combined flag: ML score supplements safety rules, but cannot override physical safety violations
    ml_anomaly = bool((proba is not None and proba >= 0.5) or iso_flag)
    final_is_anomaly = has_safety_violation or ml_anomaly

    return final_is_anomaly, proba, iso_flag, source
