"""
SQLAlchemy 2.0 ORM model definitions for EV Battery Intelligence Platform.
"""
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db.base import Base


class UserModel(Base):
    """User account model for fleet managers, technicians, drivers, and admins."""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="driver", nullable=False)
    full_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    vehicles: Mapped[List["VehicleModel"]] = relationship(
        "VehicleModel", back_populates="owner", cascade="all, delete-orphan"
    )


class VehicleModel(Base):
    """Vehicle asset model."""

    __tablename__ = "vehicles"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    chemistry: Mapped[str] = mapped_column(String(50), nullable=False)  # NMC, LFP, Solid-State
    total_energy_kwh: Mapped[float] = mapped_column(Float, nullable=False)
    nominal_voltage: Mapped[float] = mapped_column(Float, nullable=False)
    owner_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    owner: Mapped[Optional["UserModel"]] = relationship("UserModel", back_populates="vehicles")
    battery_pack: Mapped[Optional["BatteryPackModel"]] = relationship(
        "BatteryPackModel", back_populates="vehicle", uselist=False, cascade="all, delete-orphan"
    )


class BatteryPackModel(Base):
    """Battery pack configuration and metadata."""

    __tablename__ = "battery_packs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    vehicle_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("vehicles.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    serial_number: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    initial_capacity_ah: Mapped[float] = mapped_column(Float, nullable=False)
    cell_count: Mapped[int] = mapped_column(Integer, default=96, nullable=False)
    manufacture_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    vehicle: Mapped["VehicleModel"] = relationship("VehicleModel", back_populates="battery_pack")


class TelemetryFrameModel(Base):
    """Time-series battery telemetry model configured as a TimescaleDB hypertable."""

    __tablename__ = "telemetry_frames"

    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), primary_key=True, nullable=False
    )
    vehicle_id: Mapped[str] = mapped_column(String(50), primary_key=True, nullable=False)
    voltage: Mapped[float] = mapped_column(Float, nullable=False)
    current: Mapped[float] = mapped_column(Float, nullable=False)
    temperature: Mapped[float] = mapped_column(Float, nullable=False)
    soc: Mapped[float] = mapped_column(Float, nullable=False)  # State of Charge %
    soh: Mapped[float] = mapped_column(Float, nullable=False)  # State of Health %
    internal_resistance: Mapped[float] = mapped_column(Float, nullable=False)  # mΩ
    cell_voltages: Mapped[Optional[List[float]]] = mapped_column(JSON, nullable=True)  # Cell voltage array
    active_anomalies: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(JSON, nullable=True)

    __table_args__ = (
        Index("idx_telemetry_vehicle_time", "vehicle_id", "timestamp"),
    )


class AlertLogModel(Base):
    """Battery diagnostic alert and anomaly log."""

    __tablename__ = "alert_logs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True
    )
    vehicle_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    severity: Mapped[str] = mapped_column(String(20), nullable=False)  # info, warning, critical
    fault_code: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    acknowledged: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class AuditLogModel(Base):
    """Audit trail for all mutating API calls (POST, PUT, PATCH, DELETE)."""

    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    method: Mapped[str] = mapped_column(String(10), nullable=False)
    path: Mapped[str] = mapped_column(String(500), nullable=False)
    request_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    status_code: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    duration_ms: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
