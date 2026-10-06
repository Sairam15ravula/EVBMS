# Requirements Traceability & Audit Matrix

**Project Abstract:**
> An AI-Driven Battery Intelligence Platform that goes beyond a conventional BMS. It uses Machine Learning, Time Series Analytics and Explainable AI to estimate State of Charge (SoC), State of Health (SoH) and Remaining Useful Life (RUL), and detects anomalies to predict failures before they occur. It recommends optimal charging strategies, visualizes battery health and trends in interactive dashboards, and has an AI assistant that explains predictions. Target users: EV owners, fleet operators, service centers.

---

## 1. Traceability Matrix

| # | Abstract Promise | Implementation Files | API Endpoints | UI Components | Status | Gaps Identified & Remediation Plan |
|---|------------------|----------------------|---------------|---------------|:------:|-----------------------------------|
| **1** | **State of Charge (SoC) Estimation** | [soc_ekf.py](file:///C:/Users/Ravula%20Sairam/downloads/ev-battery-intelligence-platform/backend/services/soc_ekf.py)<br>[battery.py](file:///C:/Users/Ravula%20Sairam/downloads/ev-battery-intelligence-platform/backend/schemas/battery.py)<br>[predict.py](file:///C:/Users/Ravula%20Sairam/downloads/ev-battery-intelligence-platform/backend/routes/predict.py) | `POST /predict/soc-ekf`<br>`POST /predict/soc` | `<MetricCards />`<br>`<EvBmsPlatform />` | **Done** | Extended Kalman Filter (1RC ECM) evaluated against Coulomb counting baseline with current bias and initialization error. Bounds error to 2.69% RMSE vs 5.01% for Coulomb counting. |
| **2** | **State of Health (SoH) Estimation** | [soh.py](file:///C:/Users/Ravula%20Sairam/downloads/ev-battery-intelligence-platform/backend/services/soh.py)<br>[predict.py](file:///C:/Users/Ravula%20Sairam/downloads/ev-battery-intelligence-platform/backend/routes/predict.py)<br>[train_models.py](file:///C:/Users/Ravula%20Sairam/downloads/ev-battery-intelligence-platform/backend/training/train_models.py) | `POST /predict/soh`<br>`POST /predict/all` | `<EvBmsPlatform />`<br>`<DegradationChart />` | **Done** | Eliminated target leakage (`capacity` and `init_capacity` completely removed from features). LOBO cross-validation in `backend/training/evaluate.py` verifies superiority over baselines (MAE 2.05% vs 4.79% linear-in-cycle). Verified with 7 automated leakage unit tests. |
| **3** | **Remaining Useful Life (RUL) Prediction with Uncertainty** | [rul.py](file:///C:/Users/Ravula%20Sairam/downloads/ev-battery-intelligence-platform/backend/services/rul.py)<br>[predict.py](file:///C:/Users/Ravula%20Sairam/downloads/ev-battery-intelligence-platform/backend/routes/predict.py)<br>[train_models.py](file:///C:/Users/Ravula%20Sairam/downloads/ev-battery-intelligence-platform/backend/training/train_models.py) | `POST /predict/rul`<br>`POST /predict/all` | `<EvBmsPlatform />`<br>`<DegradationChart />` | **Done** | Quantile Gradient Boosting (5th, 50th, 95th percentiles) yields median RUL + monotonic 90% confidence interval. Evaluated with LOBO CV across all battery folds (MAE 13.09 cycles vs 39.59 cycles predict-the-mean). Rendered in MetricCards and DegradationChart. |
| **4** | **Anomaly Detection with Early Warning** | [anomaly.py](file:///C:/Users/Ravula%20Sairam/downloads/ev-battery-intelligence-platform/backend/services/anomaly.py)<br>[alert_engine.py](file:///C:/Users/Ravula%20Sairam/downloads/ev-battery-intelligence-platform/backend/services/alert_engine.py)<br>[alerts.py](file:///C:/Users/Ravula%20Sairam/downloads/ev-battery-intelligence-platform/backend/routes/alerts.py)<br>[models.py](file:///C:/Users/Ravula%20Sairam/downloads/ev-battery-intelligence-platform/backend/db/models.py) | `POST /predict/anomaly`<br>`GET /api/alerts`<br>`POST /api/alerts/ack/{id}` | `<AlertFeed />`<br>`<CellGridMonitor />`<br>`<EvBmsPlatform />` | **Done** | Dual-engine early warning: continuous anomaly score (0-100), categorical risk (`normal`/`watch`/`critical`), quantitative contributing signals, and physical lead-time tracking. Fault injection benchmark achieves 100.0% TPR across thermal rise, resistance jump, and voltage sag with 0.00% FPR on healthy data. Watch/critical alerts persist to DB and appear in AlertFeed. |
| **5** | **Optimal Charging Strategies Recommendation** | [charging.py](file:///C:/Users/Ravula%20Sairam/downloads/ev-battery-intelligence-platform/backend/services/charging.py)<br>[predict.py](file:///C:/Users/Ravula%20Sairam/downloads/ev-battery-intelligence-platform/backend/routes/predict.py) | `POST /predict/charging` | `<SmartRecommendations />`<br>`<EvBmsPlatform />` | **Partial** | **Gaps:** Currently only classifies past charging session types (e.g. `optimal`, `aggressive_fast`). Does NOT provide actionable forward-looking advice: target SoC window, suggested charge rate, plain-language reason based on SoH, temperature, degradation trend, or dual modes ("protect battery life" vs "need range soon").<br>**Phase 4 Fix:** Upgrade `backend/services/charging.py` with multi-mode recommendations, wire to `SmartRecommendations` UI, and add comprehensive unit tests for edge cases. |
| **6** | **Interactive Dashboards for Three User Types** | [App.tsx](file:///C:/Users/Ravula%20Sairam/downloads/ev-battery-intelligence-platform/src/App.tsx)<br>[EvBmsPlatform.tsx](file:///C:/Users/Ravula%20Sairam/downloads/ev-battery-intelligence-platform/src/EvBmsPlatform.tsx)<br>[AuthContext.tsx](file:///C:/Users/Ravula%20Sairam/downloads/ev-battery-intelligence-platform/src/context/AuthContext.tsx)<br>[auth.py](file:///C:/Users/Ravula%20Sairam/downloads/ev-battery-intelligence-platform/backend/routes/auth.py)<br>[vehicles.py](file:///C:/Users/Ravula%20Sairam/downloads/ev-battery-intelligence-platform/backend/routes/vehicles.py) | `POST /api/auth/login`<br>`POST /api/auth/register`<br>`GET /api/auth/me`<br>`GET /api/vehicles` | `<EvBmsPlatform />`<br>`<LoginModal />`<br>`<ProtectedRoute />`<br>`<EvDiagnosticScan />` | **Partial** | **Gaps:** Auth scaffolding exists, but role-tailored view routing is not segmented into the three distinct user personas: (1) EV Owner (my vehicle, charging advice, safety alerts), (2) Fleet Operator (fleet risk ranking, SoH distribution, service triage), (3) Service Center (deep scan, cell voltage/temp heatmap, anomaly history). Missing seed script for fresh demo accounts.<br>**Phase 6 Fix:** Implement distinct role-tailored views behind RBAC, seed demo accounts/data, add time-series trend charts. |
| **7** | **AI Assistant & Explainable AI (XAI)** | [xai_explainer.py](file:///C:/Users/Ravula%20Sairam/downloads/ev-battery-intelligence-platform/backend/services/xai_explainer.py)<br>[DigitalDoctorDrawer.tsx](file:///C:/Users/Ravula%20Sairam/downloads/ev-battery-intelligence-platform/src/components/DigitalDoctorDrawer.tsx)<br>[XaiAnalysisCard.tsx](file:///C:/Users/Ravula%20Sairam/downloads/ev-battery-intelligence-platform/src/components/XaiAnalysisCard.tsx) | `POST /predict/explain`<br>`POST /api/explain-degradation` | `<DigitalDoctorDrawer />`<br>`<XaiAnalysisCard />` | **Partial** | **Gaps:** Real TreeSHAP feature attributions for SoH, RUL, and anomaly predictions are missing. The assistant lacks strict grounding (saying "I don't know" when outside evidence), lacks multi-turn chat follow-ups, and lacks hallucination verification rejecting fabricated numbers.<br>**Phase 5 Fix:** Integrate `shap.TreeExplainer`, enforce strict grounding and deterministic fallback when `GEMINI_API_KEY` is unset, add hallucination verifier with automated tests. |
| **8** | **Time-Series Analytics** | [telemetry_repo.py](file:///C:/Users/Ravula%20Sairam/downloads/ev-battery-intelligence-platform/backend/db/repositories/telemetry_repo.py)<br>[telemetry.py](file:///C:/Users/Ravula%20Sairam/downloads/ev-battery-intelligence-platform/backend/routes/telemetry.py)<br>[batteryData.ts](file:///C:/Users/Ravula%20Sairam/downloads/ev-battery-intelligence-platform/src/data/batteryData.ts)<br>[analyticsEngine.ts](file:///C:/Users/Ravula%20Sairam/downloads/ev-battery-intelligence-platform/src/utils/analyticsEngine.ts) | `GET /api/telemetry/history`<br>`POST /api/telemetry/batch` | `<TelemetryChart />`<br>`<DegradationChart />`<br>`<EvBmsPlatform />` | **Partial** | **Gaps:** Time series analytics exist primarily as simulated curves in frontend data generation. Missing backend temporal feature aggregation (moving voltage deltas, temperature rise rates, impedance slope) feeding predictive anomaly and degradation models.<br>**Phases 2-6 Fix:** Implement backend time-series feature engineering and real time-series trend charts across cycles. |

---

## 2. Component & Endpoint Inventory

### Backend REST Endpoints

| Endpoint | HTTP Method | Request Schema | Response Schema | Status |
|---|:---:|---|---|:---:|
| `/` | `GET` | None | Service & Model Readiness Status | Done |
| `/predict/soc-ekf` | `POST` | `SoCEKFRequest` | `SoCEKFResponse` | Done |
| `/predict/soc` | `POST` | `SoCRequest` | `SoCResponse` | Done |
| `/predict/soh` | `POST` | `SoHRequest` | `SoHResponse` | Partial (Data leakage in features) |
| `/predict/rul` | `POST` | `RULRequest` | `RULResponse` | Partial (Needs quantile interval) |
| `/predict/anomaly` | `POST` | `AnomalyRequest` | `AnomalyResponse` | Partial (Needs lead-time & risk level) |
| `/predict/charging` | `POST` | `ChargingRequest` | `ChargingResponse` | Partial (Needs forward recommendation) |
| `/predict/explain` | `POST` | `ExplainRequest` | `ExplainResponse` | Partial (Needs TreeSHAP & grounding) |
| `/api/auth/login` | `POST` | `OAuth2PasswordRequestForm` | `Token` | Done |
| `/api/auth/register`| `POST` | `UserRegisterRequest` | `UserResponse` | Done |
| `/api/auth/me` | `GET` | Bearer Token | `UserResponse` | Done |
| `/api/vehicles` | `GET` | Bearer Token | `List[VehicleResponse]` | Done |
| `/api/telemetry/history` | `GET` | `vehicle_id`, `limit` | `List[TelemetryFrame]` | Done |
| `/api/alerts` | `GET` | `vehicle_id`, `status` | `List[AlertResponse]` | Done |
| `/api/alerts/ack/{id}` | `POST` | `alert_id` | `AlertResponse` | Done |

### Frontend UI Components

| Component | File Path | Target Persona | Current State |
|---|---|---|:---:|
| `<EvBmsPlatform />` | [EvBmsPlatform.tsx](file:///C:/Users/Ravula%20Sairam/downloads/ev-battery-intelligence-platform/src/EvBmsPlatform.tsx) | All Personas (Unified) | Functional; needs explicit role segregation |
| `<CellGridMonitor />`| [CellGridMonitor.tsx](file:///C:/Users/Ravula%20Sairam/downloads/ev-battery-intelligence-platform/src/components/CellGridMonitor.tsx) | Service Center & Fleet | Complete 96/192 cell interactive matrix |
| `<EvDiagnosticScan />`| [EvDiagnosticScan.tsx](file:///C:/Users/Ravula%20Sairam/downloads/ev-battery-intelligence-platform/src/components/EvDiagnosticScan.tsx) | Service Center | Complete 3D pack scan animation & diagnostics |
| `<AlertFeed />` | [AlertFeed.tsx](file:///C:/Users/Ravula%20Sairam/downloads/ev-battery-intelligence-platform/src/components/AlertFeed.tsx) | EV Owner & Fleet | Functional; needs predictive early-warning feeds |
| `<SmartRecommendations />` | [SmartRecommendations.tsx](file:///C:/Users/Ravula%20Sairam/downloads/ev-battery-intelligence-platform/src/components/SmartRecommendations.tsx) | EV Owner | Functional; needs concrete charging mode advice |
| `<DigitalDoctorDrawer />` | [DigitalDoctorDrawer.tsx](file:///C:/Users/Ravula%20Sairam/downloads/ev-battery-intelligence-platform/src/components/DigitalDoctorDrawer.tsx) | EV Owner & Technician | Functional; needs multi-turn grounded Q&A |
| `<XaiAnalysisCard />` | [XaiAnalysisCard.tsx](file:///C:/Users/Ravula%20Sairam/downloads/ev-battery-intelligence-platform/src/components/XaiAnalysisCard.tsx) | All Personas | Needs real TreeSHAP visualization bars |
| `<LoginModal />` | [LoginModal.tsx](file:///C:/Users/Ravula%20Sairam/downloads/ev-battery-intelligence-platform/src/components/LoginModal.tsx) | All Personas | Complete modal with role selection & demo accounts |

---

## 3. Execution Roadmap for Remaining Phases

- **Phase 2 (Trustworthy ML)**: Eliminate data leakage in SoH (`capacity`/`init_capacity`), build LOBO CV evaluation script in `backend/training/evaluate.py` with baselines (linear-in-cycle, Coulomb counting, linear extrapolation), add RUL Quantile Gradient Boosting (5th/50th/95th percentiles), and output `RESULTS.md`.
- **Phase 3 (Early-Warning Anomaly Detection)**: Add predictive anomaly score, risk level (`normal`/`watch`/`critical`), contributing signals, fault injection benchmark script with lead-time tracking, and DB-persisted alerts.
- **Phase 4 (Charging Strategy Recommendation)**: Overhaul `backend/services/charging.py` to output target SoC window, charge rate, plain language explanation, "protect battery life" vs "need range soon" modes, and unit test suite.
- **Phase 5 (Explainable AI & AI Assistant)**: Compute real TreeSHAP values for XGBoost models, ground AI assistant strictly in telemetry, add hallucination rejection verifier, deterministic offline fallback, and multi-turn chat support.
- **Phase 6 (Role-Based Dashboards)**: Distinct views for EV Owner, Fleet Operator, Service Center; demo seeding script; time-series trend charts.
- **Phase 7 (Quality & Demo Readiness)**: Raise test coverage, generate `docs/ARCHITECTURE.md` (Mermaid diagrams) and `docs/DEMO_SCRIPT.md`, and document known limitations.
