# Phase 4: Advanced AI/ML Inference & Physics Engine - Validation Strategy

*Created: 2026-08-17*

## Must-Have Verification Criteria

1. **Explicit EKF Accuracy Verification (ML-02)**:
   - Evaluated against dynamic load profiles for both NMC and LFP chemistries.
   - Target metrics: MAE < 1.5%, RMSE < 2.0%, Max Error < 3.5%.

2. **No Data Leakage & Model Candidate Selection (ML-03)**:
   - `backend/train_models.py` uses battery pack ID grouping (no row-level leakage).
   - Random Forest and XGBoost evaluated side-by-side; winning model auto-selected based on lower validation RMSE.

3. **Shared Feature Pipeline & Sidecar Metadata (ML-01)**:
   - Shared feature pipeline with standard scaling and median imputation.
   - Sidecar `<model>_metadata.json` generated with algorithm, features, validation metrics, and SHA256 checksum.

4. **Independent Safety Engine & Configurable Thresholds (ML-04)**:
   - Rule-based safety checks operate independently from Isolation Forest ML scores.
   - 55°C treated as configurable critical thermal warning (not runaway).
   - Voltage delta & resistance thresholds configurable per vehicle configuration.

5. **Grounded Gemini XAI Engine (ML-05)**:
   - Gemini XAI uses configurable `GEMINI_MODEL` env var.
   - Prompt restricts explanations strictly to observed inputs from physics/ML pipeline without fabricating unmeasured physical percentages.

6. **Safe Model Loader & Deterministic Fallbacks**:
   - `model_loader.py` checks file presence and SHA256 checksums. If unready, exposes `model_ready: False` and invokes tested physical fallbacks.

## Automated Verification Steps
- Run model training script `python backend/train_models.py`.
