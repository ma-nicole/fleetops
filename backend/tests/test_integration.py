#!/usr/bin/env python3
"""
Integration Tests for FleetOpts API
Tests end-to-end workflows: booking -> dispatch -> trip -> rating -> payment

Prerequisites:
  1. XAMPP MySQL running on localhost:3306
  2. Database `fleetopt_test` exists:
        CREATE DATABASE fleetopt_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  3. Run from repo root:
        $env:PYTHONPATH="backend"
        $env:DATABASE_URL="mysql+pymysql://root:@localhost:3306/fleetopt_test"
        python -m pytest backend/tests/test_integration.py -v
"""

import os
import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../backend"))

from app.main import app
from app.db import Base, get_db
from app.models.entities import (
    Booking,
    BookingStatus,
    DriverProfile,
    Trip,
    Truck,
    User,
    UserRole,
    TripStatus,
)
from app.core.security import create_access_token, hash_password

# ────────────────────────────────────────────────────────────
# Use the DATABASE_URL env var (must point at fleetopt_test).
# Default falls back to XAMPP root / no password.
# ────────────────────────────────────────────────────────────
TEST_DB_URL = os.environ.get(
    "DATABASE_URL",
    "mysql+pymysql://root:@localhost:3306/fleetopt_test",
)

# Ensure tests never accidentally hit the production database.
if "fleetopt_test" not in TEST_DB_URL and "test" not in TEST_DB_URL.lower():
    raise RuntimeError(
        "TEST_DB_URL must contain 'fleetopt_test' or 'test' to avoid wiping production data.\n"
        f"Got: {TEST_DB_URL}"
    )


@pytest.fixture(scope="session")
def test_engine():
    engine = create_engine(TEST_DB_URL, pool_pre_ping=True)
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture
def db(test_engine):
    """One session per test, rolled back at the end so tests are isolated."""
    connection = test_engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db):
    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def test_users(db):
    users = {
        "customer": User(
            email="test_customer@example.com",
            password_hash=hash_password("password"),
            full_name="Test Customer",
            role=UserRole.CUSTOMER,
            phone="+63-917-0001",
        ),
        "dispatcher": User(
            email="test_dispatcher@example.com",
            password_hash=hash_password("password"),
            full_name="Test Dispatcher",
            role=UserRole.DISPATCHER,
            phone="+63-917-1001",
        ),
        "driver": User(
            email="test_driver@example.com",
            password_hash=hash_password("password"),
            full_name="Test Driver",
            role=UserRole.DRIVER,
            phone="+63-917-2001",
        ),
        "manager": User(
            email="test_manager@example.com",
            password_hash=hash_password("password"),
            full_name="Test Manager",
            role=UserRole.MANAGER,
            phone="+63-917-3001",
        ),
    }

    for user in users.values():
        db.add(user)
    db.flush()

    db.add(DriverProfile(
        user_id=users["driver"].id,
        compliance_status="compliant",
        rating=4.5,
        deduction_amount=0,
    ))
    db.flush()

    return users


@pytest.fixture
def test_truck(db):
    truck = Truck(code="TEST-TRK-001", capacity_tons=20, status="available",
                  fuel_efficiency_kmpl=4.0, odometer_km=10000, age_years=2)
    db.add(truck)
    db.flush()
    return truck


# ═══════════════════════════════════════════════════════════
# BOOKING WORKFLOW
# ═══════════════════════════════════════════════════════════

class TestBookingWorkflow:

    def test_create_booking(self, client, db, test_users):
        customer = test_users["customer"]
        token = create_access_token(customer.email, customer.role.value)

        response = client.post(
            "/api/bookings",
            json={
                "pickup_location": "Warehouse A",
                "dropoff_location": "City B",
                "service_type": "fixed",
                "scheduled_date": (datetime.now() + timedelta(days=1)).date().isoformat(),
                "scheduled_time_slot": "08:00",
                "cargo_weight_tons": 10.5,
                "cargo_description": "Integration test cargo",
                "cargo_type_category": "general",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == BookingStatus.PENDING_APPROVAL.value
        assert data["estimated_cost"] > 0
        assert data["id"] is not None

    def test_booking_validation_negative_weight(self, client, db, test_users):
        customer = test_users["customer"]
        token = create_access_token(customer.email, customer.role.value)

        response = client.post(
            "/api/bookings",
            json={
                "pickup_location": "A",
                "dropoff_location": "B",
                "service_type": "fixed",
                "scheduled_date": (datetime.now() + timedelta(days=1)).date().isoformat(),
                "cargo_weight_tons": -5,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 422


# ═══════════════════════════════════════════════════════════
# DISPATCH WORKFLOW
# ═══════════════════════════════════════════════════════════

class TestDispatchWorkflow:

    def test_assign_trip(self, client, db, test_users, test_truck):
        dispatcher = test_users["dispatcher"]
        customer = test_users["customer"]
        driver = test_users["driver"]

        booking = Booking(
            customer_id=customer.id,
            pickup_location="Warehouse A",
            dropoff_location="City B",
            service_type="fixed",
            scheduled_date=(datetime.now() + timedelta(days=1)).date(),
            cargo_weight_tons=10,
            estimated_cost=500,
            status=BookingStatus.PENDING_APPROVAL,
        )
        db.add(booking)
        db.flush()

        token = create_access_token(dispatcher.email, dispatcher.role.value)
        response = client.post(
            f"/api/dispatch/{booking.id}/assign",
            json={"truck_id": test_truck.id, "driver_id": driver.id},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        assert "trip_id" in response.json()

    def test_operations_center_empty_returns_200(self, client, db, test_users):
        """Operations center must not 400 when there is no fleet activity."""
        dispatcher = test_users["dispatcher"]
        token = create_access_token(dispatcher.email, dispatcher.role.value)
        response = client.get(
            "/api/dispatch/operations-center",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        body = response.json()
        assert isinstance(body.get("active_trips"), list)
        assert isinstance(body.get("address_warnings"), list)
        assert body["active_trips"] == []
        assert body["waiting_for_assignment"] == []

    def test_operations_center_vague_addresses_active_trip_returns_200(
        self, client, db, test_users, test_truck
    ):
        """Pickup-window alerts must not call geocoding for vague seed-style addresses."""
        dispatcher = test_users["dispatcher"]
        customer = test_users["customer"]
        driver = test_users["driver"]

        booking = Booking(
            customer_id=customer.id,
            pickup_location="Warehouse-Tarlac",
            dropoff_location="Customer-QC",
            service_type="fixed",
            scheduled_date=datetime.now().date(),
            scheduled_time_slot="08:00",
            cargo_weight_tons=10,
            estimated_cost=500,
            status=BookingStatus.OUT_FOR_DELIVERY,
        )
        db.add(booking)
        db.flush()
        db.add(
            Trip(
                booking_id=booking.id,
                truck_id=test_truck.id,
                driver_id=driver.id,
                route_path="Warehouse-Tarlac -> Customer-QC",
                distance_km=100,
                toll_cost=20,
                fuel_cost=50,
                labor_cost=100,
                duration_hours=2,
                status=TripStatus.ASSIGNED,
            )
        )
        db.flush()

        token = create_access_token(dispatcher.email, dispatcher.role.value)
        response = client.get(
            "/api/dispatch/operations-center",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        body = response.json()
        assert len(body["active_trips"]) == 1
        assert isinstance(body["alerts"], list)

    def test_operations_center_driver_forbidden(self, client, db, test_users):
        driver = test_users["driver"]
        token = create_access_token(driver.email, driver.role.value)
        response = client.get(
            "/api/dispatch/operations-center",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403

    def test_vague_address_manual_route_and_assign_batch(self, client, db, test_users, test_truck):
        """Geocoding failure must not block route save or batch assignment."""
        from app.services.route_estimate import MAP_LOCATION_VERIFY_WARNING

        dispatcher = test_users["dispatcher"]
        customer = test_users["customer"]
        driver = test_users["driver"]
        helper = User(
            email="test_helper_dispatch@example.com",
            password_hash=hash_password("password"),
            full_name="Dispatch Helper",
            role=UserRole.HELPER,
            phone="+63-917-2103",
        )
        db.add(helper)
        db.flush()

        booking = Booking(
            customer_id=customer.id,
            pickup_location="Warehouse-Tarlac",
            dropoff_location="Customer-QC",
            service_type="fixed",
            scheduled_date=(datetime.now() + timedelta(days=2)).date(),
            scheduled_time_slot="08:00",
            cargo_weight_tons=10,
            estimated_cost=500,
            status=BookingStatus.READY_FOR_ASSIGNMENT,
            goods_declaration_validated=True,
            goods_declaration_review_status="approved",
            cargo_type_validated=True,
            required_truck_count=1,
        )
        db.add(booking)
        db.flush()
        from app.models.entities import Payment, PaymentStatus

        db.add(
            Payment(
                booking_id=booking.id,
                customer_id=customer.id,
                amount=500,
                method="bank_transfer",
                reference="TEST-DISPATCH-PAY",
                status=PaymentStatus.VERIFIED,
            )
        )
        db.flush()

        token = create_access_token(dispatcher.email, dispatcher.role.value)
        headers = {"Authorization": f"Bearer {token}"}

        gen = client.post(
            f"/api/dispatch/booking/{booking.id}/route-options/generate",
            headers=headers,
        )
        assert gen.status_code == 200
        gen_body = gen.json()
        assert gen_body.get("map_verification_warning") == MAP_LOCATION_VERIFY_WARNING

        manual = client.post(
            f"/api/dispatch/booking/{booking.id}/route-options/manual",
            headers=headers,
            json={
                "route_name": "Tarlac to QC manual",
                "distance_km": 95.5,
                "duration_hours": 3.5,
                "toll_cost_php": 420,
                "notes": "Dispatcher confirmed km",
            },
        )
        assert manual.status_code == 200
        manual_body = manual.json()
        assert manual_body["selected_route_option_id"] is not None
        selected = next(o for o in manual_body["options"] if o["is_selected"])
        assert selected["source"] == "manual"
        assert selected["distance_km"] == 95.5
        assert selected["duration_hours"] == 3.5

        assign = client.post(
            f"/api/dispatch/{booking.id}/assign-batch",
            headers=headers,
            json={
                "assignments": [
                    {
                        "truck_id": test_truck.id,
                        "driver_id": driver.id,
                        "helper_id": helper.id,
                        "assigned_weight": 10,
                    }
                ]
            },
        )
        assert assign.status_code == 200, assign.text
        body = assign.json()
        assert body.get("trip_ids")
        assert len(body["trip_ids"]) == 1

    def test_create_booking_vague_addresses_not_blocked(self, client, db, test_users):
        """Customer booking with ungeocodable addresses should succeed (non-blocking geocode)."""
        customer = test_users["customer"]
        token = create_access_token(customer.email, customer.role.value)
        response = client.post(
            "/api/bookings",
            json={
                "pickup_location": "Warehouse-Tarlac",
                "dropoff_location": "Customer-QC",
                "service_type": "fixed",
                "scheduled_date": (datetime.now() + timedelta(days=3)).date().isoformat(),
                "scheduled_time_slot": "08:00",
                "cargo_weight_tons": 8,
                "cargo_description": "Vague address test cargo",
                "cargo_type_category": "general",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["id"] is not None
        assert data["estimated_cost"] > 0


class TestHelperWorkflow:

    def test_helper_status_milestone_advances(self, client, db, test_users, test_truck):
        helper = User(
            email="test_helper@example.com",
            password_hash=hash_password("password"),
            full_name="Test Helper",
            role=UserRole.HELPER,
            phone="+63-917-2101",
        )
        db.add(helper)
        db.flush()

        customer = test_users["customer"]
        driver = test_users["driver"]
        booking = Booking(
            customer_id=customer.id,
            pickup_location="Warehouse A",
            dropoff_location="City B",
            service_type="fixed",
            scheduled_date=(datetime.now() + timedelta(days=1)).date(),
            scheduled_time_slot="08:00",
            cargo_weight_tons=10,
            estimated_cost=500,
            status=BookingStatus.OUT_FOR_DELIVERY,
        )
        db.add(booking)
        db.flush()
        trip = Trip(
            booking_id=booking.id,
            truck_id=test_truck.id,
            driver_id=driver.id,
            helper_id=helper.id,
            route_path="Warehouse A -> City B",
            distance_km=100,
            toll_cost=20,
            fuel_cost=50,
            labor_cost=100,
            duration_hours=2,
            status=TripStatus.IN_DELIVERY,
            helper_progress_status=None,
        )
        db.add(trip)
        db.flush()

        token = create_access_token(helper.email, helper.role.value)
        list_resp = client.get("/api/helper/bookings", headers={"Authorization": f"Bearer {token}"})
        assert list_resp.status_code == 200
        row = next(r for r in list_resp.json()["bookings"] if r["trip_id"] == trip.id)
        assert row["operational_status"] == "for_pickup"
        assert row["helper_progress_status"] == "for_pickup"

        png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
        status_resp = client.post(
            f"/api/helper/trips/{trip.id}/status",
            headers={"Authorization": f"Bearer {token}"},
            data={"status": "picked_up", "location_name": "", "remarks": ""},
            files={"photo": ("proof.png", png, "image/png")},
        )
        assert status_resp.status_code == 200
        assert status_resp.json()["status"] == "picked_up"

    def test_operations_center_vague_addresses_return_warnings_not_400(
        self, client, db, test_users, test_truck
    ):
        dispatcher = test_users["dispatcher"]
        customer = test_users["customer"]
        driver = test_users["driver"]
        helper = User(
            email="test_helper_ops@example.com",
            password_hash=hash_password("password"),
            full_name="Ops Helper",
            role=UserRole.HELPER,
            phone="+63-917-2102",
        )
        db.add(helper)
        db.flush()

        booking = Booking(
            customer_id=customer.id,
            pickup_location="Warehouse-Tarlac",
            dropoff_location="Customer-QC",
            service_type="fixed",
            scheduled_date=datetime.now().date(),
            scheduled_time_slot="08:00",
            cargo_weight_tons=10,
            estimated_cost=500,
            status=BookingStatus.OUT_FOR_DELIVERY,
        )
        db.add(booking)
        db.flush()
        db.add(
            Trip(
                booking_id=booking.id,
                truck_id=test_truck.id,
                driver_id=driver.id,
                helper_id=helper.id,
                route_path="Warehouse-Tarlac -> Customer-QC",
                distance_km=100,
                status=TripStatus.IN_DELIVERY,
                helper_progress_status="for_pickup",
            )
        )
        db.flush()

        token = create_access_token(dispatcher.email, dispatcher.role.value)
        response = client.get(
            "/api/dispatch/operations-center",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        body = response.json()
        assert len(body["active_trips"]) >= 1
        assert isinstance(body.get("address_warnings"), list)
        assert any(w["booking_id"] == booking.id for w in body["address_warnings"])


# ═══════════════════════════════════════════════════════════
# RATING WORKFLOW
# ═══════════════════════════════════════════════════════════

class TestRatingWorkflow:

    def _completed_trip(self, db, customer, driver, truck):
        booking = Booking(
            customer_id=customer.id,
            pickup_location="A",
            dropoff_location="B",
            service_type="fixed",
            scheduled_date=datetime.now().date(),
            cargo_weight_tons=10,
            estimated_cost=500,
            status=BookingStatus.COMPLETED,
        )
        db.add(booking)
        db.flush()
        trip = Trip(
            booking_id=booking.id,
            truck_id=truck.id,
            driver_id=driver.id,
            route_path="A -> B",
            distance_km=100,
            toll_cost=20,
            fuel_cost=50,
            labor_cost=100,
            duration_hours=2,
            departure_time=datetime.now() - timedelta(hours=3),
            completed_at=datetime.now(),
            status=TripStatus.COMPLETED,
        )
        db.add(trip)
        db.flush()
        return trip

    def test_submit_rating(self, client, db, test_users, test_truck):
        customer = test_users["customer"]
        driver = test_users["driver"]
        trip = self._completed_trip(db, customer, driver, test_truck)

        token = create_access_token(customer.email, customer.role.value)
        response = client.post(
            "/api/ratings/driver",
            json={"trip_id": trip.id, "driver_id": driver.id, "rating": 5},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code in [200, 201]

    def test_get_driver_average_rating(self, client, db, test_users):
        driver = test_users["driver"]
        response = client.get(f"/api/ratings/driver/{driver.id}")
        assert response.status_code == 200
        assert "average_rating" in response.json()
        assert 0 <= response.json()["average_rating"] <= 5


# ═══════════════════════════════════════════════════════════
# AUTHENTICATION
# ═══════════════════════════════════════════════════════════

class TestAuthenticationFlow:

    def test_invalid_token_rejected(self, client):
        response = client.get(
            "/api/bookings",
            headers={"Authorization": "Bearer invalid_token"},
        )
        assert response.status_code == 401

    def test_unauthorized_role_rejected(self, client, db, test_users):
        driver = test_users["driver"]
        token = create_access_token(driver.email, driver.role.value)
        response = client.post(
            "/api/dispatch/1/assign",
            json={"truck_id": 1, "driver_id": 1},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403

    def test_login_lockout(self, client, db, test_users):
        """After 5 bad attempts the account should be locked (423)."""
        customer = test_users["customer"]
        for _ in range(5):
            client.post(
                "/api/auth/login",
                data={"username": customer.email, "password": "wrongpassword"},
            )
        resp = client.post(
            "/api/auth/login",
            data={"username": customer.email, "password": "wrongpassword"},
        )
        assert resp.status_code == 423


# ═══════════════════════════════════════════════════════════
# ANALYTICS — MANAGER DASHBOARD
# ═══════════════════════════════════════════════════════════

class TestAnalyticsEndpoints:

    def test_manager_dashboard(self, client, test_users):
        manager = test_users["manager"]
        token = create_access_token(manager.email, manager.role.value)
        response = client.get(
            "/api/manager/dashboard",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "kpis" in data
        assert "cost_model" in data
        assert "demand_forecast" in data
        assert "maintenance_risk" in data
        for field in ("total_bookings", "ongoing_bookings", "completed_bookings",
                      "total_trip_cost", "total_distance"):
            assert field in data["kpis"]


# ═══════════════════════════════════════════════════════════
# PREDICTIVE ANALYTICS (paper §3.2.8)
# ═══════════════════════════════════════════════════════════

class TestPredictiveAnalytics:

    def test_predict_trip_cost(self, client, test_users):
        manager = test_users["manager"]
        token = create_access_token(manager.email, manager.role.value)
        response = client.post(
            "/api/analytics/predict-trip-cost",
            json={"distance_km": 120, "cargo_weight_tons": 8},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        body = response.json()
        for key in (
            "fuel_liters", "fuel_cost", "toll_cost", "driver_cost", "helper_cost",
            "labor_cost", "total_operational_cost", "total_cost", "regression", "explanation",
        ):
            assert key in body
        assert body["total_cost"] > 0
        assert {row["target"] for row in body["regression"]["targets"]} == {
            "fuel_cost", "toll_cost", "driver_cost", "helper_cost", "total_operational_cost"
        }

    def test_predict_fuel(self, client, test_users):
        dispatcher = test_users["dispatcher"]
        token = create_access_token(dispatcher.email, dispatcher.role.value)
        response = client.post(
            "/api/analytics/predict-fuel",
            json={"distance_km": 100, "cargo_weight_tons": 5, "road_condition": "highway"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["fuel_liters"] > 0
        assert body["fuel_cost"] > 0

    def test_predict_maintenance(self, client, test_users):
        manager = test_users["manager"]
        token = create_access_token(manager.email, manager.role.value)
        response = client.post(
            "/api/analytics/predict-maintenance",
            json={"mileage_km": 60000, "age_years": 5, "engine_hours": 1000},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        assert response.json()["priority_level"] in {"low_risk", "medium_risk", "high_risk"}

    def test_operational_forecasts_expose_decision_support(self, client, test_users):
        manager = test_users["manager"]
        token = create_access_token(manager.email, manager.role.value)
        response = client.get(
            "/api/analytics/forecast-operations?granularity=monthly&horizon=3",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        body = response.json()
        assert {row["key"] for row in body["series"]} == {
            "booking_demand", "fuel_usage", "fleet_maintenance", "delivery_trends"
        }
        for row in body["series"]:
            for key in ("historical", "forecast", "method", "interpretation", "recommendation"):
                assert key in row


# ═══════════════════════════════════════════════════════════
# PRESCRIPTIVE ANALYTICS (paper §3.2.9)
# ═══════════════════════════════════════════════════════════

class TestPrescriptiveAnalytics:

    def test_optimize_route(self, client, test_users):
        manager = test_users["manager"]
        token = create_access_token(manager.email, manager.role.value)
        response = client.post(
            "/api/analytics/optimize-route",
            json={
                "origin": "Warehouse-Tarlac",
                "destination": "Customer-QC",
                "weight": "cost",
                "cargo_weight_tons": 8,
                "departure_hour": 12,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["candidates"]
        assert body["candidates"][0]["total_cost"] > 0
        assert body["optimization_method"].startswith("A*")
        assert body["candidates"][0]["estimated_travel_time_hours"] > 0
        assert "Selected by A*" in body["candidates"][0]["selection_reason"]

    def test_whatif(self, client, test_users):
        manager = test_users["manager"]
        token = create_access_token(manager.email, manager.role.value)
        response = client.post(
            "/api/analytics/whatif",
            json={
                "base": {"distance_km": 100, "cargo_weight_tons": 5},
                "fuel_price_delta_pct": 20,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["simulated"]["total_cost"] != body["base"]["total_cost"]


# ═══════════════════════════════════════════════════════════
# PAYMENTS & FEEDBACK (paper §3.2.4)
# ═══════════════════════════════════════════════════════════

class TestCargoTypeValidationQueue:

    def test_pre_delivery_cargo_type_follows_admin_flag(self, client, db, test_users):
        """Driver/helper block must use cargo_type_validated, not a separate description gate."""
        from app.services.pre_delivery_verification import pre_delivery_block_detail

        customer = test_users["customer"]
        booking = Booking(
            customer_id=customer.id,
            pickup_location="Warehouse A",
            dropoff_location="City B",
            service_type="fixed",
            scheduled_date=(datetime.now() + timedelta(days=2)).date(),
            scheduled_time_slot="08:00",
            cargo_weight_tons=10,
            estimated_cost=500,
            status=BookingStatus.PAYMENT_VERIFIED,
            cargo_description=None,
            cargo_type_category="textiles",
            cargo_type_validated=True,
            goods_declaration_validated=True,
            goods_declaration_review_status="approved",
        )
        db.add(booking)
        db.flush()
        from app.models.entities import Payment, PaymentStatus

        db.add(
            Payment(
                booking_id=booking.id,
                customer_id=customer.id,
                amount=500,
                method="bank_transfer",
                reference="TEST-PAY",
                status=PaymentStatus.VERIFIED,
            )
        )
        db.add(booking)
        db.flush()
        booking.cargo_declaration_storage_path = "declarations/test.pdf"
        booking.cargo_declaration_original_filename = "test.pdf"
        booking.terms_agreement_storage_path = "terms/test.pdf"
        booking.terms_agreement_original_filename = "terms.pdf"
        booking.terms_agreed_at = datetime.utcnow()
        db.flush()

        assert pre_delivery_block_detail(db, booking) is None

    def test_queue_includes_payment_verified_without_cargo_description(self, client, db, test_users):
        """Compliance queue must not require cargo_description (customer often omits it)."""
        manager = test_users["manager"]
        customer = test_users["customer"]
        booking = Booking(
            customer_id=customer.id,
            pickup_location="Warehouse A",
            dropoff_location="City B",
            service_type="fixed",
            scheduled_date=(datetime.now() + timedelta(days=2)).date(),
            scheduled_time_slot="08:00",
            cargo_weight_tons=10,
            estimated_cost=500,
            status=BookingStatus.PAYMENT_VERIFIED,
            cargo_description=None,
            goods_declaration_validated=True,
            goods_declaration_review_status="approved",
            cargo_type_validated=False,
        )
        db.add(booking)
        db.flush()
        from app.models.entities import Payment, PaymentStatus

        db.add(
            Payment(
                booking_id=booking.id,
                customer_id=customer.id,
                amount=500,
                method="bank_transfer",
                reference="TEST-CARGO-QUEUE",
                status=PaymentStatus.VERIFIED,
            )
        )
        db.flush()

        token = create_access_token(manager.email, manager.role.value)
        response = client.get(
            "/api/admin/cargo-type-validations",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        ids = [row["booking_id"] for row in response.json()]
        assert booking.id in ids

    def test_queue_includes_verified_payment_when_status_still_payment_verification(
        self, client, db, test_users
    ):
        """Status label may lag; queue must use payments.verified, not status whitelist."""
        manager = test_users["manager"]
        customer = test_users["customer"]
        booking = Booking(
            customer_id=customer.id,
            pickup_location="Warehouse A",
            dropoff_location="City B",
            service_type="fixed",
            scheduled_date=(datetime.now() + timedelta(days=2)).date(),
            scheduled_time_slot="08:00",
            cargo_weight_tons=10,
            estimated_cost=500,
            status=BookingStatus.PAYMENT_VERIFICATION,
            goods_declaration_validated=True,
            goods_declaration_review_status="approved",
            cargo_type_validated=False,
        )
        db.add(booking)
        db.flush()
        from app.models.entities import Payment, PaymentStatus

        db.add(
            Payment(
                booking_id=booking.id,
                customer_id=customer.id,
                amount=500,
                method="bank_transfer",
                reference="TEST-STATUS-LAG",
                status=PaymentStatus.VERIFIED,
            )
        )
        db.flush()

        token = create_access_token(manager.email, manager.role.value)
        response = client.get(
            "/api/admin/cargo-type-validations",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        ids = [row["booking_id"] for row in response.json()]
        assert booking.id in ids

    def test_queue_excludes_without_verified_payment(self, client, db, test_users):
        manager = test_users["manager"]
        customer = test_users["customer"]
        booking = Booking(
            customer_id=customer.id,
            pickup_location="Warehouse A",
            dropoff_location="City B",
            service_type="fixed",
            scheduled_date=(datetime.now() + timedelta(days=2)).date(),
            scheduled_time_slot="08:00",
            cargo_weight_tons=10,
            estimated_cost=500,
            status=BookingStatus.PAYMENT_VERIFIED,
            goods_declaration_validated=True,
            goods_declaration_review_status="approved",
            cargo_type_validated=False,
        )
        db.add(booking)
        db.flush()

        token = create_access_token(manager.email, manager.role.value)
        response = client.get(
            "/api/admin/cargo-type-validations",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        ids = [row["booking_id"] for row in response.json()]
        assert booking.id not in ids

    def test_queue_excludes_unapproved_declaration(self, client, db, test_users):
        manager = test_users["manager"]
        customer = test_users["customer"]
        booking = Booking(
            customer_id=customer.id,
            pickup_location="Warehouse A",
            dropoff_location="City B",
            service_type="fixed",
            scheduled_date=(datetime.now() + timedelta(days=2)).date(),
            scheduled_time_slot="08:00",
            cargo_weight_tons=10,
            estimated_cost=500,
            status=BookingStatus.PAYMENT_VERIFIED,
            cargo_description="Steel beams",
            goods_declaration_review_status="pending",
            cargo_type_validated=False,
        )
        db.add(booking)
        db.flush()

        token = create_access_token(manager.email, manager.role.value)
        response = client.get(
            "/api/admin/cargo-type-validations",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        ids = [row["booking_id"] for row in response.json()]
        assert booking.id not in ids

    def test_assign_batch_blocked_without_cargo_validation(self, client, db, test_users, test_truck):
        """Dispatcher cannot create trips until cargo type is validated for the same booking_id."""
        dispatcher = test_users["dispatcher"]
        customer = test_users["customer"]
        driver = test_users["driver"]
        booking = Booking(
            customer_id=customer.id,
            pickup_location="Warehouse A",
            dropoff_location="City B",
            service_type="fixed",
            scheduled_date=(datetime.now() + timedelta(days=2)).date(),
            scheduled_time_slot="08:00",
            cargo_weight_tons=10,
            estimated_cost=500,
            status=BookingStatus.READY_FOR_ASSIGNMENT,
            goods_declaration_validated=True,
            goods_declaration_review_status="approved",
            cargo_type_validated=False,
            required_truck_count=1,
        )
        db.add(booking)
        db.flush()
        from app.models.entities import Payment, PaymentStatus

        db.add(
            Payment(
                booking_id=booking.id,
                customer_id=customer.id,
                amount=500,
                method="bank_transfer",
                reference="TEST-NO-CARGO",
                status=PaymentStatus.VERIFIED,
            )
        )
        db.flush()

        token = create_access_token(dispatcher.email, dispatcher.role.value)
        headers = {"Authorization": f"Bearer {token}"}
        response = client.post(
            f"/api/dispatch/{booking.id}/assign-batch",
            headers=headers,
            json={
                "assignments": [
                    {
                        "truck_id": test_truck.id,
                        "driver_id": driver.id,
                        "helper_id": None,
                        "assigned_weight": 10,
                    }
                ]
            },
        )
        assert response.status_code == 400
        detail = response.json()["detail"]
        assert "Selected booking is not fully verified for dispatch" in detail
        assert f"Booking #{booking.id}" in detail
        assert "Cargo type is not validated" in detail

    def test_assignable_excludes_booking_without_cargo_validation(self, client, db, test_users):
        dispatcher = test_users["dispatcher"]
        customer = test_users["customer"]
        booking = Booking(
            customer_id=customer.id,
            pickup_location="Warehouse A",
            dropoff_location="City B",
            service_type="fixed",
            scheduled_date=(datetime.now() + timedelta(days=2)).date(),
            scheduled_time_slot="08:00",
            cargo_weight_tons=10,
            estimated_cost=500,
            status=BookingStatus.PAYMENT_VERIFIED,
            goods_declaration_validated=True,
            goods_declaration_review_status="approved",
            cargo_type_validated=False,
        )
        db.add(booking)
        db.flush()
        from app.models.entities import Payment, PaymentStatus

        db.add(
            Payment(
                booking_id=booking.id,
                customer_id=customer.id,
                amount=500,
                method="bank_transfer",
                reference="TEST-ASSIGNABLE",
                status=PaymentStatus.VERIFIED,
            )
        )
        db.flush()

        token = create_access_token(dispatcher.email, dispatcher.role.value)
        response = client.get(
            "/api/workflow/booking/assignable",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        ids = [row["id"] for row in response.json()]
        assert booking.id not in ids


class TestPaymentsAndFeedback:

    def _make_completed_booking(self, db, customer):
        booking = Booking(
            customer_id=customer.id,
            pickup_location="Warehouse A",
            dropoff_location="City B",
            service_type="fixed",
            scheduled_date=datetime.now().date(),
            cargo_weight_tons=10,
            estimated_cost=2500,
            status=BookingStatus.COMPLETED,
        )
        db.add(booking)
        db.flush()
        return booking

    def test_create_payment(self, client, db, test_users):
        customer = test_users["customer"]
        booking = self._make_completed_booking(db, customer)
        token = create_access_token(customer.email, customer.role.value)
        response = client.post(
            "/api/payments",
            json={"booking_id": booking.id, "method": "gcash", "amount": 2500},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "for_verification"
        assert body["amount"] == 2500

    def test_finance_summary(self, client, test_users):
        manager = test_users["manager"]
        token = create_access_token(manager.email, manager.role.value)
        response = client.get(
            "/api/payments/finance/summary",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        for key in ("total_paid", "total_pending", "by_method"):
            assert key in response.json()

    def test_submit_feedback(self, client, db, test_users):
        customer = test_users["customer"]
        booking = self._make_completed_booking(db, customer)
        token = create_access_token(customer.email, customer.role.value)
        response = client.post(
            "/api/feedback",
            json={"booking_id": booking.id, "rating": 5, "message": "Great service"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        assert response.json()["rating"] == 5

    def test_submit_general_feedback(self, client, test_users):
        customer = test_users["customer"]
        token = create_access_token(customer.email, customer.role.value)
        response = client.post(
            "/api/feedback",
            json={"booking_id": None, "rating": 4, "message": "Great app experience", "category": "general"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["rating"] == 4
        assert data["booking_id"] is None


# ═══════════════════════════════════════════════════════════
# SCHEDULE BOARD (paper Fig 16/17)
# ═══════════════════════════════════════════════════════════

class TestSchedule:

    def test_truck_week_board(self, client, test_users):
        dispatcher = test_users["dispatcher"]
        token = create_access_token(dispatcher.email, dispatcher.role.value)
        response = client.get(
            "/api/schedule/trucks",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        body = response.json()
        assert "trucks" in body and "week_start" in body


# ═══════════════════════════════════════════════════════════
# COST ESTIMATION (workflow endpoint)
# ═══════════════════════════════════════════════════════════

class TestCostEstimation:

    def test_cost_via_workflow_create(self, client, test_users):
        customer = test_users["customer"]
        token = create_access_token(customer.email, customer.role.value)
        response = client.post(
            "/api/workflow/booking/create",
            json={
                "pickup_location": "Warehouse A",
                "dropoff_location": "City B",
                "service_type": "fixed",
                "scheduled_date": (datetime.now() + timedelta(days=2)).date().isoformat(),
                "cargo_weight_tons": 12.5,
                "cargo_description": "Workflow create test cargo",
                "cargo_type_category": "general",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        assert response.json()["estimated_cost"] > 0


if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v", "--tb=short"])
