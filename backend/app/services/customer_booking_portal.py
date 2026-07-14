"""Customer portal: display status resolution, consistency repairs, and active/history grouping."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.entities import (
    Booking,
    BookingStatus,
    Payment,
    PaymentStatus,
    TruckSlotHold,
    TruckSlotHoldStatus,
)


CUSTOMER_ACTIVE_DISPLAY_STATUSES: frozenset[str] = frozenset(
    {
        "pending_payment",
        "payment_verification",
        "payment_verified",
        "ready_for_assignment",
        "pending_approval",
        "approved",
        "assigned",
        "for_pickup",
        "picked_up",
        "en_route",
        "out_for_delivery",
        "dropped_off",
    }
)

CUSTOMER_HISTORY_DISPLAY_STATUSES: frozenset[str] = frozenset(
    {
        "completed",
        "cancelled",
        "rejected",
        "payment_rejected",
        "expired",
    }
)

BOOKING_STATUS_TO_DISPLAY: dict[BookingStatus, str] = {
    BookingStatus.PENDING_PAYMENT: "pending_payment",
    BookingStatus.PAYMENT_VERIFICATION: "payment_verification",
    BookingStatus.PAYMENT_VERIFIED: "payment_verified",
    BookingStatus.READY_FOR_ASSIGNMENT: "ready_for_assignment",
    BookingStatus.PENDING_APPROVAL: "pending_approval",
    BookingStatus.APPROVED: "approved",
    BookingStatus.ASSIGNED: "assigned",
    BookingStatus.ACCEPTED: "for_pickup",
    BookingStatus.ENROUTE: "en_route",
    BookingStatus.LOADING: "picked_up",
    BookingStatus.OUT_FOR_DELIVERY: "out_for_delivery",
    BookingStatus.COMPLETED: "completed",
    BookingStatus.CANCELLED: "cancelled",
    BookingStatus.REJECTED: "rejected",
    BookingStatus.PAYMENT_REJECTED: "payment_rejected",
    BookingStatus.EXPIRED: "expired",
}


def display_status_label(display: str) -> str:
    return {
        "pending_payment": "Pending payment",
        "payment_verification": "Payment verification",
        "payment_verified": "Payment verified",
        "ready_for_assignment": "Ready for assignment",
        "pending_approval": "Pending approval",
        "approved": "Approved",
        "assigned": "Booking assigned",
        "for_pickup": "En Route to Pickup",
        "picked_up": "Arrived at Pickup",
        "en_route": "En Route to Destination",
        "out_for_delivery": "En Route to Destination",
        "dropped_off": "Arrived at Destination",
        "completed": "Completed",
        "cancelled": "Cancelled",
        "rejected": "Rejected",
        "payment_rejected": "Payment rejected",
        "expired": "Expired",
    }.get(display, display.replace("_", " ").title())


def repair_stale_payment_rejection(db: Session, booking: Booking) -> bool:
    """If latest payment is rejected but booking still looks awaiting proof, mark payment_rejected."""
    latest = (
        db.query(Payment).filter(Payment.booking_id == booking.id).order_by(Payment.id.desc()).first()
    )
    if not latest or latest.status != PaymentStatus.REJECTED:
        return False
    if booking.status not in {
        BookingStatus.PAYMENT_VERIFICATION,
        BookingStatus.PENDING_PAYMENT,
    }:
        return False
    booking.status = BookingStatus.PAYMENT_REJECTED
    db.query(TruckSlotHold).filter(TruckSlotHold.booking_id == booking.id).update(
        {"hold_status": TruckSlotHoldStatus.RELEASED}
    )
    return True


def ensure_booking_status_matches_trips(db: Session, booking: Booking) -> bool:
    """Align booking.status with aggregate of all trips (multi-truck safe)."""
    from app.services.booking_status_aggregate import apply_aggregate_booking_status

    return apply_aggregate_booking_status(db, booking)


def resolve_customer_display_status(booking: Booking, assignments: list[dict]) -> str:
    """Unified customer-facing status key (snake_case) for filters and labels."""
    from app.services.booking_status_aggregate import aggregate_customer_display_from_assignment_rows

    raw = booking.status.value if hasattr(booking.status, "value") else str(booking.status)
    try:
        bst = BookingStatus(raw)
    except ValueError:
        bst = booking.status

    if bst in {
        BookingStatus.COMPLETED,
        BookingStatus.CANCELLED,
        BookingStatus.REJECTED,
        BookingStatus.PAYMENT_REJECTED,
        BookingStatus.EXPIRED,
    }:
        return BOOKING_STATUS_TO_DISPLAY.get(bst, raw)

    if assignments:
        return aggregate_customer_display_from_assignment_rows(assignments)

    return BOOKING_STATUS_TO_DISPLAY.get(bst, raw)


def customer_can_cancel(booking: Booking, display: str) -> bool:
    if display not in {"pending_payment", "payment_verification"}:
        return False
    st = booking.status.value if hasattr(booking.status, "value") else str(booking.status)
    try:
        bst = BookingStatus(st)
    except ValueError:
        return False
    return bst in {BookingStatus.PENDING_PAYMENT, BookingStatus.PAYMENT_VERIFICATION}


def history_primary_trip_id(assignments: list[dict]) -> int | None:
    for row in assignments:
        tid = row.get("trip_id")
        if isinstance(tid, int):
            return tid
    return None
