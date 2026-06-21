#!/usr/bin/env python3
"""
Database Seeding Script for FleetOpts (paper §3.2 + §3.5).

Creates realistic test data for UAT and to bootstrap the analytics
pipeline (predictive cost regression needs at least 5 historical trips,
the time-series model prefers 12 months).

Usage:
  python seed_db.py                    # seed only if DB has no users
  python seed_db.py --force            # drop all tables, recreate, then seed (destructive)
  python seed_db.py --repair-passwords # re-bcrypt every user as password "password" (local dev fix)
"""
from __future__ import annotations

import argparse
import os
import sys
from datetime import date, datetime, timedelta

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from app.core.config import settings  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.db import Base  # noqa: E402
from app.models.entities import (  # noqa: E402
    AttendanceRecord,
    Booking,
    BookingStatus,
    CompletionReport,
    DriverProfile,
    Feedback,
    FuelLog,
    HelperProfile,
    HistoricalTollRecord,
    JobOrder,
    MaintenanceRecord,
    MaintenanceStatus,
    OperationalLog,
    Payment,
    PaymentStatus,
    PredictionFeedback,
    PricingConfig,
    ReportStatus,
    Route,
    ServiceType,
    TollLog,
    Transaction,
    Trip,
    TripIssue,
    TripStatus,
    Truck,
    TruckBanRule,
    User,
    UserRole,
    VehicleIssueReport,
    VehicleIssueReportStatus,
)


def repair_user_password_hashes() -> None:
    """Reset all stored password hashes to bcrypt('password'). For local dev when hashes are missing or invalid."""
    if not settings.database_url or settings.database_url.startswith("sqlite"):
        raise SystemExit(
            "ERROR: SQLite is not supported.\n"
            "Set DATABASE_URL=mysql+pymysql://... in backend/.env"
        )
    engine = create_engine(settings.database_url, pool_pre_ping=True)
    with Session(engine) as db:
        users = db.query(User).all()
        if not users:
            print("[SKIP] No users in database.")
            return
        for u in users:
            u.password_hash = hash_password("password")
        db.commit()
        print(f"[OK] Re-hashed passwords for {len(users)} user(s). All use password: password")


def seed_database(*, force: bool = False) -> None:
    if not settings.database_url or settings.database_url.startswith("sqlite"):
        raise SystemExit(
            "ERROR: SQLite is not supported.\n"
            "Set DATABASE_URL=mysql+pymysql://root:@localhost:3306/fleetopt in backend/.env"
        )
    engine = create_engine(settings.database_url, pool_pre_ping=True)
    if force:
        print("[WARN] --force: dropping all tables (destructive), then creating schema...")
        Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    with Session(engine) as db:
        if not force and db.query(User).count() > 0:
            print("[SKIP] Database already has users -- skipping seed (drop tables to re-seed).")
            return

        print("[INFO] Seeding database with test data...")

        # ----------- Users -----------
        users = [
            User(email="customer1@fleetops.com", password_hash=hash_password("password"), full_name="Acme Corporation", role=UserRole.CUSTOMER, phone="+63-917-0001"),
            User(email="customer2@fleetops.com", password_hash=hash_password("password"), full_name="Global Logistics Inc", role=UserRole.CUSTOMER, phone="+63-917-0002"),
            User(email="dispatcher@fleetops.com", password_hash=hash_password("password"), full_name="John Dispatcher", role=UserRole.DISPATCHER, phone="+63-917-1001"),
            User(email="driver1@fleetops.com", password_hash=hash_password("password"), full_name="Mike Johnson", role=UserRole.DRIVER, phone="+63-917-2001"),
            User(email="driver2@fleetops.com", password_hash=hash_password("password"), full_name="Sarah Williams", role=UserRole.DRIVER, phone="+63-917-2002"),
            User(email="driver3@fleetops.com", password_hash=hash_password("password"), full_name="David Brown", role=UserRole.DRIVER, phone="+63-917-2003"),
            User(email="helper1@fleetops.com", password_hash=hash_password("password"), full_name="Pedro Helper", role=UserRole.HELPER, phone="+63-917-2101"),
            User(email="helper2@fleetops.com", password_hash=hash_password("password"), full_name="Maria Helper", role=UserRole.HELPER, phone="+63-917-2102"),
            User(email="manager@fleetops.com", password_hash=hash_password("password"), full_name="Jane Manager", role=UserRole.MANAGER, phone="+63-917-3001"),
            User(email="admin@fleetops.com", password_hash=hash_password("password"), full_name="Admin User", role=UserRole.ADMIN, phone="+63-917-9001"),
        ]
        db.add_all(users)
        db.flush()
        print(f"[OK] Users: {len(users)}")

        customers = [u for u in users if u.role == UserRole.CUSTOMER]
        drivers = [u for u in users if u.role == UserRole.DRIVER]
        helpers = [u for u in users if u.role == UserRole.HELPER]
        manager = next(u for u in users if u.role == UserRole.MANAGER)
        dispatcher = next(u for u in users if u.role == UserRole.DISPATCHER)

        # ----------- Trucks -----------
        trucks = [
            Truck(code="TRK-001", capacity_tons=20, status="available", fuel_efficiency_kmpl=4.2, odometer_km=58000, age_years=4),
            Truck(code="TRK-002", capacity_tons=20, status="available", fuel_efficiency_kmpl=4.0, odometer_km=72000, age_years=5),
            Truck(code="TRK-003", capacity_tons=15, status="in_maintenance", fuel_efficiency_kmpl=4.5, odometer_km=110000, age_years=7),
            Truck(code="TRK-004", capacity_tons=25, status="available", fuel_efficiency_kmpl=3.8, odometer_km=22000, age_years=2),
            Truck(code="TRK-005", capacity_tons=30, status="available", fuel_efficiency_kmpl=3.5, odometer_km=14000, age_years=1),
        ]
        db.add_all(trucks)
        db.flush()
        print(f"[OK] Trucks: {len(trucks)}")

        # ----------- Routes -----------
        routes = [
            Route(origin="Warehouse-Tarlac", destination="Customer-QC", distance_km=140, eta_hours=3.5, road_class="highway", base_toll=210),
            Route(origin="Warehouse-Tarlac", destination="Customer-Pasig", distance_km=158, eta_hours=4.0, road_class="highway", base_toll=235),
            Route(origin="Hub-Pampanga", destination="Customer-Makati", distance_km=110, eta_hours=2.8, road_class="urban", base_toll=170),
            Route(origin="SMC-Plant-Bulacan", destination="Customer-Caloocan", distance_km=22, eta_hours=0.7, road_class="urban", base_toll=30),
            Route(origin="Hub-Cabanatuan", destination="Hub-Manila-North", distance_km=95, eta_hours=2.4, road_class="highway", base_toll=140),
        ]
        db.add_all(routes)
        db.flush()
        print(f"[OK] Routes: {len(routes)}")

        db.add_all([
            TruckBanRule(name="EDSA-Bus-Lane-Truck-Ban", road_segment="Hub-Manila-North", weekdays_csv="Mon,Tue,Wed,Thu,Fri", start_hour=6, end_hour=9, description="Morning truck ban (paper Fig 25)"),
            TruckBanRule(name="EDSA-PM-Ban", road_segment="Customer-QC", weekdays_csv="Mon,Tue,Wed,Thu,Fri", start_hour=17, end_hour=21, description="Evening truck ban"),
        ])
        db.flush()

        # ----------- Profiles -----------
        db.add_all([
            DriverProfile(user_id=drivers[0].id, compliance_status="compliant", rating=4.8, deduction_amount=0, base_salary=1500),
            DriverProfile(user_id=drivers[1].id, compliance_status="compliant", rating=4.5, deduction_amount=50, base_salary=1450),
            DriverProfile(user_id=drivers[2].id, compliance_status="warning", rating=3.6, deduction_amount=200, base_salary=1300),
        ])
        db.add_all([
            HelperProfile(user_id=helpers[0].id, rating=4.7, base_salary=900),
            HelperProfile(user_id=helpers[1].id, rating=4.4, base_salary=850),
        ])

        # ----------- Pricing -----------
        db.add_all([
            PricingConfig(service_type=ServiceType.FIXED, base_rate=2000, labor_rate=120, helper_rate=80),
            PricingConfig(service_type=ServiceType.CUSTOMIZED, base_rate=3500, labor_rate=180, helper_rate=120),
        ])

        # ----------- Bookings & trips spread over 18 months -----------
        today = date.today()
        bookings: list[Booking] = []
        trips: list[Trip] = []
        ISSUE_TYPES = ["traffic", "mechanical", "weather", "customs", "loading_delay"]
        REPORT_TYPES = ["delay", "traffic", "route_deviation", "customs_hold"]
        total_bookings = 96

        for seq in range(total_bookings):
            customer = customers[seq % len(customers)]
            days_ago = 14 + (seq * 6)
            scheduled = today - timedelta(days=days_ago)
            route = routes[seq % len(routes)]

            if days_ago > 45:
                status = BookingStatus.COMPLETED
            elif days_ago > 14:
                status = BookingStatus.COMPLETED if seq % 6 != 0 else BookingStatus.ASSIGNED
            elif seq % 4 == 0:
                status = BookingStatus.OUT_FOR_DELIVERY
            elif seq % 4 == 1:
                status = BookingStatus.LOADING
            elif seq % 4 == 2:
                status = BookingStatus.ASSIGNED
            elif seq % 4 == 3:
                status = BookingStatus.APPROVED
            else:
                status = BookingStatus.PENDING_APPROVAL

            if seq >= total_bookings - 2:
                status = BookingStatus.PENDING_APPROVAL

            booking = Booking(
                customer_id=customer.id,
                pickup_location=route.origin,
                dropoff_location=route.destination,
                service_type=ServiceType.FIXED if seq % 2 == 0 else ServiceType.CUSTOMIZED,
                scheduled_date=scheduled,
                cargo_weight_tons=5 + (seq % 8),
                estimated_cost=3500 + seq * 180 + (seq % 12) * 40,
                status=status,
                approved_by_id=manager.id if status not in (BookingStatus.PENDING_APPROVAL, BookingStatus.REJECTED) else None,
                approved_at=datetime.utcnow() - timedelta(days=days_ago, hours=12)
                if status not in (BookingStatus.PENDING_APPROVAL, BookingStatus.REJECTED)
                else None,
                created_at=datetime.utcnow() - timedelta(days=days_ago + 2),
            )
            bookings.append(booking)

        db.add_all(bookings)
        db.flush()
        print(f"[OK] Bookings: {len(bookings)}")

        operational_logs: list[OperationalLog] = []
        trip_issues: list[TripIssue] = []
        vehicle_issues: list[VehicleIssueReport] = []

        for idx, booking in enumerate(bookings):
            if booking.status in (BookingStatus.PENDING_APPROVAL, BookingStatus.REJECTED, BookingStatus.APPROVED):
                continue
            distance_km = 60 + (idx % 5) * 18
            trip_status = (
                TripStatus.COMPLETED
                if booking.status == BookingStatus.COMPLETED
                else TripStatus.IN_DELIVERY
                if booking.status == BookingStatus.OUT_FOR_DELIVERY
                else TripStatus.LOADING
                if booking.status == BookingStatus.LOADING
                else TripStatus.ASSIGNED
            )
            days_ago = (today - booking.scheduled_date).days if booking.scheduled_date else idx + 1
            completed_at = (
                datetime.utcnow() - timedelta(days=max(days_ago - 1, 1), hours=idx % 8)
                if trip_status == TripStatus.COMPLETED
                else None
            )
            departure = (
                completed_at - timedelta(hours=5)
                if completed_at
                else datetime.utcnow() - timedelta(hours=2 + (idx % 6))
            )
            fuel_cost = round(distance_km * 0.32 * 65, 2)
            toll_cost = round(distance_km * 1.5, 2)
            labor_cost = round((distance_km / 50) * 120, 2)
            predicted_total = round(fuel_cost + toll_cost + labor_cost + (idx * 12), 2)

            trip = Trip(
                booking_id=booking.id,
                truck_id=trucks[idx % len(trucks)].id,
                driver_id=drivers[idx % len(drivers)].id,
                helper_id=helpers[idx % len(helpers)].id,
                dispatcher_id=dispatcher.id,
                route_path=f'["{booking.pickup_location}","Hub-Manila-North","{booking.dropoff_location}"]',
                distance_km=distance_km,
                fuel_cost=fuel_cost,
                toll_cost=toll_cost,
                labor_cost=labor_cost,
                duration_hours=round(distance_km / 50, 1),
                predicted_total_cost=predicted_total,
                predicted_fuel_liters=round(distance_km / 4.0, 2),
                predicted_duration_hours=round(distance_km / 50, 1),
                status=trip_status,
                assigned_at=departure - timedelta(hours=6),
                accepted_at=departure - timedelta(hours=3),
                departure_time=departure,
                arrival_pickup_time=departure + timedelta(minutes=45),
                loading_start_time=departure + timedelta(minutes=50),
                loading_end_time=departure + timedelta(hours=1, minutes=30),
                departure_delivery_time=departure + timedelta(hours=1, minutes=35),
                arrival_delivery_time=completed_at,
                completed_at=completed_at,
                proof_of_delivery=f"https://podstore.example.com/pods/{idx}.png" if completed_at else None,
            )
            trips.append(trip)

        db.add_all(trips)
        db.flush()
        print(f"[OK] Trips: {len(trips)}")

        for idx, trip in enumerate(trips):
            if trip.status != TripStatus.COMPLETED or not trip.completed_at:
                continue
            if idx % 4 == 0:
                issue_type = ISSUE_TYPES[idx % len(ISSUE_TYPES)]
                trip_issues.append(
                    TripIssue(
                        trip_id=trip.id,
                        reported_by_id=trip.driver_id,
                        issue_type=issue_type,
                        description=f"{issue_type.replace('_', ' ').title()} reported during trip execution",
                        severity="high" if issue_type in ("mechanical", "weather") else "medium",
                        resolved=idx % 8 != 0,
                        created_at=trip.completed_at - timedelta(hours=2),
                    )
                )
            if idx % 5 == 0:
                operational_logs.append(
                    OperationalLog(
                        booking_id=trip.booking_id,
                        trip_id=trip.id,
                        dispatcher_id=dispatcher.id,
                        report_type=REPORT_TYPES[idx % len(REPORT_TYPES)],
                        priority_level="high" if idx % 10 == 0 else "medium",
                        operational_details="Delay logged from dispatcher operations center during monitoring.",
                        created_at=trip.completed_at - timedelta(hours=1),
                    )
                )
            if idx % 7 == 0:
                vehicle_issues.append(
                    VehicleIssueReport(
                        booking_id=trip.booking_id,
                        trip_id=trip.id,
                        truck_id=trip.truck_id,
                        driver_id=trip.driver_id,
                        helper_id=trip.helper_id,
                        issue_type="breakdown" if idx % 14 == 0 else "warning_light",
                        priority="high" if idx % 14 == 0 else "medium",
                        description="Vehicle issue observed during or after trip completion.",
                        status=VehicleIssueReportStatus.RESOLVED if idx % 3 == 0 else VehicleIssueReportStatus.SUBMITTED,
                    )
                )

        db.add_all(operational_logs)
        db.add_all(trip_issues)
        db.add_all(vehicle_issues)
        print(f"[OK] Operational logs: {len(operational_logs)}, trip issues: {len(trip_issues)}, vehicle issues: {len(vehicle_issues)}")

        # ----------- Fuel & toll logs for completed trips -----------
        fuel_logs: list[FuelLog] = []
        toll_logs: list[TollLog] = []
        completion_reports: list[CompletionReport] = []
        prediction_feedback: list[PredictionFeedback] = []
        for trip in trips:
            if trip.status != TripStatus.COMPLETED:
                continue
            fuel_logs.append(FuelLog(
                trip_id=trip.id,
                truck_id=trip.truck_id,
                driver_id=trip.driver_id,
                liters=round(trip.distance_km / 4.0, 2),
                cost=trip.fuel_cost,
                odometer_km=trip.distance_km,
                recorded_at=trip.completed_at or datetime.utcnow(),
            ))
            toll_logs.append(TollLog(
                trip_id=trip.id,
                driver_id=trip.driver_id,
                location="NLEX/SCTEX",
                amount=trip.toll_cost,
                recorded_at=trip.completed_at or datetime.utcnow(),
            ))
            completion_reports.append(CompletionReport(
                trip_id=trip.id,
                booking_id=trip.booking_id,
                generated_by_id=trip.driver_id,
                summary=f"Trip {trip.id} completed cleanly",
                fuel_total=trip.fuel_cost,
                toll_total=trip.toll_cost,
                labor_total=trip.labor_cost,
                total_cost=trip.fuel_cost + trip.toll_cost + trip.labor_cost,
                status=ReportStatus.CONFIRMED,
                confirmed_by_id=dispatcher.id,
                confirmed_at=datetime.utcnow(),
            ))
            actual_total = trip.fuel_cost + trip.toll_cost + trip.labor_cost
            prediction_feedback.append(PredictionFeedback(
                trip_id=trip.id,
                model_name="trip_cost",
                predicted_value=trip.predicted_total_cost,
                actual_value=actual_total,
                error=round(actual_total - trip.predicted_total_cost, 2),
                abs_pct_error=round(abs(actual_total - trip.predicted_total_cost) / max(actual_total, 1) * 100, 2),
            ))
        db.add_all(fuel_logs)
        db.add_all(toll_logs)
        db.add_all(completion_reports)
        db.add_all(prediction_feedback)

        toll_history: list[HistoricalTollRecord] = []
        for trip in trips:
            if trip.status != TripStatus.COMPLETED or not trip.completed_at:
                continue
            booking = next(b for b in bookings if b.id == trip.booking_id)
            estimated = float(trip.toll_cost or 0)
            actual = round(estimated * (0.92 + (trip.id % 5) * 0.03), 2)
            toll_history.append(
                HistoricalTollRecord(
                    trip_id=trip.id,
                    booking_id=trip.booking_id,
                    route_label=f"{booking.pickup_location} → {booking.dropoff_location}",
                    origin=booking.pickup_location,
                    destination=booking.dropoff_location,
                    estimated_toll=estimated,
                    actual_toll=actual,
                    toll_variance=round(actual - estimated, 2),
                    completed_at=trip.completed_at,
                )
            )
        db.add_all(toll_history)
        print(f"[OK] Historical toll records: {len(toll_history)}")

        # ----------- Maintenance -----------
        pareto_demo_issues = [
            "Engine overheating",
            "Engine failure",
            "Engine misfire",
            "Engine oil leak",
            "Engine stall",
            "Engine knocking",
            "Engine malfunction",
            "Tire puncture",
            "Tire blowout",
            "Tire wear detected",
            "Tire flat",
            "Tire damage",
            "Tire replacement",
            "Brake failure",
            "Brake fluid leak",
            "Brake pad worn",
            "Electrical fault",
            "Electrical wiring issue",
            "Battery electrical issue",
            "Suspension problem",
            "Suspension noise",
            "Suspension worn",
            "Coolant fluid leak",
            "Hydraulic fluid leak",
            "Oil fluid leak",
        ]
        db.add_all(
            [
                MaintenanceRecord(
                    truck_id=trucks[idx % len(trucks)].id,
                    reported_issue=issue,
                    severity="high" if idx % 5 == 0 else "medium" if idx % 2 == 0 else "low",
                    predicted_risk_score=round(0.25 + (idx % 7) * 0.1, 2),
                    status=MaintenanceStatus.HIGH_RISK if idx % 6 == 0 else MaintenanceStatus.IN_SERVICE if idx % 3 == 0 else MaintenanceStatus.LOW_RISK,
                    estimated_cost=2500 + (idx * 350),
                    created_at=datetime.utcnow() - timedelta(days=idx * 3),
                )
                for idx, issue in enumerate(pareto_demo_issues)
            ]
        )

        # ----------- Attendance -----------
        attendance = [
            AttendanceRecord(user_id=driver.id, check_in_time=datetime.utcnow() - timedelta(days=day, hours=2), status="present")
            for driver in drivers
            for day in range(5)
        ]
        db.add_all(attendance)

        # ----------- Transactions + Payments -----------
        transactions: list[Transaction] = []
        payments: list[Payment] = []
        for booking in bookings:
            if booking.status in (BookingStatus.PENDING_APPROVAL, BookingStatus.REJECTED):
                continue
            transaction = Transaction(
                booking_id=booking.id,
                customer_id=booking.customer_id,
                type="booking",
                amount=booking.estimated_cost,
            )
            transactions.append(transaction)
        db.add_all(transactions)
        db.flush()

        for tx in transactions:
            booking = next(b for b in bookings if b.id == tx.booking_id)
            trip = next((t for t in trips if t.booking_id == booking.id), None)
            paid = booking.status == BookingStatus.COMPLETED
            paid_at = trip.completed_at if paid and trip and trip.completed_at else None
            payments.append(Payment(
                booking_id=booking.id,
                transaction_id=tx.id,
                customer_id=booking.customer_id,
                method="gcash" if tx.id % 2 == 0 else "bank_transfer",
                amount=booking.estimated_cost,
                status=PaymentStatus.VERIFIED if paid else PaymentStatus.FOR_VERIFICATION,
                reference=f"PAY-{1000 + booking.id}",
                paid_at=paid_at,
            ))
        db.add_all(payments)
        print(f"[OK] Payments: {len(payments)}")

        # ----------- Feedback -----------
        feedback = []
        for booking in bookings:
            if booking.status == BookingStatus.COMPLETED:
                feedback.append(Feedback(
                    booking_id=booking.id,
                    customer_id=booking.customer_id,
                    category="service",
                    rating=5 if booking.id % 3 != 0 else 4,
                    message="Smooth delivery, thanks!",
                ))
        db.add_all(feedback)

        # ----------- Job orders -----------
        for booking in bookings:
            if booking.status in (BookingStatus.APPROVED, BookingStatus.ASSIGNED):
                db.add(JobOrder(
                    booking_id=booking.id,
                    issued_by_manager_id=manager.id,
                    instructions="Standard handling",
                ))

        db.commit()

        print("\n" + "=" * 60)
        print("DONE: Database seeding completed successfully.")
        print("=" * 60)
        print("\nTest credentials (password for all: password):")
        print("  Customer:   customer1@fleetops.com")
        print("  Driver:     driver1@fleetops.com")
        print("  Helper:     helper1@fleetops.com")
        print("  Dispatcher: dispatcher@fleetops.com")
        print("  Manager:    manager@fleetops.com")
        print("  Admin:      admin@fleetops.com")
        print("\nRe-seed on Railway after deploy: python seed_db.py --force")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed FleetOpt MySQL database with UAT data.")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Drop all tables first (destructive), then recreate schema and seed.",
    )
    parser.add_argument(
        "--repair-passwords",
        action="store_true",
        help="Re-bcrypt every user's password as 'password' (fixes UnknownHashError / plain-text legacy rows).",
    )
    args = parser.parse_args()
    if args.repair_passwords:
        repair_user_password_hashes()
    else:
        seed_database(force=args.force)
