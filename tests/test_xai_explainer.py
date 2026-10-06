"""
Unit tests for Phase 5: TreeSHAP Attributions, Grounded Digital Doctor Assistant,
and Numerical Hallucination Verification.
"""
import os
import pytest
from fastapi.testclient import TestClient

from backend.app import app
from backend.services.xai_explainer import (
    TreeShapService,
    shap_service,
    chat_digital_doctor,
    is_out_of_scope,
    extract_all_numbers,
    collect_allowed_numbers_from_context,
    verify_grounded_numbers,
    generate_deterministic_assistant_reply,
    generate_grounded_xai_analysis,
)

client = TestClient(app)


# ── 1. TreeSHAP Feature Attributions ──────────────────────────────────────────

def test_soh_treeshap_attributions():
    """Verify TreeSHAP generates valid attributions and relative importance for SoH model."""
    result = shap_service.explain_soh(cycle=100.0, voltage=3.65, temperature=28.0)

    assert result["model_name"] == "soh_model_xgb"
    assert "base_value" in result
    assert "prediction" in result
    assert "cycle" in result["attributions"]
    assert "voltage" in result["attributions"]
    assert "temperature" in result["attributions"]

    # Details breakdown
    details = result["details"]
    assert len(details) == 3
    rel_sum = sum(d["relative_importance_pct"] for d in details)
    assert 99.0 <= rel_sum <= 101.0, f"Relative importance sum should be ~100%, got {rel_sum}"

    # Cycle aging should negatively impact health relative to initial
    assert isinstance(result["attributions"]["cycle"], float)


def test_rul_treeshap_attributions():
    """Verify TreeSHAP generates valid attributions for RUL model."""
    result = shap_service.explain_rul(cycle=80.0, voltage=3.70, temperature=25.0)

    assert "rul_model_xgb" in result["model_name"]
    assert "base_value" in result
    assert "prediction" in result
    assert "cycle" in result["attributions"]
    assert "voltage" in result["attributions"]
    assert "temperature" in result["attributions"]

    details = result["details"]
    assert len(details) == 3
    rel_sum = sum(d["relative_importance_pct"] for d in details)
    assert 99.0 <= rel_sum <= 101.0


def test_anomaly_treeshap_attributions():
    """Verify TreeSHAP generates valid attributions for Telemetry Anomaly model."""
    result = shap_service.explain_anomaly(soc=75.0, voltage=3.72, current=18.5, hour=14, dayofweek=3)

    assert result["model_name"] == "telemetry_anomaly_model"
    assert "base_value" in result
    assert "prediction" in result
    assert set(result["features"]) == {"soc", "voltage", "current", "hour", "dayofweek"}
    assert len(result["details"]) == 5
    rel_sum = sum(d["relative_importance_pct"] for d in result["details"])
    assert 99.0 <= rel_sum <= 101.0


# ── 2. Scope Guardrail ("I don't know") ────────────────────────────────────────

@pytest.mark.parametrize("query", [
    "What is the stock price of Tesla?",
    "Tell me a funny joke about cats",
    "Who is the president of France?",
    "What is the weather forecast for tomorrow?",
    "Can you give me a recipe for chocolate cake?",
])
def test_out_of_scope_detection(query):
    """Verify out-of-scope filter flags non-battery topics."""
    assert is_out_of_scope(query) is True


def test_digital_doctor_out_of_scope_rejection():
    """Verify Digital Doctor responds with 'I don't know' for out-of-scope questions."""
    response = chat_digital_doctor(
        user_query="What is the stock price of Tesla today?",
        context={
            "vehicle": {"name": "Tesla Model 3", "chemistry": "NMC"},
            "telemetry": {"cycleCount": 50, "temperature": 25.0, "voltage": 370.0, "current": 10.0},
            "healthMetrics": {"soh": 92.0, "rulCycles": 850, "rulYears": 6.0, "anomalies": []},
        }
    )

    assert "I don't know" in response["reply"]
    assert response["source"] == "guardrail_scope_filter"
    assert response["grounded"] is True


# ── 3. Graceful Fallback Without GEMINI_API_KEY ────────────────────────────────

def test_digital_doctor_offline_graceful_fallback(monkeypatch):
    """Verify assistant produces deterministic template without GEMINI_API_KEY, never an error."""
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)

    ctx = {
        "vehicle": {"name": "Tesla Model 3", "chemistry": "NMC"},
        "telemetry": {"cycleCount": 65, "temperature": 26.5, "voltage": 368.0, "current": 15.0, "internalResistance": 14.8},
        "healthMetrics": {"soh": 90.5, "rulCycles": 790, "rulYears": 5.4, "anomalies": []},
    }

    response = chat_digital_doctor(
        user_query="Why did my battery health drop recently?",
        context=ctx,
    )

    assert response is not None
    assert "reply" in response
    assert len(response["reply"]) > 20
    assert response["grounded"] is True
    assert response["source"] == "deterministic_physics_fallback"
    assert response["verification_passed"] is True
    assert "suggestedActions" in response
    assert len(response["suggestedActions"]) > 0


# ── 4. Numerical Hallucination Verification ───────────────────────────────────

def test_extract_all_numbers():
    text = "Battery SoH dropped to 89.5% after 120 cycles at 32.1 degC. Residual is -0.04."
    nums = extract_all_numbers(text)
    assert 89.5 in nums
    assert 120.0 in nums
    assert 32.1 in nums
    assert -0.04 in nums


def test_numerical_verification_passes_on_grounded_text():
    """Grounding verifier passes when all cited numbers exist in context."""
    context = {
        "telemetry": {"temperature": 25.0, "voltage": 370.0, "internalResistance": 14.5},
        "healthMetrics": {"soh": 91.2, "rulCycles": 800, "rulYears": 5.5},
    }
    allowed = collect_allowed_numbers_from_context(context)

    # Text citing only allowed metrics or standard benign constants (e.g. 20, 80)
    grounded_text = "Your battery SoH is 91.2% with 800 cycles remaining. Temperature is 25.0 degC. Keep SoC between 20% and 80%."
    is_verified, ungrounded = verify_grounded_numbers(grounded_text, allowed, tolerance=0.5)

    assert is_verified is True
    assert len(ungrounded) == 0


def test_numerical_verification_rejects_hallucinated_numbers():
    """Grounding verifier rejects text with numbers not in telemetry or benign constants."""
    context = {
        "telemetry": {"temperature": 25.0, "voltage": 370.0},
        "healthMetrics": {"soh": 91.2},
    }
    allowed = collect_allowed_numbers_from_context(context)

    hallucinated_text = "Your battery capacity dropped by 9999.4% and cell #737 is operating at 432.8 degC."
    is_verified, ungrounded = verify_grounded_numbers(hallucinated_text, allowed, tolerance=0.5)

    assert is_verified is False
    assert 9999.4 in ungrounded
    assert 432.8 in ungrounded


# ── 5. Multi-Turn Chat Thread Context ─────────────────────────────────────────

def test_multi_turn_chat_thread():
    """Verify follow-up messages pass conversation history into the assistant."""
    messages = [
        {"sender": "assistant", "text": "Hello! I am your AI EV Battery Digital Doctor."},
        {"sender": "user", "text": "Why did my health drop?"},
        {"sender": "assistant", "text": "Degradation is driven primarily by cycle aging."},
    ]

    context = {
        "vehicle": {"name": "Tesla Model 3", "chemistry": "NMC"},
        "telemetry": {"cycleCount": 70, "temperature": 24.0, "voltage": 372.0, "current": 0.0, "internalResistance": 14.2},
        "healthMetrics": {"soh": 91.0, "rulCycles": 810, "rulYears": 5.6, "anomalies": []},
    }

    response = chat_digital_doctor(
        user_query="Can I charge to 100% for a road trip tomorrow?",
        messages=messages,
        context=context,
    )

    assert response is not None
    assert "reply" in response
    assert response["grounded"] is True


# ── 6. FastAPI Routes Integration ─────────────────────────────────────────────

def test_api_predict_explain_endpoint():
    """Verify POST /predict/explain returns valid TreeSHAP attributions and diagnostic plan."""
    res = client.post("/predict/explain", json={
        "cycle": 60.0,
        "voltage": 370.0,
        "temperature": 25.0,
        "soc": 80.0,
        "current": 20.0,
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "soh_shap" in data
    assert "rul_shap" in data
    assert "anomaly_shap" in data
    assert data["soh_shap"]["model_name"] == "soh_model_xgb"
    assert len(data["soh_shap"]["details"]) == 3
    assert "aiAnalysis" in data
    assert "degradationCauses" in data["aiAnalysis"]


def test_api_chat_digital_doctor_endpoint():
    """Verify POST /predict/chat-digital-doctor returns structured response."""
    res = client.post("/predict/chat-digital-doctor", json={
        "userQuery": "Explain my current degradation causes",
        "context": {
            "vehicle": {"name": "Tesla Model 3", "chemistry": "NMC"},
            "telemetry": {"cycleCount": 60, "temperature": 25.0, "voltage": 370.0, "current": 10.0},
            "healthMetrics": {"soh": 91.0, "rulCycles": 800, "rulYears": 5.5, "anomalies": []},
        }
    })
    assert res.status_code == 200
    data = res.json()
    assert "reply" in data
    assert data["grounded"] is True
    assert data["verification_passed"] is True


def test_api_explain_degradation_compatibility_endpoint():
    """Verify POST /api/explain-degradation compatibility alias."""
    res = client.post("/api/explain-degradation", json={
        "vehicle": {"name": "Tesla Model 3", "chemistry": "NMC"},
        "telemetry": {"cycleCount": 60, "temperature": 25.0, "voltage": 370.0, "current": 20.0, "soc": 80.0},
        "healthMetrics": {"soh": 91.0},
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "soh_shap" in data
    assert "rul_shap" in data


def test_api_chat_digital_doctor_compatibility_endpoint():
    """Verify POST /api/chat-digital-doctor compatibility alias."""
    res = client.post("/api/chat-digital-doctor", json={
        "userQuery": "What is the capital of Mars?",
        "context": {},
    })
    assert res.status_code == 200
    data = res.json()
    assert "I don't know" in data["reply"]
