# Technical Debt & Areas of Concern

*Last mapped: 2026-08-17*

## Known Technical Debt & Security Concerns

### 1. Hardcoded Localhost Loopback Proxy Target (`server.ts`)
- **Issue**: `server.ts` proxies `/predict/*` to `http://127.0.0.1:8000` via hardcoded string URL.
- **Risk**: In containerized (Docker / Kubernetes) or production cloud deployments, the FastAPI service will reside at a different hostname/port.
- **Remediation**: Introduce a `FASTAPI_BACKEND_URL` environment variable defaulting to `http://127.0.0.1:8000`.

### 2. Open CORS Access in FastAPI (`backend/app.py`)
- **Issue**: `app.add_middleware(CORSMiddleware, allow_origins=["*"])` allows requests from any origin.
- **Risk**: Cross-origin security vulnerability if deployed publicly.
- **Remediation**: Restrict `allow_origins` to configured frontend domain in production environment variables.

### 3. Model Dependency & Cold Startup Behavior (`backend/services/`)
- **Issue**: Trained `.joblib` binaries (`soh_model_xgb.joblib`, `rul_model_xgb.joblib`, etc.) must exist in `backend/models/`.
- **Risk**: If a developer checks out the repository without running `python backend/train_models.py`, predictions will silently fall back to simplified physics formulas.
- **Remediation**: Ensure binary models are tracked via Git LFS or automated in a pre-start build script.

### 4. API Key Verification & Fallback Feedback (`server.ts`)
- **Issue**: When `GEMINI_API_KEY` is missing or invalid, Gemini LLM calls return mock fallback responses without visually alerting the dashboard user that they are in fallback mode.
- **Remediation**: Expose a health/config indicator to the frontend so users know whether Gemini AI responses are live or simulated.

### 5. Large Single-File Components (`src/EvBmsPlatform.tsx`)
- **Issue**: `src/EvBmsPlatform.tsx` is ~1,100 lines long and handles state, tab management, preset loading, timestep rendering, and UI presentation simultaneously.
- **Risk**: Difficult to maintain or test individual dashboard views independently.
- **Remediation**: Refactor `EvBmsPlatform.tsx` into sub-views (e.g., `OverviewTab.tsx`, `DegradationTab.tsx`, `AnalyticsTab.tsx`).
