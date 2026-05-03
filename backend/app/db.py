from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
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


def apply_runtime_schema_fixes() -> None:
    """Add columns introduced after initial DB creation (create_all does not ALTER tables)."""
    try:
        insp = inspect(engine)
    except Exception:
        return
    if not insp.has_table("users"):
        return
    cols = {c["name"] for c in insp.get_columns("users")}
    dialect = engine.dialect.name
    alters: list[str] = []
    if "failed_login_count" not in cols:
        if dialect == "mysql":
            alters.append(
                "ALTER TABLE users ADD COLUMN failed_login_count INT NOT NULL DEFAULT 0"
            )
        else:
            alters.append(
                "ALTER TABLE users ADD COLUMN failed_login_count INTEGER NOT NULL DEFAULT 0"
            )
    if "locked_until" not in cols:
        if dialect == "mysql":
            alters.append("ALTER TABLE users ADD COLUMN locked_until DATETIME NULL")
        else:
            alters.append("ALTER TABLE users ADD COLUMN locked_until DATETIME")
    if not alters:
        return
    with engine.begin() as conn:
        for stmt in alters:
            conn.execute(text(stmt))


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
