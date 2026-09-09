"""
Prediction routes for ML & EKF Physics inference:
  POST /predict/soc-ekf, /predict/soh, /predict/rul, /predict/anomaly,
       /predict/capacity, /predict/charging, /predict/all
"""
from fastapi import APIRouter, HTTPException

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
from services.soc_ekf import ExtendedKalmanFilterSoC

router = APIRouter(prefix="/predict", tags=["predict"])


@router.post("/soc-ekf", response_model=EkfSoCResponse)
def predict_soc_ekf(req: EkfSoCRequest):
    """Estimate State of Charge (SoC) using 1RC Extended Kalman Filter for NMC/LFP chemistry."""
    try:
        ekf = ExtendedKalmanFilterSoC(
            chemistry=req.chemistry,
            nominal_capacity_ah=req.nominal_capacity_ah,
            dt_seconds=req.dt_seconds,
            initial_soc=req.initial_soc,
        )
        soc_pct, v_rc, residual = ekf.step(req.current, req.measured_voltage)
        return EkfSoCResponse(
            estimated_soc_pct=round(soc_pct, 2),
            polarization_voltage_v=round(v_rc, 4),
            innovation_residual_v=round(residual, 4),
            chemistry=req.chemistry,
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
        rul, status, source = rul_service.predict_rul(req.cycle, req.voltage, req.temperature, req.capacity, req.soh, req.init_capacity)
        return RULResponse(rul_cycles=round(rul, 1), status=status, source=source)
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
        raise HTTPException(status_code=400, detail="Provide at least one of: soh, rul, anomaly, capacity, charging")
    return out
