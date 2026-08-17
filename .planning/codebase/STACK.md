# Tech Stack

*Last mapped: 2026-08-17*

## Languages & Runtimes
- **TypeScript**: `5.8.2` — Primary language for frontend SPA and Node server (`server.ts`, `src/**/*.tsx`)
- **Python**: `3.10+` — Machine Learning service and model training backend (`backend/app.py`, `backend/train_models.py`)
- **JavaScript (ES Modules)**: `Node.js v22+` target environment for Express middleware and Vite dev server

## Frontend Stack
- **Framework**: `React 19.0.1` — Single Page Application (SPA) declarative UI (`src/App.tsx`, `src/EvBmsPlatform.tsx`)
- **Build Tool / Dev Server**: `Vite 6.2.3` with `@vitejs/plugin-react 5.0.4`
- **Styling**: `TailwindCSS 4.1.14` with `@tailwindcss/vite` and `autoprefixer 10.4.21` (`src/index.css`)
- **Animation**: `Motion 12.23.24` (Framer Motion derivative) for dynamic drawer and UI micro-interactions
- **Data Visualization**: `Recharts 3.10.1` for real-time telemetry charts and battery degradation curves
- **Icons**: `Lucide React 0.546.0`

## Backend & API Stack
- **Node.js Gateway / Middleware**: `Express 4.21.2` (`server.ts`)
  - Proxies ML prediction routes (`/predict/*`) to Python FastAPI backend at `http://127.0.0.1:8000`
  - Serves static assets and Vite SPA in production
  - Directly provides preset data (`/api/presets`), live telemetry generation (`/api/telemetry`), and XAI analysis endpoints (`/api/explain-degradation`, `/api/chat-digital-doctor`)
- **Python ML Inference Backend**: `FastAPI 0.110+` & `Uvicorn` (`backend/app.py`, `backend/routes/predict.py`)
  - Provides REST endpoints for State of Health (SoH), Remaining Useful Life (RUL), anomaly detection, capacity fade, and charging classification

## Machine Learning & AI
- **LLM Integration**: `@google/genai 2.4.0` — Integration with `gemini-3.6-flash` for Explainable AI (XAI) degradation breakdown and Digital Doctor interactive chat assistant
- **ML Frameworks**:
  - `scikit-learn`: Random Forest Regressor/Classifier, Isolation Forest anomaly detector
  - `XGBoost`: Gradient boosting classifiers and regressors (`soh_model_xgb.joblib`, `rul_model_xgb.joblib`, `charging_class_model_xgb.joblib`)
- **Data Handling & Serialization**: `NumPy`, `Pandas`, `Joblib`

## Build & Tooling
- **Bundler & Compiler**: `esbuild 0.25.0` for bundling `server.ts` into Node CJS (`dist/server.cjs`), `tsc` for type checking (`pyrightconfig.json`, `tsconfig.json`)
- **Development Execution**: `tsx 4.21.0` for running `server.ts` with hot reloading
