# Phase 6: Automated Testing & Verification Suite - Validation Strategy

*Created: 2026-08-17*

## Must-Have Verification Criteria

1. **Pytest Backend & ML Suite (TEST-01)**:
   - `tests/test_ekf.py`: EKF SoC MAE <= 2.0% (target <= 1.5%), RMSE <= 2.0%.
   - `tests/test_models.py`: SHA256 checksum validator & failure matrix (corrupted model, bad checksum, missing metadata).
   - `tests/test_api.py`: FastAPI REST routes & RBAC auth matrix.
   - `tests/test_db.py`: Database integration tests.
   - `tests/test_data_leakage.py`: Cell-grouped train/test split verification.

2. **Frontend UI & Service Suite (TEST-02)**:
   - `src/__tests__/CellGridMonitor.test.tsx`: Cell grid state rendering, voltage/thermal view toggles, cell modal.
   - `src/__tests__/telemetrySocket.test.ts`: WebSocket client state updates and disconnection resilience.
   - `src/__tests__/DigitalDoctorDrawer.test.tsx`: Offline fallback & prompt suggested actions.

3. **End-to-End System Pipeline Verification (TEST-03)**:
   - `scripts/verify_pipeline.py` executes cleanly without requiring `GEMINI_API_KEY`, asserting SoC, SoH, RUL, Anomaly, and XAI fallback pipeline.

4. **GitHub Actions CI Automation**:
   - `.github/workflows/ci.yml` passes all workflow jobs cleanly.

## Automated Verification Steps
- Backend: `pytest tests/`
- Frontend: `npx vitest run` & `npm run build`
- E2E: `python scripts/verify_pipeline.py`
