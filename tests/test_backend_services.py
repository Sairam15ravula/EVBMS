"""
Unit & Integration Tests for Backend Services:
- Authentication & JWT Token Management (services/auth.py)
- RBAC Middleware & Security Dependencies (middleware/auth.py)
- Alert Rule Engine & Diagnostics (services/alert_engine.py)
- Capacity Fade Prediction (services/capacity.py)
- Anomaly Detection Edge Cases & Physical Lead-Time (services/anomaly.py)
- SoC EKF Boundary Conditions (services/soc_ekf.py)
"""
import pytest
import numpy as np
from datetime import timedelta
from fastapi import HTTPException

from backend.db.models import UserModel
from backend.services.auth import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    _validate_production_secret,
)
from backend.middleware.auth import require_role
from backend.services.alert_engine import (
    generate_alerts_from_telemetry,
    CRITICAL_THERMAL_THRESHOLD_C,
    VOLTAGE_SAG_THRESHOLD_V,
    OVERCURRENT_THRESHOLD_A,
    RESISTANCE_SPIKE_THRESHOLD_MOHM,
    CELL_IMBALANCE_THRESHOLD_MV,
)
from backend.services.capacity import predict_capacity
from backend.services.anomaly import (
    predict_anomaly,
    check_independent_safety_rules,
    calculate_predictive_anomaly_score,
)
from backend.services.soc_ekf import ExtendedKalmanFilterSoC, get_ocv


# ── 1. Authentication & JWT Utilities ─────────────────────────────────────────

def test_password_hashing_and_verification():
    raw_pass = "P@ssw0rdSecure2026!"
    hashed = hash_password(raw_pass)
    assert hashed != raw_pass
    assert verify_password(raw_pass, hashed) is True
    assert verify_password("WrongPassword!", hashed) is False
    assert verify_password("", hashed) is False


def test_jwt_access_and_refresh_tokens():
    payload = {"sub": "user-123", "email": "test@evbms.com", "role": "fleet_manager"}
    
    # Access Token
    access_token = create_access_token(payload, expires_delta=timedelta(minutes=15))
    decoded_access = decode_token(access_token)
    assert decoded_access is not None
    assert decoded_access["sub"] == "user-123"
    assert decoded_access["role"] == "fleet_manager"
    assert decoded_access["type"] == "access"

    # Refresh Token
    refresh_token = create_refresh_token(payload, expires_delta=timedelta(days=7))
    decoded_refresh = decode_token(refresh_token)
    assert decoded_refresh is not None
    assert decoded_refresh["sub"] == "user-123"
    assert decoded_refresh["type"] == "refresh"


def test_jwt_invalid_token_handling():
    assert decode_token("invalid.jwt.token") is None
    assert decode_token("") is None


def test_production_secret_validation():
    # In test/dev environment, default secret is accepted
    _validate_production_secret()


# ── 2. RBAC Middleware Role Enforcement ───────────────────────────────────────

@pytest.mark.anyio
async def test_require_role_access_granted():
    user = UserModel(id="usr-1", email="admin@evbms.com", hashed_password="h", role="admin")
    checker = require_role(["admin", "fleet_manager"])
    result = await checker(current_user=user)
    assert result.id == "usr-1"
    assert result.role == "admin"


@pytest.mark.anyio
async def test_require_role_access_denied():
    user = UserModel(id="usr-2", email="driver@evbms.com", hashed_password="h", role="driver")
    checker = require_role(["admin", "technician"])
    with pytest.raises(HTTPException) as exc_info:
        await checker(current_user=user)
    assert exc_info.value.status_code == 403
    assert "Access denied" in exc_info.value.detail


# ── 3. Telemetry Alert Rule Engine ───────────────────────────────────────────

def test_alert_engine_clean_telemetry():
    telemetry = {
        "vehicle_id": "v-clean",
        "temperature": 28.0,
        "voltage": 350.0,
        "current": 45.0,
        "internal_resistance": 15.0,
        "cell_voltages": [3.65, 3.64, 3.65, 3.66],
    }
    alerts = generate_alerts_from_telemetry(telemetry)
    assert len(alerts) == 0


def test_alert_engine_thermal_runaway():
    telemetry = {
        "vehicle_id": "v-hot",
        "temperature": 62.5,  # Exceeds 55°C
        "voltage": 350.0,
        "current": 20.0,
        "internal_resistance": 14.0,
    }
    alerts = generate_alerts_from_telemetry(telemetry)
    assert len(alerts) == 1
    assert alerts[0]["fault_code"] == "CRITICAL_THERMAL"
    assert alerts[0]["severity"] == "critical"
    assert alerts[0]["vehicle_id"] == "v-hot"


def test_alert_engine_cell_voltage_sag():
    telemetry = {
        "vehicle_id": "v-sag",
        "temperature": 25.0,
        "voltage": 310.0,
        "current": 50.0,
        "cell_voltages": [3.6, 2.35, 3.6, 3.5],  # 2.35V < 2.5V threshold
    }
    alerts = generate_alerts_from_telemetry(telemetry)
    assert any(a["fault_code"] == "VOLTAGE_SAG" for a in alerts)


def test_alert_engine_pack_voltage_sag_estimation():
    telemetry = {
        "vehicle_id": "v-pack-sag",
        "temperature": 25.0,
        "voltage": 200.0,  # 200V / 96 cells = 2.08V/cell < 2.5V threshold
        "cell_count": 96,
    }
    alerts = generate_alerts_from_telemetry(telemetry)
    assert any(a["fault_code"] == "VOLTAGE_SAG" for a in alerts)


def test_alert_engine_overcurrent_and_resistance_spike():
    telemetry = {
        "vehicle_id": "v-overload",
        "temperature": 35.0,
        "current": 420.0,  # > 350A
        "internal_resistance": 42.0,  # > 35 mΩ
    }
    alerts = generate_alerts_from_telemetry(telemetry)
    fault_codes = [a["fault_code"] for a in alerts]
    assert "OVERCURRENT" in fault_codes
    assert "RESISTANCE_SPIKE" in fault_codes


def test_alert_engine_cell_imbalance():
    telemetry = {
        "vehicle_id": "v-imbalance",
        "cell_voltages": [3.70, 3.78, 3.69],  # Delta: 90 mV > 50 mV threshold
    }
    alerts = generate_alerts_from_telemetry(telemetry)
    assert len(alerts) == 1
    assert alerts[0]["fault_code"] == "CELL_IMBALANCE"
    assert alerts[0]["severity"] == "warning"


# ── 4. Capacity Fade Service ─────────────────────────────────────────────────

def test_predict_capacity_fade():
    # Pre-knee cycle
    cap_early, src_early = predict_capacity(50.0)
    assert cap_early > 0.0
    assert src_early in ["trained_model", "fallback_formula"]

    # Post-knee cycle
    cap_late, src_late = predict_capacity(200.0)
    assert cap_late > 0.0
    assert src_late in ["trained_model", "fallback_formula"]


# ── 5. Anomaly Detection Edge Cases & Physical Lead-Time ─────────────────────

def test_composite_risk_score_calculation():
    # Nominal healthy battery
    score_healthy, level_healthy, contrib_healthy, lead_healthy = calculate_predictive_anomaly_score(
        soc=70.0,
        voltage=360.0,
        current=10.0,
        temperature=25.0,
        resistance=14.0,
        cell_delta_mv=15.0,
        ml_proba=0.05,
        iso_flag=False,
    )
    assert score_healthy < 40.0
    assert level_healthy == "normal"
    assert lead_healthy is None

    # Critical thermal battery
    score_critical, level_critical, contrib_critical, lead_critical = calculate_predictive_anomaly_score(
        soc=50.0,
        voltage=340.0,
        current=-30.0,
        temperature=56.0,
        resistance=38.0,
        cell_delta_mv=75.0,
        temp_rate=0.2,
        ml_proba=0.85,
        iso_flag=True,
    )
    assert score_critical >= 70.0
    assert level_critical == "critical"
    assert lead_critical is not None
    assert lead_critical <= 60.0


def test_predict_anomaly_full_pipeline():
    is_anom, score, risk, contribs, lead_time, proba, iso_flag, src = predict_anomaly(
        soc=75.0,
        voltage=370.0,
        current=-30.0,
        temperature=28.0,
        resistance=15.0,
        cell_delta_mv=18.0,
    )
    assert isinstance(is_anom, (bool, np.bool_))
    assert 0.0 <= score <= 100.0
    assert risk in ["normal", "watch", "critical"]
    assert isinstance(contribs, list)
    assert src in ["trained_model", "physical_safety_engine"]


# ── 6. SoC EKF Boundary Conditions ───────────────────────────────────────────

def test_soc_ekf_boundary_conditions():
    # Test LFP chemistry lookup and step
    ekf_lfp = ExtendedKalmanFilterSoC(initial_soc=0.5, chemistry="LFP", nominal_capacity_ah=200.0)
    soc_est, residual, p_cov = ekf_lfp.step(current_amps=15.0, measured_voltage_v=3.32)
    assert 0.0 <= soc_est <= 100.0
    assert ekf_lfp.chemistry == "LFP"

    # Test extreme initial soc clamp
    ekf_clamped = ExtendedKalmanFilterSoC(initial_soc=1.5, chemistry="NMC", nominal_capacity_ah=230.0)
    assert ekf_clamped.x[0, 0] <= 1.0
    soc_clamped, _, _ = ekf_clamped.step(current_amps=-10.0, measured_voltage_v=4.20)
    assert 0.0 <= soc_clamped <= 100.0
