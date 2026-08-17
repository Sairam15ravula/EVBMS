# EV Battery Intelligence Platform

## What This Is

An enterprise-grade, AI-driven EV Battery Intelligence Platform for real-time battery pack analytics, State of Charge (SoC), State of Health (SoH), Remaining Useful Life (RUL) forecasting, cell-level telemetry monitoring, and automated anomaly detection. Built with React 19, Express Node Gateway, Python FastAPI ML services, PostgreSQL database persistence, and Google Gemini 3.6 Flash Explainable AI (XAI).

## Core Value

Delivering high-accuracy physical and ML-driven battery health diagnostics, cell-level fault isolation, and actionable lifetime optimization for EV fleet managers, engineers, and drivers.

## Requirements

### Validated

- ✓ **VAL-01**: React 19 Single Page Application dashboard with live telemetry and degradation visualizations — *existing codebase*
- ✓ **VAL-02**: Node.js Express Gateway proxying `/predict/*` endpoints to Python ML service — *existing codebase*
- ✓ **VAL-03**: FastAPI Machine Learning service with XGBoost/RandomForest models for SoH, RUL, capacity fade, and anomaly detection — *existing codebase*
- ✓ **VAL-04**: Gemini 3.6 Flash LLM integration for Explainable AI (XAI) degradation breakdown and Digital Doctor interactive assistant — *existing codebase*
- ✓ **VAL-05**: NASA B0005 aging dataset generator and model training scripts — *existing codebase*

### Active

- [ ] **MON-01**: Real-time battery stream monitoring with WebSockets / Server-Sent Events (SSE)
- [ ] **EST-01**: High-fidelity State of Charge (SoC) estimation engine with coulomb counting and Kalman filtering
- [ ] **EST-02**: Machine Learning & physics hybrid State of Health (SoH) and Remaining Useful Life (RUL) estimation
- [ ] **DIAG-01**: Cell-level array telemetry breakdown, voltage imbalance detection, and thermal hotspot mapping
- [ ] **DIAG-02**: Automated battery anomaly, fault, and thermal runaway risk alert engine
- [ ] **BACK-01**: Production-ready FastAPI & Express REST APIs with rate limiting, input validation, and standard error handling
- [ ] **DATA-01**: Relational & Time-Series database persistence (PostgreSQL / TimescaleDB) for historical telemetry, vehicle profiles, and diagnostic logs
- [ ] **INFRA-01**: Scalable ML model inference server setup with versioned model loading and fallback policies
- [ ] **AUTH-01**: User authentication, JWT session management, user roles (Fleet Manager, Technician, Driver), and vehicle asset access control
- [ ] **TEST-01**: Comprehensive automated testing suite (Pytest for backend ML/APIs, Vitest/Jest for frontend React UI) and OpenAPI/Swagger documentation

### Out of Scope

- **Physical Hardware Interfacing**: CAN-bus physical hardware dongle manufacturing (simulated over WebSockets / REST API endpoints) — *out of software scope*
- **Mobile Native Applications**: iOS/Android native builds (focusing on responsive PWA / web SPA first) — *deferred to v2*

## Context

The repository contains an initial functional prototype combining a Vite/React SPA, Node.js Express server, and Python FastAPI ML model predictors. The goal is to evolve this prototype into a production-grade EV battery management platform with persistent storage, full authentication, cell-level diagnostics, scalable ML microservices, and end-to-end test coverage.

## Constraints

- **Tech Stack**: Must leverage existing React 19, Express, FastAPI, and scikit-learn/XGBoost/Gemini stack while adding PostgreSQL/TimescaleDB and JWT auth.
- **Performance**: ML inference response time < 100ms; telemetry ingestion latency < 200ms.
- **Reliability**: Fallback physics-based calculators must operate if ML models or external Gemini APIs are unreachable.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Hybrid Gateway Architecture | Express handles SPA static serving, WebSocket streaming, and Gemini AI; FastAPI handles heavy ML model inference | ✓ Good |
| Dual-Engine Diagnostics | Combines physics-based NASA/CALCE degradation models with trained XGBoost regressors and Gemini XAI | ✓ Good |
| PostgreSQL / TimescaleDB | Provides structured relational data for users/vehicles alongside hypertable time-series storage for high-frequency battery telemetry | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-17 after initial GSD project initialization*
