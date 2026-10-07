# Known Limitations, Simulation Boundaries & Fallback Inventory

**AI-Driven Battery Intelligence Platform (EVBMS)**  
*Transparent accounting of current project scope, simulated elements, and fallback mechanisms.*

---

## 1. Simulated vs Hardware Elements

| System Area | Real / Production Implementation | Simulated / Test Mocking in Current Demo |
|---|---|---|
| **BMS Hardware Interface** | Real serial/CAN bus parsing algorithms and data models (`backend/services/soc_ekf.py`, `backend/schemas/battery.py`) are fully production-grade. | Physical hardware CAN bus transceivers (e.g. MCP2515, PEAK-System PCAN) are simulated by `server/index.js` WebSocket emitter generating physical current/voltage transients. |
| **Battery Cell Aging Data** | Grounded in real empirical laboratory cycling data from the **NASA Ames Prognostics Center of Excellence** (B0005, B0006, B0007, B0018 lithium-ion cells cycled to 80% EOL under controlled ambient temperatures). | High-cycle multi-year fleets (e.g. 500–1000 operational cycles) use synthetic physical degradation trajectory extrapolations conforming to NASA non-linear capacity knees and SEI impedance growth. |
| **Fault Injection** | Fault detection and early-warning lead time engines execute production algorithms (`backend/services/anomaly.py`). | Physical faults (thermal runaway heating at +0.2°C/s, internal resistance jump to 38.5 mΩ, voltage sag under acceleration burst) are generated through synthetic fault-injection profiles (`backend/training/fault_injection_benchmark.py`). |
| **Multi-Vehicle Telematics** | Complete relational and time-series schemas with PostgreSQL / TimescaleDB support and JWT authentication. | Five commercial vehicles are pre-seeded in local SQLite/PostgreSQL by `backend/db/seed_demo_data.py` rather than continuously communicating with external telematics APIs. |

---

## 2. Inventory of Fallback Formulas & Offline Degradation Paths

The platform adheres to a zero-failure defensive design principle: every ML and cloud dependency has a deterministic, physics-grounded offline fallback to prevent system crashes or unhandled 500 errors.

### 2.1. State of Health (SoH) Fallback
- **Primary Path:** Scikit-learn / XGBoost model (`soh_model_xgb.joblib`) trained via LOBO cross-validation using non-leaky operational features (`cycle`, `voltage`, `temperature`).
- **Fallback Trigger:** If the `.joblib` binary is missing or corrupted.
- **Fallback Implementation:** Quadratic NASA B0005 regression curve in `backend/services/soh.py`:
  $$\text{SoH}_{\text{fallback}} = 1.0 - 0.00045 \cdot \text{cycle} - 1.2 \times 10^{-6} \cdot \text{cycle}^2$$
  *Enforces a monotonic lower bound of 0.60 (60% SoH).*

### 2.2. Remaining Useful Life (RUL) Fallback
- **Primary Path:** Quantile Gradient Boosting regressors (`rul_model_xgb.joblib` / `rul_quantile_*.joblib`) predicting 5th, 50th, and 95th percentiles.
- **Fallback Trigger:** If the `.joblib` binary is missing or corrupted.
- **Fallback Implementation:** Linear extrapolation from current SoH to the 80% EOL warranty boundary in `backend/services/rul.py`:
  $$\Delta \text{SoH}_{\text{per\_cycle}} = \frac{100.0 - \text{SoH}}{\max(1, \text{cycle})}$$
  $$\text{RUL}_{\text{fallback}} = \max\left(0, \frac{\text{SoH} - 80.0}{\max(0.0001, \Delta \text{SoH}_{\text{per\_cycle}})}\right)$$
  *Assumes standard $\pm 15\%$ symmetric interval for lower/upper bounds in fallback mode.*

### 2.3. Digital Doctor AI Assistant Fallback
- **Primary Path:** Google Gemini 2.5 Flash via `google-genai` SDK using a system prompt strictly grounded in TreeSHAP attributions and pack telemetry.
- **Fallback Trigger:** If `GEMINI_API_KEY` is unset, invalid, rate-limited, or network connectivity is unavailable.
- **Fallback Implementation:** Deterministic offline electrochemistry template engine in `backend/services/xai_explainer.py`. Generates domain-expert explanations directly from Shapley attributions, cell temperature thresholds, and charging rules. Tested with zero network dependency.

### 2.4. Telemetry Anomaly Detection Fallback
- **Primary Path:** Supervised XGBoost classifier (`telemetry_anomaly_model.joblib`) combined with unsupervised Isolation Forest (`telemetry_isolation_forest.joblib`).
- **Fallback Trigger:** If model binaries are not present.
- **Fallback Implementation:** Independent deterministic physical safety rule engine in `backend/services/anomaly.py`:
  - Thermal runaway boundary: $\ge 55^\circ\text{C}$ (critical), $\ge 42^\circ\text{C}$ (watch).
  - Internal resistance threshold: $> 35\text{ m}\Omega$ (critical), $> 25\text{ m}\Omega$ (watch).
  - Cell imbalance: $> 50\text{ mV}$ delta between maximum and minimum cell.
  - Under-voltage cutoff: $< 2.6\text{ V/cell}$ (critical), $< 3.0\text{ V/cell}$ (watch).

---

## 3. Scope Boundaries & Future Hardware Integration

1. **Ambient Temperature Variations:**
   - The NASA dataset was collected primarily at fixed room temperature ($24^\circ\text{C}$) with elevated thermal cycles ($43^\circ\text{C}$). Extreme arctic conditions (e.g. $-20^\circ\text{C}$ cold-cranking and regenerative braking limitations) use electrochemical temperature coefficient models rather than measured -20°C NASA cycle runs.
2. **Cell Balancing Actuation:**
   - The platform accurately detects and highlights cell-level voltage imbalances ($> 50\text{ mV}$) in `<CellGridMonitor />` and flags them in the triage queue, but passive/active cell bleeding resistor actuation is not physically triggered on real hardware.
3. **Hardware BMS Flashing:**
   - Recommendations and alarms are surfaced via REST API and WebSocket to cloud/edge dashboards. Flashing updated firmware calibration tables over CAN bus (UDS protocol ISO 14229) is out of scope for the software platform.
