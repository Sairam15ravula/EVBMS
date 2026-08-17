# Phase 3: Production Backend APIs & Streaming Gateway - Context

**Gathered:** 2026-08-17  
**Status:** Ready for planning  

<domain>
## Phase Boundary

This phase establishes production-grade REST API endpoints, real-time WebSocket telemetry streaming, rate limiting middleware, and health monitoring across the Express Gateway and FastAPI application services.

</domain>

<decisions>
## Implementation Decisions & Architectural Constraints

### 1. Gateway & Service Ownership Boundaries
- **Express Node Gateway (`server.ts`)**: Owns static SPA serving, proxying, rate limiting, health aggregation, and real-time WebSocket streaming (`/ws/telemetry`).
- **FastAPI Application Backend (`backend/app.py`)**: Owns all production REST APIs, fleet CRUD, diagnostic alert history, historical telemetry queries, and ML prediction services.

### 2. Real-Time Transport Specification
- **WebSocket is the ONLY real-time transport in Phase 3**; SSE (Server-Sent Events) will NOT be implemented.
- WebSocket endpoint is strictly `/ws/telemetry`.

### 3. Telemetry Schema & Data Flow Architecture
- **Single Authoritative Schema**: All telemetry frames conform 1:1 to the Phase 1 `TelemetryFrameModel` (`timestamp`, `vehicle_id`, `voltage`, `current`, `temperature`, `soc`, `soh`, `internal_resistance`, `cell_voltages`, `active_anomalies`) and frontend `BatteryTelemetry` interface.
- **Telemetry Ingestion & Persistence Path**: Live telemetry frames generated or received by the Express gateway are broadcast over WebSocket to connected clients AND posted/persisted to PostgreSQL/TimescaleDB via FastAPI / `TelemetryRepository.insert_frame()`. No competing sources of truth or duplicate telemetry generators.

### 4. Health Aggregation & Readiness Monitoring (`/api/health`)
- Express owns the public `GET /api/health` endpoint and returns an aggregated status response:
  - Gateway metrics (uptime, active WebSocket connections count, connection limits).
  - FastAPI status (proxied query to `http://127.0.0.1:8000/`).
  - Database connectivity readiness (`database_configured: true`).
  - ML model readiness (`models_loaded` status dict).

### 5. Rate Limiting & Connection Throttling
- **REST Endpoints**: Protected via `express-rate-limit` (HTTP request limit, e.g. 100 requests / 15 mins per IP).
- **WebSocket Gateway (`/ws/telemetry`)**: Enforces separate connection limits (max 50 concurrent connections) and per-connection message rate limits (max 10 incoming messages/sec per socket).

### 6. Bounded Historical Telemetry Queries
- `GET /api/telemetry/history/{vehicle_id}` requires bounded query parameters: `start_time` (optional ISO timestamp), `end_time` (optional ISO timestamp), `limit` (default 100, max 1000), `offset` (default 0).

### 7. Alert Acknowledgement & RBAC Security
- `PATCH /api/alerts/{id}/acknowledge` reuses Phase 2 JWT security and RBAC middleware (`get_current_user` & `require_role(["admin", "fleet_manager", "technician"])`). Drivers cannot acknowledge alerts.

### 8. Repository Layer Reuse
- All FastAPI endpoints strictly reuse Phase 1 `BaseRepository`, `UserRepository`, `VehicleRepository`, and `TelemetryRepository` in `backend/db/repositories/`. No duplicate SQL queries or parallel ORM patterns.

</decisions>

<canonical_refs>
## Canonical References

- `server.ts` — Express gateway & static asset server
- `backend/app.py` — FastAPI REST & ML application backend
- `backend/db/models.py` — Phase 1 SQLAlchemy ORM models (`TelemetryFrameModel`, `AlertLogModel`, etc.)
- `backend/db/repositories/` — Phase 1 Repository access layer (`TelemetryRepository`, `VehicleRepository`)
- `backend/middleware/auth.py` — Phase 2 JWT security & `require_role` middleware
- `.planning/REQUIREMENTS.md` — BACK-01 through BACK-04 requirements

</canonical_refs>

---
*Phase: 03-production-backend-apis-streaming-gateway*
