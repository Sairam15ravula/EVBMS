"""
Async database engine & session factory configuration with automatic SQLite fallback.
"""
import os
from pathlib import Path
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

SQLITE_PATH = Path(__file__).resolve().parent.parent / "ev_bms.db"
SQLITE_URL = f"sqlite+aiosqlite:///{SQLITE_PATH.as_posix()}"

CONFIGURED_URL = os.getenv("DATABASE_URL", "")

# Default to SQLite for zero-config reliability unless a non-default postgres url is specified
if CONFIGURED_URL and not CONFIGURED_URL.startswith("postgresql://postgres:postgrespassword@localhost:5432"):
    DATABASE_URL = CONFIGURED_URL
    if DATABASE_URL.startswith("postgresql://"):
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
else:
    DATABASE_URL = SQLITE_URL


def _make_engine(url: str):
    kwargs = {"echo": False, "future": True}
    if not url.startswith("sqlite"):
        kwargs.update({"pool_size": 20, "max_overflow": 10})
    return create_async_engine(url, **kwargs)


engine = _make_engine(DATABASE_URL)
async_session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


_db_initialized = False


async def init_db():
    """Initialize database tables and seed demo vehicles if empty."""
    global engine, async_session_factory, DATABASE_URL, _db_initialized
    if _db_initialized:
        return
    import backend.db.models  # noqa: F401 - register all ORM models with Base.metadata
    from backend.db.base import Base
    from backend.db.models import VehicleModel

    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception as e:
        print(f"[db-session] Database connection failed ({e}). Falling back to SQLite.")
        DATABASE_URL = SQLITE_URL
        engine = _make_engine(DATABASE_URL)
        async_session_factory = async_sessionmaker(
            bind=engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=False,
        )
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    # Seed vehicles if table is empty
    try:
        async with async_session_factory() as session:
            from sqlalchemy import select
            result = await session.execute(select(VehicleModel))
            existing = result.scalars().first()
            if not existing:
                from backend.db.models import BatteryPackModel
                demo_vehicles = [
                    (
                        VehicleModel(
                            id="veh-tesla-m3",
                            name="Fleet Alpha — Model 3 Long Range",
                            model="Tesla Model 3 LR",
                            chemistry="NMC",
                            total_energy_kwh=75.0,
                            nominal_voltage=350.0,
                        ),
                        BatteryPackModel(
                            vehicle_id="veh-tesla-m3",
                            serial_number="PACK-TSLA-001",
                            initial_capacity_ah=230.0,
                            cell_count=96,
                        ),
                    ),
                    (
                        VehicleModel(
                            id="veh-ioniq-5",
                            name="Fleet Beta — Ioniq 5 AWD",
                            model="Hyundai Ioniq 5",
                            chemistry="NMC",
                            total_energy_kwh=77.4,
                            nominal_voltage=800.0,
                        ),
                        BatteryPackModel(
                            vehicle_id="veh-ioniq-5",
                            serial_number="PACK-HYUN-002",
                            initial_capacity_ah=220.0,
                            cell_count=192,
                        ),
                    ),
                    (
                        VehicleModel(
                            id="veh-mach-e",
                            name="Fleet Gamma — Mustang Mach-E",
                            model="Ford Mustang Mach-E",
                            chemistry="NMC",
                            total_energy_kwh=88.0,
                            nominal_voltage=380.0,
                        ),
                        BatteryPackModel(
                            vehicle_id="veh-mach-e",
                            serial_number="PACK-FORD-003",
                            initial_capacity_ah=245.0,
                            cell_count=108,
                        ),
                    ),
                    (
                        VehicleModel(
                            id="veh-byd-seal",
                            name="Fleet Delta — Seal Blade Battery",
                            model="BYD Seal Excellence",
                            chemistry="LFP",
                            total_energy_kwh=82.5,
                            nominal_voltage=550.0,
                        ),
                        BatteryPackModel(
                            vehicle_id="veh-byd-seal",
                            serial_number="PACK-BYD-004",
                            initial_capacity_ah=150.0,
                            cell_count=172,
                        ),
                    ),
                ]
                for v, p in demo_vehicles:
                    session.add(v)
                    session.add(p)
                await session.commit()
                print("[db-session] Initialized database and seeded 4 demo fleet vehicles with battery packs.")
    except Exception as se:
        print(f"[db-session] Warning: could not seed demo vehicles: {se}")

    _db_initialized = True


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependency generator for FastAPI routes to yield an async database session."""
    if not _db_initialized:
        await init_db()
    async with async_session_factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

