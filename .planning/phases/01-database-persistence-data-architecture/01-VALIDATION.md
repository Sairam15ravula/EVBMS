# Phase 1: Database Persistence & Data Architecture - Validation Strategy

*Created: 2026-08-17*

## Must-Have Verification Criteria

1. **Database Schema & Migrations (DATA-01)**:
   - Alembic migration environment is initialized and executing `alembic upgrade head` applies all table schemas without errors.
   - Core tables exist: `users`, `vehicles`, `battery_packs`, `telemetry_frames`, `alert_logs`.

2. **TimescaleDB Hypertable Setup (DATA-02)**:
   - `telemetry_frames` is configured as a time-series hypertable partitioned by `timestamp`.
   - Batch insert of 100 telemetry frames completes in < 50ms.

3. **SQLAlchemy 2.0 Async ORM Repository (DATA-03)**:
   - Async session factory connects to PostgreSQL via `asyncpg`.
   - `UserRepo`, `VehicleRepo`, and `TelemetryRepo` perform CRUD operations with proper async context management.

## Automated Verification Steps
- Run schema creation verification script in Python (`python -c "import backend.db..."`).
- Test async query insertion and retrieval.
