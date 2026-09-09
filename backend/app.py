"""
FastAPI entrypoint for EV Battery Intelligence Platform API.
"""
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent
root_dir = backend_dir.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.alerts import router as alerts_router
from routes.auth import router as auth_router
from routes.predict import router as predict_router
from routes.telemetry import router as telemetry_router
from routes.vehicles import router as vehicles_router

app = FastAPI(
    title="AI-Driven Battery Intelligence Platform API",
    description="Production REST APIs for Fleet Management, Battery Telemetry, Alerts, Auth, and ML Inference.",
    version="0.1.0",
)

# Dev-friendly CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register REST routers
app.include_router(auth_router)
app.include_router(vehicles_router)
app.include_router(telemetry_router)
app.include_router(alerts_router)
app.include_router(predict_router)


@app.on_event("startup")
def _load_models_once():
    from services import soh, rul, anomaly, capacity, charging  # noqa: F401
    print("Battery Intelligence APIs, Fleet Management, Auth & ML models ready.")


@app.get("/")
def health():
    import os
    models_dir = os.path.join(os.path.dirname(__file__), "models")
    expected = [
        "soh_model_xgb.joblib", "rul_model_xgb.joblib", "telemetry_anomaly_model.joblib",
        "telemetry_isolation_forest.joblib", "capacity_fade_model.joblib", "charging_class_model_xgb.joblib",
    ]
    present = {name: os.path.exists(os.path.join(models_dir, name)) for name in expected}
    
    # Check database ORM availability
    db_configured = False
    try:
        from db.session import DATABASE_URL
        db_configured = bool(DATABASE_URL)
    except Exception:
        db_configured = False

    return {
        "status": "ok",
        "message": "AI-Driven Battery Intelligence Platform API",
        "models_loaded": present,
        "database_configured": db_configured,
        "auth_enabled": True,
        "fleet_apis_enabled": True,
        "note": "Endpoints for any model marked false above will use a documented fallback formula instead of a trained model.",
    }
