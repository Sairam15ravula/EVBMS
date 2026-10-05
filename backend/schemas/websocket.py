"""
Pydantic schemas for WebSocket control message validation.

Defines the expected structure for WebSocket control messages such as
SELECT_VEHICLE and SELECT_SCENARIO, and provides a validation function
that returns a tuple of (is_valid, error_message).
"""
from typing import Literal, Optional, Tuple

from pydantic import BaseModel, Field, ValidationError


class SelectVehicleMessage(BaseModel):
    """WebSocket message to select a vehicle for live telemetry streaming."""

    type: Literal["SELECT_VEHICLE"] = "SELECT_VEHICLE"
    vehicle_id: str = Field(..., min_length=1, description="Vehicle identifier to subscribe to")


class SelectScenarioMessage(BaseModel):
    """WebSocket message to select a simulation scenario."""

    type: Literal["SELECT_SCENARIO"] = "SELECT_SCENARIO"
    scenario_id: str = Field(..., min_length=1, description="Simulation scenario identifier")


class WebSocketControlMessage(BaseModel):
    """Generic WebSocket control message wrapper."""

    type: str = Field(..., description="Message type discriminator")
    vehicle_id: Optional[str] = None
    scenario_id: Optional[str] = None


def validate_websocket_message(data: dict) -> Tuple[bool, Optional[str]]:
    """
    Validate a WebSocket control message payload.

    Args:
        data: Raw dictionary payload from the WebSocket message.

    Returns:
        A tuple of (is_valid, error_message). If the message is valid,
        error_message is None.
    """
    if not isinstance(data, dict):
        return False, "Message must be a JSON object"

    msg_type = data.get("type")

    if msg_type == "SELECT_VEHICLE":
        try:
            SelectVehicleMessage(**data)
            return True, None
        except ValidationError as e:
            return False, f"Invalid SELECT_VEHICLE message: {e}"
    elif msg_type == "SELECT_SCENARIO":
        try:
            SelectScenarioMessage(**data)
            return True, None
        except ValidationError as e:
            return False, f"Invalid SELECT_SCENARIO message: {e}"
    else:
        return False, (
            f"Unknown message type: '{msg_type}'. "
            "Supported types: SELECT_VEHICLE, SELECT_SCENARIO"
        )
