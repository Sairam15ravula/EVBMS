# Phase 6: Automated Testing & Verification Suite - Context

**Gathered:** 2026-08-17  
**Status:** Ready for planning  

<domain>
## Phase Boundary

This final phase establishes full test automation across backend microservices, ML model inference engines, physics Extended Kalman Filters, database persistence layers, React frontend components, and full end-to-end telemetry-to-ML system integration.

</domain>

<decisions>
## Implementation Decisions

### 1. Pytest Backend Suite (`tests/test_api.py`, `tests/test_models.py`, `tests/test_ekf.py`, `tests/test_db.py`) (TEST-01)
- Unit tests for 1RC Extended Kalman Filter (`soc_ekf.py`): verify state vector convergence, NMC vs LFP OCV lookup tables, MAE < 1.5%, RMSE < 2.0%.
- Unit tests for SHA256 Model Loader (`model_loader.py`): verify checksum validation, sidecar metadata parsing, and deterministic physical fallbacks when model binary is unready.
- API integration tests for FastAPI REST routes (`/predict/soc-ekf`, `/api/auth/*`, `/api/vehicles/*`, `/api/telemetry/*`, `/api/alerts/*`).
- Repository tests using SQLAlchemy async session mocks or test database.

### 2. Frontend Component & Integration Tests (`src/__tests__/`) (TEST-02)
- Vitest / React Testing Library tests for `CellGridMonitor.tsx`, `Header.tsx`, `BmsComparison.tsx`, and `DigitalDoctorDrawer.tsx`.
- WebSocket client service unit test (`telemetrySocket.ts`).

### 3. End-to-End System Verification Script (`scripts/verify_pipeline.py`) (TEST-03)
- Standalone executable script that:
  1. Checks backend `/api/health` aggregated status across FastAPI, Express, DB, and ML services.
  2. Sends real-time telemetry frame to WebSocket gateway (`ws://localhost:3000/ws/telemetry`).
  3. Verifies telemetry frame ingestion and database persistence via FastAPI history endpoint.
  4. Triggers `POST /predict/soc-ekf` and validates EKF SoC response.
  5. Asserts full pipeline execution passes cleanly with 0 errors.

</decisions>

<canonical_refs>
## Canonical References

- `backend/services/soc_ekf.py` — 1RC EKF SoC estimator
- `backend/services/model_loader.py` — SHA256 model loader
- `backend/routes/` — FastAPI REST endpoints
- `src/components/` — React UI components
- `server.ts` — Express gateway server

</canonical_refs>

---
*Phase: 06-automated-testing-verification-suite*
