"""
Vehicle fleet management & battery pack CRUD API routes.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.repositories.vehicle_repo import VehicleRepository
from backend.db.session import get_async_session
from backend.schemas.fleet import VehicleCreateRequest, VehicleResponse

router = APIRouter(prefix="/api/vehicles", tags=["vehicles"])


@router.get("", response_model=List[VehicleResponse])
async def list_vehicles(
    limit: int = Query(default=50, le=500),
    offset: int = Query(default=0),
    owner_id: Optional[str] = None,
    session: AsyncSession = Depends(get_async_session),
):
    """List all registered EV vehicles (with optional owner filter)."""
    vehicle_repo = VehicleRepository(session)
    if owner_id:
        return await vehicle_repo.get_by_owner(owner_id)
    return await vehicle_repo.get_all(limit=limit, offset=offset)


@router.post("", response_model=VehicleResponse, status_code=status.HTTP_201_CREATED)
async def create_vehicle(
    req: VehicleCreateRequest, session: AsyncSession = Depends(get_async_session)
):
    """Register a new vehicle asset and create associated battery pack configuration."""
    vehicle_repo = VehicleRepository(session)
    existing = await vehicle_repo.get_by_id(req.id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Vehicle with ID '{req.id}' already exists.",
        )

    vehicle = await vehicle_repo.create(
        id=req.id,
        name=req.name,
        model=req.model,
        chemistry=req.chemistry,
        total_energy_kwh=req.total_energy_kwh,
        nominal_voltage=req.nominal_voltage,
        owner_id=req.owner_id,
    )

    # Create associated battery pack if serial number is provided
    serial = req.serial_number or f"PACK-{req.id.upper()}-01"
    initial_cap = req.initial_capacity_ah or (req.total_energy_kwh * 1000.0 / req.nominal_voltage)
    await vehicle_repo.create_battery_pack(
        vehicle_id=vehicle.id,
        serial_number=serial,
        initial_capacity_ah=initial_cap,
        cell_count=req.cell_count or 96,
    )

    # Return created vehicle with pack
    return await vehicle_repo.get_with_pack(vehicle.id)


@router.get("/{vehicle_id}", response_model=VehicleResponse)
async def get_vehicle(vehicle_id: str, session: AsyncSession = Depends(get_async_session)):
    """Fetch single vehicle asset with associated battery pack."""
    vehicle_repo = VehicleRepository(session)
    vehicle = await vehicle_repo.get_with_pack(vehicle_id)
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Vehicle '{vehicle_id}' not found.",
        )
    return vehicle


@router.delete("/{vehicle_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vehicle(vehicle_id: str, session: AsyncSession = Depends(get_async_session)):
    """Delete a vehicle asset."""
    vehicle_repo = VehicleRepository(session)
    vehicle = await vehicle_repo.get_by_id(vehicle_id)
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Vehicle '{vehicle_id}' not found.",
        )
    await vehicle_repo.delete(vehicle)
    return None
