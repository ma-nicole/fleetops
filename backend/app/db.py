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
        if "route_id" not in bk_cols:
            alters.append("ALTER TABLE bookings ADD COLUMN route_id INT NULL")
        doc_cols = [
            ("cargo_declaration_original_filename", "VARCHAR(255) NULL"),
            ("cargo_declaration_storage_path", "VARCHAR(512) NULL"),
            ("cargo_declaration_uploaded_at", "DATETIME NULL"),
            ("terms_agreement_original_filename", "VARCHAR(255) NULL"),
            ("terms_agreement_storage_path", "VARCHAR(512) NULL"),
            ("terms_agreement_uploaded_at", "DATETIME NULL"),
            ("terms_agreed_at", "DATETIME NULL"),
        ]
        for col, ddl_suffix in doc_cols:
            if col not in bk_cols:
                alters.append(f"ALTER TABLE bookings ADD COLUMN {col} {ddl_suffix}")
        customs_cols = [
            ("customs_clearance_status", "VARCHAR(32) NULL"),
            ("customs_tariff_notes", "VARCHAR(2000) NULL"),
            ("customs_additional_charges_php", "FLOAT NULL"),
            ("customs_customer_updated_at", "DATETIME NULL"),
            ("customs_admin_validated", "TINYINT(1) NOT NULL DEFAULT 0" if dialect == "mysql" else "BOOLEAN NOT NULL DEFAULT 0"),
            ("customs_validated_by_id", "INT NULL"),
            ("customs_validated_at", "DATETIME NULL"),
            ("customs_admin_notes", "VARCHAR(2000) NULL"),
            ("customs_validated_additional_charges_php", "FLOAT NULL"),
        ]
        for col, ddl_suffix in customs_cols:
            if col not in bk_cols:
                alters.append(f"ALTER TABLE bookings ADD COLUMN {col} {ddl_suffix}")
        pre_delivery_cols = [
            ("goods_declaration_validated", "TINYINT(1) NOT NULL DEFAULT 0" if dialect == "mysql" else "BOOLEAN NOT NULL DEFAULT 0"),
            ("cargo_type_validated", "TINYINT(1) NOT NULL DEFAULT 0" if dialect == "mysql" else "BOOLEAN NOT NULL DEFAULT 0"),
        ]
        for col, ddl_suffix in pre_delivery_cols:
            if col not in bk_cols:
                alters.append(f"ALTER TABLE bookings ADD COLUMN {col} {ddl_suffix}")
        goods_review_cols = [
            ("goods_declaration_review_status", "VARCHAR(32) NULL"),
            ("goods_declaration_review_remarks", "VARCHAR(2000) NULL"),
            ("goods_declaration_reviewed_at", "DATETIME NULL"),
            ("goods_declaration_reviewed_by_id", "INT NULL"),
        ]
        for col, ddl_suffix in goods_review_cols:
            if col not in bk_cols:
                alters.append(f"ALTER TABLE bookings ADD COLUMN {col} {ddl_suffix}")
        cargo_type_cols = [
            ("cargo_type_category", "VARCHAR(64) NULL"),
            ("cargo_type_admin_notes", "VARCHAR(2000) NULL"),
            ("cargo_restricted_flag", "TINYINT(1) NOT NULL DEFAULT 0" if dialect == "mysql" else "BOOLEAN NOT NULL DEFAULT 0"),
            ("cargo_restricted_reasons", "VARCHAR(2000) NULL"),
            ("cargo_type_validated_by_id", "INT NULL"),
            ("cargo_type_validated_at", "DATETIME NULL"),
        ]
        for col, ddl_suffix in cargo_type_cols:
            if col not in bk_cols:
                alters.append(f"ALTER TABLE bookings ADD COLUMN {col} {ddl_suffix}")
        toll_booking_cols = [
            ("estimated_toll_budget_php", "FLOAT NULL"),
            ("toll_matrix_matched", "TINYINT(1) NOT NULL DEFAULT 0" if dialect == "mysql" else "BOOLEAN NOT NULL DEFAULT 0"),
            ("toll_estimate_message", "VARCHAR(500) NULL"),
            ("vehicle_class_used", "VARCHAR(32) NULL"),
            ("toll_entry_point", "VARCHAR(255) NULL"),
            ("toll_exit_point", "VARCHAR(255) NULL"),
            ("toll_effective_date", "DATE NULL"),
        ]
        for col, ddl_suffix in toll_booking_cols:
            if col not in bk_cols:
                alters.append(f"ALTER TABLE bookings ADD COLUMN {col} {ddl_suffix}")

    if insp.has_table("trucks"):
        trk_cols = {c["name"] for c in insp.get_columns("trucks")}
        if "vehicle_class" not in trk_cols:
            alters.append("ALTER TABLE trucks ADD COLUMN vehicle_class VARCHAR(32) NOT NULL DEFAULT 'Class 3'")
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
        trip_additions = [
            ("helper_id", "INT NULL"),
            ("route_id", "INT NULL"),
            ("selected_route_option_id", "INT NULL"),
            ("maintenance_cost", "FLOAT NOT NULL DEFAULT 0"),
            ("predicted_total_cost", "FLOAT NOT NULL DEFAULT 0"),
            ("predicted_fuel_liters", "FLOAT NOT NULL DEFAULT 0"),
            ("predicted_duration_hours", "FLOAT NOT NULL DEFAULT 0"),
            ("driver_allowance_php", "FLOAT NOT NULL DEFAULT 0"),
            ("helper_allowance_php", "FLOAT NOT NULL DEFAULT 0"),
            ("receiving_document_path", "VARCHAR(512) NULL"),
            ("receiving_document_uploaded_at", "DATETIME NULL"),
            ("receiving_qr_token", "VARCHAR(64) NULL"),
            ("receiving_qr_verified_at", "DATETIME NULL"),
            ("digital_signature_path", "VARCHAR(512) NULL"),
            ("digital_signature_uploaded_at", "DATETIME NULL"),
        ]
        for col, ddl_suffix in trip_additions:
            if col not in tr_cols:
                alters.append(f"ALTER TABLE trips ADD COLUMN {col} {ddl_suffix}")
        for col, ddl_suffix in [
            ("estimated_toll_budget", "FLOAT NULL"),
            ("additional_toll_total", "FLOAT NULL"),
            ("toll_actual_total", "FLOAT NULL"),
            ("toll_variance", "FLOAT NULL"),
        ]:
            if col not in tr_cols:
                alters.append(f"ALTER TABLE trips ADD COLUMN {col} {ddl_suffix}")

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
        truck_additions = [
            ("fuel_efficiency_kmpl", "FLOAT NOT NULL DEFAULT 4"),
            ("odometer_km", "FLOAT NOT NULL DEFAULT 0"),
            ("age_years", "FLOAT NOT NULL DEFAULT 1"),
        ]
        for col, ddl_suffix in truck_additions:
            if col not in tk_cols:
                alters.append(f"ALTER TABLE trucks ADD COLUMN {col} {ddl_suffix}")

    if insp.has_table("driver_profiles"):
        dp_cols = {c["name"] for c in insp.get_columns("driver_profiles")}
        if "base_salary" not in dp_cols:
            alters.append("ALTER TABLE driver_profiles ADD COLUMN base_salary FLOAT NOT NULL DEFAULT 1200")

    if insp.has_table("maintenance_records"):
        mr_cols = {c["name"] for c in insp.get_columns("maintenance_records")}
        maint_additions = [
            ("status", "VARCHAR(32) NOT NULL DEFAULT 'ok'"),
            ("estimated_cost", "FLOAT NOT NULL DEFAULT 0"),
            ("actual_cost", "FLOAT NOT NULL DEFAULT 0"),
            ("parts_used", "VARCHAR(500) NULL"),
            ("next_service_date", "DATE NULL"),
            ("created_at", "DATETIME NULL"),
        ]
        for col, ddl_suffix in maint_additions:
            if col not in mr_cols:
                alters.append(f"ALTER TABLE maintenance_records ADD COLUMN {col} {ddl_suffix}")

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
                from app.services.demo_booking_filter import demo_booking_sql_where

                demo_where = demo_booking_sql_where("b.")
                conn.execute(
                    text(
                        "UPDATE truck_slot_holds h "
                        "INNER JOIN bookings b ON b.id = h.booking_id "
                        "SET h.hold_status = 'released' "
                        "WHERE b.status IN ('cancelled','rejected','payment_rejected','completed','expired') "
                        "AND h.hold_status IN ('on_hold','payment_verification','ready_for_assignment','assigned')"
                    )
                )
                conn.execute(
                    text(
                        "UPDATE truck_slot_holds h "
                        "INNER JOIN bookings b ON b.id = h.booking_id "
                        "SET h.hold_status = 'released' "
                        f"WHERE {demo_where} "
                        "AND h.hold_status IN ('on_hold','payment_verification','ready_for_assignment','assigned')"
                    )
                )

            if insp.has_table("users"):
                if dialect == "mysql":
                    conn.execute(
                        text(
                            "ALTER TABLE users MODIFY COLUMN role "
                            "ENUM('ADMIN','MANAGER','DISPATCHER','DRIVER','HELPER','CUSTOMER') NOT NULL"
                        )
                    )
                conn.execute(
                    text(
                        "UPDATE users SET role = 'HELPER' "
                        "WHERE (role = '' OR role IS NULL) AND LOWER(email) LIKE '%helper%'"
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

    if not insp.has_table("driver_trip_notifications"):
        dialect = engine.dialect.name
        with engine.begin() as conn:
            if dialect == "mysql":
                conn.execute(
                    text(
                        """
                        CREATE TABLE driver_trip_notifications (
                            id INT AUTO_INCREMENT PRIMARY KEY,
                            driver_id INT NOT NULL,
                            trip_id INT NULL,
                            booking_id INT NOT NULL,
                            kind VARCHAR(32) NOT NULL,
                            schedule_summary VARCHAR(255) NOT NULL DEFAULT '',
                            route_summary VARCHAR(512) NOT NULL DEFAULT '',
                            required_action VARCHAR(512) NOT NULL DEFAULT '',
                            read_at DATETIME NULL,
                            created_at DATETIME NOT NULL,
                            KEY ix_dtn_driver (driver_id),
                            KEY ix_dtn_trip (trip_id),
                            KEY ix_dtn_booking (booking_id),
                            CONSTRAINT fk_dtn_driver FOREIGN KEY (driver_id) REFERENCES users(id),
                            CONSTRAINT fk_dtn_trip FOREIGN KEY (trip_id) REFERENCES trips(id),
                            CONSTRAINT fk_dtn_booking FOREIGN KEY (booking_id) REFERENCES bookings(id)
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                        """
                    )
                )
            else:
                conn.execute(
                    text(
                        """
                        CREATE TABLE driver_trip_notifications (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            driver_id INTEGER NOT NULL,
                            trip_id INTEGER,
                            booking_id INTEGER NOT NULL,
                            kind VARCHAR(32) NOT NULL,
                            schedule_summary VARCHAR(255) NOT NULL DEFAULT '',
                            route_summary VARCHAR(512) NOT NULL DEFAULT '',
                            required_action VARCHAR(512) NOT NULL DEFAULT '',
                            read_at DATETIME,
                            created_at DATETIME NOT NULL
                        )
                        """
                    )
                )

    # Toll matrix enhancement tables (additive)
    from app.models.entities import AdditionalTollEntry, HistoricalTollRecord, TollMatrix, TollPlaza, TollPlazaAlias

    for table in (TollMatrix.__table__, AdditionalTollEntry.__table__, HistoricalTollRecord.__table__, TollPlaza.__table__, TollPlazaAlias.__table__):
        if not insp.has_table(table.name):
            table.create(bind=engine, checkfirst=True)

    if insp.has_table("toll_matrix"):
        tm_cols = {c["name"] for c in insp.get_columns("toll_matrix")}
        tm_alters: list[str] = []
        date_type = "DATE" if dialect == "mysql" else "DATE"
        if "entry_point" not in tm_cols:
            tm_alters.append("ALTER TABLE toll_matrix ADD COLUMN entry_point VARCHAR(255) NULL")
        if "exit_point" not in tm_cols:
            tm_alters.append("ALTER TABLE toll_matrix ADD COLUMN exit_point VARCHAR(255) NULL")
        if "toll_fee" not in tm_cols:
            tm_alters.append("ALTER TABLE toll_matrix ADD COLUMN toll_fee FLOAT NULL")
        if "effective_date" not in tm_cols:
            tm_alters.append(f"ALTER TABLE toll_matrix ADD COLUMN effective_date {date_type} NULL")
        with engine.begin() as conn:
            for stmt in tm_alters:
                conn.execute(text(stmt))
            if "origin" in tm_cols:
                conn.execute(
                    text(
                        "UPDATE toll_matrix SET entry_point = origin "
                        "WHERE entry_point IS NULL OR TRIM(entry_point) = ''"
                    )
                )
            if "destination" in tm_cols:
                conn.execute(
                    text(
                        "UPDATE toll_matrix SET exit_point = destination "
                        "WHERE exit_point IS NULL OR TRIM(exit_point) = ''"
                    )
                )
            if "estimated_toll" in tm_cols:
                fee_expr = "COALESCE(estimated_toll, 0)"
                if "rfid_allowance" in tm_cols:
                    fee_expr += " + COALESCE(rfid_allowance, 0)"
                if "route_buffer" in tm_cols:
                    fee_expr += " + COALESCE(route_buffer, 0)"
                conn.execute(
                    text(
                        f"UPDATE toll_matrix SET toll_fee = {fee_expr} "
                        "WHERE toll_fee IS NULL OR toll_fee = 0"
                    )
                )
            conn.execute(
                text(
                    "UPDATE toll_matrix SET effective_date = '2026-01-20' "
                    "WHERE effective_date IS NULL"
                )
            )

    if insp.has_table("historical_toll_records"):
        hr_cols = {c["name"] for c in insp.get_columns("historical_toll_records")}
        hr_alters: list[str] = []
        if "entry_point" not in hr_cols:
            hr_alters.append("ALTER TABLE historical_toll_records ADD COLUMN entry_point VARCHAR(255) NULL")
        if "exit_point" not in hr_cols:
            hr_alters.append("ALTER TABLE historical_toll_records ADD COLUMN exit_point VARCHAR(255) NULL")
        if "effective_date" not in hr_cols:
            hr_alters.append(f"ALTER TABLE historical_toll_records ADD COLUMN effective_date DATE NULL")
        if hr_alters:
            with engine.begin() as conn:
                for stmt in hr_alters:
                    conn.execute(text(stmt))

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
            conn.execute(
                text(
                    "UPDATE bookings SET status = 'payment_verification' "
                    "WHERE status IS NULL OR TRIM(status) = ''"
                )
            )


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
