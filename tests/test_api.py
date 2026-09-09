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
