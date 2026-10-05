# AI-Driven EV Battery Intelligence Platform

An advanced AI-Driven Battery Intelligence Platform that goes beyond conventional Battery Management Systems (BMS). It leverages Machine Learning, Time Series Analytics, and Explainable AI (XAI) to accurately estimate State of Charge (SoC), State of Health (SoH), and Remaining Useful Life (RUL), detects anomalies to predict failures before they occur, recommends optimal charging strategies, visualizes battery health and trends in interactive dashboards, and features an AI assistant grounded in battery telemetry.

Target users:
- **EV Owners**: Personal battery health, real-time SoC/range, intelligent charging advice, safety alerts.
- **Fleet Operators**: Multi-vehicle health ranking, fleet SoH distribution, risk prioritization, predictive service scheduling.
- **Service Centers**: Deep diagnostic scans, cell-level telemetry inspection, degradation trends, anomaly history, and physics-informed remediation plans.

---

## Architecture Overview

```
ev-battery-intelligence-platform/
├── backend/                  # FastAPI REST API & AI Inference Engine
│   ├── app.py                # Application entrypoint & CORS middleware
│   ├── db/                   # SQLAlchemy models, SQLite/PostgreSQL async engine, migrations
│   ├── models/               # Pinned .joblib ML binaries & SHA256 sidecar metadata JSONs
│   ├── routes/               # API endpoints (/predict, /api/auth, /api/vehicles, /api/alerts)
│   ├── schemas/              # Pydantic data validation contracts
│   ├── services/             # SoC EKF, SoH/RUL inference, anomaly detection, XAI explainer
│   └── training/             # Retraining pipelines (train_models.py, evaluate.py)
├── src/                      # React 19 + TypeScript frontend with Tailwind CSS
│   ├── App.tsx               # Root component & role-based routing
│   ├── EvBmsPlatform.tsx     # Unified platform UI
│   ├── components/           # CellGridMonitor, EvDiagnosticScan, SmartRecommendations, etc.
│   └── context/              # AuthContext and role management
├── datasets/                 # NASA B0005, CALCE, and real-world EV battery telemetry datasets
├── tests/                    # Backend test suite (pytest)
├── server.ts                 # Express & WebSocket telemetry streaming server
├── requirements.txt          # Fully pinned Python dependencies
└── package.json              # Frontend scripts and dependencies
```

---

## Prerequisites

- **Python**: 3.12+ (tested with Python 3.12 and 3.14)
- **Node.js**: 18+ and npm
- **Operating System**: Windows / Linux / macOS

---

## Quickstart Setup & Run

### 1. Environment Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Key environment variables:
| Variable | Description | Default |
| --- | --- | --- |
| `GEMINI_API_KEY` | Optional: Gemini API key for natural language explanations (gracefully falls back to deterministic rule/SHAP engine if omitted) | `""` |
| `DATABASE_URL` | Async database URL (SQLite or PostgreSQL) | `sqlite+aiosqlite:///backend/ev_bms.db` |
| `SECRET_KEY` | JWT signing secret for RBAC authentication | `dev-secret-key-change-in-production-only` |
| `PORT` | Frontend Express / WebSocket port | `3000` |
| `BACKEND_PORT` | FastAPI backend port | `8000` |
| `VITE_BACKEND_URL`| Frontend target for FastAPI API calls | `http://localhost:8000` |
| `VITE_WS_URL` | Frontend WebSocket connection string | `ws://localhost:3000` |

### 2. Backend Setup (Python)

Create and activate a virtual environment, then install dependencies:

```bash
# Windows (PowerShell)
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Linux / macOS
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3. Frontend Setup (Node.js)

```bash
npm install
```

---

## Model Training & Retraining

Models are trained using cell-level grouping (GroupKFold) to prevent cross-cycle data leakage, and saved under pinned scikit-learn (`1.9.1`) with SHA256 integrity checksums and sidecar metadata JSONs:

```bash
# Using npm
npm run train

# Or using Python directly
python backend/training/train_models.py

# Or using Makefile
make train
```

Trained models generated in `backend/models/`:
- `soh_model_xgb.joblib` + `soh_model_xgb_metadata.json`
- `rul_model_xgb.joblib` + `rul_model_xgb_metadata.json`
- `charging_class_model_xgb.joblib` + `charging_class_model_xgb_metadata.json`
- `telemetry_isolation_forest.joblib` + `telemetry_isolation_forest_metadata.json`
- `telemetry_anomaly_model.joblib` + `telemetry_anomaly_model_metadata.json`
- `capacity_fade_model.joblib` + `capacity_fade_model_metadata.json`

---

## Running the Platform

You can run both services concurrently:

### Terminal 1: Backend Service (FastAPI)
```bash
# Runs on http://localhost:8000
npm run dev:backend
# or: uvicorn backend.app:app --reload --port 8000
```
Interactive OpenAPI documentation is available at: `http://localhost:8000/docs`

### Terminal 2: Frontend & Telemetry Stream (Express + WebSocket + Vite)
```bash
# Runs on http://localhost:3000
npm run dev
# or: make dev
```

---

## Verification & Testing Suite

Run the full testing and quality assurance suite:

```bash
# Run backend pytest suite
pytest
# or: npm run test:backend

# Run frontend type checking
npx tsc --noEmit
# or: npm run typecheck

# Run frontend vitest suite
npx vitest run
# or: npm run test:frontend

# Build frontend production bundle
npx vite build
# or: npm run build
```

---

## User Roles & Capabilities

| Role | Access Scope | Key Features |
| --- | --- | --- |
| **EV Owner** | Single Vehicle | Live SoC %, Pack SOH %, Range remaining, Smart charging advisor, Safety alert feed |
| **Fleet Operator** | Entire Fleet | Fleet SOH distribution, Multi-vehicle risk ranking, Battery failure predictions, Fleet triage |
| **Service Center** | Deep Diagnostics | 96/192 cell voltage/temp heatmap, Internal resistance degradation, Anomaly root-cause analysis, XAI assistant |
