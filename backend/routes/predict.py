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
)
from services import soh as soh_service
from services import rul as rul_service
from services import anomaly as anomaly_service
from services import capacity as capacity_service
from services import charging as charging_service
from services.soc_ekf import ExtendedKalmanFilterSoC, get_or_create_ekf

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
def predict_anomaly(req: AnomalyRequest):
    try:
        is_anom, proba, iso_flag, source = anomaly_service.predict_anomaly(
            req.soc, req.voltage, req.current, req.hour, req.dayofweek, req.temperature, req.resistance,
        )
        return AnomalyResponse(
            is_anomaly=is_anom,
            anomaly_probability=round(proba, 4) if proba is not None else None,
            isolation_forest_flag=iso_flag,
            source=source,
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
        label, proba, source = charging_service.predict_charging(req.model_dump())
        return ChargingResponse(charging_class=label, confidence=round(proba, 4) if proba is not None else None, source=source)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Charging classification failed: {e}")


@router.post("/all")
def predict_all(req: AllPredictRequest):
    out = {}
    if req.soc_ekf:
        out["soc_ekf"] = predict_soc_ekf(req.soc_ekf)
    if req.soh:
        out["soh"] = predict_soh(req.soh)
    if req.rul:
        out["rul"] = predict_rul(req.rul)
    if req.anomaly:
        out["anomaly"] = predict_anomaly(req.anomaly)
    if req.capacity:
        out["capacity"] = predict_capacity(req.capacity)
    if req.charging:
        out["charging"] = predict_charging(req.charging)
    if not out:
        raise HTTPException(status_code=400, detail="Provide at least one of: soc_ekf, soh, rul, anomaly, capacity, charging")
    return out


@router.post("/batch", response_model=BatchPredictResponse)
def predict_batch(req: BatchPredictRequest):
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
                result = predict_all(pred)
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
