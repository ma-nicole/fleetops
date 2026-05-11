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
        if dialect == "mysql":
            alters.append(
                "ALTER TABLE bookings MODIFY COLUMN status VARCHAR(32) NOT NULL DEFAULT 'pending_approval'"
            )

    if insp.has_table("payments"):
        pay_cols = {c["name"] for c in insp.get_columns("payments")}
        v255 = "VARCHAR(255) NULL"
        v512 = "VARCHAR(512) NULL"
        dt_null = "DATETIME NULL" if dialect == "mysql" else "DATETIME"
        int_null = "INT NULL"
        additions = [
            ("proof_original_filename", v255),
            ("proof_storage_path", v512),
            ("proof_uploaded_at", dt_null),
            ("reviewed_at", dt_null),
            ("reviewed_by_id", int_null),
        ]
        for col, ddl_suffix in additions:
            if col not in pay_cols:
                alters.append(f"ALTER TABLE payments ADD COLUMN {col} {ddl_suffix}")

        if dialect == "mysql":
            alters.append(
                "ALTER TABLE payments MODIFY COLUMN status VARCHAR(32) NOT NULL DEFAULT 'for_verification'"
            )

    if insp.has_table("trips"):
        tr_cols = {c["name"] for c in insp.get_columns("trips")}
        if "helper_progress_status" not in tr_cols:
            if dialect == "mysql":
                alters.append("ALTER TABLE trips ADD COLUMN helper_progress_status VARCHAR(32) NULL")
            else:
                alters.append("ALTER TABLE trips ADD COLUMN helper_progress_status VARCHAR(32) NULL")
        if "helper_last_proof_path" not in tr_cols:
            if dialect == "mysql":
                alters.append("ALTER TABLE trips ADD COLUMN helper_last_proof_path VARCHAR(512) NULL")
            else:
                alters.append("ALTER TABLE trips ADD COLUMN helper_last_proof_path VARCHAR(512) NULL")

    if alters or insp.has_table("payments"):
        with engine.begin() as conn:
            for stmt in alters:
                conn.execute(text(stmt))

            if insp.has_table("payments"):
                conn.execute(
                    text(
                        "UPDATE payments SET status = 'for_verification' "
                        "WHERE status IN ('pending', 'processing')"
                    )
                )
                conn.execute(text("UPDATE payments SET status = 'verified' WHERE status = 'paid'"))
                conn.execute(text("UPDATE payments SET status = 'rejected' WHERE status = 'failed'"))

    # Legacy MySQL ENUM on bookings.status often stored Python enum *names* (PENDING_APPROVAL) not values
    # (pending_approval) — that breaks SQLAlchemy's Enum. Normalize on every startup (idempotent).
    if insp.has_table("bookings"):
        from app.models.entities import BookingStatus

        with engine.begin() as conn:
            for m in BookingStatus:
                conn.execute(
                    text("UPDATE bookings SET status = :v WHERE status = :bad"),
                    {"v": m.value, "bad": m.name},
                )


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
