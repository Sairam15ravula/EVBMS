# Roadmap: EV Battery Intelligence Platform

## Overview

The EV Battery Intelligence Platform project transitions from a functional prototype to an enterprise-grade battery analytics platform. Development proceeds in 6 structured, verifiable phases covering database persistence, secure authentication, production streaming APIs, enhanced ML/physics algorithms, cell-level telemetry visualization, and automated test coverage.

## Phases

- [ ] **Phase 1: Database Persistence & Data Architecture** - Setup PostgreSQL schema, Alembic migrations, TimescaleDB telemetry hypertables, and SQLAlchemy ORM models
- [ ] **Phase 2: Authentication & User Management** - Implement JWT registration/login, RBAC roles, vehicle asset scoping, and auth middleware
- [ ] **Phase 3: Production Backend APIs & Streaming Gateway** - Build standardized FastAPI REST endpoints, WebSocket/SSE real-time telemetry streaming, and rate limiting
- [ ] **Phase 4: Advanced AI/ML Inference & Physics Engine** - Deploy Extended Kalman Filter (EKF) SoC estimation, XGBoost SoH/RUL forecasting, Isolation Forest anomaly engine, and Gemini 3.6 Flash XAI service
- [ ] **Phase 5: Cell-Level Monitoring & Dashboard Enhancement** - Implement 3D/grid cell-level telemetry views, real-time WebSocket dashboard integration, and multi-vehicle comparison views
- [ ] **Phase 6: Automated Testing & Verification Suite** - Create Pytest backend unit/integration tests, Vitest UI tests, and end-to-end telemetry-to-ML pipeline verification scripts

---

## Phase Details

### Phase 1: Database Persistence & Data Architecture
**Goal**: Establish production database persistence for vehicle assets, battery packs, user accounts, diagnostic alert logs, and high-frequency time-series telemetry data.  
**Depends on**: Existing codebase map (`.planning/codebase/`)  
**Requirements**: DATA-01, DATA-02, DATA-03  
**Success Criteria**:
  1. PostgreSQL database connects successfully with Alembic migrations creating all core tables (`users`, `vehicles`, `battery_packs`, `alert_logs`).
  2. TimescaleDB hypertable (or partitioned time-series table) ingests and queries high-frequency battery telemetry frames (voltage, current, temperature, SoC, SoH) with sub-50ms query times.
  3. SQLAlchemy 2.0 async ORM models provide type-safe CRUD operations for FastAPI and Express services.

Plans:
- [ ] 01-01: Configure PostgreSQL / TimescaleDB database connection, Docker Compose environment, and Alembic migrations setup
- [ ] 01-02: Build SQLAlchemy async ORM models (`User`, `Vehicle`, `BatteryPack`, `TelemetryFrame`, `AlertLog`) and data repository layer

---

### Phase 2: Authentication & User Management
**Goal**: Implement secure user registration, JWT authentication, Role-Based Access Control (RBAC), and asset ownership scoping.  
**Depends on**: Phase 1  
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04  
**Success Criteria**:
  1. Users can register, log in, and receive secure JWT access and refresh tokens.
  2. RBAC middleware restricts access to administrative and vehicle management routes based on user role (Admin, Fleet Manager, Technician, Driver).
  3. React UI stores session tokens securely and enforces protected route navigation.

Plans:
- [ ] 02-01: Build FastAPI authentication endpoints (signup, login, token refresh, password hashing) and JWT security middleware
- [ ] 02-02: Implement RBAC vehicle asset access control and frontend React authentication state manager

---

### Phase 3: Production Backend APIs & Streaming Gateway
**Goal**: Build robust REST API contracts, WebSocket/SSE telemetry streaming server, rate limiting, and OpenAPI documentation.  
**Depends on**: Phase 2  
**Requirements**: BACK-01, BACK-02, BACK-03, BACK-04  
**Success Criteria**:
  1. FastAPI returns standardized OpenAPI/Swagger compliant responses with strict Pydantic input validation.
  2. Express Node server broadcasts real-time telemetry frames over WebSockets / SSE to connected dashboard clients.
  3. Health check endpoints and rate limiting middleware protect endpoints against overload.

Plans:
- [ ] 03-01: Refactor Express server (`server.ts`) to add WebSocket / SSE real-time telemetry broadcasting and rate limiting
- [ ] 03-02: Build FastAPI production REST APIs for vehicle fleet CRUD, pack diagnostics, and historical telemetry pagination

---

### Phase 4: Advanced AI/ML Inference & Physics Engine
**Goal**: Elevate battery intelligence algorithms with Extended Kalman Filter (EKF) SoC estimation, XGBoost SoH/RUL models, Isolation Forest anomaly isolation, and Gemini XAI explanation.  
**Depends on**: Phase 3  
**Requirements**: ML-01, ML-02, ML-03, ML-04, ML-05  
**Success Criteria**:
  1. EKF algorithm estimates State of Charge (SoC) with < 2% error under dynamic current profiles.
  2. XGBoost regression models predict SoH and RUL cycles based on NASA/CALCE aging parameters with fallback to physical calculation if model binary is missing.
  3. Isolation Forest and threshold rules classify battery anomalies (cell voltage delta, thermal runaway risk) in < 50ms.
  4. Gemini 3.6 Flash generates structured Explainable AI (XAI) degradation factor breakdowns.

Plans:
- [ ] 04-01: Implement physics-based Extended Kalman Filter (EKF) SoC estimator and integrate into backend prediction pipeline
- [ ] 04-02: Enhance XGBoost & Random Forest ML models (`backend/train_models.py`), update FastAPI service inference wrappers (`backend/services/`), and optimize Gemini XAI prompt builder

---

### Phase 5: Cell-Level Monitoring & Dashboard Enhancement
**Goal**: Provide comprehensive cell-level monitoring visualization, dynamic real-time WebSocket dashboard integration, and multi-vehicle comparison tools.  
**Depends on**: Phase 4  
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05  
**Success Criteria**:
  1. Dashboard displays a 3D/grid cell array view rendering individual cell voltages, thermal hotspots, and imbalance status.
  2. Live telemetry metrics update via WebSockets without full-page re-renders.
  3. Users can compare two vehicle battery packs side-by-side on degradation curves and remaining life projections.

Plans:
- [ ] 05-01: Create `CellGridMonitor.tsx` component with interactive cell voltage array, thermal hotspot rendering, and imbalance alerts
- [ ] 05-02: Integrate WebSocket live updates into `EvBmsPlatform.tsx`, enhance `BmsComparison.tsx` view, and polish Digital Doctor drawer

---

### Phase 6: Automated Testing & Verification Suite
**Goal**: Establish comprehensive test coverage across backend ML services, APIs, database layer, and frontend React UI.  
**Depends on**: Phase 5  
**Requirements**: TEST-01, TEST-02, TEST-03  
**Success Criteria**:
  1. Pytest suite achieves > 85% test coverage across FastAPI endpoints, Pydantic schemas, and ML inference services.
  2. Vitest / React Testing Library verifies frontend component rendering and user interaction flows.
  3. End-to-end verification script passes cleanly, confirming real-time telemetry stream ingestion, database persistence, and ML model prediction.

Plans:
- [ ] 06-01: Write Pytest backend test suite (`tests/test_api.py`, `tests/test_models.py`, `tests/test_db.py`)
- [ ] 06-02: Write Vitest frontend component tests and end-to-end integration test runner

---

## Progress

**Execution Order:**
Phases execute sequentially in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Database Persistence & Data Architecture | 0/2 | Not started | - |
| 2. Authentication & User Management | 0/2 | Not started | - |
| 3. Production Backend APIs & Streaming Gateway | 0/2 | Not started | - |
| 4. Advanced AI/ML Inference & Physics Engine | 0/2 | Not started | - |
| 5. Cell-Level Monitoring & Dashboard Enhancement | 0/2 | Not started | - |
| 6. Automated Testing & Verification Suite | 0/2 | Not started | - |
