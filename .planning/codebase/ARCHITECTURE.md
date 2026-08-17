# System Architecture

*Last mapped: 2026-08-17*

## Architecture Overview
The **EV Battery Intelligence Platform** is built using a hybrid 3-tier architecture:
1. **Frontend Presentation Tier**: React SPA with real-time battery telemetry visualization, interactive diagnostic drawers, and Explainable AI (XAI) breakdown cards.
2. **BMS API Gateway & Node.js Middleware**: Express server handling static asset serving, preset/telemetry API orchestration, and Google Gemini 3.6 Flash AI integration.
3. **Python ML Analytics & Inference Service**: FastAPI service executing machine learning models (XGBoost, Random Forest, Isolation Forest) trained on EV battery aging datasets.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        React Single Page App                           │
│                (src/EvBmsPlatform.tsx & components/*)                   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / JSON
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     Express API Gateway (server.ts)                   │
│                                                                        │
│ ┌───────────────────────────┐         ┌──────────────────────────────┐ │
│ │ Telemetry & Presets API   │         │  Google Gemini 3.6 Flash     │ │
│ │ (/api/telemetry, etc.)    │         │  XAI & Digital Doctor        │ │
│ └───────────────────────────┘         └──────────────────────────────┘ │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Proxy (/predict/*)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   FastAPI ML Backend (backend/app.py)                  │
│                                                                        │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────────────┐ │
│ │  SoH Model   │ │  RUL Model   │ │ Anomaly Model│ │ Capacity / Charge│ │
│ │  (XGBoost)   │ │  (XGBoost)   │ │(Iso Forest)  │ │ (Random Forest) │ │
│ └──────────────┘ └──────────────┘ └──────────────┘ └─────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

## Layer Breakdown

### 1. Presentation & Client Layer (`src/`)
- **Main View (`src/EvBmsPlatform.tsx`)**: Controls dashboard state (vehicle selection, scenario preset, timestep animation, tab selection).
- **Core Components (`src/components/`)**:
  - `Header.tsx`: System title, status pill, vehicle selector, and scenario presets.
  - `MetricCards.tsx`: Displays key parameters (SoH %, RUL, Voltage, Current, Temperature, SoC).
  - `TelemetryChart.tsx` & `DegradationChart.tsx`: Recharts time-series data visualizations.
  - `XaiAnalysisCard.tsx`: Displays physical degradation drivers, risk breakdown, and action plan.
  - `DigitalDoctorDrawer.tsx`: Slide-over chatbot powered by Gemini API.
  - `BmsComparison.tsx`: Side-by-side comparison of active vehicle vs baseline/competing pack.

### 2. Gateway & AI Service Layer (`server.ts`)
- **Static & Vite Dev Middleware**: Serves production build files from `dist/` or attaches Vite middleware during development.
- **Mock & Data Services**: Calls `analyticsEngine.ts` to compute health metrics (SoH, RUL cycles, thermal stress factors).
- **Gemini LLM Integration**: Formats battery telemetry into structured system prompts and schemas for Gemini 3.6 Flash.
- **FastAPI Reverse Proxy**: Intercepts `/predict/*` routes and proxies them directly to port 8000.

### 3. Machine Learning Inference Service (`backend/`)
- **FastAPI Application (`backend/app.py`)**: Entry point with CORS middleware and startup event model loader (`services/_loader.py`).
- **Endpoints (`backend/routes/predict.py`)**:
  - `POST /predict/soh`: Predicts battery State of Health percentage based on cycle, voltage, temperature, current capacity.
  - `POST /predict/rul`: Predicts Remaining Useful Life cycles and year count until 80% EOL.
  - `POST /predict/anomaly`: Uses Isolation Forest & XGBoost anomaly probability to detect battery cell imbalance or thermal runaway risk.
  - `POST /predict/capacity`: Predicts capacity fade curve.
  - `POST /predict/charging`: Classifies charging behavior (Standard AC, Fast DC, Ultra-fast DC).
  - `POST /predict/all`: Aggregates all predictions in a single API request.
- **Services (`backend/services/`)**: Individual service modules wrapping joblib model invocation with mathematical fallback functions if models are un-trained.

## Key Design Abstractions & Patterns
- **Fallback Resilience**: Both Node Express (Gemini XAI) and Python FastAPI (ML models) implement fallback logic if API keys or `.joblib` model binaries are missing.
- **Lazy Initialization**: Gemini SDK client is lazily instantiated upon first API call to prevent startup crashes when `GEMINI_API_KEY` is not set.
- **Preset Data Engine (`src/data/batteryData.ts`)**: Pre-configured battery chemistries (`NMC`, `LFP`, `Solid-State`) and stress scenarios (`healthy-new`, `fast-charge-heavy`, `thermal-stress`, `cold-weather`).
