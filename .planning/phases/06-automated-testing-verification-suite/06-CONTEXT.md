# Phase 6: Automated Testing & Verification Suite - Context

**Gathered:** 2026-08-17  
**Status:** Ready for planning  

<domain>
## Phase Boundary

This phase delivers an enterprise-grade, automated testing and verification suite across backend microservices, ML model inference engines, Extended Kalman Filters, database persistence layers, React frontend components, and full end-to-end telemetry-to-ML system pipeline verification with GitHub Actions CI automation.

</domain>

<decisions>
## 16 Explicit Testing & Verification Requirements

### 1. SoC Metric Reconciliation
- Acceptance criteria: MAE <= 2.0% and RMSE <= 2.0% (preferred target MAE <= 1.5%), using Phase 4 1RC EKF validation methodology.

### 2. Isolated Database for Integration Tests
- Use isolated database connections for repository/database integration tests. Use mocks only for unit-level isolation.

### 3. Accurate E2E Telemetry Pathway
- E2E ingestion follows Phase 3 production architecture: `POST /api/telemetry` FastAPI endpoint ingests frames into TimescaleDB/PostgreSQL, and Express WebSocket gateway broadcasts frames to `/ws/telemetry`.

### 4. Extended E2E Pipeline Scope
- E2E pipeline tests SoC (EKF), SoH (XGBoost), RUL (XGBoost), Anomaly Detection (Isolation Forest + Physical Safety Rules), and XAI structured/fallback output.

### 5. Offline Gemini Fallback Testing
- Default automated test suite runs WITHOUT requiring `GEMINI_API_KEY`, exercising `xai_explainer.py` deterministic fallback. Live Gemini API tests are optional.

### 6. Model-Quality Validation Tests
- Add Pytest model quality tests validating metrics (SoH RMSE < 3.0%, RUL RMSE < 50 cycles, Anomaly F1/Precision) matching Phase 4 criteria.

### 7. Leakage Prevention Verification
- Verify that ML train/test splits occur strictly at the battery/cell level (`GroupKFold`) and zero telemetry rows leak between train and test packs.

### 8. Model Loader Failure Case Matrix
- Test `model_loader.py` failure cases: correct checksum, incorrect checksum, corrupted model binary, missing model, missing metadata JSON, invalid metadata JSON, and deterministic physics fallbacks.

### 9. WebSocket Resilience Testing
- Add tests for connection, disconnection, exponential backoff, reconnection, malformed JSON frames, missing fields, and server unavailability.

### 10. Frontend Component Behavioral Tests
- Add Vitest tests for `CellGridMonitor.tsx` (normal/imbalanced/critical states, voltage/thermal views, cell detail modal) and `telemetrySocket.ts` (live stream updates, disconnected state).

### 11. Digital Doctor AI Tests
- Add tests for `DigitalDoctorDrawer.tsx` covering anomaly-driven quick actions, conversation persistence across toggles, API error handling, and offline fallback behavior.

### 12. Auth & RBAC Matrix Tests
- Test authentication and RBAC endpoints covering unauthenticated (401), invalid JWT, expired JWT, viewer, operator, and admin access roles.

### 13. GitHub Actions CI Pipeline Automation
- Create `.github/workflows/ci.yml` running backend tests, frontend tests, ML validation, production builds, database integration tests, and E2E verification.

### 14. CodeRabbit Review Compatibility
- Ensure CI workflow and PR structure are compatible with CodeRabbit automated code review.

### 15. Architecture Preservation & Conflict Checks
- Zero architectural conflicts found across Phase 1-5 implementations. Preserve existing API contracts.

### 16. Final Verification Report
- Produce a final `VERIFICATION.md` report showing test counts, pass/fail status, ML metrics, EKF metrics, and E2E pipeline status.

</decisions>

<canonical_refs>
## Canonical References

- `backend/services/soc_ekf.py` — 1RC EKF SoC estimator
- `backend/services/model_loader.py` — SHA256 model loader
- `backend/routes/` — FastAPI REST endpoints
- `src/components/` — React UI components
- `server.ts` — Express gateway server
- `.github/workflows/ci.yml` — GitHub Actions CI pipeline

</canonical_refs>

---
*Phase: 06-automated-testing-verification-suite*
