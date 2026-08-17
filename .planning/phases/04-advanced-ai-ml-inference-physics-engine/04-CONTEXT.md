# Phase 4: Advanced AI/ML Inference & Physics Engine - Context

**Gathered:** 2026-08-17  
**Status:** Ready for planning  

<domain>
## Phase Boundary

This phase delivers production physics + machine learning battery intelligence models, including an Extended Kalman Filter (EKF) State of Charge (SoC) estimator, XGBoost/Random Forest State of Health (SoH) and Remaining Useful Life (RUL) forecasters, Isolation Forest anomaly isolation, and Gemini XAI degradation factor analysis.

</domain>

<decisions>
## Implementation Decisions

### 1. Hybrid Extended Kalman Filter (EKF) + Coulomb Counting SoC Estimator
- Module: `backend/services/soc_ekf.py`
- Algorithm: Equivalent Circuit Model (ECM) 1RC parameterization:
  - Predict step: \(x_{k|k-1} = x_{k-1} - \frac{\eta \cdot I_k \cdot \Delta t}{Q_{max}}\)
  - Open Circuit Voltage (OCV) lookup curve for NMC and LFP chemistries.
  - State covariance update with voltage measurement innovation residual.
- Target SoC error: < 2.0% under dynamic current load.

### 2. Model Loader & Versioning Architecture (ML-01)
- Module: `backend/services/model_loader.py`
- Pre-loads trained `.joblib` model binaries at FastAPI startup with fallback to physical electrochemical equations if model file is missing or corrupted.
- Support model version tagging (`v1.0.0`) and runtime model metadata reporting.

### 3. Aging Benchmarks (NASA B0005 & CALCE) & ML Training Refinement (ML-03)
- Models trained in `backend/train_models.py`:
  - `soh_model_xgb.joblib` & `rul_model_xgb.joblib` (XGBoost Regressor)
  - `telemetry_isolation_forest.joblib` (Isolation Forest Anomaly Isolation)
  - `charging_class_model_xgb.joblib` (Charging Mode Classifier)
- Feature Engineering: Capacity fade, internal resistance growth (\(\Delta R\)), temperature stress integral, cumulative throughput (Ah).

### 4. Real-Time Battery Anomaly Isolation (ML-04)
- Module: `backend/services/anomaly.py`
- Dual-engine isolation: Threshold-based rule engine (thermal runaway > 55°C, cell delta > 50mV, resistance spike > 40mΩ) combined with Isolation Forest outlier score.

### 5. Gemini 3.6 Flash Explainable AI (XAI) Engine (ML-05)
- Module: `backend/services/xai_explainer.py`
- Leverages Gemini structured outputs to break down physical degradation into percentage contributions (SEI growth, lithium plating, thermal stress) with fallback resilience when API key is unconfigured.

</decisions>

<canonical_refs>
## Canonical References

- `backend/train_models.py` — Model training script using NASA B0005 dataset
- `backend/services/` — Inference service wrappers (`soh.py`, `rul.py`, `anomaly.py`, `capacity.py`, `charging.py`)
- `backend/routes/predict.py` — FastAPI inference endpoints
- `.planning/REQUIREMENTS.md` — ML-01 through ML-05 requirements

</canonical_refs>

---
*Phase: 04-advanced-ai-ml-inference-physics-engine*
