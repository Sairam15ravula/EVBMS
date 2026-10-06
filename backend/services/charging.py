"""
Optimal Charging Strategy Recommendation and Session Classification Service.

Provides:
1. Multi-mode actionable recommendations:
   - "protect_battery_life": optimizes electrochemical longevity (limits max SoC, reduces C-rates, preserves capacity)
   - "need_range_soon": optimizes immediate range replenishment (allows up to 90-100% SoC, higher charge rates while strictly enforcing thermal safety limits)
2. Concrete recommendations:
   - Target SoC Window [min, max]
   - Suggested Charge Rate in kW (fast vs slow charging)
   - Suggested Charge Type description
   - Plain-language reason based on current SoH, pack temperature, and degradation trend
3. Edge case protections:
   - Hot pack (>= 42°C): thermal throttling to <= 7.4 kW to avoid runaway & cathodal breakdown
   - Cold pack (< 10°C / < 5°C): power restricted to avoid metallic lithium anode plating
   - Low SoH (< 80%): contracted buffer [20%, 75%] and reduced power to minimize particle microcracking
   - Near-full SoC (>= 85% / >= 95%): CV saturation taper to trickle rates (2.3 - 3.6 kW)
   - Chemistry specific tuning: LFP allows periodic 100% balancing; NMC capped at 80% daily ceiling
4. Machine Learning classification:
   - Supervised XGBoost classifier pipeline for charging session categorization
"""
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import pandas as pd

try:
    from backend.services._loader import load
except ImportError:
    from services._loader import load

_bundle = load("charging_class_model_xgb.joblib")

_LABEL_TIPS = {
    "aggressive_fast": (
        "Aggressive fast charge — high stress",
        "Frequent high-power charging in warm conditions accelerates wear. Prefer AC charging when time allows.",
    ),
    "full_charge_wear": (
        "Full charge — accelerates wear",
        "Charging past ~90% regularly adds stress at the top of the voltage window. Consider 20-80% for daily use.",
    ),
    "fast_moderate": (
        "Fast charge — moderate stress",
        "Fine occasionally; relying on it daily will shorten lifespan versus AC charging.",
    ),
    "cold_weather": (
        "Cold-weather charge — reduced efficiency",
        "Charging in cold conditions is lower-efficiency and briefly raises internal resistance.",
    ),
    "optimal": (
        "Optimal — battery-friendly",
        "Close to the ideal charging window for long-term battery health.",
    ),
    "standard": (
        "Standard charge — normal",
        "Within normal operating parameters.",
    ),
}


def recommend_charging_strategy(
    soh: float = 90.0,
    soc: float = 50.0,
    temperature: float = 25.0,
    degradation_trend: Optional[float] = None,
    battery_type: str = "NMC",
    priority_mode: str = "protect_battery_life",
    current_mode: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Generate actionable charging strategy recommendations.

    Args:
        soh: Current State of Health percentage (0-100)
        soc: Current State of Charge percentage (0-100)
        temperature: Pack temperature in °C
        degradation_trend: Capacity loss rate (% fade / 100 cycles)
        battery_type: 'NMC' or 'LFP'
        priority_mode: 'protect_battery_life' or 'need_range_soon'
        current_mode: Optional 'AC' or 'DC Fast'
    """
    soh_val = float(np.clip(soh, 10.0, 100.0))
    soc_val = float(np.clip(soc, 0.0, 100.0))
    temp_val = float(temperature)
    b_type = (battery_type or "NMC").upper().strip()
    is_range_mode = bool("range" in str(priority_mode).lower())
    mode_str = "need_range_soon" if is_range_mode else "protect_battery_life"

    reasons: List[str] = []

    # 1. Base Strategy by Priority Mode
    if not is_range_mode:
        target_min = 20.0
        target_max = 80.0
        rate_kw = 11.0
        charge_type = "AC Level 2 (Slow, 11 kW)"
        reasons.append(
            "Longevity Mode Active: Restricting daily cycling to a 20%–80% buffer minimizes cathode lattice stress and slows SEI growth."
        )
    else:
        target_min = 10.0
        target_max = 95.0 if b_type != "LFP" else 100.0
        rate_kw = 120.0
        charge_type = "DC Fast Charging (120 kW)"
        reasons.append(
            "Range Priority Mode: Maximizing usable driving range with high-power fast charging."
        )

    # 2. Chemistry Rules (LFP vs NMC)
    if b_type == "LFP":
        if not is_range_mode:
            target_max = 90.0
            reasons.append(
                "LFP chemistry exhibits minimal phase-change volume variation; periodic 100% saturation is beneficial for BMS cell voltage calibration."
            )
        else:
            target_max = 100.0
            reasons.append(
                "LFP cells tolerate 100% full top-up safely with negligible cathode cracking."
            )
    else:  # NMC
        if not is_range_mode:
            reasons.append(
                "NMC layered cathode suffers transition metal dissolution and micro-cracking above 80% SoC; 80% daily ceiling recommended."
            )
        else:
            if target_max > 90.0:
                reasons.append(
                    "For NMC, charging past 90% accelerates high-voltage parasitic reactions; depart promptly after reaching target."
                )

    # 3. State of Health (SoH) Adjustments
    if soh_val < 80.0:
        # Heavily degraded pack
        if not is_range_mode:
            target_max = min(target_max, 75.0)
            rate_kw = min(rate_kw, 7.4)
            charge_type = "AC Level 2 (Gentle, 7.4 kW)"
            reasons.append(
                f"Low SoH Alert ({soh_val:.1f}% < 80%): Pack has heightened internal impedance. Charge window contracted to {target_min:.0f}%–{target_max:.0f}% and power limited to 7.4 kW to reduce I²R heat and micro-crack propagation."
            )
        else:
            target_max = min(target_max, 85.0)
            rate_kw = min(rate_kw, 50.0)
            charge_type = "DC Fast (Capped at 50 kW for High Impedance)"
            reasons.append(
                f"Degraded Pack ({soh_val:.1f}% SoH): Fast charge rate capped at 50 kW and max charge limited to 85% to protect degraded electrodes against thermal runaway."
            )
    elif soh_val < 88.0:
        # Moderate degradation
        if is_range_mode:
            rate_kw = min(rate_kw, 75.0)
            charge_type = "DC Fast (Capped at 75 kW)"
            reasons.append(
                f"Moderate degradation (SoH {soh_val:.1f}%): Rate capped at 75 kW to curb heat buildup."
            )

    # 4. Thermal Safety & Environmental Overrides
    if temp_val >= 42.0:
        # Hot pack (Critical thermal stress)
        target_max = min(target_max, 75.0 if not is_range_mode else 80.0)
        rate_kw = min(rate_kw, 7.4)
        charge_type = "AC Level 2 (Thermal Throttled, 7.4 kW)"
        reasons.append(
            f"HOT PACK OVERRIDE ({temp_val:.1f} degC >= 42.0 degC): Fast charging disabled and rate throttled to 7.4 kW to prevent thermal runaway hazard and binder decomposition. Allow pack cooling before high-power charging."
        )
    elif temp_val >= 36.0:
        # Elevated temperature
        if is_range_mode:
            rate_kw = min(rate_kw, 50.0)
            charge_type = "DC Fast (Thermal Throttled, 50 kW)"
            reasons.append(
                f"Elevated pack temperature ({temp_val:.1f} degC): Fast charge throttled to 50 kW to avoid exceeding the 45 degC safety threshold."
            )
        else:
            rate_kw = min(rate_kw, 11.0)
            reasons.append(
                f"Warm pack ({temp_val:.1f} degC): AC slow charging recommended to avoid supplementary thermal accumulation."
            )
    elif temp_val < 5.0:
        # Sub-zero / severe cold pack
        rate_kw = min(rate_kw, 7.4)
        charge_type = "AC Level 2 (Cold Throttled, 7.4 kW)"
        reasons.append(
            f"COLD PACK OVERRIDE ({temp_val:.1f} degC < 5.0 degC): Low temperature severely impedes solid-state Li+ intercalation. Fast charging disabled to avoid hazardous metallic lithium dendrite plating on the graphite anode. Thermal pre-conditioning required."
        )
    elif temp_val < 12.0:
        # Chilly pack
        if is_range_mode:
            rate_kw = min(rate_kw, 40.0)
            charge_type = "DC Fast (Preheat Recommended, 40 kW)"
            reasons.append(
                f"Chilly pack ({temp_val:.1f} degC): Power restricted to 40 kW until battery warms above 15 degC."
            )

    # 5. Near-Full State-of-Charge (SoC) Tapering
    if soc_val >= 95.0:
        rate_kw = min(rate_kw, 2.3)
        charge_type = "AC Trickle / Balancing (2.3 kW)"
        reasons.append(
            f"Near-Full Pack ({soc_val:.1f}% SoC): Power tapered to 2.3 kW trickle rate for cell balancing without high overpotential stress."
        )
    elif soc_val >= 85.0:
        if not is_range_mode:
            rate_kw = min(rate_kw, 3.6)
            charge_type = "AC Low (3.6 kW)"
            reasons.append(
                f"Pack at {soc_val:.1f}% SoC has met or exceeded the 80% daily preservation ceiling. Disconnecting charge recommended unless departing on a long trip immediately."
            )
        else:
            rate_kw = min(rate_kw, 22.0)
            charge_type = "DC Fast (CV Saturation Taper, 22 kW)"
            reasons.append(
                f"Approaching capacity ({soc_val:.1f}% SoC): DC Fast rate tapered to 22 kW in constant-voltage phase."
            )

    # 6. Degradation Trend Influence
    if degradation_trend is not None and degradation_trend > 0.05:
        if not is_range_mode:
            rate_kw = min(rate_kw, 7.4)
        else:
            rate_kw = min(rate_kw, 50.0)
        reasons.append(
            f"Accelerated degradation trend detected ({degradation_trend:.2f}% fade rate): High C-rate charging should be minimized to avoid premature knee-point onset."
        )

    # 7. Map to Canonical Classification Label
    if temp_val >= 42.0 and rate_kw > 15.0:
        charging_class = "aggressive_fast"
    elif soc_val >= 95.0:
        charging_class = "full_charge_wear"
    elif temp_val < 10.0:
        charging_class = "cold_weather"
    elif rate_kw > 40.0:
        charging_class = "fast_moderate"
    elif target_max <= 82.0 and rate_kw <= 22.0:
        charging_class = "optimal"
    else:
        charging_class = "standard"

    reason_str = " ".join(reasons)

    return {
        "charging_class": charging_class,
        "confidence": 0.95,
        "source": "rule_engine",
        "target_soc_min": round(target_min, 1),
        "target_soc_max": round(target_max, 1),
        "target_soc_window": [round(target_min, 1), round(target_max, 1)],
        "suggested_charge_rate_kw": round(rate_kw, 1),
        "suggested_charge_type": charge_type,
        "priority_mode": mode_str,
        "reason": reason_str,
        "explanation_link": "#digital-doctor",
    }


def get_charging_recommendation(payload: dict) -> Dict[str, Any]:
    """Extract parameters from payload and compute full charging recommendation."""
    soc = payload.get("soc", payload.get("SOC", 50.0))
    soh = payload.get("soh", payload.get("SOH", 90.0))
    temp = payload.get("temperature", payload.get("Battery_Temp", 25.0))
    trend = payload.get("degradation_trend", payload.get("Degradation_Rate", None))
    b_type = payload.get("battery_type", payload.get("Battery_Type", "NMC"))
    priority = payload.get("priority_mode", "protect_battery_life")
    curr_mode = payload.get("current_mode", payload.get("Charging_Mode", "AC"))

    rec = recommend_charging_strategy(
        soh=float(soh) if soh is not None else 90.0,
        soc=float(soc) if soc is not None else 50.0,
        temperature=float(temp) if temp is not None else 25.0,
        degradation_trend=float(trend) if trend is not None else None,
        battery_type=str(b_type) if b_type is not None else "NMC",
        priority_mode=str(priority) if priority is not None else "protect_battery_life",
        current_mode=str(curr_mode) if curr_mode is not None else "AC",
    )

    # If ML bundle is available and input contains all ML features, attach ML predictions
    if _bundle is not None:
        try:
            if isinstance(_bundle, dict) and "pipeline" in _bundle:
                pipe = _bundle["pipeline"]
                features = _bundle.get("num_features", []) + _bundle.get("cat_features", [])
                if features and all(f in payload for f in features):
                    X = pd.DataFrame([payload])[features]
                    pred_idx = pipe.predict(X)[0]
                    proba = float(pipe.predict_proba(X)[0].max()) if hasattr(pipe, "predict_proba") else None
                    label = (
                        _bundle["label_encoder"].inverse_transform([pred_idx])[0]
                        if "label_encoder" in _bundle
                        else str(pred_idx)
                    )
                    rec["charging_class"] = str(label)
                    rec["confidence"] = proba
                    rec["source"] = "trained_model"
        except Exception as e:
            print(f"[charging-service] Model inference note: {e}")

    return rec


def predict_charging(payload: dict) -> Tuple[str, Optional[float], str]:
    """Legacy classification tuple return for backward compatibility."""
    rec = get_charging_recommendation(payload)
    return str(rec["charging_class"]), rec.get("confidence"), str(rec.get("source", "rule_engine"))


def describe(label: str) -> Tuple[str, str]:
    """Retrieve human-readable description and tip for a charging class."""
    return _LABEL_TIPS.get(label, (label, ""))
