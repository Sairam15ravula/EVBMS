# Phase 1: Database Persistence & Data Architecture - Context

**Gathered:** 2026-08-17  
**Status:** Ready for planning  

<domain>
## Phase Boundary

This phase establishes the relational and time-series database foundation for the EV Battery Intelligence Platform. It delivers PostgreSQL database schema definitions, Alembic migration scripts, TimescaleDB telemetry hypertables, and an async SQLAlchemy 2.0 ORM repository layer.

</domain>

<decisions>
## Implementation Decisions

### Database Engine & ORM
- Use **PostgreSQL 16+** with **TimescaleDB extension** for time-series telemetry hypertables.
- Use **SQLAlchemy 2.0 (asyncio)** with `asyncpg` driver for non-blocking I/O in FastAPI.
- Use **Alembic** for schema migration management.

### Data Model Architecture
- **Users Table**: `id` (UUID), `email`, `hashed_password`, `role` (`admin`, `fleet_manager`, `technician`, `driver`), `created_at`.
- **Vehicles Table**: `id` (UUID/string), `name`, `model`, `chemistry` (`NMC`, `LFP`), `pack_capacity_kwh`, `nominal_voltage`, `owner_id`.
- **Battery Packs Table**: `id` (UUID), `vehicle_id`, `serial_number`, `initial_capacity_ah`, `cell_count`, `manufacture_date`.
- **Telemetry Frames Table (Hypertable)**: Partitioned by `timestamp` and `vehicle_id`. Stores `voltage`, `current`, `temperature`, `soc`, `soh`, `internal_resistance`, `cell_voltages` (JSONB/array), `active_anomalies` (JSONB).
- **Alert Logs Table**: `id`, `timestamp`, `vehicle_id`, `severity` (`info`, `warning`, `critical`), `fault_code`, `description`, `acknowledged`.

### Discretion & Patterns
- Place database configurations and async session factories in `backend/database/` or `backend/db/`.
- Provide repository helper functions for CRUD operations (`UserRepo`, `VehicleRepo`, `TelemetryRepo`).

</decisions>

<canonical_refs>
## Canonical References

- `backend/app.py` — FastAPI application entrypoint and startup hook
- `backend/schemas/battery.py` — Existing Pydantic data schemas
- `.planning/codebase/STACK.md` — Tech stack documentation
- `.planning/codebase/ARCHITECTURE.md` — Overall architecture documentation

</canonical_refs>

---
*Phase: 01-database-persistence-data-architecture*
