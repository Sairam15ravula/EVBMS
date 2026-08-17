# Phase 4: Advanced AI/ML Inference & Physics Engine - Research

*Researched: 2026-08-17*

## Key Technical Decisions & Equations

### 1. Extended Kalman Filter (EKF) Discrete State Space Formulation
- **State Vector**: \(x_k = [z_k, v_{rc,k}]^T\) where \(z_k\) is SoC (0.0 to 1.0) and \(v_{rc,k}\) is polarization voltage.
- **Process Equations**:
  \[
  z_k = z_{k-1} - \frac{\eta \Delta t}{Q_{max}} I_k
  \]
  \[
  v_{rc,k} = e^{-\Delta t / \tau} v_{rc,k-1} + R_1 (1 - e^{-\Delta t / \tau}) I_k
  \]
- **Jacobian Matrix \(F_k\)**:
  \[
  F_k = \begin{bmatrix} 1 & 0 \\ 0 & e^{-\Delta t / \tau} \end{bmatrix}
  \]
- **Measurement Matrix \(H_k\)**:
  \[
  H_k = \begin{bmatrix} \frac{\partial OCV(z)}{\partial z}\Big|_{z_{k|k-1}} & -1 \end{bmatrix}
  \]
- **Innovation & Kalman Gain**:
  \[
  y_k = V_{meas,k} - \left( OCV(z_{k|k-1}, \text{chem}) - I_k R_0 - v_{rc,k|k-1} \right)
  \]
  \[
  S_k = H_k P_{k|k-1} H_k^T + R, \quad K_k = P_{k|k-1} H_k^T S_k^{-1}
  \]
  \[
  x_{k|k} = x_{k|k-1} + K_k y_k, \quad P_{k|k} = (I - K_k H_k) P_{k|k-1}
  \]

### 2. Group-Based Splitting & Model Selection Protocol
- In `backend/train_models.py`, dataset split MUST be cell/battery pack grouped:
  ```python
  from sklearn.model_selection import GroupKFold
  # Split by battery_id so telemetry rows from the same pack never bleed into test set
  ```
- Models evaluated: Random Forest (`RandomForestRegressor`) vs XGBoost (`XGBRegressor`). Candidate with lower RMSE/MAE on test set is selected and serialized.

### 3. Model Metadata Schema (`<model_name>_metadata.json`)
```json
{
  "model_name": "soh_model_xgb",
  "version": "1.0.0",
  "algorithm": "XGBRegressor",
  "dataset": "NASA_B0005_CALCE_Augmented",
  "feature_schema_version": "v1.0",
  "training_timestamp": "2026-08-17T19:48:00Z",
  "validation_metrics": {
    "mae": 0.42,
    "rmse": 0.58,
    "r2": 0.982
  },
  "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}
```

## Validation Architecture

### Verification Commands
- `python backend/train_models.py`
