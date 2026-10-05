"""
Model metrics and status endpoints.

Exposes endpoints for querying ML model loading status, readiness,
and training metrics from the metrics_report.json file.
"""
import json
from pathlib import Path
from typing import Any, Dict

from fastapi import APIRouter

from backend.services.model_loader import model_loader

router = APIRouter(prefix="/api/models", tags=["models"])

METRICS_REPORT_PATH = Path(__file__).resolve().parent.parent / "models" / "metrics_report.json"


@router.get("/metrics")
async def get_model_metrics() -> Dict[str, Any]:
    """
    Return model loading status and training metrics.

    Reads metrics_report.json and combines it with the current
    model readiness status from the ModelLoader singleton.
    """
    metrics: Dict[str, Any] = {}
    try:
        with open(METRICS_REPORT_PATH, "r", encoding="utf-8") as f:
            metrics = json.load(f)
    except FileNotFoundError:
        metrics = {}
    except json.JSONDecodeError:
        metrics = {}

    readiness = model_loader.get_readiness()

    return {
        "metrics": metrics,
        "readiness": readiness,
    }


@router.get("/status")
async def get_model_status() -> Dict[str, Any]:
    """
    Return which models are loaded vs using fallback.

    Provides a quick summary of model availability for health checks
    and monitoring dashboards.
    """
    readiness = model_loader.get_readiness()

    loaded = [name for name, status in readiness.items() if status]
    fallback = [name for name, status in readiness.items() if not status]

    return {
        "loaded": loaded,
        "fallback": fallback,
        "total_models": len(readiness),
        "loaded_count": len(loaded),
        "fallback_count": len(fallback),
    }
