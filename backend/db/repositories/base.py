"""
Generic Async SQLAlchemy Repository Base Class.
"""
from typing import Any, Generic, List, Optional, Type, TypeVar
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# pyrefly: ignore [missing-import]
from backend.db.base import Base

ModelType = TypeVar("ModelType", bound=Base)


class BaseRepository(Generic[ModelType]):
    """Generic async CRUD repository."""

    def __init__(self, model: Type[ModelType], session: AsyncSession):
        self.model = model
        self.session = session

    async def get_by_id(self, id_val: Any) -> Optional[ModelType]:
        """Fetch a single record by primary key."""
        return await self.session.get(self.model, id_val)

    async def get_all(self, limit: int = 100, offset: int = 0) -> List[ModelType]:
        """Fetch multiple records with pagination."""
        query = select(self.model).offset(offset).limit(limit)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def create(self, **kwargs: Any) -> ModelType:
        """Create and persist a new model instance."""
        instance = self.model(**kwargs)
        self.session.add(instance)
        await self.session.commit()
        await self.session.refresh(instance)
        return instance

    async def update(self, instance: ModelType, **kwargs: Any) -> ModelType:
        """Update existing model attributes."""
        for key, value in kwargs.items():
            if hasattr(instance, key) and value is not None:
                setattr(instance, key, value)
        await self.session.commit()
        await self.session.refresh(instance)
        return instance

    async def delete(self, instance: ModelType) -> bool:
        """Delete a record."""
        await self.session.delete(instance)
        await self.session.commit()
        return True
