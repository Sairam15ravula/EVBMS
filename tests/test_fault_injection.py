"""
Phase 3 Verification: Fault Injection, Early Warning Lead-Time, and DB Alert Persistence Tests.
"""
import pytest
from fastapi.testclient import TestClient

from backend.app import app
from backend.services.anomaly import predict_anomaly

client = TestClient(app)


def test_healthy_baseline_zero_false_positive():
    """Verify healthy telemetry baseline yields 0 false positives."""
    for _ in range(50):
        is_anom, score, risk, signals, lead_t, proba, iso, src = predict_anomaly(
            soc=65.0,
            voltage=370.0,
            current=45.0,
            hour=14,
            dayofweek=2,
            temperature=28.5,
            resistance=15.2,
            cell_delta_mv=12.0,
        )
        assert is_anom is False
        assert risk == "normal"
        assert score < 40.0
        assert lead_t is None


def test_thermal_rise_early_warning_detection():
    """Verify thermal rise triggers early warning watch before 55°C critical limit."""
    is_anom, score, risk, signals, lead_t, proba, iso, src = predict_anomaly(
        soc=70.0,
        voltage=365.0,
        current=60.0,
        temperature=44.0,  # Breached 42.0°C watch boundary
        resistance=16.0,
        temp_rate=0.08,
    )
    assert is_anom is True
    assert risk in ["watch", "critical"]
    assert score >= 40.0
    assert lead_t is not None
    assert lead_t > 0.0
    assert any("thermal" in s.lower() or "degc" in s.lower() for s in signals)


def test_internal_resistance_jump_detection():
    """Verify internal resistance jump triggers early warning."""
    is_anom, score, risk, signals, lead_t, proba, iso, src = predict_anomaly(
        soc=75.0,
        voltage=370.0,
        current=50.0,
        temperature=31.0,
        resistance=29.0,  # Breached 25.0 mOhm watch boundary
    )
    assert is_anom is True
    assert risk in ["watch", "critical"]
    assert score >= 40.0
    assert any("resistance" in s.lower() or "mohm" in s.lower() for s in signals)


def test_voltage_sag_under_load_detection():
    """Verify cell voltage sag below 3.0V triggers early warning."""
    # 96 cells * 2.85V = 273.6V pack
    is_anom, score, risk, signals, lead_t, proba, iso, src = predict_anomaly(
        soc=30.0,
        voltage=273.6,
        current=120.0,
        temperature=32.0,
        resistance=17.0,
        volt_rate=-0.015,
    )
    assert is_anom is True
    assert risk in ["watch", "critical"]
    assert score >= 40.0
    assert lead_t is not None
    assert any("voltage" in s.lower() or "sag" in s.lower() for s in signals)


def test_anomaly_endpoint_db_alert_persistence():
    """Verify /predict/anomaly persists alert to database and appears in /api/alerts."""
    resp = client.post(
        "/predict/anomaly",
        json={
            "vehicle_id": "TEST-EV-FAULT-01",
            "soc": 40.0,
            "voltage": 260.0,  # Critical sag
            "current": 180.0,
            "temperature": 56.5,  # Critical thermal
            "resistance": 38.0,   # Critical resistance
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_anomaly"] is True
    assert data["risk_level"] == "critical"
    assert data["anomaly_score"] >= 70.0
    assert data["alert_persisted"] is True
    assert data["alert_id"] is not None

    # Verify alert appears in /api/alerts query
    alerts_resp = client.get("/api/alerts?vehicle_id=TEST-EV-FAULT-01")
    assert alerts_resp.status_code == 200
    alert_list = alerts_resp.json()
    assert len(alert_list) >= 1
    found = any(a["id"] == data["alert_id"] for a in alert_list)
    assert found is True
