"""
Diagnostic alert logs and fault code management router.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models import AlertLogModel, UserModel
from backend.db.session import get_async_session
from backend.middleware.auth import require_role
from backend.schemas.fleet import AlertAcknowledgeResponse, AlertLogResponse

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("", response_model=List[AlertLogResponse])
async def list_alert_logs(
    vehicle_id: Optional[str] = Query(default=None, description="Filter alerts by vehicle ID"),
    severity: Optional[str] = Query(default=None, description="Filter by severity: info, warning, critical"),
    unacknowledged_only: bool = Query(default=False, description="Filter unacknowledged alerts"),
    limit: int = Query(default=50, le=500),
    offset: int = Query(default=0),
    session: AsyncSession = Depends(get_async_session),
):
    """Fetch paginated battery diagnostic alert logs with optional filters."""
    query = select(AlertLogModel)

    if vehicle_id:
        query = query.where(AlertLogModel.vehicle_id == vehicle_id)
    if severity:
        query = query.where(AlertLogModel.severity == severity)
    if unacknowledged_only:
        query = query.where(AlertLogModel.acknowledged == False)

    query = query.order_by(desc(AlertLogModel.timestamp)).offset(offset).limit(limit)
    result = await session.execute(query)
    return list(result.scalars().all())


class AlertCreateRequest(BaseModel):
    vehicle_id: str
    severity: str = "warning"
    fault_code: str
    description: str


@router.post("", response_model=AlertLogResponse, status_code=status.HTTP_201_CREATED)
async def create_alert(
    req: AlertCreateRequest,
    session: AsyncSession = Depends(get_async_session),
):
    """Create and persist a diagnostic alert log in the database."""
    import uuid
    from datetime import datetime, timezone

    alert = AlertLogModel(
        id=str(uuid.uuid4()),
        timestamp=datetime.now(timezone.utc),
        vehicle_id=req.vehicle_id,
        severity=req.severity,
        fault_code=req.fault_code,
        description=req.description,
        acknowledged=False,
    )
    session.add(alert)
    await session.commit()
    await session.refresh(alert)
    return alert


@router.patch("/{alert_id}/acknowledge", response_model=AlertAcknowledgeResponse)
async def acknowledge_alert(
    alert_id: str,
    current_user: UserModel = Depends(require_role(["admin", "fleet_manager", "technician"])),
    session: AsyncSession = Depends(get_async_session),
):
    """Mark a diagnostic alert log as acknowledged (Requires Admin, Fleet Manager, or Technician role)."""
    alert = await session.get(AlertLogModel, alert_id)
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert log '{alert_id}' not found.",
        )

    alert.acknowledged = True
    await session.commit()
    await session.refresh(alert)

    return AlertAcknowledgeResponse(
        id=alert.id,
        acknowledged=True,
        acknowledged_by=current_user.email,
        message=f"Alert '{alert_id}' acknowledged by {current_user.role} ({current_user.email}).",
    )
