# Phase 6: Automated Testing & Verification Suite - Research

*Researched: 2026-08-17*

## Key Test Automation Architecture

### 1. Pytest Backend Test Execution
Python virtualenv path: `c:\Users\Ravula Sairam\Downloads\ev-battery-intelligence-platform\.venv\Scripts\python.exe`

Command:
```bash
& "c:\Users\Ravula Sairam\Downloads\ev-battery-intelligence-platform\.venv\Scripts\python.exe" -m pytest tests/
```

### 2. Frontend Vitest Test Execution
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

### 4. GitHub Actions CI Configuration (`.github/workflows/ci.yml`)
Runs automated backend pytest, frontend vitest, ML validation, build verification, and E2E pipeline runner on pull requests and pushes to `main`.

## Validation Architecture

### Verification Commands
- Backend Pytest: `pytest tests/`
- Frontend Vitest: `npx vitest run`
- E2E Runner: `python scripts/verify_pipeline.py`
- Build Verification: `npm run build`
