from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.models.base import Base


def get_database_url():
    """
    Build database URL based on configuration.
    Supports SQLite (development), MySQL, or Google Cloud SQL for MySQL.
    """
    if settings.database_url.startswith("sqlite://"):
        # SQLite doesn't support pool_pre_ping
        engine = create_engine(settings.database_url, connect_args={"check_same_thread": False})
    else:
        engine = create_engine(settings.database_url, pool_pre_ping=True, pool_size=10, max_overflow=20)
    return engine


engine = get_database_url()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
