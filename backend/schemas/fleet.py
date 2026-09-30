"""
Pydantic schemas for vehicle fleet management, battery packs, alert logs, and telemetry queries.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class BatteryPackSchema(BaseModel):
    """Battery pack configuration response model."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    vehicle_id: str
    serial_number: str
    initial_capacity_ah: float
    cell_count: int
    manufacture_date: Optional[datetime] = None


class VehicleCreateRequest(BaseModel):
    """Vehicle creation payload."""
    id: str = Field(description="Unique vehicle identifier / VIN (e.g. tesla-m3-01)")
    name: str = Field(description="Vehicle display name")
    model: str = Field(description="Vehicle model")
    chemistry: str = Field(default="NMC", description="Battery chemistry: NMC, LFP, NCA")
    total_energy_kwh: float = Field(gt=0, description="Total battery pack energy capacity in kWh")
    nominal_voltage: float = Field(gt=0, description="Nominal battery pack voltage")
    owner_id: Optional[str] = None
    serial_number: Optional[str] = None
    initial_capacity_ah: Optional[float] = None
    cell_count: Optional[int] = 96


class VehicleResponse(BaseModel):
    """Vehicle asset response contract."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    model: str
    chemistry: str
    total_energy_kwh: float
    nominal_voltage: float
    owner_id: Optional[str] = None
    created_at: datetime
    battery_pack: Optional[BatteryPackSchema] = None


class AlertLogResponse(BaseModel):
    """Diagnostic alert log response contract."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    timestamp: datetime
    vehicle_id: str
    severity: str
    fault_code: str
    description: str
    acknowledged: bool


class AlertAcknowledgeResponse(BaseModel):
    """Alert acknowledgement status response."""
    id: str
    acknowledged: bool
    acknowledged_by: str
    message: str


class TelemetryIngestRequest(BaseModel):
    """Telemetry frame ingestion payload."""
    vehicle_id: str
    voltage: float
    current: float
    temperature: float
    soc: float = Field(ge=0, le=100)
    soh: float = Field(ge=0, le=100)
    internal_resistance: float
    timestamp: Optional[datetime] = None
    cell_voltages: Optional[List[float]] = None
    active_anomalies: Optional[List[Dict[str, Any]]] = None


class TelemetryFrameResponse(BaseModel):
    """Telemetry frame query response contract."""
    model_config = ConfigDict(from_attributes=True)

    timestamp: datetime
    vehicle_id: str
    voltage: float
    current: float
    temperature: float
    soc: float
    soh: float
    internal_resistance: float
    cell_voltages: Optional[List[float]] = None
    active_anomalies: Optional[List[Dict[str, Any]]] = None
