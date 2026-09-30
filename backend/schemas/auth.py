"""
Pydantic data validation schemas for authentication and user management.
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserRegisterRequest(BaseModel):
    """Registration request payload."""
    email: EmailStr
    password: str = Field(min_length=6, description="Password must be at least 6 characters")
    full_name: Optional[str] = None
    role: Optional[str] = Field(default="driver", description="admin, fleet_manager, technician, driver")


class UserLoginRequest(BaseModel):
    """Login credentials request payload."""
    email: EmailStr
    password: str


class RefreshTokenRequest(BaseModel):
    """Refresh token payload."""
    refresh_token: str


class TokenResponse(BaseModel):
    """JWT Token response contract."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user_id: str
    email: str
    role: str


class UserResponse(BaseModel):
    """User profile response contract."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    full_name: Optional[str] = None
    role: str
    is_active: bool
    created_at: datetime
