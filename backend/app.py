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

from backend.middleware.audit import AuditLoggingMiddleware
from backend.middleware.request_id import RequestIDMiddleware
from backend.utils.logger import get_logger
from routes.alerts import router as alerts_router
from routes.auth import router as auth_router
from routes.metrics import router as metrics_router
from routes.predict import router as predict_router
from routes.telemetry import router as telemetry_router
from routes.vehicles import router as vehicles_router

logger = get_logger(__name__)

# Allowed CORS origins - restrict in production
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173",
).split(",")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup and shutdown events."""
    logger.info("Application starting up")
    # Startup: load ML models and initialize database
    from services import soh, rul, anomaly, capacity, charging  # noqa: F401
    try:
        from db.session import init_db
        await init_db()
    except Exception as e:
        logger.warning(f"Database init warning: {e}")
    logger.info("Battery Intelligence APIs, Fleet Management, Auth & ML models ready.")
    yield
    # Shutdown: cleanup resources
    logger.info("Shutting down EV Battery Intelligence Platform API.")


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

# Request ID middleware — generates/propagates X-Request-ID for tracing
app.add_middleware(RequestIDMiddleware)

# Audit logging middleware — logs all mutating API calls (POST/PUT/PATCH/DELETE)
app.add_middleware(AuditLoggingMiddleware)

# Register REST routers
app.include_router(auth_router)
app.include_router(vehicles_router)
app.include_router(telemetry_router)
app.include_router(alerts_router)
app.include_router(predict_router)
app.include_router(metrics_router)


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


@app.post("/api/explain-degradation")
def api_explain_degradation(payload: dict):
    """Compatibility alias for XAI degradation explanation with TreeSHAP attributions."""
    from schemas.battery import ExplainRequest
    from routes.predict import explain_predictions

    # Extract fields whether flat or nested in vehicle/telemetry
    telemetry = payload.get("telemetry", {})
    health = payload.get("healthMetrics", {})
    vehicle = payload.get("vehicle", {})

    cycle = payload.get("cycle") or telemetry.get("cycleCount") or 60.0
    voltage = payload.get("voltage") or telemetry.get("voltage") or 370.0
    temp = payload.get("temperature") or telemetry.get("temperature") or 25.0
    soc = payload.get("soc") or telemetry.get("soc") or 80.0
    current = payload.get("current") or telemetry.get("current") or 20.0
    soh = payload.get("soh") or health.get("soh")

    req = ExplainRequest(
        cycle=float(cycle),
        voltage=float(voltage),
        temperature=float(temp),
        soc=float(soc),
        current=float(current),
        soh=float(soh) if soh is not None else None,
        vehicle_info=vehicle or payload.get("vehicle_info"),
    )
    return explain_predictions(req)


@app.post("/api/chat-digital-doctor")
def api_chat_digital_doctor(payload: dict):
    """Compatibility alias for grounded Digital Doctor chat with hallucination verification."""
    from schemas.battery import ChatDoctorRequest, ChatMessageSchema
    from routes.predict import chat_digital_doctor_endpoint

    raw_msgs = payload.get("messages", [])
    parsed_msgs = []
    for m in raw_msgs:
        if isinstance(m, dict) and "sender" in m and "text" in m:
            parsed_msgs.append(ChatMessageSchema(sender=m["sender"], text=m["text"], timestamp=m.get("timestamp")))

    req = ChatDoctorRequest(
        userQuery=payload.get("userQuery", ""),
        messages=parsed_msgs if parsed_msgs else None,
        context=payload.get("context", {}),
    )
    return chat_digital_doctor_endpoint(req)

