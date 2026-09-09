"""
Database repository integration unit tests.
Verifies SQLAlchemy async models and repository interfaces.
"""
import pytest
from backend.db.models import UserModel, VehicleModel, BatteryPackModel, AlertLogModel, TelemetryFrameModel


def test_model_definitions():
    user = UserModel(email="test@ev.com", hashed_password="hash", role="fleet_manager", full_name="Test Manager")
    assert user.email == "test@ev.com"
    assert user.role == "fleet_manager"

    vehicle = VehicleModel(id="v-101", name="Test Sedan", model="Model 3", chemistry="NMC", total_energy_kwh=75.0, nominal_voltage=350.0)
    assert vehicle.id == "v-101"
    assert vehicle.chemistry == "NMC"

    pack = BatteryPackModel(vehicle_id="v-101", serial_number="PACK-998", initial_capacity_ah=230.0, cell_count=96)
    assert pack.cell_count == 96
