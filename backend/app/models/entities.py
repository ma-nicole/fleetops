from datetime import date, datetime
from enum import Enum

from sqlalchemy import Date, DateTime, Enum as SAEnum, Float, ForeignKey, Integer, String, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class UserRole(str, Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    DISPATCHER = "dispatcher"
    DRIVER = "driver"
    HELPER = "helper"
    CUSTOMER = "customer"


class BookingStatus(str, Enum):
    """Booking workflow statuses (paper §3.2.3 + Fig 19)"""
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


class PaymentStatus(str, Enum):
    """Payment lifecycle (paper §3.2.4 Customer DFD)"""
    PENDING = "pending"
    PROCESSING = "processing"
    PAID = "paid"
    FAILED = "failed"
    REFUNDED = "refunded"


class ReportStatus(str, Enum):
    """Completion-report lifecycle (paper Driver DFD)"""
    DRAFT = "draft"
    SUBMITTED = "submitted"
    REVIEWED = "reviewed"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"
    ARCHIVED = "archived"


class MaintenanceStatus(str, Enum):
    """Maintenance priority (paper §3.2.8.2)"""
    OK = "ok"
    LOW_RISK = "low_risk"
    MEDIUM_RISK = "medium_risk"
    HIGH_RISK = "high_risk"
    SCHEDULED = "scheduled"
    IN_SERVICE = "in_service"
    RESOLVED = "resolved"


class ServiceType(str, Enum):
    FIXED = "fixed"
    CUSTOMIZED = "customized"


class TruckOperationalStatus(str, Enum):
    """Rolling weekly schedule states (paper Fig 16)"""
    AVAILABLE = "available"
    DISPATCHED = "dispatched"
    LOADING = "loading"
    IN_TRANSIT = "in_transit"
    UNLOADING = "unloading"
    RETURN_TO_BASE = "return_to_base"
    MAINTENANCE = "maintenance"


# ------------------------------------------------------------------
# Identity & access
# ------------------------------------------------------------------

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    clerk_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    failed_login_count: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# ------------------------------------------------------------------
# Fleet & catalog
# ------------------------------------------------------------------

class Truck(Base):
    __tablename__ = "trucks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    capacity_tons: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="available")
    fuel_efficiency_kmpl: Mapped[float] = mapped_column(Float, default=4.0)
    odometer_km: Mapped[float] = mapped_column(Float, default=0)
    age_years: Mapped[float] = mapped_column(Float, default=1.0)
    last_maintenance_date: Mapped[date | None] = mapped_column(Date, nullable=True)


class Route(Base):
    """Catalog of origin→destination routes (paper §3.2.4 ERD)"""
    __tablename__ = "routes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    origin: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    destination: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    distance_km: Mapped[float] = mapped_column(Float, default=0)
    eta_hours: Mapped[float] = mapped_column(Float, default=0)
    road_class: Mapped[str] = mapped_column(String(50), default="highway")  # highway | urban | rough
    base_toll: Mapped[float] = mapped_column(Float, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class TruckBanRule(Base):
    """Truck-ban / corridor rule (paper §3.2.5 + Fig 25)"""
    __tablename__ = "truck_ban_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    road_segment: Mapped[str] = mapped_column(String(255), nullable=False)
    weekdays_csv: Mapped[str] = mapped_column(String(50), default="Mon,Tue,Wed,Thu,Fri")
    start_hour: Mapped[int] = mapped_column(Integer, default=6)   # 24h
    end_hour: Mapped[int] = mapped_column(Integer, default=9)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


# ------------------------------------------------------------------
# Bookings, transactions, jobs
# ------------------------------------------------------------------

class Transaction(Base):
    """Bridge between Booking and Payment (paper ERD)"""
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    booking_id: Mapped[int | None] = mapped_column(ForeignKey("bookings.id"), nullable=True, index=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    broker_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    type: Mapped[str] = mapped_column(String(50), default="booking")
    amount: Mapped[float] = mapped_column(Float, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


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

    # Optional foreign keys (filled as workflow advances)
    route_id: Mapped[int | None] = mapped_column(ForeignKey("routes.id"), nullable=True)

    estimated_cost: Mapped[float] = mapped_column(Float, default=0)
    actual_cost: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[BookingStatus] = mapped_column(SAEnum(BookingStatus), default=BookingStatus.PENDING_APPROVAL)

    approved_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    customer: Mapped[User] = relationship(foreign_keys=[customer_id])
    approved_by: Mapped[User | None] = relationship(foreign_keys=[approved_by_id])
    route: Mapped[Route | None] = relationship(foreign_keys=[route_id])


class JobOrder(Base):
    """Manager → Dispatcher hand-off (paper §3.2.3 sequence)"""
    __tablename__ = "job_orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id"), nullable=False, unique=True)
    issued_by_manager_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    assigned_dispatcher_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    instructions: Mapped[str | None] = mapped_column(String(500), nullable=True)
    issued_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class RouteOption(Base):
    """A* candidate routes per booking (paper §3.2.9 + Test F-07 IsSelected flag)"""
    __tablename__ = "route_options"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id"), nullable=False)
    rank: Mapped[int] = mapped_column(Integer, default=1)
    path_json: Mapped[str] = mapped_column(Text, default="[]")
    distance_km: Mapped[float] = mapped_column(Float, default=0)
    fuel_cost: Mapped[float] = mapped_column(Float, default=0)
    toll_cost: Mapped[float] = mapped_column(Float, default=0)
    time_penalty: Mapped[float] = mapped_column(Float, default=0)
    maintenance_penalty: Mapped[float] = mapped_column(Float, default=0)
    total_cost: Mapped[float] = mapped_column(Float, default=0)
    is_selected: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# ------------------------------------------------------------------
# Trip execution
# ------------------------------------------------------------------

class Trip(Base):
    __tablename__ = "trips"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id"), nullable=False)
    truck_id: Mapped[int] = mapped_column(ForeignKey("trucks.id"), nullable=False)
    driver_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    helper_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    dispatcher_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    route_id: Mapped[int | None] = mapped_column(ForeignKey("routes.id"), nullable=True)
    selected_route_option_id: Mapped[int | None] = mapped_column(ForeignKey("route_options.id"), nullable=True)

    route_path: Mapped[str] = mapped_column(Text, default="")
    distance_km: Mapped[float] = mapped_column(Float, default=0)
    toll_cost: Mapped[float] = mapped_column(Float, default=0)
    fuel_cost: Mapped[float] = mapped_column(Float, default=0)
    labor_cost: Mapped[float] = mapped_column(Float, default=0)
    maintenance_cost: Mapped[float] = mapped_column(Float, default=0)
    duration_hours: Mapped[float] = mapped_column(Float, default=0)

    # Predicted vs actual snapshots (paper Fig 24 feedback loop)
    predicted_total_cost: Mapped[float] = mapped_column(Float, default=0)
    predicted_fuel_liters: Mapped[float] = mapped_column(Float, default=0)
    predicted_duration_hours: Mapped[float] = mapped_column(Float, default=0)

    status: Mapped[TripStatus] = mapped_column(SAEnum(TripStatus), default=TripStatus.PENDING)

    assigned_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    departure_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    arrival_pickup_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    loading_start_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    loading_end_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    departure_delivery_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    arrival_delivery_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    proof_of_delivery: Mapped[str | None] = mapped_column(String(500), nullable=True)
    pod_notes: Mapped[str | None] = mapped_column(String(500), nullable=True)

    current_latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    current_longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    estimated_delivery_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    booking: Mapped[Booking] = relationship(foreign_keys=[booking_id])
    truck: Mapped[Truck] = relationship(foreign_keys=[truck_id])
    driver: Mapped[User] = relationship(foreign_keys=[driver_id])
    helper: Mapped["User | None"] = relationship(foreign_keys=[helper_id])
    dispatcher: Mapped["User | None"] = relationship(foreign_keys=[dispatcher_id])
    route: Mapped["Route | None"] = relationship(foreign_keys=[route_id])


class FuelLog(Base):
    """Per-trip fuel entry by driver (paper Driver DFD Fig 13)"""
    __tablename__ = "fuel_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id"), nullable=False, index=True)
    truck_id: Mapped[int] = mapped_column(ForeignKey("trucks.id"), nullable=False)
    driver_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    liters: Mapped[float] = mapped_column(Float, default=0)
    cost: Mapped[float] = mapped_column(Float, default=0)
    odometer_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    receipt_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class TollLog(Base):
    """Per-trip toll entry by driver"""
    __tablename__ = "toll_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id"), nullable=False, index=True)
    driver_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    location: Mapped[str] = mapped_column(String(255), default="")
    amount: Mapped[float] = mapped_column(Float, default=0)
    receipt_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class MaintenanceRecord(Base):
    __tablename__ = "maintenance_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    truck_id: Mapped[int] = mapped_column(ForeignKey("trucks.id"), nullable=False)
    reported_issue: Mapped[str] = mapped_column(String(255), nullable=False)
    severity: Mapped[str] = mapped_column(String(50), default="medium")
    status: Mapped[MaintenanceStatus] = mapped_column(
        SAEnum(MaintenanceStatus), default=MaintenanceStatus.OK
    )
    predicted_risk_score: Mapped[float] = mapped_column(Float, default=0)
    estimated_cost: Mapped[float] = mapped_column(Float, default=0)
    actual_cost: Mapped[float] = mapped_column(Float, default=0)
    parts_used: Mapped[str | None] = mapped_column(String(500), nullable=True)
    scheduled_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    next_service_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


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
    base_salary: Mapped[float] = mapped_column(Float, default=1200.0)


class HelperProfile(Base):
    """Helper crew profile (paper Table 6: each delivery truck paired with a helper)"""
    __tablename__ = "helper_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, nullable=False)
    rating: Mapped[float] = mapped_column(Float, default=5)
    base_salary: Mapped[float] = mapped_column(Float, default=800.0)


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
    """Exceptions raised during trip execution"""
    __tablename__ = "trip_issues"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id"), nullable=False)
    reported_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    issue_type: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    severity: Mapped[str] = mapped_column(String(30), default="medium")

    resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    resolution_notes: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    trip: Mapped[Trip] = relationship(foreign_keys=[trip_id])
    reported_by: Mapped[User] = relationship(foreign_keys=[reported_by_id])


# ------------------------------------------------------------------
# Payments & feedback
# ------------------------------------------------------------------

class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id"), nullable=False, index=True)
    transaction_id: Mapped[int | None] = mapped_column(ForeignKey("transactions.id"), nullable=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    method: Mapped[str] = mapped_column(String(50), default="card")  # card | gcash | bank | cash
    amount: Mapped[float] = mapped_column(Float, default=0)
    status: Mapped[PaymentStatus] = mapped_column(SAEnum(PaymentStatus), default=PaymentStatus.PENDING)
    reference: Mapped[str] = mapped_column(String(100), default="")
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    refunded_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Feedback(Base):
    """Customer service feedback (paper Customer DFD Fig 14, Feedback data store)"""
    __tablename__ = "feedback"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id"), nullable=False, index=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    category: Mapped[str] = mapped_column(String(50), default="service")
    rating: Mapped[int] = mapped_column(Integer, default=5)
    message: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class CompletionReport(Base):
    """Final report bundling Trip + FuelLog + TollLog + POD + issues (paper Driver DFD)"""
    __tablename__ = "completion_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id"), nullable=False, unique=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id"), nullable=False)
    generated_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    summary: Mapped[str] = mapped_column(Text, default="")

    fuel_total: Mapped[float] = mapped_column(Float, default=0)
    toll_total: Mapped[float] = mapped_column(Float, default=0)
    labor_total: Mapped[float] = mapped_column(Float, default=0)
    maintenance_total: Mapped[float] = mapped_column(Float, default=0)
    total_cost: Mapped[float] = mapped_column(Float, default=0)

    status: Mapped[ReportStatus] = mapped_column(SAEnum(ReportStatus), default=ReportStatus.DRAFT)
    confirmed_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# ------------------------------------------------------------------
# Analytics — predictive runs, results, feedback (paper Fig 23, 24, §3.5.10)
# ------------------------------------------------------------------

class ForecastRun(Base):
    __tablename__ = "forecast_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)  # cost | fuel | maintenance | demand
    triggered_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    triggered_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    sample_size: Mapped[int] = mapped_column(Integer, default=0)
    parameters_json: Mapped[str] = mapped_column(Text, default="{}")
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)


class ForecastResult(Base):
    __tablename__ = "forecast_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("forecast_runs.id"), nullable=False)
    target_entity: Mapped[str] = mapped_column(String(50), default="trip")  # trip | truck | month
    target_id: Mapped[str] = mapped_column(String(50), default="")
    predicted_value: Mapped[float] = mapped_column(Float, default=0)
    breakdown_json: Mapped[str] = mapped_column(Text, default="{}")
    period: Mapped[str | None] = mapped_column(String(20), nullable=True)  # for time-series
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ModelMetric(Base):
    """Per-run accuracy (paper §3.5.10: MAE, MAPE, RMSE, Brier, Recall, F1)"""
    __tablename__ = "model_metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    run_id: Mapped[int | None] = mapped_column(ForeignKey("forecast_runs.id"), nullable=True)
    model_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    mae: Mapped[float] = mapped_column(Float, default=0)
    mape: Mapped[float] = mapped_column(Float, default=0)
    rmse: Mapped[float] = mapped_column(Float, default=0)
    accuracy: Mapped[float] = mapped_column(Float, default=0)
    recall: Mapped[float] = mapped_column(Float, default=0)
    f1: Mapped[float] = mapped_column(Float, default=0)
    brier: Mapped[float] = mapped_column(Float, default=0)
    sample_size: Mapped[int] = mapped_column(Integer, default=0)
    measured_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class PredictionFeedback(Base):
    """Predicted vs actual per trip (paper Fig 24 feedback loop)"""
    __tablename__ = "prediction_feedback"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id"), nullable=False, index=True)
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    predicted_value: Mapped[float] = mapped_column(Float, default=0)
    actual_value: Mapped[float] = mapped_column(Float, default=0)
    error: Mapped[float] = mapped_column(Float, default=0)
    abs_pct_error: Mapped[float] = mapped_column(Float, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
