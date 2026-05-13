from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from app.constants.fleet_capacity import trucks_required_for_cargo
from app.models.entities import (
    Booking,
    BookingStatus,
    Payment,
    PaymentStatus,
    Truck,
    TruckSlotHold,
    TruckSlotHoldStatus,
)


# Holds that reserve capacity before real trips exist. ASSIGNED holds must not block —
# the same booking is already represented by active trips on trucks (avoid double-count).
BLOCKING_HOLD_STATUSES = (
    TruckSlotHoldStatus.ON_HOLD,
    TruckSlotHoldStatus.READY_FOR_ASSIGNMENT,
)

BOOKING_BLOCKING_STATUSES = (
    BookingStatus.PENDING_PAYMENT,
    BookingStatus.PAYMENT_VERIFICATION,
    BookingStatus.PAYMENT_VERIFIED,
    BookingStatus.READY_FOR_ASSIGNMENT,
    BookingStatus.ASSIGNED,
    BookingStatus.PENDING_APPROVAL,
    BookingStatus.APPROVED,
)


@dataclass
class TruckAvailability:
    active_trucks: int
    unavailable_trucks: int
    available_trucks: int
    required_trucks: int
    can_book: bool


def get_available_truck_count(
    db: Session,
    schedule_date: date,
    time_slot: str,
    required_trucks: int,
    lock_rows: bool = False,
) -> TruckAvailability:
    active_trucks_q = db.query(func.count(Truck.id)).filter(
        func.lower(func.coalesce(Truck.status, "available")).notin_(["maintenance", "inactive"])
    )
    if lock_rows:
        active_trucks_q = active_trucks_q.with_for_update()
    active_trucks = int(active_trucks_q.scalar() or 0)

    # NOTE: keep "payment_verification" string for backward/manual compatibility.
    # Canonical hold during payment stage is "on_hold".
    has_rejected_payment = db.query(Payment.id).filter(
        Payment.booking_id == Booking.id,
        Payment.status == PaymentStatus.REJECTED,
    ).exists()
    has_verified_payment = db.query(Payment.id).filter(
        Payment.booking_id == Booking.id,
        Payment.status == PaymentStatus.VERIFIED,
    ).exists()

    holds_q = (
        db.query(func.coalesce(func.sum(TruckSlotHold.required_truck_count), 0))
        .join(Booking, Booking.id == TruckSlotHold.booking_id)
        .filter(
            TruckSlotHold.schedule_date == schedule_date,
            TruckSlotHold.time_slot == time_slot,
            func.lower(func.coalesce(TruckSlotHold.hold_status, "")).in_(
                [
                    TruckSlotHoldStatus.ON_HOLD.value,
                    "payment_verification",
                    TruckSlotHoldStatus.READY_FOR_ASSIGNMENT.value,
                ]
            ),
            # Safety net: terminal / dead bookings must not keep slot capacity tied up.
            Booking.status.notin_(
                [
                    BookingStatus.CANCELLED,
                    BookingStatus.REJECTED,
                    BookingStatus.PAYMENT_REJECTED,
                    BookingStatus.COMPLETED,
                    BookingStatus.EXPIRED,
                ]
            ),
            # Extra safety: rejected payment (without any verified payment) should never block slots.
            ~and_(has_rejected_payment, ~has_verified_payment),
        )
    )
    if lock_rows:
        holds_q = holds_q.with_for_update()
    unavailable_holds = int(holds_q.scalar() or 0)

    legacy_without_hold_q = (
        db.query(Booking)
        .outerjoin(TruckSlotHold, TruckSlotHold.booking_id == Booking.id)
        .filter(
            Booking.scheduled_date == schedule_date,
            Booking.scheduled_time_slot == time_slot,
            Booking.status.in_(BOOKING_BLOCKING_STATUSES),
            TruckSlotHold.id.is_(None),
        )
    )
    if lock_rows:
        legacy_without_hold_q = legacy_without_hold_q.with_for_update()
    legacy_rows = legacy_without_hold_q.all()
    unavailable_legacy = sum(
        int(b.required_truck_count or trucks_required_for_cargo(float(b.cargo_weight_tons or 0)))
        for b in legacy_rows
    )

    unavailable_trucks = max(0, unavailable_holds + unavailable_legacy)
    available_trucks = max(0, active_trucks - unavailable_trucks)
    req = max(1, int(required_trucks))
    return TruckAvailability(
        active_trucks=active_trucks,
        unavailable_trucks=unavailable_trucks,
        available_trucks=available_trucks,
        required_trucks=req,
        can_book=available_trucks >= req,
    )

