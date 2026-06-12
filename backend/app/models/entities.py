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


class CustomsClearanceStatus(str, Enum):
    NOT_STARTED = "not_started"
    DOCUMENTS_PREPARED = "documents_prepared"
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    CLEARED = "cleared"
    HELD = "held"


class BookingStatus(str, Enum):
    """Booking workflow statuses (paper §3.2.3 + Fig 19)"""
    PENDING_PAYMENT = "pending_payment"
    PAYMENT_VERIFICATION = "payment_verification"
    PAYMENT_VERIFIED = "payment_verified"
    READY_FOR_ASSIGNMENT = "ready_for_assignment"
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
    PAYMENT_REJECTED = "payment_rejected"
    EXPIRED = "expired"


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
    """Proof-of-payment verification lifecycle (admin approves uploads)."""

    FOR_VERIFICATION = "for_verification"
    VERIFIED = "verified"
    REJECTED = "rejected"
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


class GoodsDeclarationReviewStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    REVISION_REQUESTED = "revision_requested"
    RESUBMITTED = "resubmitted"


class CargoTypeCategory(str, Enum):
    GENERAL = "general"
    ELECTRONICS = "electronics"
    FURNITURE = "furniture"
    FOOD_PERISHABLE = "food_perishable"
    FOOD_NON_PERISHABLE = "food_non_perishable"
    CONSTRUCTION = "construction"
    AUTOMOTIVE = "automotive"
    TEXTILES = "textiles"
    PHARMACEUTICALS = "pharmaceuticals"
    CHEMICALS_HAZMAT = "chemicals_hazmat"
    FLAMMABLE = "flammable"
    WEAPONS = "weapons"
    LIVE_ANIMALS = "live_animals"
    CONTROLLED_SUBSTANCES = "controlled_substances"
    OTHER = "other"


class TruckOperationalStatus(str, Enum):
    """Rolling weekly schedule states (paper Fig 16)"""
    AVAILABLE = "available"
    DISPATCHED = "dispatched"
    LOADING = "loading"
    IN_TRANSIT = "in_transit"
    UNLOADING = "unloading"
    RETURN_TO_BASE = "return_to_base"
    MAINTENANCE = "maintenance"


class TruckSlotHoldStatus(str, Enum):
    ON_HOLD = "on_hold"
    READY_FOR_ASSIGNMENT = "ready_for_assignment"
    ASSIGNED = "assigned"
    RELEASED = "released"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class TruckAssignmentStatus(str, Enum):
    ASSIGNED = "assigned"
    FOR_PICKUP = "for_pickup"
    PICKED_UP = "picked_up"
    EN_ROUTE = "en_route"
    DROPPED_OFF = "dropped_off"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


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
    company_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole), nullable=False)
    availability_status: Mapped[str] = mapped_column(String(32), default="available")
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    password_reset_token_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    password_reset_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    failed_login_count: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    saved_sites: Mapped[list["CustomerSavedSite"]] = relationship(
        "CustomerSavedSite",
        back_populates="customer",
        cascade="all, delete-orphan",
    )


class CustomerSavedSite(Base):
    """Customer warehouse / delivery addresses (persist beyond browser session)."""

    __tablename__ = "customer_saved_sites"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    label: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address: Mapped[str] = mapped_column(Text, nullable=False)
    street: Mapped[str | None] = mapped_column(Text, nullable=True)
    barangay: Mapped[str | None] = mapped_column(Text, nullable=True)
    city_municipality: Mapped[str | None] = mapped_column(Text, nullable=True)
    province: Mapped[str | None] = mapped_column(Text, nullable=True)
    postal_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    customer: Mapped["User"] = relationship("User", back_populates="saved_sites")


# ------------------------------------------------------------------
# Fleet & catalog
# ------------------------------------------------------------------

class Truck(Base):
    __tablename__ = "trucks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    model_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    capacity_tons: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="available")
    availability_status: Mapped[str] = mapped_column(String(32), default="available")
    fuel_efficiency_kmpl: Mapped[float] = mapped_column(Float, default=4.0)
    odometer_km: Mapped[float] = mapped_column(Float, default=0)
    age_years: Mapped[float] = mapped_column(Float, default=1.0)
    vehicle_class: Mapped[str] = mapped_column(String(32), default="Class 3")
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
    """One of four daily pickup windows; capacity = overlapping truck-hours (four × 42 t tractors)."""
    scheduled_time_slot: Mapped[str] = mapped_column(String(8), nullable=False, default="08:00")
    cargo_weight_tons: Mapped[float] = mapped_column(Float, nullable=False)
    required_truck_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    cargo_description: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Optional foreign keys (filled as workflow advances)
    route_id: Mapped[int | None] = mapped_column(ForeignKey("routes.id"), nullable=True)

    estimated_cost: Mapped[float] = mapped_column(Float, default=0)
    estimated_toll_budget_php: Mapped[float | None] = mapped_column(Float, nullable=True)
    toll_matrix_matched: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    toll_estimate_message: Mapped[str | None] = mapped_column(String(500), nullable=True)
    vehicle_class_used: Mapped[str | None] = mapped_column(String(32), nullable=True)
    toll_entry_point: Mapped[str | None] = mapped_column(String(255), nullable=True)
    toll_exit_point: Mapped[str | None] = mapped_column(String(255), nullable=True)
    toll_effective_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    actual_cost: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[BookingStatus] = mapped_column(
        SAEnum(
            BookingStatus,
            values_callable=lambda obj: [m.value for m in obj],
            native_enum=False,
            length=32,
        ),
        default=BookingStatus.PENDING_APPROVAL,
    )

    approved_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    """Latest manual location name from helper (not GPS)."""
    latest_location: Mapped[str | None] = mapped_column(String(512), nullable=True)

    cargo_declaration_original_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    cargo_declaration_storage_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    cargo_declaration_uploaded_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    terms_agreement_original_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    terms_agreement_storage_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    terms_agreement_uploaded_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    terms_agreed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    customs_clearance_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    customs_tariff_notes: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    customs_additional_charges_php: Mapped[float | None] = mapped_column(Float, nullable=True)
    customs_customer_updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    customs_admin_validated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    customs_validated_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    customs_validated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    customs_admin_notes: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    customs_validated_additional_charges_php: Mapped[float | None] = mapped_column(Float, nullable=True)

    goods_declaration_validated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    cargo_type_validated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    goods_declaration_review_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    goods_declaration_review_remarks: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    goods_declaration_reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    goods_declaration_reviewed_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    cargo_type_category: Mapped[str | None] = mapped_column(String(64), nullable=True)
    cargo_type_admin_notes: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    cargo_restricted_flag: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    cargo_restricted_reasons: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    cargo_type_validated_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    cargo_type_validated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    @property
    def cargo_declaration_file_url(self) -> str | None:
        from app.services.upload_urls import public_upload_url

        return public_upload_url(self.cargo_declaration_storage_path)

    @property
    def terms_agreement_file_url(self) -> str | None:
        from app.services.upload_urls import public_upload_url

        return public_upload_url(self.terms_agreement_storage_path)

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


class TruckSlotHold(Base):
    __tablename__ = "truck_slot_holds"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id"), nullable=False, index=True)
    schedule_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    time_slot: Mapped[str] = mapped_column(String(8), nullable=False, index=True)
    required_truck_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    hold_status: Mapped[TruckSlotHoldStatus] = mapped_column(
        SAEnum(
            TruckSlotHoldStatus,
            values_callable=lambda obj: [m.value for m in obj],
            native_enum=False,
            length=32,
        ),
        default=TruckSlotHoldStatus.ON_HOLD,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class TruckAssignment(Base):
    __tablename__ = "truck_assignments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id"), nullable=False, index=True)
    truck_id: Mapped[int] = mapped_column(ForeignKey("trucks.id"), nullable=False)
    driver_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    helper_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    assigned_weight: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    assignment_status: Mapped[TruckAssignmentStatus] = mapped_column(
        SAEnum(
            TruckAssignmentStatus,
            values_callable=lambda obj: [m.value for m in obj],
            native_enum=False,
            length=32,
        ),
        default=TruckAssignmentStatus.ASSIGNED,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class TripStatusUpdate(Base):
    __tablename__ = "trip_status_updates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id"), nullable=False, index=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id"), nullable=False, index=True)
    helper_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    location_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    remarks: Mapped[str | None] = mapped_column(String(500), nullable=True)
    photo_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class TripLocationUpdate(Base):
    __tablename__ = "trip_location_updates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id"), nullable=False, index=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id"), nullable=False, index=True)
    helper_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    location_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    remarks: Mapped[str | None] = mapped_column(String(500), nullable=True)
    photo_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

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
    estimated_toll_budget: Mapped[float | None] = mapped_column(Float, nullable=True)
    additional_toll_total: Mapped[float | None] = mapped_column(Float, nullable=True)
    toll_actual_total: Mapped[float | None] = mapped_column(Float, nullable=True)
    toll_variance: Mapped[float | None] = mapped_column(Float, nullable=True)
    fuel_cost: Mapped[float] = mapped_column(Float, default=0)
    labor_cost: Mapped[float] = mapped_column(Float, default=0)
    driver_allowance_php: Mapped[float] = mapped_column(Float, default=0)
    helper_allowance_php: Mapped[float] = mapped_column(Float, default=0)
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

    receiving_document_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    receiving_document_uploaded_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    receiving_qr_token: Mapped[str | None] = mapped_column(String(64), nullable=True)
    receiving_qr_verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    digital_signature_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    digital_signature_uploaded_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    """Helper-facing milestone (for_pick_up … complete_trip); mirrored for dispatcher/customer UI."""
    helper_progress_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    helper_last_proof_path: Mapped[str | None] = mapped_column(String(512), nullable=True)

    """Latest manual location name from helper (not GPS)."""
    latest_location: Mapped[str | None] = mapped_column(String(512), nullable=True)

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


class OperationalLog(Base):
    """Dispatcher-side operational incident / note tied to a trip (not customer feedback)."""

    __tablename__ = "operational_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id"), nullable=False, index=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id"), nullable=False, index=True)
    dispatcher_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    report_type: Mapped[str] = mapped_column(String(64), nullable=False)
    priority_level: Mapped[str] = mapped_column(String(16), nullable=False, default="medium")
    operational_details: Mapped[str] = mapped_column(Text, nullable=False)
    attachment_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


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


class TripShoulderCostCategory(str, Enum):
    TOLL = "toll"
    FUEL = "fuel"
    PARKING = "parking"
    ALLOWANCE = "allowance"
    OTHER = "other"


class TripShoulderCostEntry(Base):
    """Dispatcher-captured shoulder / out-of-pocket trip expenses (tracking & analytics only)."""

    __tablename__ = "trip_shoulder_cost_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id"), nullable=False, index=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id"), nullable=False, index=True)
    dispatcher_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    category: Mapped[str] = mapped_column(String(32), nullable=False)
    amount_php: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
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


class BookingFreightSettings(Base):
    """Singleton row (id=1): admin-editable diesel ₱/L and toll only; other formula terms are code constants."""

    __tablename__ = "booking_freight_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    diesel_price_php_per_liter: Mapped[float] = mapped_column(Float, nullable=False)
    toll_fees_php_per_trip: Mapped[float] = mapped_column(Float, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


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
    check_out_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
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


class VehicleIssueReportStatus(str, Enum):
    SUBMITTED = "submitted"
    REVIEWED = "reviewed"
    RESOLVED = "resolved"


class VehicleIssueReport(Base):
    """Driver-submitted truck issue tied to a real trip/booking (dispatcher workflow)."""

    __tablename__ = "vehicle_issue_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id"), nullable=False, index=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id"), nullable=False, index=True)
    truck_id: Mapped[int] = mapped_column(ForeignKey("trucks.id"), nullable=False)
    driver_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    helper_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    issue_type: Mapped[str] = mapped_column(String(64), nullable=False)
    priority: Mapped[str] = mapped_column(String(16), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    attachment_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    status: Mapped[VehicleIssueReportStatus] = mapped_column(
        SAEnum(
            VehicleIssueReportStatus,
            values_callable=lambda obj: [m.value for m in obj],
            native_enum=False,
            length=32,
        ),
        default=VehicleIssueReportStatus.SUBMITTED,
    )

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    booking: Mapped[Booking] = relationship(foreign_keys=[booking_id])
    trip: Mapped[Trip] = relationship(foreign_keys=[trip_id])
    truck: Mapped[Truck] = relationship(foreign_keys=[truck_id])
    driver: Mapped[User] = relationship(foreign_keys=[driver_id])
    helper: Mapped[User | None] = relationship(foreign_keys=[helper_id])


class GeneralOperationalReport(Base):
    """Driver-submitted trip-related operational report (completion, delays, fuel, incidents, etc.)."""

    __tablename__ = "general_operational_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id"), nullable=False, index=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id"), nullable=False, index=True)
    driver_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    helper_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    category: Mapped[str] = mapped_column(String(64), nullable=False)
    """Operational leg context when submitted (assigned … completed); optional."""
    status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    report_date: Mapped[date] = mapped_column(Date, nullable=False)
    starting_odometer_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    ending_odometer_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    fuel_consumed: Mapped[float | None] = mapped_column(Float, nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    attachment_url: Mapped[str | None] = mapped_column(String(512), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    booking: Mapped[Booking] = relationship(foreign_keys=[booking_id])
    trip: Mapped[Trip] = relationship(foreign_keys=[trip_id])
    driver: Mapped[User] = relationship(foreign_keys=[driver_id])
    helper: Mapped[User | None] = relationship(foreign_keys=[helper_id])


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
    status: Mapped[PaymentStatus] = mapped_column(
        SAEnum(
            PaymentStatus,
            values_callable=lambda obj: [m.value for m in obj],
            native_enum=False,
            length=32,
        ),
        default=PaymentStatus.FOR_VERIFICATION,
    )
    reference: Mapped[str] = mapped_column(String(100), default="")
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    refunded_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    proof_original_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    proof_storage_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    proof_uploaded_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    reviewed_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    @property
    def proof_file_url(self) -> str | None:
        from app.services.upload_urls import public_upload_url

        return public_upload_url(self.proof_storage_path)


class Feedback(Base):
    """Customer service feedback (paper Customer DFD Fig 14, Feedback data store)"""
    __tablename__ = "feedback"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    booking_id: Mapped[int | None] = mapped_column(ForeignKey("bookings.id"), nullable=True, index=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    category: Mapped[str] = mapped_column(String(50), default="service")
    rating: Mapped[int] = mapped_column(Integer, default=5)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
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


class DriverTripNotificationKind(str, Enum):
    ASSIGNED = "assigned"
    UPDATED = "updated"


class DriverTripNotification(Base):
    """In-app trip alerts for drivers (assignment and schedule/route updates)."""

    __tablename__ = "driver_trip_notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    driver_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    trip_id: Mapped[int | None] = mapped_column(ForeignKey("trips.id"), nullable=True, index=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id"), nullable=False, index=True)
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    schedule_summary: Mapped[str] = mapped_column(String(255), default="")
    route_summary: Mapped[str] = mapped_column(String(512), default="")
    required_action: Mapped[str] = mapped_column(String(512), default="")
    read_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class TollPlazaStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class TollPlaza(Base):
    """Canonical NLEX-SCTEX toll plaza name with admin-managed aliases."""

    __tablename__ = "toll_plazas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    canonical_name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    status: Mapped[str] = mapped_column(String(16), default=TollPlazaStatus.ACTIVE.value, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    aliases: Mapped[list["TollPlazaAlias"]] = relationship(
        "TollPlazaAlias", back_populates="plaza", cascade="all, delete-orphan"
    )


class TollPlazaAlias(Base):
    """Alternate labels that map customer/route text to a canonical toll plaza."""

    __tablename__ = "toll_plaza_aliases"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    plaza_id: Mapped[int] = mapped_column(ForeignKey("toll_plazas.id"), nullable=False, index=True)
    alias: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    plaza: Mapped["TollPlaza"] = relationship("TollPlaza", back_populates="aliases")


class TollMatrixStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class TollMatrix(Base):
    """NLEX-SCTEX style descriptive toll matrix: entry plaza → exit plaza by vehicle class."""

    __tablename__ = "toll_matrix"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entry_point: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    exit_point: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    vehicle_class: Mapped[str] = mapped_column(String(32), nullable=False, default="Class 3", index=True)
    toll_fee: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    effective_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(16), default=TollMatrixStatus.ACTIVE.value, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AdditionalTollEntry(Base):
    """Driver-reported toll surcharges during transit (reroute, extra gates, etc.)."""

    __tablename__ = "additional_toll_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id"), nullable=False, index=True)
    driver_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    reason: Mapped[str] = mapped_column(String(500), nullable=False)
    receipt_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class HistoricalTollRecord(Base):
    """Completed-trip toll snapshot for analytics and future estimation."""

    __tablename__ = "historical_toll_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id"), nullable=False, index=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id"), nullable=False, index=True)
    route_label: Mapped[str] = mapped_column(String(512), default="")
    entry_point: Mapped[str] = mapped_column(String(255), default="")
    exit_point: Mapped[str] = mapped_column(String(255), default="")
    origin: Mapped[str] = mapped_column(String(255), default="")
    destination: Mapped[str] = mapped_column(String(255), default="")
    vehicle_class: Mapped[str] = mapped_column(String(32), default="Class 3")
    effective_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    estimated_toll: Mapped[float] = mapped_column(Float, default=0)
    actual_toll: Mapped[float] = mapped_column(Float, default=0)
    toll_variance: Mapped[float] = mapped_column(Float, default=0)
    completed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
