"""
Audit log repository for database operations.

Provides data access methods for the audit_logs table, enabling
querying and persistence of API audit trail entries.
"""
from typing import List

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models import AuditLogModel
from backend.db.repositories.base import BaseRepository


class AuditRepository(BaseRepository[AuditLogModel]):
    """Repository for audit log operations."""

    def __init__(self, session: AsyncSession):
        super().__init__(AuditLogModel, session)

    async def get_recent_logs(self, limit: int = 100, offset: int = 0) -> List[AuditLogModel]:
        """Fetch recent audit log entries ordered by timestamp descending."""
        query = (
            select(AuditLogModel)
            .order_by(desc(AuditLogModel.timestamp))
            .offset(offset)
            .limit(limit)
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_by_user(self, user_id: str, limit: int = 100) -> List[AuditLogModel]:
        """Fetch audit logs for a specific user."""
        query = (
            select(AuditLogModel)
            .where(AuditLogModel.user_id == user_id)
            .order_by(desc(AuditLogModel.timestamp))
            .limit(limit)
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_by_request_id(self, request_id: str) -> List[AuditLogModel]:
        """Fetch audit logs for a specific request ID."""
        query = (
            select(AuditLogModel)
            .where(AuditLogModel.request_id == request_id)
            .order_by(desc(AuditLogModel.timestamp))
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())
