# Phase 3: Production Backend APIs & Streaming Gateway - Validation Strategy

*Created: 2026-08-17*

## Must-Have Verification Criteria

1. **FastAPI Production REST Contracts (BACK-01)**:
   - All REST routes return standard JSON responses and OpenAPI documentation is generated at `/docs`.
   - Input validation catches invalid parameters and returns 422 Unprocessable Entity.

2. **Real-Time WebSocket Telemetry Streaming (BACK-02)**:
   - Express server manages `/ws/telemetry` WebSocket endpoint exclusively (no SSE).
   - Telemetry frames conform 1:1 to Phase 1 `TelemetryFrameModel` schema.
   - Connection limits (max 50) and per-socket message rate limits (10 msg/sec) are enforced.

3. **Fleet, Alert & Bounded Telemetry APIs (BACK-03)**:
   - `GET /api/vehicles`, `POST /api/vehicles`, `GET /api/alerts`, `PATCH /api/alerts/{id}/acknowledge` function cleanly.
   - `PATCH /api/alerts/{id}/acknowledge` requires JWT token with `admin`, `fleet_manager`, or `technician` role via Phase 2 `require_role` middleware.
   - Historical telemetry query `GET /api/telemetry/history/{vehicle_id}` supports `start_time`, `end_time`, `limit` (max 1000), and `offset`.

4. **Health Check & Rate Limiting (BACK-04)**:
   - Express `GET /api/health` reports uptime, active WebSocket connections, Express rate limiting state, and proxied FastAPI / database / ML readiness metrics.
   - Express rate limiter throttles HTTP requests exceeding 100 req/15min.

## Automated Verification Steps
- Endpoint status verification via curl and test scripts.
