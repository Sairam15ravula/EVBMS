"""
Server-side alert rule engine for generating alerts from telemetry frames.

Evaluates incoming telemetry data against a set of configurable rules
and produces structured alert dictionaries for persistence and notification.
"""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from backend.utils.logger import get_logger

logger = get_logger(__name__)

# ── Rule Thresholds ──────────────────────────────────────────────────────────
CRITICAL_THERMAL_THRESHOLD_C = 55.0       # °C — critical thermal runaway risk
VOLTAGE_SAG_THRESHOLD_V = 2.5             # V/cell — deep discharge protection
OVERCURRENT_THRESHOLD_A = 350.0           # A — contactor / fuse rating
RESISTANCE_SPIKE_THRESHOLD_MOHM = 35.0    # mΩ — degradation / connection fault
CELL_IMBALANCE_THRESHOLD_MV = 50.0        # mV — cell balancing required


def generate_alerts_from_telemetry(telemetry_dict: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Evaluate a telemetry frame against all alert rules.

    Args:
        telemetry_dict: Dictionary containing telemetry fields:
            - vehicle_id (str)
            - temperature (float) — battery temperature in °C
            - voltage (float) — pack voltage in V
            - current (float) — current in A (positive = discharge)
            - internal_resistance (float) — in mΩ
            - cell_voltages (list[float], optional) — individual cell voltages
            - cell_count (int, optional) — number of series cells (default 96)

    Returns:
        List of alert dictionaries, each containing:
            - vehicle_id, severity, fault_code, description, timestamp
    """
    alerts: List[Dict[str, Any]] = []
    vehicle_id = telemetry_dict.get("vehicle_id", "unknown")
    timestamp = datetime.now(timezone.utc).isoformat()

    # ── Rule 1: Critical Thermal ─────────────────────────────────────────────
    temperature = telemetry_dict.get("temperature")
    if temperature is not None and temperature > CRITICAL_THERMAL_THRESHOLD_C:
        alerts.append({
            "vehicle_id": vehicle_id,
            "severity": "critical",
            "fault_code": "CRITICAL_THERMAL",
            "description": (
                f"Battery temperature {temperature}°C exceeds critical "
                f"threshold of {CRITICAL_THERMAL_THRESHOLD_C}°C"
            ),
            "timestamp": timestamp,
        })

    # ── Rule 2: Voltage Sag (per-cell) ───────────────────────────────────────
    voltage = telemetry_dict.get("voltage")
    cell_voltages = telemetry_dict.get("cell_voltages")

    if cell_voltages and len(cell_voltages) > 0:
        min_cell_v = min(cell_voltages)
        if min_cell_v < VOLTAGE_SAG_THRESHOLD_V:
            alerts.append({
                "vehicle_id": vehicle_id,
                "severity": "critical",
                "fault_code": "VOLTAGE_SAG",
                "description": (
                    f"Cell voltage {min_cell_v}V below threshold of "
                    f"{VOLTAGE_SAG_THRESHOLD_V}V"
                ),
                "timestamp": timestamp,
            })
    elif voltage is not None:
        # Estimate per-cell voltage from pack voltage and cell count
        cell_count = telemetry_dict.get("cell_count", 96)
        if cell_count > 0:
            per_cell_v = voltage / cell_count
            if per_cell_v < VOLTAGE_SAG_THRESHOLD_V:
                alerts.append({
                    "vehicle_id": vehicle_id,
                    "severity": "critical",
                    "fault_code": "VOLTAGE_SAG",
                    "description": (
                        f"Per-cell voltage {per_cell_v:.3f}V below threshold "
                        f"of {VOLTAGE_SAG_THRESHOLD_V}V"
                    ),
                    "timestamp": timestamp,
                })

    # ── Rule 3: Overcurrent ──────────────────────────────────────────────────
    current = telemetry_dict.get("current")
    if current is not None and abs(current) > OVERCURRENT_THRESHOLD_A:
        alerts.append({
            "vehicle_id": vehicle_id,
            "severity": "critical",
            "fault_code": "OVERCURRENT",
            "description": (
                f"Current {current}A exceeds threshold of "
                f"{OVERCURRENT_THRESHOLD_A}A"
            ),
            "timestamp": timestamp,
        })

    # ── Rule 4: Resistance Spike ──────────────────────────────────────────────
    resistance = telemetry_dict.get("internal_resistance")
    if resistance is not None and resistance > RESISTANCE_SPIKE_THRESHOLD_MOHM:
        alerts.append({
            "vehicle_id": vehicle_id,
            "severity": "warning",
            "fault_code": "RESISTANCE_SPIKE",
            "description": (
                f"Internal resistance {resistance}mΩ exceeds threshold of "
                f"{RESISTANCE_SPIKE_THRESHOLD_MOHM}mΩ"
            ),
            "timestamp": timestamp,
        })

    # ── Rule 5: Cell Imbalance ───────────────────────────────────────────────
    if cell_voltages and len(cell_voltages) > 1:
        max_cell_v = max(cell_voltages)
        min_cell_v = min(cell_voltages)
        imbalance_mv = (max_cell_v - min_cell_v) * 1000  # Convert V to mV
        if imbalance_mv > CELL_IMBALANCE_THRESHOLD_MV:
            alerts.append({
                "vehicle_id": vehicle_id,
                "severity": "warning",
                "fault_code": "CELL_IMBALANCE",
                "description": (
                    f"Cell imbalance {imbalance_mv:.1f}mV exceeds threshold "
                    f"of {CELL_IMBALANCE_THRESHOLD_MV}mV"
                ),
                "timestamp": timestamp,
            })

    if alerts:
        logger.info(
            f"Generated {len(alerts)} alert(s) for vehicle {vehicle_id}",
            extra={"alert_count": len(alerts), "vehicle_id": vehicle_id},
        )

    return alerts
