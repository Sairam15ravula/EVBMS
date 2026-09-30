"""
FastAPI entrypoint for EV Battery Intelligence Platform API.
"""
import os
import sys
from contextlib import asynccontextmanager
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

# Allowed CORS origins - restrict in production
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173",
).split(",")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup and shutdown events."""
    # Startup: load ML models and initialize database
    from services import soh, rul, anomaly, capacity, charging  # noqa: F401
    try:
        from db.session import init_db
        await init_db()
    except Exception as e:
        print(f"[app-startup] Database init warning: {e}")
    print("Battery Intelligence APIs, Fleet Management, Auth & ML models ready.")
    yield
    # Shutdown: cleanup resources
    print("[app-shutdown] Shutting down EV Battery Intelligence Platform API.")


app = FastAPI(
    title="AI-Driven Battery Intelligence Platform API",
    description="Production REST APIs for Fleet Management, Battery Telemetry, Alerts, Auth, and ML Inference.",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware with configurable allowed origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

# Register REST routers
app.include_router(auth_router)
app.include_router(vehicles_router)
app.include_router(telemetry_router)
app.include_router(alerts_router)
app.include_router(predict_router)


@app.get("/")
def root():
    """Root endpoint with basic API information."""
    return {
        "status": "ok",
        "message": "AI-Driven Battery Intelligence Platform API",
        "version": "0.1.0",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health")
def health():
    """Health check endpoint for monitoring and load balancers."""
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
