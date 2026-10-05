"""
Request ID middleware for generating and propagating X-Request-ID headers.

Generates a unique request ID for each incoming request (or propagates an
existing one from the client), stores it in a context variable for access
by downstream components (logging, audit, etc.), and adds it to the
response headers.
"""
import uuid
from contextvars import ContextVar
from typing import Optional

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

# Context variable to store the current request ID for logging and auditing
request_id_context: ContextVar[Optional[str]] = ContextVar("request_id", default=None)


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Middleware that generates or propagates the X-Request-ID header."""

    async def dispatch(self, request: Request, call_next) -> Response:
        # Propagate client-supplied request ID or generate a new one
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request_id_context.set(request_id)

        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response
