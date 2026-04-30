from datetime import date, datetime
from enum import Enum

from sqlalchemy import Date, DateTime, Enum as SAEnum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class UserRole(str, Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    DISPATCHER = "dispatcher"
    DRIVER = "driver"
    CUSTOMER = "customer"


class BookingStatus(str, Enum):
    """Booking workflow statuses"""
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    ASSIGNED = "assigned"
    ACCEPTED = "accepted"
    ENROUTE = "enroute"
    LOADING = "loading"
    OUT_FOR_DELIVERY = "out_for_delivery"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    REJECTED = "rejected"


class TripStatus(str, Enum):
    """Trip execution statuses"""
    PENDING = "pending"
    ASSIGNED = "assigned"
    ACCEPTED = "accepted"
    DEPARTED = "departed"
    LOADING = "loading"
    IN_DELIVERY = "in_delivery"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ServiceType(str, Enum):
    FIXED = "fixed"
    CUSTOMIZED = "customized"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    clerk_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)  # Null if using Clerk
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Truck(Base):
    __tablename__ = "trucks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    capacity_tons: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="available")
    last_maintenance_date: Mapped[date | None] = mapped_column(Date, nullable=True)


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    pickup_location: Mapped[str] = mapped_column(String(255), nullable=False)
    dropoff_location: Mapped[str] = mapped_column(String(255), nullable=False)
    service_type: Mapped[ServiceType] = mapped_column(SAEnum(ServiceType), nullable=False)
    scheduled_date: Mapped[date] = mapped_column(Date, nullable=False)
    cargo_weight_tons: Mapped[float] = mapped_column(Float, nullable=False)
    cargo_description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    estimated_cost: Mapped[float] = mapped_column(Float, default=0)
    actual_cost: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[BookingStatus] = mapped_column(SAEnum(BookingStatus), default=BookingStatus.PENDING_APPROVAL)
    
    # Workflow tracking
    approved_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    customer: Mapped[User] = relationship(foreign_keys=[customer_id])
    approved_by: Mapped[User | None] = relationship(foreign_keys=[approved_by_id])


class Trip(Base):
    __tablename__ = "trips"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id"), nullable=False)
    truck_id: Mapped[int] = mapped_column(ForeignKey("trucks.id"), nullable=False)
    driver_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    dispatcher_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    
    route_path: Mapped[str] = mapped_column(Text, default="")
    distance_km: Mapped[float] = mapped_column(Float, default=0)
    toll_cost: Mapped[float] = mapped_column(Float, default=0)
    fuel_cost: Mapped[float] = mapped_column(Float, default=0)
    labor_cost: Mapped[float] = mapped_column(Float, default=0)
    duration_hours: Mapped[float] = mapped_column(Float, default=0)
    
    status: Mapped[TripStatus] = mapped_column(SAEnum(TripStatus), default=TripStatus.PENDING)
    
    # Execution tracking
    assigned_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    departure_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    arrival_pickup_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    loading_start_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    loading_end_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    departure_delivery_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    arrival_delivery_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    
    # Delivery proof
    proof_of_delivery: Mapped[str | None] = mapped_column(String(500), nullable=True)  # signature/image URL
    pod_notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    
    # Current state
    current_latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    current_longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    estimated_delivery_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    booking: Mapped["Booking"] = relationship(foreign_keys=[booking_id])
    truck: Mapped["Truck"] = relationship(foreign_keys=[truck_id])
    driver: Mapped["User"] = relationship(foreign_keys=[driver_id])
    dispatcher: Mapped["User | None"] = relationship(foreign_keys=[dispatcher_id])


class MaintenanceRecord(Base):
    __tablename__ = "maintenance_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    truck_id: Mapped[int] = mapped_column(ForeignKey("trucks.id"), nullable=False)
    reported_issue: Mapped[str] = mapped_column(String(255), nullable=False)
    severity: Mapped[str] = mapped_column(String(50), default="medium")
    predicted_risk_score: Mapped[float] = mapped_column(Float, default=0)
    scheduled_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class PricingConfig(Base):
    __tablename__ = "pricing_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    service_type: Mapped[ServiceType] = mapped_column(SAEnum(ServiceType), nullable=False)
    base_rate: Mapped[float] = mapped_column(Float, default=0)
    labor_rate: Mapped[float] = mapped_column(Float, default=0)
    helper_rate: Mapped[float] = mapped_column(Float, default=0)


class DriverProfile(Base):
    __tablename__ = "driver_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, nullable=False)
    compliance_status: Mapped[str] = mapped_column(String(50), default="compliant")
    rating: Mapped[float] = mapped_column(Float, default=5)
    deduction_amount: Mapped[float] = mapped_column(Float, default=0)


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    check_in_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    status: Mapped[str] = mapped_column(String(30), default="present")


class DriverRating(Base):
    __tablename__ = "driver_ratings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id"), nullable=False)
    driver_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    rated_by_customer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    rating: Mapped[float] = mapped_column(Float, nullable=False)
    comment: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class TripIssue(Base):
    """Track exceptions/issues reported during trip execution"""
    __tablename__ = "trip_issues"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id"), nullable=False)
    reported_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    
    issue_type: Mapped[str] = mapped_column(String(50), nullable=False)  # breakdown, traffic, accident, etc
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    severity: Mapped[str] = mapped_column(String(30), default="medium")  # low, medium, high
    
    resolved: Mapped[bool] = mapped_column(default=False)
    resolution_notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    
    trip: Mapped["Trip"] = relationship(foreign_keys=[trip_id])
    reported_by: Mapped["User"] = relationship(foreign_keys=[reported_by_id])
