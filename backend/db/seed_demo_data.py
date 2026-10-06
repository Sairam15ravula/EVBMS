"""
Seed script for EV Battery Intelligence Platform demo users, vehicles, telemetry, and alerts.
Run standalone with:
    python backend/db/seed_demo_data.py
"""
import asyncio
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone

# Ensure root and backend directory in sys.path
root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from sqlalchemy import select
from backend.db.base import Base
from backend.db.session import engine, async_session_factory, init_db
from backend.db.models import (
    UserModel,
    VehicleModel,
    BatteryPackModel,
    TelemetryFrameModel,
    AlertLogModel,
)
from backend.services.auth import hash_password


async def seed_data():
    """Seed demo accounts, fleet vehicles, battery packs, telemetry, and diagnostic alerts."""
    print("[seed] Initializing database schema...")
    await init_db()

    now = datetime.now(timezone.utc)

    async with async_session_factory() as session:
        # ── 1. Seed Demo Users ────────────────────────────────────────────────
        demo_users = [
            {
                "id": "usr-demo-owner",
                "email": "owner@evbms.demo",
                "password": "Owner123!",
                "full_name": "Alex Mercer (EV Owner)",
                "role": "driver",
            },
            {
                "id": "usr-demo-fleet",
                "email": "fleet@evbms.demo",
                "password": "Fleet123!",
                "full_name": "Sarah Chen (Fleet Director)",
                "role": "fleet_manager",
            },
            {
                "id": "usr-demo-tech",
                "email": "technician@evbms.demo",
                "password": "Tech123!",
                "full_name": "Marcus Vance (Master Technician)",
                "role": "technician",
            },
            {
                "id": "usr-demo-admin",
                "email": "admin@evbms.demo",
                "password": "Admin123!",
                "full_name": "System Administrator",
                "role": "admin",
            },
        ]

        for u in demo_users:
            stmt = select(UserModel).where(UserModel.email == u["email"])
            existing = (await session.execute(stmt)).scalars().first()
            if not existing:
                user_obj = UserModel(
                    id=u["id"],
                    email=u["email"],
                    hashed_password=hash_password(u["password"]),
                    full_name=u["full_name"],
                    role=u["role"],
                    is_active=True,
                    created_at=now - timedelta(days=30),
                )
                session.add(user_obj)
                print(f"[seed] Created user: {u['email']} (role: {u['role']})")

        await session.commit()

        # ── 2. Seed Fleet Vehicles & Battery Packs ────────────────────────────
        demo_vehicles = [
            {
                "id": "veh-tesla-m3",
                "name": "Tesla Model 3 Long Range",
                "model": "Model 3 LR",
                "chemistry": "NMC",
                "total_energy_kwh": 75.0,
                "nominal_voltage": 350.0,
                "owner_id": "usr-demo-owner",
                "pack": {
                    "serial_number": "PACK-TSLA-001",
                    "initial_capacity_ah": 230.0,
                    "cell_count": 96,
                },
                "soh": 91.5,
                "soc": 78.0,
                "temp": 24.5,
                "resistance": 14.2,
            },
            {
                "id": "veh-ioniq-5",
                "name": "Hyundai Ioniq 5 AWD",
                "model": "Ioniq 5 AWD",
                "chemistry": "NMC",
                "total_energy_kwh": 77.4,
                "nominal_voltage": 800.0,
                "owner_id": "usr-demo-fleet",
                "pack": {
                    "serial_number": "PACK-HYUN-002",
                    "initial_capacity_ah": 220.0,
                    "cell_count": 192,
                },
                "soh": 88.0,
                "soc": 64.0,
                "temp": 28.0,
                "resistance": 17.5,
            },
            {
                "id": "veh-byd-atto3",
                "name": "BYD Atto 3 Blade Pack",
                "model": "Atto 3 Standard",
                "chemistry": "LFP",
                "total_energy_kwh": 60.5,
                "nominal_voltage": 400.0,
                "owner_id": "usr-demo-fleet",
                "pack": {
                    "serial_number": "PACK-BYD-003",
                    "initial_capacity_ah": 150.0,
                    "cell_count": 126,
                },
                "soh": 96.2,
                "soc": 85.0,
                "temp": 22.0,
                "resistance": 13.0,
            },
            {
                "id": "veh-f150-lightning",
                "name": "Ford F-150 Lightning ER",
                "model": "F-150 Lightning Extended",
                "chemistry": "NMC",
                "total_energy_kwh": 131.0,
                "nominal_voltage": 400.0,
                "owner_id": "usr-demo-fleet",
                "pack": {
                    "serial_number": "PACK-FORD-004",
                    "initial_capacity_ah": 380.0,
                    "cell_count": 108,
                },
                "soh": 84.1,
                "soc": 42.0,
                "temp": 34.0,
                "resistance": 21.0,
            },
            {
                "id": "veh-nissan-leaf",
                "name": "Nissan Leaf Gen2 (High Degradation)",
                "model": "Leaf SV Plus",
                "chemistry": "NMC",
                "total_energy_kwh": 40.0,
                "nominal_voltage": 360.0,
                "owner_id": "usr-demo-fleet",
                "pack": {
                    "serial_number": "PACK-LEAF-005",
                    "initial_capacity_ah": 115.0,
                    "cell_count": 96,
                },
                "soh": 73.8,
                "soc": 35.0,
                "temp": 41.5,
                "resistance": 38.5,
            },
        ]

        for v in demo_vehicles:
            stmt = select(VehicleModel).where(VehicleModel.id == v["id"])
            existing_v = (await session.execute(stmt)).scalars().first()
            if not existing_v:
                v_obj = VehicleModel(
                    id=v["id"],
                    name=v["name"],
                    model=v["model"],
                    chemistry=v["chemistry"],
                    total_energy_kwh=v["total_energy_kwh"],
                    nominal_voltage=v["nominal_voltage"],
                    owner_id=v["owner_id"],
                    created_at=now - timedelta(days=20),
                )
                session.add(v_obj)

                pack_obj = BatteryPackModel(
                    id=f"pack-{v['id']}",
                    vehicle_id=v["id"],
                    serial_number=v["pack"]["serial_number"],
                    initial_capacity_ah=v["pack"]["initial_capacity_ah"],
                    cell_count=v["pack"]["cell_count"],
                    manufacture_date=now - timedelta(days=365),
                )
                session.add(pack_obj)
                print(f"[seed] Added vehicle: {v['name']} ({v['chemistry']})")

        await session.commit()

        # ── 3. Seed Telemetry History Frames ──────────────────────────────────
        print("[seed] Seeding time-series telemetry history frames...")
        for v in demo_vehicles:
            # Generate 10 historic time steps for each vehicle
            for step in range(10):
                t_stamp = now - timedelta(minutes=(9 - step) * 15)
                # Slight variation over time
                soc_val = max(10.0, min(100.0, v["soc"] - (9 - step) * 0.8))
                temp_val = round(v["temp"] + (step % 3) * 0.5, 1)
                res_val = round(v["resistance"] + (step % 2) * 0.2, 2)
                volt_val = round(v["nominal_voltage"] * (0.95 + (soc_val / 100.0) * 0.1), 1)
                curr_val = round(-15.0 + (step % 5) * 8.0, 1)

                stmt = select(TelemetryFrameModel).where(
                    TelemetryFrameModel.vehicle_id == v["id"],
                    TelemetryFrameModel.timestamp == t_stamp,
                )
                existing_tf = (await session.execute(stmt)).scalars().first()
                if not existing_tf:
                    tf = TelemetryFrameModel(
                        timestamp=t_stamp,
                        vehicle_id=v["id"],
                        voltage=volt_val,
                        current=curr_val,
                        temperature=temp_val,
                        soc=soc_val,
                        soh=v["soh"],
                        internal_resistance=res_val,
                        cell_voltages=[round(volt_val / v["pack"]["cell_count"], 3)] * 10,
                        active_anomalies=[],
                    )
                    session.add(tf)

        await session.commit()

        # ── 4. Seed Diagnostic Alert Logs ─────────────────────────────────────
        print("[seed] Seeding diagnostic alert logs...")
        demo_alerts = [
            {
                "id": "alt-critical-01",
                "vehicle_id": "veh-nissan-leaf",
                "severity": "critical",
                "fault_code": "CRITICAL_HAZARD",
                "description": "Internal resistance jumped to 38.5 mΩ (+140% above baseline). Severe capacity degradation (73.8% SoH). Service required immediately.",
                "timestamp": now - timedelta(hours=2),
                "acknowledged": False,
            },
            {
                "id": "alt-watch-02",
                "vehicle_id": "veh-f150-lightning",
                "severity": "warning",
                "fault_code": "PREDICTIVE_RISK_WATCH",
                "description": "Cell imbalance delta reached 68 mV under 34°C thermal cycling. Predictive watch triggered.",
                "timestamp": now - timedelta(hours=5),
                "acknowledged": False,
            },
            {
                "id": "alt-info-03",
                "vehicle_id": "veh-ioniq-5",
                "severity": "info",
                "fault_code": "TELEMETRY_ANOMALY",
                "description": "Transient high-current DC fast-charge ramp detected (220 kW). Thermal management active.",
                "timestamp": now - timedelta(hours=12),
                "acknowledged": True,
            },
            {
                "id": "alt-watch-04",
                "vehicle_id": "veh-tesla-m3",
                "severity": "info",
                "fault_code": "CHARGING_ADVISORY",
                "description": "Battery pack reached 80% daily recommended SoC buffer. Trickle rate engaged for electrode longevity.",
                "timestamp": now - timedelta(hours=1),
                "acknowledged": True,
            },
        ]

        for a in demo_alerts:
            stmt = select(AlertLogModel).where(AlertLogModel.id == a["id"])
            existing_a = (await session.execute(stmt)).scalars().first()
            if not existing_a:
                alert_obj = AlertLogModel(
                    id=a["id"],
                    timestamp=a["timestamp"],
                    vehicle_id=a["vehicle_id"],
                    severity=a["severity"],
                    fault_code=a["fault_code"],
                    description=a["description"],
                    acknowledged=a["acknowledged"],
                )
                session.add(alert_obj)
                print(f"[seed] Added alert: {a['fault_code']} ({a['severity']}) for {a['vehicle_id']}")

        await session.commit()
        print("\n[seed] Demo database seeding completed successfully!")
        print("Demo Accounts:")
        print("  • EV Owner:       owner@evbms.demo       / Owner123!   (Role: driver)")
        print("  • Fleet Operator: fleet@evbms.demo       / Fleet123!   (Role: fleet_manager)")
        print("  • Service Center: technician@evbms.demo  / Tech123!    (Role: technician)")
        print("  • Administrator:  admin@evbms.demo       / Admin123!   (Role: admin)")


if __name__ == "__main__":
    asyncio.run(seed_data())
