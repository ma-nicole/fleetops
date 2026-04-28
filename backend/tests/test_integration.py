#!/usr/bin/env python3
"""
Integration Tests for FleetOpts API
Tests end-to-end workflows: booking -> dispatch -> trip -> rating

Usage: pytest backend/tests/test_integration.py -v
"""

import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../backend"))

from app.main import app
from app.db import Base, get_db
from app.models.entities import User, Booking, Trip, Truck, DriverProfile
from app.core.security import create_access_token

# Test database setup
TEST_DB_URL = "sqlite:///test_fleetops.db"

@pytest.fixture
def db():
    """Create test database session"""
    engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    
    with Session(engine) as session:
        yield session
    
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def client(db):
    """Create FastAPI test client with test database"""
    def override_get_db():
        yield db
    
    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()

@pytest.fixture
def test_users(db):
    """Create test users for different roles"""
    users = {
        "customer": User(
            email="test_customer@example.com",
            password_hash="hashed",
            full_name="Test Customer",
            role="customer",
            phone="+1-555-0001",
            clerk_id="test_clerk_customer"
        ),
        "dispatcher": User(
            email="test_dispatcher@example.com",
            password_hash="hashed",
            full_name="Test Dispatcher",
            role="dispatcher",
            phone="+1-555-1001",
            clerk_id="test_clerk_dispatcher"
        ),
        "driver": User(
            email="test_driver@example.com",
            password_hash="hashed",
            full_name="Test Driver",
            role="driver",
            phone="+1-555-2001",
            clerk_id="test_clerk_driver"
        ),
        "manager": User(
            email="test_manager@example.com",
            password_hash="hashed",
            full_name="Test Manager",
            role="manager",
            phone="+1-555-3001",
            clerk_id="test_clerk_manager"
        ),
    }
    
    for user in users.values():
        db.add(user)
    db.flush()
    
    # Create driver profile
    driver_profile = DriverProfile(
        user_id=users["driver"].id,
        compliance_status="compliant",
        rating=4.5,
        deduction_amount=0
    )
    db.add(driver_profile)
    db.flush()
    
    return users

@pytest.fixture
def test_truck(db):
    """Create test truck"""
    truck = Truck(code="TEST-TRUCK-001", capacity_tons=20, status="available")
    db.add(truck)
    db.flush()
    return truck

class TestBookingWorkflow:
    """Test complete booking to completion workflow"""
    
    def test_create_booking(self, client, db, test_users):
        """Test: Customer creates a booking"""
        customer = test_users["customer"]
        token = create_access_token(customer.id, customer.role)
        
        booking_data = {
            "pickup_location": "Warehouse A",
            "dropoff_location": "City B",
            "service_type": "fixed",
            "scheduled_date": (datetime.now() + timedelta(days=1)).isoformat().split('T')[0],
            "cargo_weight_tons": 10.5,
        }
        
        response = client.post(
            "/api/bookings",
            json=booking_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "pending"
        assert data["estimated_cost"] > 0
        return data["id"]
    
    def test_booking_validation(self, client, db, test_users):
        """Test: Booking validation catches invalid input"""
        customer = test_users["customer"]
        token = create_access_token(customer.id, customer.role)
        
        # Invalid: negative weight
        invalid_booking = {
            "pickup_location": "A",
            "dropoff_location": "B",
            "service_type": "fixed",
            "scheduled_date": (datetime.now() + timedelta(days=1)).isoformat().split('T')[0],
            "cargo_weight_tons": -5,
        }
        
        response = client.post(
            "/api/bookings",
            json=invalid_booking,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        # Should return 422 validation error
        assert response.status_code == 422

class TestDispatchWorkflow:
    """Test dispatch assignment and route optimization"""
    
    def test_assign_trip(self, client, db, test_users, test_truck):
        """Test: Dispatcher assigns truck and driver to booking"""
        dispatcher = test_users["dispatcher"]
        customer = test_users["customer"]
        driver = test_users["driver"]
        
        # Create booking first
        booking = Booking(
            customer_id=customer.id,
            pickup_location="Warehouse A",
            dropoff_location="City B",
            service_type="fixed",
            scheduled_date=(datetime.now() + timedelta(days=1)).date(),
            cargo_weight_tons=10,
            estimated_cost=500,
            status="pending"
        )
        db.add(booking)
        db.flush()
        
        # Assign via dispatcher
        token = create_access_token(dispatcher.id, dispatcher.role)
        
        assignment_data = {
            "booking_id": booking.id,
            "truck_id": test_truck.id,
            "driver_id": driver.id,
        }
        
        response = client.post(
            f"/api/dispatch/{booking.id}/assign",
            json=assignment_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code in [200, 201]
        data = response.json()
        assert data["status"] in ["assigned", "confirmed"]

class TestRatingWorkflow:
    """Test driver rating submission and aggregation"""
    
    def test_submit_rating(self, client, db, test_users, test_truck):
        """Test: Customer submits driver rating after trip"""
        customer = test_users["customer"]
        driver = test_users["driver"]
        
        # Create completed trip
        booking = Booking(
            customer_id=customer.id,
            pickup_location="A",
            dropoff_location="B",
            service_type="fixed",
            scheduled_date=datetime.now().date(),
            cargo_weight_tons=10,
            estimated_cost=500,
            status="completed"
        )
        db.add(booking)
        db.flush()
        
        trip = Trip(
            booking_id=booking.id,
            truck_id=test_truck.id,
            driver_id=driver.id,
            route_path="A -> B",
            distance_km=100,
            toll_cost=20,
            fuel_cost=50,
            labor_cost=100,
            duration_hours=2,
            started_at=datetime.now() - timedelta(hours=3),
            completed_at=datetime.now()
        )
        db.add(trip)
        db.flush()
        
        # Submit rating
        token = create_access_token(customer.id, customer.role)
        rating_data = {
            "trip_id": trip.id,
            "driver_id": driver.id,
            "rating_value": 5,
        }
        
        response = client.post(
            "/api/ratings",
            json=rating_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code in [200, 201]
    
    def test_get_driver_average_rating(self, client, db, test_users, test_truck):
        """Test: Retrieve driver's average rating"""
        driver = test_users["driver"]
        
        response = client.get(f"/api/ratings/{driver.id}")
        
        assert response.status_code == 200
        data = response.json()
        assert "average_rating" in data
        assert 0 <= data["average_rating"] <= 5

class TestAuthenticationFlow:
    """Test authentication and role-based access"""
    
    def test_invalid_token_rejected(self, client):
        """Test: Invalid JWT token is rejected"""
        response = client.get(
            "/api/bookings",
            headers={"Authorization": "Bearer invalid_token"}
        )
        
        assert response.status_code == 401
    
    def test_unauthorized_role_rejected(self, client, db, test_users):
        """Test: Role-based access control enforced"""
        # Driver cannot access dispatch endpoint (requires dispatcher role)
        driver = test_users["driver"]
        token = create_access_token(driver.id, driver.role)
        
        response = client.post(
            "/api/dispatch/1/assign",
            json={"truck_id": 1, "driver_id": 1},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        # Should return 403 Forbidden
        assert response.status_code == 403

class TestAnalyticsEndpoints:
    """Test analytics and manager dashboard"""
    
    def test_manager_dashboard(self, client, test_users):
        """Test: Manager can access dashboard analytics"""
        manager = test_users["manager"]
        token = create_access_token(manager.id, manager.role)
        
        response = client.get(
            "/api/manager/dashboard",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Check required dashboard fields
        required_fields = [
            "total_bookings",
            "completed_trips",
            "average_trip_cost",
            "fleet_utilization",
            "total_revenue"
        ]
        
        for field in required_fields:
            assert field in data

class TestCostEstimation:
    """Test cost calculation service"""
    
    def test_cost_prediction(self, client):
        """Test: Cost estimation returns valid numbers"""
        cost_data = {
            "distance_km": 150,
            "cargo_weight_tons": 15,
            "fuel_price_per_liter": 3.5,
            "toll_rate": 0.15,
            "labor_rate": 50
        }
        
        response = client.post(
            "/api/analytics/cost-predict",
            json=cost_data
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "fuel_cost" in data
        assert "toll_cost" in data
        assert "labor_cost" in data
        assert "estimated_total" in data
        assert data["estimated_total"] > 0

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
