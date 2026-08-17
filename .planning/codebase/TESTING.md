# Testing & Verification Setup

*Last mapped: 2026-08-17*

## Type Checking & Linting

### Frontend & Node Gateway Type Checking
- **Command**: `npm run lint`
- **Underlying Tool**: `tsc --noEmit`
- **Config**: `tsconfig.json`
- Verifies full type safety across React components (`src/**/*.tsx`), simulation data (`src/data/batteryData.ts`), and Express server (`server.ts`).

### Python Language Server & Type Verification
- **Tool**: `Pyright`
- **Config**: `pyrightconfig.json`
- Checks type consistency across FastAPI routes, Pydantic schemas, and ML training pipelines.

## Model Training & Verification Commands

### Synthetic Dataset Generation
- **Command**: `python backend/training/generate_synthetic_data.py`
- **Output**: Generates synthetic NASA B0005 aging datasets (`capacity_fade.csv`, `telemetry_anomaly.csv`, `charging_behavior.csv`, `battery_soh_rul.csv`) in `datasets/` directory.

### Full ML Model Training Suite
- **Command**: `python backend/train_models.py`
- **Output**: Trains and evaluates:
  1. XGBoost SoH Regressor (`soh_model_xgb.joblib`)
  2. XGBoost RUL Regressor (`rul_model_xgb.joblib`)
  3. Random Forest Anomaly Classifier (`telemetry_anomaly_model.joblib`) & Isolation Forest (`telemetry_isolation_forest.joblib`)
  4. Random Forest Capacity Fade Regressor (`capacity_fade_model.joblib`)
  5. XGBoost Charging Classifier (`charging_class_model_xgb.joblib`)
- Validates model metrics (R² score, MAE, MSE, Accuracy) and saves trained binaries to `backend/models/`.

## Manual & Endpoint Verification

### FastAPI Backend Health Verification
- **URL**: `http://127.0.0.1:8000/`
- **Response**:
  ```json
  {
    "status": "ok",
    "message": "AI-Driven Battery Intelligence Platform API",
    "models_loaded": {
      "soh_model_xgb.joblib": true,
      "rul_model_xgb.joblib": true,
      "telemetry_anomaly_model.joblib": true,
      "telemetry_isolation_forest.joblib": true,
      "capacity_fade_model.joblib": true,
      "charging_class_model_xgb.joblib": true
    }
  }
  ```

### Express Gateway Verification
- Presets: `GET http://localhost:3000/api/presets`
- Live Telemetry: `POST http://localhost:3000/api/telemetry`
- ML Proxy Test: `POST http://localhost:3000/predict/soh`
