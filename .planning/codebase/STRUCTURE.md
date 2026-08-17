# Repository Structure & Organization

*Last mapped: 2026-08-17*

## Directory Layout

```
ev-battery-intelligence-platform/
├── server.ts                  # Node.js Express Gateway, Gemini LLM API & Vite Server
├── package.json               # Node.js dependencies & scripts
├── requirements.txt           # Python root dependencies
├── vite.config.ts             # Vite bundler configuration
├── tsconfig.json              # TypeScript compiler configuration
├── pyrightconfig.json         # Python language server config
├── .env.example               # Environment variables template
│
├── src/                       # Frontend React 19 Single Page Application
│   ├── main.tsx               # React DOM rendering entrypoint
│   ├── App.tsx                # App root wrapper & layout container
│   ├── EvBmsPlatform.tsx      # Main EV Battery Intelligence Dashboard
│   ├── types.ts               # Shared TypeScript interface & type definitions
│   ├── index.css              # Global styles & Tailwind imports
│   ├── components/            # Reusable UI dashboard components
│   │   ├── Header.tsx         # Top bar, vehicle & scenario selectors
│   │   ├── MetricCards.tsx    # Key metric cards (SoH, RUL, V, I, Temp, SoC)
│   │   ├── TelemetryChart.tsx # Live telemetry time-series line chart
│   │   ├── DegradationChart.tsx # SoH & Capacity degradation projection chart
│   │   ├── XaiAnalysisCard.tsx # Explainable AI degradation factors & risk levels
│   │   ├── DigitalDoctorDrawer.tsx # Gemini AI chatbot drawer
│   │   ├── BmsComparison.tsx  # Side-by-side vehicle BMS comparison view
│   │   ├── AlertFeed.tsx      # Battery anomaly & fault warning alerts
│   │   └── SmartRecommendations.tsx # Operational recommendations feed
│   ├── data/                  # Data models & telemetry generators
│   │   └── batteryData.ts     # Vehicle presets, scenario presets, telemetry simulation
│   └── utils/                 # Analytics helper functions
│       └── analyticsEngine.ts # Battery health calculation algorithms
│
├── backend/                   # Python FastAPI ML Backend & Training Pipeline
│   ├── app.py                 # FastAPI application & startup event model loader
│   ├── train_models.py        # Complete ML model training script
│   ├── requirements.txt       # Python backend dependencies
│   ├── routes/                # API router handlers
│   │   └── predict.py         # POST /predict/* endpoints (soh, rul, anomaly, etc.)
│   ├── schemas/               # Pydantic schemas for request validation
│   │   └── battery.py         # Request & response data models
│   ├── services/              # ML model inference wrappers with fallback logic
│   │   ├── _loader.py         # Centralized joblib model loader
│   │   ├── soh.py             # State of Health model service
│   │   ├── rul.py             # Remaining Useful Life model service
│   │   ├── anomaly.py         # Telemetry anomaly & Isolation Forest service
│   │   ├── capacity.py        # Capacity fade prediction service
│   │   └── charging.py        # Charging classification service
│   ├── models/                # Binary model storage (.joblib files)
│   └── training/              # Data generation and batch model training
│       ├── generate_synthetic_data.py # NASA B0005 aging dataset generator
│       └── train_all.py       # Batch training executor
│
└── datasets/                  # Datasets storage directory (NASA / CALCE battery data)
```

## Key File Locations & Entry Points
- **Node Gateway / Full Stack Dev Entry**: `server.ts`
- **Frontend App Entry**: `src/main.tsx` -> `src/App.tsx` -> `src/EvBmsPlatform.tsx`
- **FastAPI ML Backend Entry**: `backend/app.py`
- **Model Training Pipeline**: `backend/train_models.py`
- **API Request Validation**: `backend/schemas/battery.py`
- **Frontend Type Definitions**: `src/types.ts`
- **Battery Presets & Simulation Data**: `src/data/batteryData.ts`

## Naming Conventions
- **TypeScript Components**: PascalCase (`MetricCards.tsx`, `XaiAnalysisCard.tsx`)
- **TypeScript Utilities / Modules**: camelCase (`analyticsEngine.ts`, `batteryData.ts`)
- **Python Files & Services**: snake_case (`train_models.py`, `predict.py`, `generate_synthetic_data.py`)
- **API Routes**: kebab-case (`/api/explain-degradation`, `/predict/soh`, `/predict/all`)
