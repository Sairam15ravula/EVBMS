"""
Telemetry Time-Series Data Access Repository (TimescaleDB / PostgreSQL).
"""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models import AlertLogModel, TelemetryFrameModel
from backend.db.repositories.base import BaseRepository


class TelemetryRepository(BaseRepository[TelemetryFrameModel]):
    """Repository for time-series battery telemetry frames and alert logs."""

    def __init__(self, session: AsyncSession):
        super().__init__(TelemetryFrameModel, session)

    async def insert_frame(self, frame_data: Dict[str, Any]) -> TelemetryFrameModel:
        """Insert a single telemetry frame."""
        if "timestamp" not in frame_data or frame_data["timestamp"] is None:
            frame_data["timestamp"] = datetime.now(timezone.utc)
        frame = TelemetryFrameModel(**frame_data)
        self.session.add(frame)
        await self.session.commit()
        return frame

    async def insert_batch(self, frames_data: List[Dict[str, Any]]) -> int:
        """Batch insert telemetry frames."""
        now = datetime.now(timezone.utc)
        frames = []
        for data in frames_data:
            if "timestamp" not in data or data["timestamp"] is None:
                data["timestamp"] = now
            frames.append(TelemetryFrameModel(**data))
        self.session.add_all(frames)
        await self.session.commit()
        return len(frames)

    async def get_latest_frame(self, vehicle_id: str) -> Optional[TelemetryFrameModel]:
        """Fetch the most recent telemetry frame for a vehicle."""
        query = (
            select(TelemetryFrameModel)
            .where(TelemetryFrameModel.vehicle_id == vehicle_id)
            .order_by(desc(TelemetryFrameModel.timestamp))
            .limit(1)
        )
        result = await self.session.execute(query)
        return result.scalars().first()

    async def get_recent_history(
        self, vehicle_id: str, limit: int = 50
    ) -> List[TelemetryFrameModel]:
        """Fetch recent telemetry frames for real-time charting."""
        query = (
            select(TelemetryFrameModel)
            .where(TelemetryFrameModel.vehicle_id == vehicle_id)
            .order_by(desc(TelemetryFrameModel.timestamp))
            .limit(limit)
        )
        result = await self.session.execute(query)
        frames = list(result.scalars().all())
        frames.reverse()  # Return in chronological order
        return frames

    async def log_alert(
        self, vehicle_id: str, severity: str, fault_code: str, description: str
    ) -> AlertLogModel:
        """Log a battery diagnostic alert/fault."""
        alert = AlertLogModel(
            vehicle_id=vehicle_id,
            severity=severity,
            fault_code=fault_code,
            description=description,
            timestamp=datetime.now(timezone.utc),
        )
        self.session.add(alert)
        await self.session.commit()
        await self.session.refresh(alert)
        return alert

    async def get_active_alerts(self, vehicle_id: str) -> List[AlertLogModel]:
        """Fetch unacknowledged alert logs for a vehicle."""
        query = (
            select(AlertLogModel)
            .where(
                AlertLogModel.vehicle_id == vehicle_id,
                AlertLogModel.acknowledged == False,
            )
            .order_by(desc(AlertLogModel.timestamp))
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())
