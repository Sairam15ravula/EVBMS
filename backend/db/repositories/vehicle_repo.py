"""
Vehicle Asset Data Access Repository.
"""
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.db.models import BatteryPackModel, VehicleModel
from backend.db.repositories.base import BaseRepository


class VehicleRepository(BaseRepository[VehicleModel]):
    """Vehicle asset repository."""

    def __init__(self, session: AsyncSession):
        super().__init__(VehicleModel, session)

    async def get_with_pack(self, vehicle_id: str) -> Optional[VehicleModel]:
        """Fetch vehicle by ID with associated battery pack eager loaded."""
        query = (
            select(VehicleModel)
            .where(VehicleModel.id == vehicle_id)
            .options(selectinload(VehicleModel.battery_pack))
        )
        result = await self.session.execute(query)
        return result.scalars().first()

    async def get_by_owner(self, owner_id: str) -> List[VehicleModel]:
        """Fetch all vehicles owned by a specific user."""
        query = select(VehicleModel).where(VehicleModel.owner_id == owner_id)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def create_battery_pack(self, vehicle_id: str, **kwargs) -> BatteryPackModel:
        """Create and associate a battery pack with a vehicle."""
        pack = BatteryPackModel(vehicle_id=vehicle_id, **kwargs)
        self.session.add(pack)
        await self.session.commit()
        await self.session.refresh(pack)
        return pack
