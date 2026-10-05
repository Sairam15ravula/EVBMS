"""
Authentication and JWT Security Utilities.
"""
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import jwt
import bcrypt

ENV = os.getenv("ENV", "development")
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "evbms_super_secret_jwt_key_change_in_production_2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

DEFAULT_SECRET_KEY = "evbms_super_secret_jwt_key_change_in_production_2026"


def _validate_production_secret() -> None:
    """Raise RuntimeError if running in production with the default JWT secret key."""
    if ENV == "production" and SECRET_KEY == DEFAULT_SECRET_KEY:
        raise RuntimeError(
            "JWT_SECRET_KEY must be set to a non-default value in production. "
            "Set the JWT_SECRET_KEY environment variable to a secure random string."
        )


# Validate at module import time to fail fast on misconfiguration
_validate_production_secret()


def hash_password(password: str) -> str:
    """Hash password using bcrypt directly (no passlib dependency)."""
    password_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plain password against bcrypt hashed password."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except Exception:
        return False


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Generate short-lived JWT access token."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta if expires_delta else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"type": "access", "iat": now, "exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Generate long-lived JWT refresh token."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta if expires_delta else timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS))
    to_encode.update({"type": "refresh", "iat": now, "exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and validate JWT token payload."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.PyJWTError:
        return None
