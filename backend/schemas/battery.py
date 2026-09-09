"""
Pydantic schemas for the prediction API. Field names follow the PRD's
"Implemented AI Model Mapping" table (section 7) and the tech-stack
doc's ML Stack table (section 5) exactly, so request bodies match what
those docs specify as each model's primary inputs.
"""
from typing import Literal, Optional
from pydantic import BaseModel, Field

Source = Literal["trained_model", "fallback_formula", "ekf_physics_engine"]


class EkfSoCRequest(BaseModel):
    chemistry: Literal["NMC", "LFP"] = Field(..., description="Explicit battery pack chemistry: 'NMC' or 'LFP'")
    current: float = Field(..., description="Current in Amperes (Positive = Discharge, Negative = Charge)")
    measured_voltage: float = Field(..., description="Measured pack terminal voltage in Volts")
    nominal_capacity_ah: float = Field(200.0, gt=0, description="Nominal capacity in Ah")
    initial_soc: float = Field(0.80, ge=0.0, le=1.0, description="Initial estimated State of Charge (0.0 to 1.0)")
    dt_seconds: float = Field(1.0, gt=0, description="Sampling time step in seconds")


class EkfSoCResponse(BaseModel):
    estimated_soc_pct: float = Field(..., description="Estimated State of Charge % (0 - 100)")
    polarization_voltage_v: float = Field(..., description="Internal RC polarization voltage (V)")
    innovation_residual_v: float = Field(..., description="Voltage measurement innovation error (V)")
    chemistry: str
    source: Source = "ekf_physics_engine"


class SoHRequest(BaseModel):
    cycle: float = Field(..., description="Cycle index")
    voltage: float
    temperature: float
    capacity: float = Field(..., description="Most recent measured/reference capacity, kWh")
    init_capacity: float = Field(75.0, description="Rated capacity, kWh")


class SoHResponse(BaseModel):
    soh: float = Field(..., description="Predicted State of Health, %")
    source: Source


class RULRequest(BaseModel):
    cycle: float
    voltage: float
    temperature: float
    capacity: float
    soh: float
    init_capacity: float = 75.0


class RULResponse(BaseModel):
    rul_cycles: float
    status: Literal["normal", "past-threshold", "flat", "unavailable"]
    source: Source


class AnomalyRequest(BaseModel):
    soc: float = Field(..., ge=0, le=100)
    voltage: float
    current: float
    hour: int = Field(..., ge=0, le=23)
    dayofweek: int = Field(..., ge=0, le=6)
    temperature: Optional[float] = None
    resistance: Optional[float] = None


class AnomalyResponse(BaseModel):
    is_anomaly: bool
    anomaly_probability: Optional[float] = None
    isolation_forest_flag: Optional[bool] = None
    source: Source


class CapacityRequest(BaseModel):
    Cycle_Index: float


class CapacityResponse(BaseModel):
    predicted_capacity_kwh: float
    source: Source


class ChargingRequest(BaseModel):
    SOC: float
    Voltage: float
    Current: float
    Battery_Temp: float
    Ambient_Temp: float
    Charging_Duration: float
    Degradation_Rate: float
    Charging_Mode: str = Field(..., description="'AC' or 'DC Fast'")
    Efficiency: float
    Battery_Type: str = Field(..., description="e.g. 'NMC' or 'LFP'")
    Charging_Cycles: float
    EV_Model: str


class ChargingResponse(BaseModel):
    charging_class: str
    confidence: Optional[float] = None
    source: Source


class AllPredictRequest(BaseModel):
    soh: Optional[SoHRequest] = None
    rul: Optional[RULRequest] = None
    anomaly: Optional[AnomalyRequest] = None
    capacity: Optional[CapacityRequest] = None
    charging: Optional[ChargingRequest] = None


class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
