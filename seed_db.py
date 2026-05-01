#!/usr/bin/env python3
"""
Database Seeding Script for FleetOpts
Creates realistic test data for UAT and development
Usage: python seed_db.py
"""

import os
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

# Import models and schemas
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from app.core.config import settings
from app.db import Base, get_db
from app.models.entities import (
    User, Booking, Trip, Truck, MaintenanceRecord,
    PricingConfig, DriverProfile, AttendanceRecord
)

def seed_database():
    """Seed database with realistic test data"""
    
    # Create database engine
    if settings.use_cloud_sql:
        from google.cloud.sql.connector import Connector
        connector = Connector()
        conn = connector.getconn(
            f"{settings.gcp_project_id}:{settings.cloud_sql_region}:{settings.cloud_sql_instance}",
            "pg8000",
            user=settings.db_user,
            password=settings.db_password,
            db=settings.db_name
        )
        engine = create_engine("postgresql+pg8000://", creator=lambda: conn)
    else:
        engine = create_engine(settings.database_url)
    
    # Create tables
    Base.metadata.create_all(bind=engine)
    
    with Session(engine) as db:
        print("🌱 Seeding database with test data...")
        
        # 1. Create Users (Customers, Dispatchers, Drivers, Managers, Admin)
        print("\n📝 Creating users...")
        
        users = [
            # Customers
            User(
                email="customer1@fleetops.com",
                password_hash="hashed_password",
                full_name="Acme Corporation",
                role="customer",
                phone="+1-555-0001",
                clerk_id="clerk_customer_1"
            ),
            User(
                email="customer2@fleetops.com",
                password_hash="hashed_password",
                full_name="Global Logistics Inc",
                role="customer",
                phone="+1-555-0002",
                clerk_id="clerk_customer_2"
            ),
            # Dispatcher
            User(
                email="dispatcher@fleetops.com",
                password_hash="hashed_password",
                full_name="John Dispatcher",
                role="dispatcher",
                phone="+1-555-1001",
                clerk_id="clerk_dispatcher_1"
            ),
            # Drivers
            User(
                email="driver1@fleetops.com",
                password_hash="hashed_password",
                full_name="Mike Johnson",
                role="driver",
                phone="+1-555-2001",
                clerk_id="clerk_driver_1"
            ),
            User(
                email="driver2@fleetops.com",
                password_hash="hashed_password",
                full_name="Sarah Williams",
                role="driver",
                phone="+1-555-2002",
                clerk_id="clerk_driver_2"
            ),
            User(
                email="driver3@fleetops.com",
                password_hash="hashed_password",
                full_name="David Brown",
                role="driver",
                phone="+1-555-2003",
                clerk_id="clerk_driver_3"
            ),
            # Manager
            User(
                email="manager@fleetops.com",
                password_hash="hashed_password",
                full_name="Jane Manager",
                role="manager",
                phone="+1-555-3001",
                clerk_id="clerk_manager_1"
            ),
            # Admin
            User(
                email="admin@fleetops.com",
                password_hash="hashed_password",
                full_name="Admin User",
                role="admin",
                phone="+1-555-9001",
                clerk_id="clerk_admin_1"
            ),
        ]
        
        db.add_all(users)
        db.flush()  # Flush to get IDs without committing
        print(f"✓ Created {len(users)} users")
        
        # 2. Create Trucks
        print("\n🚚 Creating trucks...")
        
        trucks = [
            Truck(code="TRUCK-001", capacity_tons=20, status="available"),
            Truck(code="TRUCK-002", capacity_tons=20, status="available"),
            Truck(code="TRUCK-003", capacity_tons=15, status="in_maintenance"),
            Truck(code="TRUCK-004", capacity_tons=25, status="available"),
            Truck(code="TRUCK-005", capacity_tons=30, status="available"),
        ]
        
        db.add_all(trucks)
        db.flush()
        print(f"✓ Created {len(trucks)} trucks")
        
        # 3. Create Driver Profiles
        print("\n👥 Creating driver profiles...")
        
        driver_users = [u for u in users if u.role == "driver"]
        driver_profiles = [
            DriverProfile(
                user_id=driver_users[0].id,
                compliance_status="compliant",
                rating=4.8,
                deduction_amount=0
            ),
            DriverProfile(
                user_id=driver_users[1].id,
                compliance_status="compliant",
                rating=4.5,
                deduction_amount=50
            ),
            DriverProfile(
                user_id=driver_users[2].id,
                compliance_status="warning",
                rating=3.2,
                deduction_amount=200
            ),
        ]
        
        db.add_all(driver_profiles)
        db.flush()
        print(f"✓ Created {len(driver_profiles)} driver profiles")
        
        # 4. Create Pricing Configs
        print("\n💰 Creating pricing configs...")
        
        pricing = [
            PricingConfig(
                service_type="fixed",
                base_rate=100,
                labor_rate=50,
                helper_rate=30
            ),
            PricingConfig(
                service_type="customized",
                base_rate=150,
                labor_rate=75,
                helper_rate=45
            ),
        ]
        
        db.add_all(pricing)
        db.flush()
        print(f"✓ Created {len(pricing)} pricing configs")
        
        # 5. Create Bookings
        print("\n📦 Creating bookings...")
        
        customer_users = [u for u in users if u.role == "customer"]
        bookings = []
        
        for i, customer in enumerate(customer_users):
            for j in range(3):  # 3 bookings per customer
                booking = Booking(
                    customer_id=customer.id,
                    pickup_location=f"Warehouse {chr(65 + (i*3 + j) % 5)}",
                    dropoff_location=f"City {chr(88 + (i*3 + j) % 5)}",
                    service_type="fixed" if j % 2 == 0 else "customized",
                    scheduled_date=(datetime.now() + timedelta(days=j+1)).date(),
                    cargo_weight_tons=5 + j * 2,
                    estimated_cost=250 + (j * 50),
                    status="pending" if j == 0 else "confirmed" if j == 1 else "completed"
                )
                bookings.append(booking)
        
        db.add_all(bookings)
        db.flush()
        print(f"✓ Created {len(bookings)} bookings")
        
        # 6. Create Trips (from confirmed/completed bookings)
        print("\n🛣️ Creating trips...")
        
        completed_bookings = [b for b in bookings if b.status in ["confirmed", "completed"]]
        trips = []
        
        for i, booking in enumerate(completed_bookings[:4]):  # Create trips for first 4 bookings
            trip = Trip(
                booking_id=booking.id,
                truck_id=trucks[i % len(trucks)].id,
                driver_id=driver_users[i % len(driver_users)].id,
                route_path="START -> STOP1 -> STOP2 -> END",
                distance_km=120 + (i * 20),
                toll_cost=25 + (i * 5),
                fuel_cost=45 + (i * 8),
                labor_cost=150 + (i * 25),
                duration_hours=3 + (i * 0.5),
                departure_time=datetime.now() - timedelta(days=i+1),
                completed_at=datetime.now() - timedelta(hours=24-i*6) if booking.status == "completed" else None
            )
            trips.append(trip)
        
        db.add_all(trips)
        db.flush()
        print(f"✓ Created {len(trips)} trips")
        
        # 7. Create Maintenance Records
        print("\n🔧 Creating maintenance records...")
        
        maintenance = [
            MaintenanceRecord(
                truck_id=trucks[0].id,
                reported_issue="Tire wear detected",
                severity="low",
                predicted_risk_score=0.3,
                scheduled_date=(datetime.now() + timedelta(days=7)).date()
            ),
            MaintenanceRecord(
                truck_id=trucks[2].id,
                reported_issue="Engine oil change needed",
                severity="medium",
                predicted_risk_score=0.6,
                scheduled_date=datetime.now().date(),
                resolved_at=datetime.now()
            ),
            MaintenanceRecord(
                truck_id=trucks[3].id,
                reported_issue="Brake fluid leak",
                severity="high",
                predicted_risk_score=0.9,
                scheduled_date=datetime.now().date()
            ),
        ]
        
        db.add_all(maintenance)
        db.flush()
        print(f"✓ Created {len(maintenance)} maintenance records")
        
        # 8. Create Attendance Records
        print("\n⏱️ Creating attendance records...")
        
        attendance = []
        for driver in driver_users:
            for day in range(5):
                attendance.append(
                    AttendanceRecord(
                        user_id=driver.id,
                        check_in_time=datetime.now() - timedelta(days=day, hours=2),
                        status="present"
                    )
                )
        
        db.add_all(attendance)
        db.flush()
        print(f"✓ Created {len(attendance)} attendance records")
        
        # Commit all changes
        db.commit()
        
        print("\n" + "="*50)
        print("✅ Database seeding completed successfully!")
        print("="*50)
        print("\n📊 Summary:")
        print(f"  • Users: {len(users)}")
        print(f"  • Trucks: {len(trucks)}")
        print(f"  • Driver Profiles: {len(driver_profiles)}")
        print(f"  • Pricing Configs: {len(pricing)}")
        print(f"  • Bookings: {len(bookings)}")
        print(f"  • Trips: {len(trips)}")
        print(f"  • Maintenance Records: {len(maintenance)}")
        print(f"  • Attendance Records: {len(attendance)}")
        
        print("\n🔐 Test Credentials:")
        print("  Customer: customer1@fleetops.com")
        print("  Dispatcher: dispatcher@fleetops.com")
        print("  Driver: driver1@fleetops.com")
        print("  Manager: manager@fleetops.com")
        print("  Admin: admin@fleetops.com")
        print("\n  (All use password: any_password_works_with_local_jwt)")

if __name__ == "__main__":
    seed_database()
