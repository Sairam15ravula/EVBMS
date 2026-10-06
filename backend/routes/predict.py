"""
Prediction routes for ML & EKF Physics inference:
  POST /predict/soc-ekf, /predict/soh, /predict/rul, /predict/anomaly,
       /predict/capacity, /predict/charging, /predict/all, /predict/batch
"""
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from schemas.battery import (
    EkfSoCRequest, EkfSoCResponse,
    SoHRequest, SoHResponse, RULRequest, RULResponse,
    AnomalyRequest, AnomalyResponse, CapacityRequest, CapacityResponse,
    ChargingRequest, ChargingResponse, AllPredictRequest,
    ExplainRequest, ExplainResponse, ChatDoctorRequest, ChatDoctorResponse,
)
from services import soh as soh_service
from services import rul as rul_service
from services import anomaly as anomaly_service
from services import capacity as capacity_service
from services import charging as charging_service
from services.soc_ekf import ExtendedKalmanFilterSoC, get_or_create_ekf
from services.xai_explainer import (
    shap_service,
    chat_digital_doctor,
    generate_grounded_xai_analysis,
)

router = APIRouter(prefix="/predict", tags=["predict"])


class BatchPredictRequest(BaseModel):
    """Batch prediction request containing multiple prediction items."""

    predictions: List[AllPredictRequest] = Field(
        ..., min_length=1, max_length=100,
        description="List of prediction requests to process",
    )


class BatchPredictResponse(BaseModel):
    """Batch prediction response with individual results and summary."""

    results: List[Dict[str, Any]]
    total: int
    successful: int
    failed: int


@router.post("/soc-ekf", response_model=EkfSoCResponse)
def predict_soc_ekf(req: EkfSoCRequest):
    """Estimate State of Charge (SoC) using 1RC Extended Kalman Filter with session continuity."""
    try:
        ekf, sid = get_or_create_ekf(
            session_id=req.session_id,
            chemistry=req.chemistry,
            nominal_capacity_ah=req.nominal_capacity_ah,
            dt_seconds=req.dt_seconds,
            initial_soc=req.initial_soc,
            num_cells_series=req.num_cells_series,
        )
        soc_pct, v_rc, residual = ekf.step(req.current, req.measured_voltage)
        return EkfSoCResponse(
            estimated_soc_pct=round(soc_pct, 2),
            polarization_voltage_v=round(v_rc, 4),
            innovation_residual_v=round(residual, 4),
            chemistry=req.chemistry,
            session_id=sid,
            source="ekf_physics_engine",
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"EKF estimation error: {e}")


@router.post("/soh", response_model=SoHResponse)
def predict_soh(req: SoHRequest):
    try:
        soh, source = soh_service.predict_soh(req.cycle, req.voltage, req.temperature, req.capacity, req.init_capacity)
        return SoHResponse(soh=round(soh, 2), source=source)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"SoH prediction failed: {e}")


@router.post("/rul", response_model=RULResponse)
def predict_rul(req: RULRequest):
    try:
        rul, status, source, rul_lower, rul_upper, interval_width = rul_service.predict_rul(
            req.cycle, req.voltage, req.temperature, req.capacity, req.soh, req.init_capacity
        )
        conf_interval = (
            [round(rul_lower, 1), round(rul_upper, 1)]
            if rul_lower is not None and rul_upper is not None
            else None
        )
        return RULResponse(
            rul_cycles=round(rul, 1),
            status=status,
            source=source,
            rul_lower=round(rul_lower, 1) if rul_lower is not None else None,
            rul_upper=round(rul_upper, 1) if rul_upper is not None else None,
            confidence_interval_90=conf_interval,
            interval_width=round(interval_width, 1) if interval_width is not None else None,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"RUL prediction failed: {e}")


@router.post("/anomaly", response_model=AnomalyResponse)
async def predict_anomaly(req: AnomalyRequest):
    try:
        (
            is_anom,
            anomaly_score,
            risk_level,
            contributing,
            lead_time,
            proba,
            iso_flag,
            source,
        ) = anomaly_service.predict_anomaly(
            soc=req.soc,
            voltage=req.voltage,
            current=req.current,
            hour=req.hour,
            dayofweek=req.dayofweek,
            temperature=req.temperature,
            resistance=req.resistance,
            cell_delta_mv=req.cell_delta_mv,
            temp_rate=req.temp_rate,
            volt_rate=req.volt_rate,
        )

        alert_persisted = False
        alert_id = None

        # Rule 3: Alerts must persist in the DB and appear in the AlertFeed
        if is_anom or risk_level in ["watch", "critical"]:
            try:
                import uuid
                from datetime import datetime, timezone
                from backend.db.session import async_session_factory
                from backend.db.models import AlertLogModel

                v_id = req.vehicle_id or "DEMO-EV-01"
                sev = "critical" if risk_level == "critical" else "warning" if risk_level == "watch" else "info"
                fault_code = (
                    "PREDICTIVE_RISK_WATCH"
                    if risk_level == "watch"
                    else "CRITICAL_HAZARD"
                    if risk_level == "critical"
                    else "TELEMETRY_ANOMALY"
                )
                desc = (
                    f"Risk: {risk_level.upper()} (Score: {anomaly_score:.1f}/100). "
                    + "; ".join(contributing[:2])
                )
                if lead_time is not None:
                    desc += f" Est. lead-time: {lead_time:.0f}s."

                new_alert_id = str(uuid.uuid4())
                async with async_session_factory() as session:
                    alert = AlertLogModel(
                        id=new_alert_id,
                        timestamp=datetime.now(timezone.utc),
                        vehicle_id=v_id,
                        severity=sev,
                        fault_code=fault_code,
                        description=desc,
                        acknowledged=False,
                    )
                    session.add(alert)
                    await session.commit()
                    alert_persisted = True
                    alert_id = new_alert_id
            except Exception as dbe:
                print(f"[predict-anomaly] DB alert persistence note: {dbe}")

        return AnomalyResponse(
            is_anomaly=is_anom,
            anomaly_score=round(anomaly_score, 1),
            risk_level=risk_level,
            contributing_signals=contributing,
            estimated_lead_time_seconds=round(lead_time, 1) if lead_time is not None else None,
            anomaly_probability=round(proba, 4) if proba is not None else None,
            isolation_forest_flag=iso_flag,
            source=source,
            alert_persisted=alert_persisted,
            alert_id=alert_id,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Anomaly prediction failed: {e}")


@router.post("/capacity", response_model=CapacityResponse)
def predict_capacity(req: CapacityRequest):
    try:
        cap, source = capacity_service.predict_capacity(req.Cycle_Index)
        return CapacityResponse(predicted_capacity_kwh=round(cap, 2), source=source)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Capacity prediction failed: {e}")


@router.post("/charging", response_model=ChargingResponse)
def predict_charging(req: ChargingRequest):
    try:
        rec = charging_service.get_charging_recommendation(req.model_dump())
        return ChargingResponse(**rec)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Charging recommendation failed: {e}")


@router.post("/all")
async def predict_all(req: AllPredictRequest):
    out = {}
    if req.soc_ekf:
        out["soc_ekf"] = predict_soc_ekf(req.soc_ekf)
    if req.soh:
        out["soh"] = predict_soh(req.soh)
    if req.rul:
        out["rul"] = predict_rul(req.rul)
    if req.anomaly:
        out["anomaly"] = await predict_anomaly(req.anomaly)
    if req.capacity:
        out["capacity"] = predict_capacity(req.capacity)
    if req.charging:
        out["charging"] = predict_charging(req.charging)
    if not out:
        raise HTTPException(status_code=400, detail="Provide at least one of: soc_ekf, soh, rul, anomaly, capacity, charging")
    return out


@router.post("/batch", response_model=BatchPredictResponse)
async def predict_batch(req: BatchPredictRequest):
    """
    Process multiple predictions in batches of 10.

    Accepts a list of prediction requests and returns results for each,
    processing them in chunks of 10 to manage memory and compute load.
    """
    results: List[Dict[str, Any]] = []
    successful = 0
    failed = 0

    predictions = req.predictions
    chunk_size = 10

    for i in range(0, len(predictions), chunk_size):
        chunk = predictions[i : i + chunk_size]
        for pred in chunk:
            try:
                result = await predict_all(pred)
                results.append({"status": "success", "data": result})
                successful += 1
            except HTTPException as e:
                results.append({"status": "error", "error": e.detail})
                failed += 1
            except Exception as e:
                results.append({"status": "error", "error": str(e)})
                failed += 1

    return BatchPredictResponse(
        results=results,
        total=len(predictions),
        successful=successful,
        failed=failed,
    )


@router.post("/explain", response_model=ExplainResponse)
def explain_predictions(req: ExplainRequest):
    """
    Generate TreeSHAP attributions for SoH, RUL, and Anomaly models,
    accompanied by grounded degradation diagnosis.
    """
    try:
        cycle = req.cycle if req.cycle is not None else 60.0
        voltage = req.voltage if req.voltage is not None else 370.0
        temperature = req.temperature if req.temperature is not None else 25.0
        soc = req.soc if req.soc is not None else 80.0
        current = req.current if req.current is not None else 20.0
        hour = req.hour if req.hour is not None else 12
        dayofweek = req.dayofweek if req.dayofweek is not None else 2

        soh_shap = shap_service.explain_soh(cycle=cycle, voltage=voltage, temperature=temperature)
        rul_shap = shap_service.explain_rul(cycle=cycle, voltage=voltage, temperature=temperature)
        anomaly_shap = shap_service.explain_anomaly(
            soc=soc, voltage=voltage, current=current, hour=hour, dayofweek=dayofweek
        )

        analysis = generate_grounded_xai_analysis(
            vehicle_info=req.vehicle_info or {"name": "EV Pack", "chemistry": "NMC"},
            telemetry_frame={
                "cycleCount": cycle,
                "voltage": voltage,
                "temperature": temperature,
                "soc": soc,
                "current": current,
                "internalResistance": 14.5,
            },
            health_metrics={
                "soh": req.soh or round(soh_shap["prediction"] * 100.0, 1),
                "rulCycles": round(rul_shap["prediction"], 1),
                "rulYears": round(rul_shap["prediction"] / 120.0, 1),
                "healthStatusText": "GOOD" if (req.soh or 90.0) >= 80.0 else "DEGRADED",
                "riskLevel": "LOW",
            },
        )

        return ExplainResponse(
            success=True,
            source="tree_shap_engine",
            soh_shap=soh_shap,
            rul_shap=rul_shap,
            anomaly_shap=anomaly_shap,
            aiAnalysis=analysis.get("aiAnalysis"),
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"XAI explanation failed: {e}")


@router.post("/chat-digital-doctor", response_model=ChatDoctorResponse)
def chat_digital_doctor_endpoint(req: ChatDoctorRequest):
    """
    Conversational Digital Doctor assistant strictly grounded in telemetry and TreeSHAP attributions.
    Rejects out-of-scope queries with 'I don't know' and verifies grounded numbers.
    """
    try:
        messages_list = (
            [m.model_dump() for m in req.messages] if req.messages else None
        )
        result = chat_digital_doctor(
            user_query=req.userQuery,
            messages=messages_list,
            context=req.context or {},
        )
        return ChatDoctorResponse(
            reply=result.get("reply", ""),
            suggestedActions=result.get("suggestedActions", []),
            grounded=result.get("grounded", True),
            verification_passed=result.get("verification_passed", True),
            source=result.get("source", "deterministic_physics_fallback"),
            shap_summary=result.get("shap_summary"),
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Chat assistant failed: {e}")

