# Phase 6: Automated Testing & Verification Suite - Research

*Researched: 2026-08-17*

## Key Test Architecture & Command Execution

### 1. Pytest Backend Execution
Python virtualenv path: `c:\Users\Ravula Sairam\Downloads\ev-battery-intelligence-platform\.venv\Scripts\python.exe`

Command:
```bash
& "c:\Users\Ravula Sairam\Downloads\ev-battery-intelligence-platform\.venv\Scripts\python.exe" -m pytest tests/
```

### 2. Frontend Vitest Execution
Command:
```bash
npm run test -- --run
```
(or `npx vitest run`)

### 3. End-to-End Pipeline Verification Script (`scripts/verify_pipeline.py`)
Command:
```bash
& "c:\Users\Ravula Sairam\Downloads\ev-battery-intelligence-platform\.venv\Scripts\python.exe" scripts/verify_pipeline.py
```

## Validation Architecture

### Verification Commands
- Backend: `pytest tests/`
- Frontend: `npm run build` & `vitest run`
- E2E: `python scripts/verify_pipeline.py`
