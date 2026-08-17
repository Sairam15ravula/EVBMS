# Phase 5: Cell-Level Monitoring & Dashboard Enhancement - Validation Strategy

*Created: 2026-08-17*

## Must-Have Verification Criteria

1. **Configurable & Chemistry-Aware Cell Grid (UI-01)**:
   - `CellGridMonitor.tsx` renders dynamic cell count (e.g., 96, 108, 192) and module layout based on battery metadata.
   - Thresholds adapt dynamically between NMC (4.2V max) and LFP (3.65V max).

2. **Client-Side WebSocket Service (UI-02)**:
   - `telemetrySocket.ts` manages client connection to `/ws/telemetry` without spawning a WebSocket server in React.
   - Selective subscription updates metric cards without triggering full dashboard re-renders.

3. **Separation of WebSocket vs. REST Transport**:
   - Live telemetry streams over WebSocket; historical telemetry data uses FastAPI `GET /api/telemetry/history/{vehicle_id}` REST endpoint.

4. **Grounded AI Doctor & API Vehicle Comparison (UI-04, UI-05)**:
   - Digital Doctor AI consumes physics/ML evidence.
   - Vehicle comparison queries backend `/api/vehicles` REST endpoint.
   - RUL scenario controls are explicitly labeled as "Simulations / Estimated Impact".

## Automated Verification Steps
- Build verification: `npm run build`
