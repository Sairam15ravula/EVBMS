"""
User Data Access Repository.
"""
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models import UserModel
from backend.db.repositories.base import BaseRepository


class UserRepository(BaseRepository[UserModel]):
    """User data operations repository."""

    def __init__(self, session: AsyncSession):
        super().__init__(UserModel, session)

    async def get_by_email(self, email: str) -> Optional[UserModel]:
        """Fetch user by unique email address."""
        query = select(UserModel).where(UserModel.email == email)
        result = await self.session.execute(query)
        return result.scalars().first()
