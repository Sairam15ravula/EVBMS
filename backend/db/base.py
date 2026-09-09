"""
SQLAlchemy 2.0 DeclarativeBase base class and model registry.
"""
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy ORM models."""
    pass
