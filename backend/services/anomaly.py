"""
Predictive Early-Warning Anomaly Service with Physical Safety Rules,
Isolation Forest, and Failure Lead-Time Estimation.

Features:
- Continuous anomaly scoring (0.0 to 100.0)
- Categorical risk levels: 'normal' (<40), 'watch' (40-69, early warning), 'critical' (>=70)
- Explanatory list of contributing signals with quantitative evidence
- Estimated lead-time before critical failure on thermal, impedance, and voltage faults
"""
import os
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import pandas as pd
from backend.services.model_loader import model_loader

# Configurable Safety Rule Thresholds (overridable via Environment Variables)
CRITICAL_THERMAL_WARNING_TEMP = float(os.getenv("CRITICAL_THERMAL_TEMP", "55.0"))
WATCH_THERMAL_WARNING_TEMP = float(os.getenv("WATCH_THERMAL_TEMP", "42.0"))
DEFAULT_MAX_CELL_DELTA_MV = float(os.getenv("MAX_CELL_DELTA_MV", "50.0"))
DEFAULT_RESISTANCE_SPIKE_MOHM = float(os.getenv("MAX_RESISTANCE_MOHM", "35.0"))
WATCH_RESISTANCE_MOHM = float(os.getenv("WATCH_RESISTANCE_MOHM", "25.0"))
VOLTAGE_SAG_CELL_CRITICAL_V = float(os.getenv("VOLTAGE_SAG_CELL_CRITICAL_V", "2.6"))
VOLTAGE_SAG_CELL_WATCH_V = float(os.getenv("VOLTAGE_SAG_CELL_WATCH_V", "3.0"))

_clf_bundle, _clf_ready = model_loader.load_model("telemetry_anomaly_model.joblib")
_iso_bundle, _iso_ready = model_loader.load_model("telemetry_isolation_forest.joblib")


def infer_series_cell_count(voltage: float) -> int:
    """Infer discrete battery pack series cell count from voltage magnitude."""
    if voltage <= 5.0:
        return 1
    if voltage <= 16.0:
        return 4   # 12V auxiliary / LFP
    if voltage <= 30.0:
        return 8   # 24V
    if voltage <= 65.0:
        return 14  # 48V pack (LEV / telecom)
    if voltage <= 150.0:
        return 28  # 96V
    if voltage <= 500.0:
        return 96  # 400V EV pack (Tesla / Leaf / Bolt standard 96S)
    return 192     # 800V EV pack


def normalize_cell_voltage(voltage: float) -> float:
    """Normalize pack voltage to cell equivalent (3.0 - 4.2V nominal)."""
    ns = infer_series_cell_count(voltage)
    return voltage / ns


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
    Auto-normalizes pack-level voltage (> 5V) to cell-level equivalent.
    """
    v_cell = normalize_cell_voltage(voltage)

    safety_violations = {
        "critical_thermal_warning": bool(temperature is not None and temperature >= critical_temp_thresh),
        "voltage_sag_or_overvoltage": bool(v_cell < VOLTAGE_SAG_CELL_CRITICAL_V or v_cell > 4.3),
        "overcurrent_fault": bool(abs(current) > 350.0),
        "invalid_soc_bounds": bool(soc < 0.0 or soc > 100.0),
        "resistance_spike_warning": bool(resistance is not None and resistance > resistance_thresh),
        "cell_voltage_imbalance_warning": bool(cell_delta_mv is not None and cell_delta_mv > cell_delta_thresh),
    }

    return safety_violations


def calculate_predictive_anomaly_score(
    soc: float,
    voltage: float,
    current: float,
    temperature: Optional[float] = None,
    resistance: Optional[float] = None,
    cell_delta_mv: Optional[float] = None,
    temp_rate: Optional[float] = None,
    volt_rate: Optional[float] = None,
    ml_proba: Optional[float] = None,
    iso_flag: Optional[bool] = None,
    has_safety_violation: bool = False,
) -> Tuple[float, str, List[str], Optional[float]]:
    """
    Calculate continuous anomaly score (0-100), risk level, contributing signals, and lead-time.

    Returns:
        (anomaly_score, risk_level, contributing_signals, estimated_lead_time_seconds)
    """
    v_cell = normalize_cell_voltage(voltage)

    score = 0.0
    contributing: List[str] = []
    lead_times: List[float] = []

    # 1. Thermal Analysis
    if temperature is not None:
        if temperature >= CRITICAL_THERMAL_WARNING_TEMP:
            score += 70.0
            contributing.append(
                f"Critical pack temperature ({temperature:.1f} degC >= {CRITICAL_THERMAL_WARNING_TEMP:.1f} degC, severe thermal runaway hazard)"
            )
            lead_times.append(15.0)  # Imminent danger
        elif temperature >= WATCH_THERMAL_WARNING_TEMP:
            # Linear ramp from 40 to 65 pts
            frac = (temperature - WATCH_THERMAL_WARNING_TEMP) / (CRITICAL_THERMAL_WARNING_TEMP - WATCH_THERMAL_WARNING_TEMP)
            pts = 40.0 + 25.0 * frac
            score += pts
            contributing.append(
                f"Elevated thermal rise ({temperature:.1f} degC breached {WATCH_THERMAL_WARNING_TEMP:.1f} degC watch boundary, +{pts:.1f} pts)"
            )
            # Estimated lead time to critical threshold
            effective_rate = temp_rate if (temp_rate is not None and temp_rate > 0.01) else 0.06
            t_lead = (CRITICAL_THERMAL_WARNING_TEMP - temperature) / effective_rate
            lead_times.append(max(20.0, round(t_lead, 1)))
        elif temp_rate is not None and temp_rate > 0.05 and temperature > 36.0:
            pts = 20.0
            score += pts
            contributing.append(f"Rapid transient heating rate ({temp_rate*60:.1f} degC/min, +{pts:.1f} pts)")
            lead_times.append(max(30.0, round((CRITICAL_THERMAL_WARNING_TEMP - temperature) / temp_rate, 1)))

    # 2. Internal Resistance Analysis
    if resistance is not None:
        if resistance > DEFAULT_RESISTANCE_SPIKE_MOHM:
            score += 70.0
            contributing.append(
                f"Severe internal resistance spike ({resistance:.1f} mOhm > {DEFAULT_RESISTANCE_SPIKE_MOHM:.1f} mOhm, contact/SEI degradation)"
            )
            lead_times.append(60.0)
        elif resistance > WATCH_RESISTANCE_MOHM:
            frac = (resistance - WATCH_RESISTANCE_MOHM) / (DEFAULT_RESISTANCE_SPIKE_MOHM - WATCH_RESISTANCE_MOHM)
            pts = 40.0 + 25.0 * frac
            score += pts
            contributing.append(
                f"Internal resistance growth ({resistance:.1f} mOhm entered {WATCH_RESISTANCE_MOHM:.1f} mOhm watch window, +{pts:.1f} pts)"
            )
            lead_times.append(180.0)

    # 3. Voltage Dynamics & Sag Analysis
    if v_cell < VOLTAGE_SAG_CELL_CRITICAL_V:
        score += 70.0
        contributing.append(
            f"Critical voltage collapse ({v_cell:.2f} V/cell < {VOLTAGE_SAG_CELL_CRITICAL_V:.2f} V under-voltage cutoff)"
        )
        lead_times.append(15.0)
    elif v_cell < VOLTAGE_SAG_CELL_WATCH_V:
        frac = (VOLTAGE_SAG_CELL_WATCH_V - v_cell) / (VOLTAGE_SAG_CELL_WATCH_V - VOLTAGE_SAG_CELL_CRITICAL_V)
        pts = 40.0 + 25.0 * frac
        score += pts
        contributing.append(
            f"Voltage sag under load ({v_cell:.2f} V/cell below {VOLTAGE_SAG_CELL_WATCH_V:.2f} V threshold, +{pts:.1f} pts)"
        )
        eff_dv = abs(volt_rate) if (volt_rate is not None and abs(volt_rate) > 0.005) else 0.015
        lead_times.append(max(15.0, round((v_cell - VOLTAGE_SAG_CELL_CRITICAL_V) / eff_dv, 1)))
    elif v_cell > 4.30:
        score += 70.0
        contributing.append(f"Overvoltage hazard ({v_cell:.2f} V/cell > 4.30 V max cell limit)")
        lead_times.append(30.0)

    # 4. Overcurrent & Cell Imbalance
    if abs(current) > 350.0:
        score += 70.0
        contributing.append(f"Severe overcurrent ({current:.1f} A exceeds 350.0 A rating)")
        lead_times.append(20.0)
    elif abs(current) > 250.0:
        score += 20.0
        contributing.append(f"Heavy current surge ({current:.1f} A, +20.0 pts)")

    if cell_delta_mv is not None and cell_delta_mv > DEFAULT_MAX_CELL_DELTA_MV:
        score += 40.0
        contributing.append(f"Cell voltage imbalance ({cell_delta_mv:.1f} mV > {DEFAULT_MAX_CELL_DELTA_MV:.1f} mV)")
        lead_times.append(300.0)

    # 5. ML Models Contribution (bounded to prevent false positives on clean baselines)
    if ml_proba is not None and ml_proba > 0.05:
        ml_pts = min(20.0, ml_proba * 20.0)
        score += ml_pts
        if ml_proba >= 0.70:
            contributing.append(f"Supervised anomaly probability {ml_proba:.2%} (+{ml_pts:.1f} pts)")

    if iso_flag is True:
        score += 10.0
        contributing.append("Isolation Forest flagged multidimensional telemetry signature (+10.0 pts)")

    if has_safety_violation:
        score = max(score, 80.0)

    # Bound continuous score
    anomaly_score = float(np.clip(round(score, 1), 0.0, 100.0))

    # Categorical Risk Level
    if anomaly_score >= 70.0 or has_safety_violation:
        risk_level = "critical"
    elif anomaly_score >= 40.0:
        risk_level = "watch"
    else:
        risk_level = "normal"

    # Select shortest lead-time from active failure paths if in watch/critical
    estimated_lead_time: Optional[float] = None
    if risk_level in ["watch", "critical"] and lead_times:
        estimated_lead_time = float(min(lead_times))

    if not contributing:
        contributing.append("All primary telemetry parameters operate within nominal baseline envelopes.")

    return anomaly_score, risk_level, contributing, estimated_lead_time


def predict_anomaly(
    soc: float,
    voltage: float,
    current: float,
    hour: int = 12,
    dayofweek: int = 2,
    temperature: Optional[float] = None,
    resistance: Optional[float] = None,
    cell_delta_mv: Optional[float] = None,
    temp_rate: Optional[float] = None,
    volt_rate: Optional[float] = None,
) -> Tuple[bool, float, str, List[str], Optional[float], Optional[float], Optional[bool], str]:
    """
    Dual-engine predictive early-warning anomaly detection.
    
    Returns:
        (is_anomaly, anomaly_score, risk_level, contributing_signals, estimated_lead_time_seconds,
         anomaly_probability, isolation_forest_flag, source)
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

    # Normalize voltage if pack voltage was passed
    v_norm = normalize_cell_voltage(voltage)

    # Supervised XGBoost Classifier Prediction
    if _clf_bundle is not None and _clf_ready:
        try:
            model = _clf_bundle["model"] if isinstance(_clf_bundle, dict) and "model" in _clf_bundle else _clf_bundle
            features = _clf_bundle["features"] if isinstance(_clf_bundle, dict) and "features" in _clf_bundle else ["soc", "voltage", "current", "hour", "dayofweek"]
            X = pd.DataFrame([{"soc": soc, "voltage": v_norm, "current": current, "hour": hour, "dayofweek": dayofweek}])[features]
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

            payload = {"soc": soc, "voltage": v_norm, "current": current, "hour": hour, "dayofweek": dayofweek}
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

    anomaly_score, risk_level, contributing_signals, estimated_lead_time = calculate_predictive_anomaly_score(
        soc=soc,
        voltage=voltage,
        current=current,
        temperature=temperature,
        resistance=resistance,
        cell_delta_mv=cell_delta_mv,
        temp_rate=temp_rate,
        volt_rate=volt_rate,
        ml_proba=proba,
        iso_flag=iso_flag,
        has_safety_violation=has_safety_violation,
    )

    is_anomaly = bool(has_safety_violation or risk_level in ["watch", "critical"])

    return (
        is_anomaly,
        anomaly_score,
        risk_level,
        contributing_signals,
        estimated_lead_time,
        proba,
        iso_flag,
        source,
    )
