"""
Telemetry ingestion and bounded historical query API routes.
"""
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models import TelemetryFrameModel
from backend.db.repositories.telemetry_repo import TelemetryRepository
from backend.db.session import get_async_session
from backend.schemas.fleet import TelemetryFrameResponse, TelemetryIngestRequest

router = APIRouter(prefix="/api/telemetry", tags=["telemetry"])


@router.post("/ingest", response_model=TelemetryFrameResponse, status_code=status.HTTP_201_CREATED)
async def ingest_telemetry_frame(
    req: TelemetryIngestRequest, session: AsyncSession = Depends(get_async_session)
):
    """Ingest a live telemetry frame and persist to TimescaleDB hypertable."""
    telemetry_repo = TelemetryRepository(session)
    frame_dict = req.model_dump()
    frame = await telemetry_repo.insert_frame(frame_dict)

    # Automatically evaluate and persist diagnostic alerts from telemetry
    try:
        from backend.services.alert_engine import generate_alerts_from_telemetry
        alerts = generate_alerts_from_telemetry(frame_dict)
        for a in alerts:
            await telemetry_repo.log_alert(
                vehicle_id=a["vehicle_id"],
                severity=a["severity"],
                fault_code=a["fault_code"],
                description=a["description"],
            )
    except Exception as e:
        print(f"[telemetry-ingest] Alert generation error: {e}")

    return frame


@router.get("/history/{vehicle_id}", response_model=List[TelemetryFrameResponse])
async def get_telemetry_history(
    vehicle_id: str,
    start_time: Optional[datetime] = Query(default=None, description="ISO Start Timestamp filter"),
    end_time: Optional[datetime] = Query(default=None, description="ISO End Timestamp filter"),
    limit: int = Query(default=100, le=1000, description="Max telemetry records to return (max 1000)"),
    offset: int = Query(default=0, ge=0, description="Pagination offset"),
    session: AsyncSession = Depends(get_async_session),
):
    """Query bounded historical telemetry frames for a vehicle asset."""
    query = select(TelemetryFrameModel).where(TelemetryFrameModel.vehicle_id == vehicle_id)

    if start_time:
        query = query.where(TelemetryFrameModel.timestamp >= start_time)
    if end_time:
        query = query.where(TelemetryFrameModel.timestamp <= end_time)

    query = query.order_by(desc(TelemetryFrameModel.timestamp)).offset(offset).limit(limit)
    result = await session.execute(query)
    frames = list(result.scalars().all())
    frames.reverse()  # Return in chronological order
    return frames
