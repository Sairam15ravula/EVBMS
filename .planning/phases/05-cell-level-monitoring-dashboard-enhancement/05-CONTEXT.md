# Phase 5: Cell-Level Monitoring & Dashboard Enhancement - Context

**Gathered:** 2026-08-17  
**Status:** Ready for planning  

<domain>
## Phase Boundary

This phase elevates the frontend UI user experience:
1. Dynamic, chemistry-aware cell-level monitoring grid (`CellGridMonitor.tsx`).
2. Client-side WebSocket telemetry integration (`src/services/telemetrySocket.ts`) connected to Express Gateway.
3. Multi-vehicle side-by-side comparison analytics (`BmsComparison.tsx`) backed by Phase 3 REST APIs.
4. Grounded Digital Doctor AI assistant drawer (`DigitalDoctorDrawer.tsx`).

</domain>

<decisions>
## Technical & UI Architecture Constraints

### 1. Configurable Cell Count & Module Layout
- `CellGridMonitor.tsx` supports configurable cell counts (e.g. 96, 108, 192) and module arrangements derived dynamically from `vehicle.battery_pack.cell_count` metadata. Cell counts are NOT hardcoded.

### 2. Chemistry-Aware Thresholds (NMC vs. LFP)
- Thresholds are chemistry-aware (`NMC` vs `LFP`):
  - **NMC**: Nominal ~3.70V, Max 4.20V, Min 3.00V, Max Temp 55°C.
  - **LFP**: Nominal ~3.20V, Max 3.65V, Min 2.50V, Max Temp 60°C.
- Thresholds are driven by battery metadata, not blindly hardcoded.

### 3. Backend Safety State is Authoritative
- Backend physics/ML safety state (`healthMetrics.anomalies`, Phase 4 `check_independent_safety_rules`) is authoritative. The frontend visualizes state and does NOT independently redefine safety classifications.

### 4. Explicit WebSocket Boundary
- Express Node server (`server.ts` & `src/services/websocketServer.ts`) owns the WebSocket server.
- React UI contains strictly a WebSocket client service (`src/services/telemetrySocket.ts` / `useWebSocketTelemetry.ts`). No WebSocket server is created in React.

### 5. Centralized Live Telemetry & REST Separation
- Live streaming telemetry flows over WebSocket (`/ws/telemetry`).
- Historical telemetry data queries use FastAPI REST endpoint `GET /api/telemetry/history/{vehicle_id}` (Phase 3). Large historical datasets are NOT sent over WebSockets.
- Client state updates selectively to prevent full dashboard re-renders.

### 6. Grounded Digital Doctor & Vehicle Comparison APIs
- Digital Doctor assistant consumes evidence produced by the physics/ML layer (`xai_explainer.py` & `/api/chat-digital-doctor`).
- `BmsComparison.tsx` queries vehicle metadata from backend `/api/vehicles` API rather than static inline cards.
- Scenario stress controls are clearly labeled as "Simulations / Estimated Impact" separate from actual measured RUL predictions.

### 7. Schema & Architecture Preservation
- Reuses Phase 1-4 Pydantic schemas, TypeScript types (`BatteryTelemetry`, `HealthMetrics`), JWT/RBAC middleware, and ORM repositories.

</decisions>

<canonical_refs>
## Canonical References

- `src/EvBmsPlatform.tsx` — Main dashboard container
- `src/services/telemetrySocket.ts` — React WebSocket client service
- `src/components/CellGridMonitor.tsx` — Configurable cell grid component
- `src/components/BmsComparison.tsx` — Multi-vehicle comparison component
- `.planning/REQUIREMENTS.md` — UI-01 through UI-05 requirements

</canonical_refs>

---
*Phase: 05-cell-level-monitoring-dashboard-enhancement*
