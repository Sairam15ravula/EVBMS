"""
Pydantic schemas for the prediction API. Field names follow the PRD's
"Implemented AI Model Mapping" table (section 7) and the tech-stack
doc's ML Stack table (section 5) exactly, so request bodies match what
those docs specify as each model's primary inputs.
"""
from typing import Any, Dict, List, Literal, Optional, Set
from pydantic import BaseModel, Field

Source = Literal["trained_model", "fallback_formula", "ekf_physics_engine", "rule_engine"]


class EkfSoCRequest(BaseModel):
    chemistry: Literal["NMC", "LFP"] = Field("NMC", description="Explicit battery pack chemistry: 'NMC' or 'LFP'")
    current: float = Field(..., description="Current in Amperes (Positive = Discharge, Negative = Charge)")
    measured_voltage: float = Field(..., description="Measured pack terminal or cell voltage in Volts")
    nominal_capacity_ah: float = Field(200.0, gt=0, description="Nominal capacity in Ah")
    initial_soc: float = Field(0.80, ge=0.0, le=1.0, description="Initial estimated State of Charge (0.0 to 1.0)")
    dt_seconds: float = Field(1.0, gt=0, description="Sampling time step in seconds")
    num_cells_series: Optional[int] = Field(None, gt=0, description="Series cell count for auto pack-to-cell scaling")
    session_id: Optional[str] = Field(None, description="Optional persistent session identifier for recursive tracking")


class EkfSoCResponse(BaseModel):
    estimated_soc_pct: float = Field(..., description="Estimated State of Charge % (0 - 100)")
    polarization_voltage_v: float = Field(..., description="Internal RC polarization voltage (V)")
    innovation_residual_v: float = Field(..., description="Voltage measurement innovation error (V)")
    chemistry: str
    session_id: Optional[str] = None
    source: Source = "ekf_physics_engine"


class SoHRequest(BaseModel):
    cycle: float = Field(..., description="Cycle index")
    voltage: float
    temperature: float
    capacity: Optional[float] = Field(None, description="Optional measured/reference capacity for fallback calculation, kWh")
    init_capacity: Optional[float] = Field(75.0, description="Optional rated capacity for fallback calculation, kWh")


class SoHResponse(BaseModel):
    soh: float = Field(..., description="Predicted State of Health, %")
    source: Source


class RULRequest(BaseModel):
    cycle: float
    voltage: float
    temperature: float
    capacity: Optional[float] = None
    soh: Optional[float] = None
    init_capacity: Optional[float] = 75.0


class RULResponse(BaseModel):
    rul_cycles: float
    status: Literal["normal", "past-threshold", "flat", "unavailable"]
    source: Source
    rul_lower: Optional[float] = None
    rul_upper: Optional[float] = None
    confidence_interval_90: Optional[list[float]] = None
    interval_width: Optional[float] = None


class AnomalyRequest(BaseModel):
    soc: float = Field(..., ge=0, le=100)
    voltage: float
    current: float
    hour: int = Field(12, ge=0, le=23)
    dayofweek: int = Field(2, ge=0, le=6)
    temperature: Optional[float] = None
    resistance: Optional[float] = None
    cell_delta_mv: Optional[float] = None
    vehicle_id: Optional[str] = None
    temp_rate: Optional[float] = None
    volt_rate: Optional[float] = None


class AnomalyResponse(BaseModel):
    is_anomaly: bool
    anomaly_score: float = Field(0.0, description="Continuous predictive anomaly score (0 - 100)")
    risk_level: Literal["normal", "watch", "critical"] = Field("normal", description="Risk category: normal, watch, or critical")
    contributing_signals: list[str] = Field(default_factory=list, description="Contributing telemetry signals with quantitative evidence")
    estimated_lead_time_seconds: Optional[float] = Field(None, description="Estimated lead time in seconds before critical failure")
    anomaly_probability: Optional[float] = None
    isolation_forest_flag: Optional[bool] = None
    source: Source
    alert_persisted: bool = False
    alert_id: Optional[str] = None


class CapacityRequest(BaseModel):
    Cycle_Index: float


class CapacityResponse(BaseModel):
    predicted_capacity_kwh: float
    source: Source


class ChargingRequest(BaseModel):
    # Support both legacy uppercase fields and clean snake_case fields
    SOC: Optional[float] = None
    soc: Optional[float] = None
    Voltage: Optional[float] = 380.0
    voltage: Optional[float] = None
    Current: Optional[float] = 0.0
    current: Optional[float] = None
    Battery_Temp: Optional[float] = None
    temperature: Optional[float] = None
    Ambient_Temp: Optional[float] = 22.0
    ambient_temp: Optional[float] = None
    Charging_Duration: Optional[float] = 30.0
    charging_duration: Optional[float] = None
    Degradation_Rate: Optional[float] = 0.02
    degradation_trend: Optional[float] = None
    Charging_Mode: Optional[str] = "AC"
    charging_mode: Optional[str] = None
    Efficiency: Optional[float] = 0.92
    Battery_Type: Optional[str] = "NMC"
    battery_type: Optional[str] = None
    Charging_Cycles: Optional[float] = 100.0
    EV_Model: Optional[str] = "Generic EV"
    ev_model: Optional[str] = None
    soh: Optional[float] = 90.0
    priority_mode: Optional[str] = Field(
        default="protect_battery_life",
        description="'protect_battery_life' (longevity) or 'need_range_soon' (fast replenishment)",
    )


class ChargingResponse(BaseModel):
    charging_class: str
    confidence: Optional[float] = None
    source: Source
    target_soc_min: float = 20.0
    target_soc_max: float = 80.0
    target_soc_window: List[float] = [20.0, 80.0]
    suggested_charge_rate_kw: float = 11.0
    suggested_charge_type: str = "AC Level 2 (Slow, 11 kW)"
    priority_mode: str = "protect_battery_life"
    reason: str = ""
    explanation_link: str = "#digital-doctor"


class AllPredictRequest(BaseModel):
    soc_ekf: Optional[EkfSoCRequest] = None
    soh: Optional[SoHRequest] = None
    rul: Optional[RULRequest] = None
    anomaly: Optional[AnomalyRequest] = None
    capacity: Optional[CapacityRequest] = None
    charging: Optional[ChargingRequest] = None


class ShapFeatureAttribution(BaseModel):
    feature: str
    value: float
    shap_attribution: float
    relative_importance_pct: float


class ModelShapSummary(BaseModel):
    model_name: str
    base_value: float
    prediction: float
    features: List[str]
    attributions: Dict[str, float]
    details: List[ShapFeatureAttribution]


class ExplainRequest(BaseModel):
    cycle: Optional[float] = 60.0
    voltage: Optional[float] = 370.0
    temperature: Optional[float] = 25.0
    soc: Optional[float] = 80.0
    current: Optional[float] = 20.0
    hour: Optional[int] = 12
    dayofweek: Optional[int] = 2
    soh: Optional[float] = None
    rul: Optional[float] = None
    vehicle_info: Optional[Dict[str, Any]] = None


class ExplainResponse(BaseModel):
    success: bool = True
    source: str = "tree_shap_engine"
    soh_shap: ModelShapSummary
    rul_shap: ModelShapSummary
    anomaly_shap: ModelShapSummary
    aiAnalysis: Optional[Dict[str, Any]] = None


class ChatMessageSchema(BaseModel):
    sender: str
    text: str
    timestamp: Optional[str] = None


class ChatDoctorRequest(BaseModel):
    userQuery: str
    messages: Optional[List[ChatMessageSchema]] = None
    context: Optional[Dict[str, Any]] = None


class ChatDoctorResponse(BaseModel):
    reply: str
    suggestedActions: List[str] = []
    grounded: bool = True
    verification_passed: bool = True
    source: str = "deterministic_physics_fallback"
    shap_summary: Optional[Dict[str, Any]] = None


class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
