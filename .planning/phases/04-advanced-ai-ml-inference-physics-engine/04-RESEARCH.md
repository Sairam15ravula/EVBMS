# Phase 4: Advanced AI/ML Inference & Physics Engine - Research

*Researched: 2026-08-17*

## Key Technical Decisions & Physics Equations

### 1. Extended Kalman Filter (EKF) SoC Estimation Equations
- **State Vector**: \(x_k = [SoC_k, V_{rc,k}]^T\)
- **State Transition Matrix**:
  \[
  x_k = \begin{bmatrix} 1 & 0 \\ 0 & e^{-\Delta t / (R_1 C_1)} \end{bmatrix} x_{k-1} + \begin{bmatrix} -\frac{\eta \Delta t}{Q_{nominal}} \\ R_1 (1 - e^{-\Delta t / (R_1 C_1)}) \end{bmatrix} I_k
  \]
- **Measurement Equation**:
  \[
  V_k = OCV(SoC_k) - I_k R_0 - V_{rc,k} + v_k
  \]

### 2. Isolation Forest Anomaly Detection Strategy
- Predict anomaly score \(s(x, n) = 2^{-\frac{E(h(x))}{c(n)}}\). Scores > 0.6 indicate isolated abnormal battery telemetry frames.

### 3. Model Loader Fallback Contract
- `model_loader.py` checks for binary existence. If absent, fallback math is invoked:
  - SoH Fallback: \(SoH = \frac{C_{current}}{C_{nominal}} \times 100\%\)
  - RUL Fallback: \(RUL_{cycles} = \max(0, \frac{SoH - 80.0}{0.015})\)

## Validation Architecture

### Verification Commands
- `python backend/train_models.py`
- `pytest tests/test_models.py`
