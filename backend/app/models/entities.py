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
    SCHEDULED = "scheduled"
    ONGOING = "ongoing"
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
    estimated_cost: Mapped[float] = mapped_column(Float, default=0)
    status: Mapped[BookingStatus] = mapped_column(SAEnum(BookingStatus), default=BookingStatus.SCHEDULED)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    customer: Mapped[User] = relationship()


class Trip(Base):
    __tablename__ = "trips"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id"), nullable=False)
    truck_id: Mapped[int] = mapped_column(ForeignKey("trucks.id"), nullable=False)
    driver_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    route_path: Mapped[str] = mapped_column(Text, default="")
    distance_km: Mapped[float] = mapped_column(Float, default=0)
    toll_cost: Mapped[float] = mapped_column(Float, default=0)
    fuel_cost: Mapped[float] = mapped_column(Float, default=0)
    labor_cost: Mapped[float] = mapped_column(Float, default=0)
    duration_hours: Mapped[float] = mapped_column(Float, default=0)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


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
