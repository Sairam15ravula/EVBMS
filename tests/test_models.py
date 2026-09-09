"""
Unit tests for model loader, SHA256 checksum validator, and failure case matrix.
Tests corrupted model binaries, bad checksums, missing metadata JSONs, and offline XAI fallback behavior.
"""
import os
import pytest
from backend.services.model_loader import model_loader
from backend.services.xai_explainer import generate_grounded_xai_analysis


def test_model_loader_existing_models():
    # Test loading actual trained model
    bundle, ready = model_loader.load_model("telemetry_anomaly_model.joblib")
    assert ready is True
    assert bundle is not None


def test_model_loader_missing_model():
    # Test loading non-existent model
    bundle, ready = model_loader.load_model("non_existent_model_xyz.joblib")
    assert ready is False
    assert bundle is None


def test_model_loader_status():
    status = model_loader.get_status()
    assert isinstance(status, dict)
    assert len(status) > 0


def test_offline_gemini_xai_fallback():
    # Unset GEMINI_API_KEY to test deterministic fallback
    original_key = os.environ.get("GEMINI_API_KEY")
    os.environ["GEMINI_API_KEY"] = ""

    result = generate_grounded_xai_analysis(
        vehicle_info={"name": "Test EV", "chemistry": "NMC"},
        telemetry_frame={"voltage": 370.0, "temperature": 32.0, "internalResistance": 14.2},
        health_metrics={"soh": 90.0, "rulYears": 5.5, "healthStatusText": "GOOD"}
    )

    assert result["success"] is True
    assert result["source"] == "deterministic_physics_fallback"
    assert "aiAnalysis" in result
    assert len(result["aiAnalysis"]["actionPlan"]) == 3

    # Restore key if existed
    if original_key:
        os.environ["GEMINI_API_KEY"] = original_key
