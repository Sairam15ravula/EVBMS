# Phase 3: Production Backend APIs & Streaming Gateway - Context

**Gathered:** 2026-08-17  
**Status:** Ready for planning  

<domain>
## Phase Boundary

This phase establishes production-grade REST API endpoints for vehicle fleet management, battery pack diagnostics, alert history pagination, real-time WebSocket / SSE telemetry streaming, and middleware for rate limiting and API health monitoring across Express and FastAPI services.

</domain>

<decisions>
## Implementation Decisions

### Real-Time Telemetry Streaming
- Use **WebSocket (ws)** server integrated with Node Express (`server.ts` or `http.createServer(app)`).
- Provide real-time channel `/ws/telemetry` broadcasting live battery telemetry frames to connected clients at configurable intervals (e.g., 1s).

### FastAPI Production Fleet APIs
- **Vehicle Routes (`/api/vehicles`)**:
  - `GET /api/vehicles`: List all vehicles (supports filtering by owner / organization).
  - `POST /api/vehicles`: Create new vehicle asset.
  - `GET /api/vehicles/{id}`: Fetch vehicle details with associated battery pack.
  - `DELETE /api/vehicles/{id}`: Delete vehicle asset.
- **Battery Pack Routes (`/api/packs`)**:
  - `GET /api/packs`: List battery pack specifications.
  - `GET /api/packs/{id}`: Fetch specific pack metadata.
- **Alert Log Routes (`/api/alerts`)**:
  - `GET /api/alerts`: List diagnostic alert logs with pagination (`limit`, `offset`) and filter by `severity` and `vehicle_id`.
  - `PATCH /api/alerts/{id}/acknowledge`: Mark alert log as acknowledged.
- **Telemetry History Routes (`/api/telemetry/history`)**:
  - `GET /api/telemetry/history/{vehicle_id}`: Fetch historical telemetry frames over a date range.

### Rate Limiting & Resilience
- Express Middleware: `express-rate-limit` protecting API routes against abuse (e.g., 100 requests per 15 minutes per IP).
- FastAPI Middleware: `slowapi` or custom sliding window rate limiter.
- Health Check: `GET /api/health` providing system uptime, database status, and ML model loading state.

</decisions>

<canonical_refs>
## Canonical References

- `server.ts` — Existing Express server and Vite middleware
- `backend/app.py` — FastAPI application entrypoint
- `backend/db/repositories/` — Repository access layer created in Phase 1
- `backend/middleware/auth.py` — JWT and RBAC security middleware created in Phase 2
- `.planning/REQUIREMENTS.md` — BACK-01 through BACK-04 requirements

</canonical_refs>

---
*Phase: 03-production-backend-apis-streaming-gateway*
