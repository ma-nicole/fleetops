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
    if "password_reset_token_hash" not in cols:
        if dialect == "mysql":
            alters.append("ALTER TABLE users ADD COLUMN password_reset_token_hash VARCHAR(255) NULL")
        else:
            alters.append("ALTER TABLE users ADD COLUMN password_reset_token_hash VARCHAR(255)")
    if "password_reset_expires_at" not in cols:
        if dialect == "mysql":
            alters.append("ALTER TABLE users ADD COLUMN password_reset_expires_at DATETIME NULL")
        else:
            alters.append("ALTER TABLE users ADD COLUMN password_reset_expires_at DATETIME")
    if "company_name" not in cols:
        if dialect == "mysql":
            alters.append("ALTER TABLE users ADD COLUMN company_name VARCHAR(255) NULL")
        else:
            alters.append("ALTER TABLE users ADD COLUMN company_name VARCHAR(255)")

    if insp.has_table("feedback"):
        fb_cols = {c["name"]: c for c in insp.get_columns("feedback")}
        bk = fb_cols.get("booking_id")
        if bk is not None and bk.get("nullable") is False:
            if dialect == "mysql":
                alters.append("ALTER TABLE feedback MODIFY COLUMN booking_id INT NULL")
            else:
                alters.append("ALTER TABLE feedback ALTER COLUMN booking_id DROP NOT NULL")
        if dialect == "mysql":
            alters.append("ALTER TABLE feedback MODIFY COLUMN message TEXT NULL")
        else:
            alters.append("ALTER TABLE feedback ALTER COLUMN message TYPE TEXT")

    if insp.has_table("customer_saved_sites"):
        ss_cols = {c["name"] for c in insp.get_columns("customer_saved_sites")}
        v64 = "VARCHAR(64) NULL"
        blob = "TEXT NULL"
        additions: list[tuple[str, str]] = [
            ("street", blob),
            ("barangay", blob),
            ("city_municipality", blob),
            ("province", blob),
            ("postal_code", v64),
        ]
        for col, ddl_suffix in additions:
            if col not in ss_cols:
                alters.append(f"ALTER TABLE customer_saved_sites ADD COLUMN {col} {ddl_suffix}")

    if insp.has_table("bookings"):
        bk_cols = {c["name"] for c in insp.get_columns("bookings")}
        if "scheduled_time_slot" not in bk_cols:
            if dialect == "mysql":
                alters.append(
                    "ALTER TABLE bookings ADD COLUMN scheduled_time_slot VARCHAR(8) NOT NULL DEFAULT '08:00'"
                )
            else:
                alters.append(
                    "ALTER TABLE bookings ADD COLUMN scheduled_time_slot VARCHAR(8) NOT NULL DEFAULT '08:00'"
                )

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
