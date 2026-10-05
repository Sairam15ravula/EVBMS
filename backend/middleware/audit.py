"""
Audit logging middleware for tracking all mutating API calls.

Logs every POST, PUT, PATCH, and DELETE request with user identity,
HTTP method, path, request ID, response status, and duration. Entries
are persisted to the audit_logs database table for compliance and
forensic analysis.
"""
import time
from datetime import datetime, timezone
from typing import Optional

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from backend.middleware.request_id import request_id_context
from backend.utils.logger import get_logger

logger = get_logger(__name__)

# HTTP methods that modify server state
MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


class AuditLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware that logs all mutating API calls to the audit trail."""

    async def dispatch(self, request: Request, call_next) -> Response:
        # Skip non-mutating methods
        if request.method not in MUTATING_METHODS:
            return await call_next(request)

        request_id = request_id_context.get() or request.headers.get("X-Request-ID", "unknown")
        user_id = await self._extract_user_id(request)
        start_time = time.time()

        response = await call_next(request)

        duration_ms = (time.time() - start_time) * 1000

        audit_entry = {
            "user_id": user_id or "anonymous",
            "method": request.method,
            "path": request.url.path,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "request_id": request_id,
            "status_code": response.status_code,
            "duration_ms": round(duration_ms, 2),
        }

        # Structured log entry
        logger.info("Audit log entry", extra={"audit": audit_entry})

        # Persist to database (non-blocking — failures must not break the request)
        try:
            await self._store_audit_log(audit_entry)
        except Exception as e:
            logger.warning(f"Failed to store audit log: {e}")

        return response

    async def _extract_user_id(self, request: Request) -> Optional[str]:
        """Extract user ID from the Authorization Bearer token."""
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return None
        token = auth_header[7:]
        try:
            from backend.services.auth import decode_token
            payload = decode_token(token)
            if payload:
                return payload.get("sub")
        except Exception:
            pass
        return None

    async def _store_audit_log(self, audit_entry: dict) -> None:
        """Persist audit log entry to the database."""
        from backend.db.session import async_session_factory
        from backend.db.repositories.audit_repo import AuditRepository

        async with async_session_factory() as session:
            repo = AuditRepository(session)
            await repo.create(
                user_id=audit_entry["user_id"],
                method=audit_entry["method"],
                path=audit_entry["path"],
                request_id=audit_entry["request_id"],
                status_code=audit_entry["status_code"],
                duration_ms=audit_entry["duration_ms"],
            )
