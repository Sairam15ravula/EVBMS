# Phase 1: Database Persistence & Data Architecture - Research

*Researched: 2026-08-17*

## Key Technical Decisions & Architecture

### 1. Database Driver & Connection Pooling
- **Driver**: `asyncpg` (`postgresql+asyncpg://...`) for high-performance non-blocking query execution in FastAPI handlers.
- **Engine Creation**: `create_async_engine(DATABASE_URL, pool_size=20, max_overflow=10)`
- **Session Factory**: `async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)`

### 2. TimescaleDB Telemetry Hypertables
- TimescaleDB converts regular PostgreSQL tables into hypertables automatically partitioned by time intervals (e.g., 1 day chunks).
- SQL command for hypertable initialization:
  ```sql
  SELECT create_hypertable('telemetry_frames', 'timestamp', if_not_exists => TRUE);
  ```
- Fast analytical time-bucket queries:
  ```sql
  SELECT time_bucket('5 minutes', timestamp) AS five_min,
         avg(voltage) as avg_voltage,
         avg(temperature) as avg_temp
  FROM telemetry_frames
  WHERE vehicle_id = :vehicle_id AND timestamp > NOW() - INTERVAL '24 hours'
  GROUP BY five_min ORDER BY five_min ASC;
  ```

### 3. Alembic Async Migration Pipeline
- Configure `env.py` in Alembic to use `run_migrations_online()` with `connectable = async_engine_from_config(...)`.
- Include `target_metadata = Base.metadata` so Alembic automatically detects changes in SQLAlchemy ORM models.

### 4. Risk Mitigation & Gotchas
- **Async Session Lifecycle**: Use FastAPI `Depends(get_async_session)` dependency generator to ensure sessions are closed cleanly after each request.
- **JSONB vs Array for Cell Data**: Store per-cell telemetry array in JSONB or FLOAT array column to allow dynamic cell pack configurations (e.g. 96 cells vs 108 cells) without modifying table schemas.
- **Fallback Resilience**: If PostgreSQL connection is unreachable, database repositories return documented empty results or cached fallback telemetry frames to prevent application crashes.

## Validation Architecture

### Verification Commands
- `alembic upgrade head`
- `python -m pytest tests/test_db.py` (to be implemented in testing phase, verified manually in Phase 1)
