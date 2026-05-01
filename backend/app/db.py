from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.models.base import Base


# MySQL-only engine — XAMPP default is root with no password on port 3306.
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,   # detect stale connections
    pool_size=5,
    max_overflow=10,
    pool_recycle=1800,    # recycle connections every 30 minutes
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
