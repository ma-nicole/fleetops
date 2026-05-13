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
    if "availability_status" not in cols:
        alters.append("ALTER TABLE users ADD COLUMN availability_status VARCHAR(32) NOT NULL DEFAULT 'available'")

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
        if "required_truck_count" not in bk_cols:
            alters.append("ALTER TABLE bookings ADD COLUMN required_truck_count INT NOT NULL DEFAULT 1")
            alters.append("UPDATE bookings SET required_truck_count = 1 WHERE required_truck_count IS NULL")
        if "latest_location" not in bk_cols:
            alters.append("ALTER TABLE bookings ADD COLUMN latest_location VARCHAR(512) NULL")

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
        if "latest_location" not in tr_cols:
            alters.append("ALTER TABLE trips ADD COLUMN latest_location VARCHAR(512) NULL")

    if insp.has_table("booking_freight_settings"):
        bf_cols = {c["name"] for c in insp.get_columns("booking_freight_settings")}
        if "toll_fees_php_per_trip" not in bf_cols:
            alters.append(
                "ALTER TABLE booking_freight_settings ADD COLUMN toll_fees_php_per_trip FLOAT NOT NULL DEFAULT 0"
            )
        for col in (
            "truck_fuel_efficiency_kmpl",
            "cargo_rate_php_per_ton",
            "driver_freight_share_rate",
            "helper_freight_share_rate",
        ):
            if col in bf_cols:
                alters.append(f"ALTER TABLE booking_freight_settings DROP COLUMN {col}")
        legacy_cols = [
            "trip_wear_misc_php_per_km",
            "trip_depreciation_rate",
            "helper_pay_php_per_trip",
            "driver_freight_commission_rate",
            "cargo_weight_multiplier_per_ton",
        ]
        for col in legacy_cols:
            if col in bf_cols:
                alters.append(f"ALTER TABLE booking_freight_settings DROP COLUMN {col}")

    if insp.has_table("trucks"):
        tk_cols = {c["name"] for c in insp.get_columns("trucks")}
        if "model_name" not in tk_cols:
            v255 = "VARCHAR(255) NULL"
            alters.append(f"ALTER TABLE trucks ADD COLUMN model_name {v255}")
        if dialect == "mysql":
            alters.append("UPDATE trucks SET status = LOWER(COALESCE(status,'available'))")
        if "availability_status" not in tk_cols:
            alters.append("ALTER TABLE trucks ADD COLUMN availability_status VARCHAR(32) NOT NULL DEFAULT 'available'")

    if insp.has_table("truck_slot_holds"):
        if dialect == "mysql":
            alters.append(
                "ALTER TABLE truck_slot_holds MODIFY COLUMN hold_status VARCHAR(32) NOT NULL DEFAULT 'on_hold'"
            )

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
            if insp.has_table("truck_slot_holds") and insp.has_table("bookings"):
                conn.execute(
                    text(
                        "UPDATE truck_slot_holds h "
                        "INNER JOIN bookings b ON b.id = h.booking_id "
                        "SET h.hold_status = 'released' "
                        "WHERE b.status IN ('cancelled','rejected') "
                        "AND h.hold_status IN ('on_hold','payment_verification','ready_for_assignment','assigned')"
                    )
                )

    if insp.has_table("attendance_records"):
        ar_cols = {c["name"] for c in insp.get_columns("attendance_records")}
        if "check_out_time" not in ar_cols:
            dialect = engine.dialect.name
            co_null = "DATETIME NULL" if dialect == "mysql" else "DATETIME"
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE attendance_records ADD COLUMN check_out_time {co_null}"))
                conn.execute(
                    text(
                        "UPDATE attendance_records SET check_out_time = check_in_time "
                        "WHERE check_out_time IS NULL"
                    )
                )

    if not insp.has_table("operational_logs"):
        dialect = engine.dialect.name
        with engine.begin() as conn:
            if dialect == "mysql":
                conn.execute(
                    text(
                        """
                        CREATE TABLE operational_logs (
                            id INT AUTO_INCREMENT PRIMARY KEY,
                            booking_id INT NOT NULL,
                            trip_id INT NOT NULL,
                            dispatcher_id INT NOT NULL,
                            report_type VARCHAR(64) NOT NULL,
                            priority_level VARCHAR(16) NOT NULL,
                            operational_details TEXT NOT NULL,
                            attachment_url VARCHAR(512) NULL,
                            created_at DATETIME NOT NULL,
                            KEY ix_oplog_booking (booking_id),
                            KEY ix_oplog_trip (trip_id),
                            CONSTRAINT fk_oplog_booking FOREIGN KEY (booking_id) REFERENCES bookings(id),
                            CONSTRAINT fk_oplog_trip FOREIGN KEY (trip_id) REFERENCES trips(id),
                            CONSTRAINT fk_oplog_dispatcher FOREIGN KEY (dispatcher_id) REFERENCES users(id)
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                        """
                    )
                )
            else:
                conn.execute(
                    text(
                        """
                        CREATE TABLE operational_logs (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            booking_id INTEGER NOT NULL,
                            trip_id INTEGER NOT NULL,
                            dispatcher_id INTEGER NOT NULL,
                            report_type VARCHAR(64) NOT NULL,
                            priority_level VARCHAR(16) NOT NULL,
                            operational_details TEXT NOT NULL,
                            attachment_url VARCHAR(512),
                            created_at DATETIME NOT NULL
                        )
                        """
                    )
                )

    if not insp.has_table("vehicle_issue_reports"):
        dialect = engine.dialect.name
        with engine.begin() as conn:
            if dialect == "mysql":
                conn.execute(
                    text(
                        """
                        CREATE TABLE vehicle_issue_reports (
                            id INT AUTO_INCREMENT PRIMARY KEY,
                            booking_id INT NOT NULL,
                            trip_id INT NOT NULL,
                            truck_id INT NOT NULL,
                            driver_id INT NOT NULL,
                            helper_id INT NULL,
                            issue_type VARCHAR(64) NOT NULL,
                            priority VARCHAR(16) NOT NULL,
                            description TEXT NOT NULL,
                            attachment_url VARCHAR(512) NULL,
                            status VARCHAR(32) NOT NULL DEFAULT 'submitted',
                            created_at DATETIME NOT NULL,
                            updated_at DATETIME NOT NULL,
                            KEY ix_vir_trip (trip_id),
                            KEY ix_vir_booking (booking_id),
                            KEY ix_vir_driver (driver_id),
                            CONSTRAINT fk_vir_booking FOREIGN KEY (booking_id) REFERENCES bookings(id),
                            CONSTRAINT fk_vir_trip FOREIGN KEY (trip_id) REFERENCES trips(id),
                            CONSTRAINT fk_vir_truck FOREIGN KEY (truck_id) REFERENCES trucks(id),
                            CONSTRAINT fk_vir_driver FOREIGN KEY (driver_id) REFERENCES users(id),
                            CONSTRAINT fk_vir_helper FOREIGN KEY (helper_id) REFERENCES users(id)
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                        """
                    )
                )
            else:
                conn.execute(
                    text(
                        """
                        CREATE TABLE vehicle_issue_reports (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            booking_id INTEGER NOT NULL,
                            trip_id INTEGER NOT NULL,
                            truck_id INTEGER NOT NULL,
                            driver_id INTEGER NOT NULL,
                            helper_id INTEGER,
                            issue_type VARCHAR(64) NOT NULL,
                            priority VARCHAR(16) NOT NULL,
                            description TEXT NOT NULL,
                            attachment_url VARCHAR(512),
                            status VARCHAR(32) NOT NULL DEFAULT 'submitted',
                            created_at DATETIME NOT NULL,
                            updated_at DATETIME NOT NULL
                        )
                        """
                    )
                )

    if not insp.has_table("general_operational_reports"):
        dialect = engine.dialect.name
        with engine.begin() as conn:
            if dialect == "mysql":
                conn.execute(
                    text(
                        """
                        CREATE TABLE general_operational_reports (
                            id INT AUTO_INCREMENT PRIMARY KEY,
                            booking_id INT NOT NULL,
                            trip_id INT NOT NULL,
                            driver_id INT NOT NULL,
                            helper_id INT NULL,
                            category VARCHAR(64) NOT NULL,
                            status VARCHAR(32) NULL,
                            report_date DATE NOT NULL,
                            starting_odometer_km FLOAT NULL,
                            ending_odometer_km FLOAT NULL,
                            fuel_consumed FLOAT NULL,
                            description TEXT NOT NULL,
                            notes TEXT NULL,
                            attachment_url VARCHAR(512) NULL,
                            created_at DATETIME NOT NULL,
                            KEY ix_gor_trip (trip_id),
                            KEY ix_gor_booking (booking_id),
                            KEY ix_gor_driver (driver_id),
                            CONSTRAINT fk_gor_booking FOREIGN KEY (booking_id) REFERENCES bookings(id),
                            CONSTRAINT fk_gor_trip FOREIGN KEY (trip_id) REFERENCES trips(id),
                            CONSTRAINT fk_gor_driver FOREIGN KEY (driver_id) REFERENCES users(id),
                            CONSTRAINT fk_gor_helper FOREIGN KEY (helper_id) REFERENCES users(id)
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                        """
                    )
                )
            else:
                conn.execute(
                    text(
                        """
                        CREATE TABLE general_operational_reports (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            booking_id INTEGER NOT NULL,
                            trip_id INTEGER NOT NULL,
                            driver_id INTEGER NOT NULL,
                            helper_id INTEGER,
                            category VARCHAR(64) NOT NULL,
                            status VARCHAR(32),
                            report_date DATE NOT NULL,
                            starting_odometer_km FLOAT,
                            ending_odometer_km FLOAT,
                            fuel_consumed FLOAT,
                            description TEXT NOT NULL,
                            notes TEXT,
                            attachment_url VARCHAR(512),
                            created_at DATETIME NOT NULL
                        )
                        """
                    )
                )

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
            conn.execute(
                text(
                    "UPDATE bookings SET status = 'payment_verification' "
                    "WHERE status IN ('pending_approval')"
                )
            )


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
