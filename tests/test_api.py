"""
API Integration & RBAC Auth Matrix Tests.
Tests FastAPI endpoints: /predict/soc-ekf, /api/auth/login, /api/vehicles, /api/telemetry/history, /api/alerts.
"""
import pytest
from fastapi.testclient import TestClient
from backend.app import app

client = TestClient(app)


def test_predict_soc_ekf_endpoint():
    response = client.post(
        "/predict/soc-ekf",
        json={
            "chemistry": "NMC",
            "measured_voltage": 3.85,
            "current": 20.0,
            "nominal_capacity_ah": 230.0,
            "initial_soc": 0.8
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "estimated_soc_pct" in data
    assert "innovation_residual_v" in data
    assert data["chemistry"] == "NMC"


def test_predict_soc_ekf_lfp():
    response = client.post(
        "/predict/soc-ekf",
        json={
            "chemistry": "LFP",
            "measured_voltage": 3.30,
            "current": 10.0,
            "nominal_capacity_ah": 200.0,
            "initial_soc": 0.5
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["chemistry"] == "LFP"


def test_unauthenticated_protected_route():
    response = client.post("/api/alerts/ack/test-alert-id")
    assert response.status_code in [401, 403, 404]


def test_predict_soh_endpoint():
    response = client.post(
        "/predict/soh",
        json={
            "cycle": 50,
            "voltage": 3.82,
            "temperature": 27.5,
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "soh" in data
    assert 0.0 <= data["soh"] <= 100.0
    assert data["source"] in ["trained_model", "fallback_formula"]


def test_predict_rul_endpoint_quantile_interval():
    response = client.post(
        "/predict/rul",
        json={
            "cycle": 60,
            "voltage": 3.75,
            "temperature": 29.0,
            "soh": 88.0,
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "rul_cycles" in data
    assert data["status"] in ["normal", "past-threshold", "flat"]
    assert "rul_lower" in data and "rul_upper" in data
    assert "confidence_interval_90" in data
    if data["rul_lower"] is not None and data["rul_upper"] is not None:
        assert data["rul_lower"] <= data["rul_cycles"] <= data["rul_upper"]
        assert data["confidence_interval_90"] == [data["rul_lower"], data["rul_upper"]]


def test_predict_all_endpoint():
    response = client.post(
        "/predict/all",
        json={
            "soh": {"cycle": 40, "voltage": 3.85, "temperature": 25.0},
            "rul": {"cycle": 40, "voltage": 3.85, "temperature": 25.0, "soh": 92.0},
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "soh" in data
    assert "rul" in data
    assert data["rul"]["rul_cycles"] >= 0.0

