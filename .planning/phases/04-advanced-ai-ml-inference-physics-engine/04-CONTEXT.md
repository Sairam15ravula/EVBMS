# Phase 4: Advanced AI/ML Inference & Physics Engine - Context

**Gathered:** 2026-08-17  
**Status:** Ready for planning  

<domain>
## Phase Boundary

This phase delivers production-grade physics + machine learning battery intelligence models:
1. Extended Kalman Filter (EKF) State of Charge (SoC) estimator.
2. Evaluated XGBoost vs. Random Forest State of Health (SoH) and Remaining Useful Life (RUL) forecasters.
3. Dual-engine rule-based + Isolation Forest anomaly isolation.
4. Grounded Gemini Explainable AI (XAI) degradation factor analysis.

</domain>

<decisions>
## Technical & ML Validation Constraints

### 1. Extended Kalman Filter (EKF) Parameterization & Chemistry Metadata
- **Module**: `backend/services/soc_ekf.py`
- **State Vector**: \(x_k = [z_k, v_{rc,k}]^T\), where \(z_k \in [0, 1]\) is State of Charge, and \(v_{rc,k}\) is RC polarization voltage.
- **Process Model**:
  - \(z_k = z_{k-1} - \frac{\eta \cdot \Delta t}{Q_{max}} I_k\)
  - \(v_{rc,k} = e^{-\Delta t / (R_1 C_1)} v_{rc,k-1} + R_1 (1 - e^{-\Delta t / (R_1 C_1)}) I_k\)
- **Measurement Model**: \(y_k = OCV(z_k, \text{chemistry}) - I_k R_0 - v_{rc,k}\)
- **Sign Convention**: Discharge \(I_k > 0\), Charge \(I_k < 0\). Sampling interval \(\Delta t = 1.0\text{s}\).
- **Chemistry Support**: Requires explicit `chemistry` metadata (`NMC` or `LFP`) with 1D interpolated OCV-SoC lookup tables. Does NOT default silently.
- **Covariances**: \(P_0 = \text{diag}(10^{-4}, 10^{-4})\), \(Q = \text{diag}(10^{-7}, 10^{-5})\), \(R = 10^{-3}\).
- **Target Accuracy**: MAE < 1.5%, RMSE < 2.0%, Max Absolute Error < 3.5% across dynamic profiles.

### 2. Prevents Data Leakage & Evaluates Production Candidates
- **Dataset Splitting**: Cell/pack-level grouping (GroupKFold or battery ID split) in `backend/train_models.py` so telemetry rows from the same pack never appear in both train and test sets.
- **RUL Definition**: Remaining cycles or estimated operating years until reaching the 80.0% EOL capacity threshold (\(SoH = 80.0\%\)).
- **Model Evaluation**: `train_models.py` trains both Random Forest and XGBoost for SoH and RUL, evaluates MAE, RMSE, and R², and selects the winning candidate based on validation metrics.

### 3. Shared Feature Pipeline & Model Metadata Schemas
- **Feature Pipeline**: Standardized pipeline (`['voltage', 'current', 'temperature', 'cycleCount', 'nominalCapacity', 'currentCapacity', 'internalResistance']`) with explicit units, median imputation, standard scaling, and versioning tag `v1.0`.
- **Model Metadata**: Sidecar JSON (`<model>_metadata.json`) storing model name, version, dataset, training timestamp, validation metrics (MAE, RMSE, R²), feature schema version, and SHA256 checksum.

### 4. Rule-Based Safety Engine Independence & Configurable Thresholds
- Rule-based safety checks (thermal warnings, voltage sags, cell imbalance) operate independently from Isolation Forest ML scores. ML anomaly scores supplement safety rules, but CANNOT override or clear a safety rule violation.
- 55°C is treated as a configurable `CRITICAL_THERMAL_WARNING` threshold (not automatically thermal runaway).
- Cell voltage delta (default 50mV) and resistance spike thresholds (default 35mΩ) are configurable per vehicle/chemistry configuration.

### 5. Grounded Gemini XAI Engine & Configurable Environment Variable
- **Module**: `backend/services/xai_explainer.py`
- Uses configurable `GEMINI_MODEL` environment variable (defaults to `gemini-3.6-flash`).
- Prompts explicitly restrict Gemini to explaining evidence provided by the physics/ML pipeline. Gemini is forbidden from fabricating unmeasured physical percentages.

### 6. Safe Model Loader & Architecture Preservation
- `backend/services/model_loader.py` validates model existence and SHA256 checksums. If missing or invalid, exposes `model_ready: False` and activates deterministic physical fallback models.
- Reuses Phase 1 ORM/repositories, Phase 2 JWT/RBAC middleware, and Phase 3 REST routes.

</decisions>

<canonical_refs>
## Canonical References

- `backend/train_models.py` — Model training script with cell-level train/test split and XGBoost vs RF selection
- `backend/services/soc_ekf.py` — Extended Kalman Filter physics implementation
- `backend/services/model_loader.py` — Centralized model loader & metadata provider
- `backend/services/anomaly.py` — Independent safety rule & Isolation Forest anomaly engine
- `backend/services/xai_explainer.py` — Grounded Gemini XAI engine
- `backend/routes/predict.py` — Inference routes
- `.planning/REQUIREMENTS.md` — ML-01 through ML-05 requirements

</canonical_refs>

---
*Phase: 04-advanced-ai-ml-inference-physics-engine*
