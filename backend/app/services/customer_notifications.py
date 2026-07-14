"""In-app customer notifications — document review decisions and support confirmations."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models.entities import Booking, CustomerNotification, CustomerNotificationKind


def create_customer_notification(
    db: Session,
    *,
    customer_id: int,
    booking_id: int | None,
    kind: CustomerNotificationKind | str,
    title: str,
    message: str,
    required_action: str = "",
    link_path: str = "",
) -> CustomerNotification:
    kind_val = kind.value if isinstance(kind, CustomerNotificationKind) else str(kind)
    row = CustomerNotification(
        customer_id=customer_id,
        booking_id=booking_id,
        kind=kind_val,
        title=(title or "").strip()[:255],
        message=(message or "").strip()[:1000],
        required_action=(required_action or "").strip()[:512],
        link_path=(link_path or "").strip()[:255],
    )
    db.add(row)
    return row


def notify_customer_document_review(
    db: Session,
    booking: Booking,
    *,
    status: str,
    remarks: str | None = None,
) -> CustomerNotification | None:
    """Create an in-app alert when a manager/admin revises or rejects documents."""
    if not booking.customer_id:
        return None
    st = (status or "").strip().lower()
    note = (remarks or "").strip()
    if st == "revision_requested":
        return create_customer_notification(
            db,
            customer_id=int(booking.customer_id),
            booking_id=int(booking.id),
            kind=CustomerNotificationKind.DOCUMENT_REVISION,
            title=f"Documents need revision — Booking #{booking.id}",
            message=note or "Your goods declaration was marked For Revision. Please update and resubmit.",
            required_action="Open the booking, review remarks, then resubmit the goods declaration.",
            link_path=f"/modules/operations/trips?booking={booking.id}",
        )
    if st == "rejected":
        return create_customer_notification(
            db,
            customer_id=int(booking.customer_id),
            booking_id=int(booking.id),
            kind=CustomerNotificationKind.DOCUMENT_REJECTED,
            title=f"Documents rejected — Booking #{booking.id}",
            message=note or "Your goods declaration was rejected. Contact support if you need help.",
            required_action="Review the rejection remarks and contact support, or submit a corrected declaration if allowed.",
            link_path=f"/modules/customer/support?booking={booking.id}",
        )
    return None


def acknowledge_document_notifications_for_booking(
    db: Session,
    *,
    customer_id: int,
    booking_id: int | None,
) -> int:
    """Mark document revision/rejected alerts read after the customer has acted (e.g. contacted support)."""
    if not booking_id:
        return 0
    now = datetime.utcnow()
    kinds = {
        CustomerNotificationKind.DOCUMENT_REVISION.value,
        CustomerNotificationKind.DOCUMENT_REJECTED.value,
    }
    rows = (
        db.query(CustomerNotification)
        .filter(
            CustomerNotification.customer_id == customer_id,
            CustomerNotification.booking_id == int(booking_id),
            CustomerNotification.kind.in_(kinds),
            CustomerNotification.read_at.is_(None),
            CustomerNotification.dismissed_at.is_(None),
        )
        .all()
    )
    for row in rows:
        row.read_at = now
    return len(rows)


def notify_customer_support_received(
    db: Session,
    *,
    customer_id: int,
    booking_id: int | None,
    category: str,
) -> CustomerNotification:
    """Confirm to the customer that their Contact Support message was received."""
    cat = (category or "support").strip() or "support"
    booking_bit = f" for Booking #{booking_id}" if booking_id else ""
    # Contacting support acknowledges the related document alert for that booking.
    acknowledge_document_notifications_for_booking(
        db, customer_id=customer_id, booking_id=booking_id
    )
    row = create_customer_notification(
        db,
        customer_id=customer_id,
        booking_id=booking_id,
        kind=CustomerNotificationKind.SUPPORT_RECEIVED,
        title="Support request received",
        message=f"Your {cat} message{booking_bit} was submitted. Our team will follow up by email when needed.",
        required_action="No action needed unless you receive a follow-up.",
        link_path="/modules/customer/support" + (f"?booking={booking_id}" if booking_id else ""),
    )
    # Confirmation should not keep the unread red badge after the user acted.
    row.read_at = datetime.utcnow()
    return row


def serialize_customer_notification(row: CustomerNotification) -> dict[str, Any]:
    return {
        "id": row.id,
        "booking_id": row.booking_id,
        "kind": row.kind,
        "title": row.title,
        "message": row.message,
        "required_action": row.required_action,
        "link_path": row.link_path,
        "read": row.read_at is not None,
        "read_at": row.read_at.isoformat() if row.read_at else None,
        "dismissed": row.dismissed_at is not None,
        "dismissed_at": row.dismissed_at.isoformat() if row.dismissed_at else None,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def list_customer_notifications(
    db: Session,
    customer_id: int,
    *,
    unread_only: bool = False,
    include_dismissed: bool = False,
    limit: int = 30,
) -> list[dict[str, Any]]:
    safe_limit = min(max(limit, 1), 100)
    q = db.query(CustomerNotification).filter(CustomerNotification.customer_id == customer_id)
    if not include_dismissed:
        q = q.filter(CustomerNotification.dismissed_at.is_(None))
    if unread_only:
        q = q.filter(CustomerNotification.read_at.is_(None))
    rows = q.order_by(CustomerNotification.created_at.desc()).limit(safe_limit).all()
    return [serialize_customer_notification(r) for r in rows]


def count_unread_customer_notifications(db: Session, customer_id: int) -> int:
    return (
        db.query(CustomerNotification)
        .filter(
            CustomerNotification.customer_id == customer_id,
            CustomerNotification.read_at.is_(None),
            CustomerNotification.dismissed_at.is_(None),
        )
        .count()
    )


def mark_customer_notification_read(
    db: Session,
    customer_id: int,
    notification_id: int,
) -> dict[str, Any] | None:
    row = (
        db.query(CustomerNotification)
        .filter(
            CustomerNotification.id == notification_id,
            CustomerNotification.customer_id == customer_id,
            CustomerNotification.dismissed_at.is_(None),
        )
        .first()
    )
    if not row:
        return None
    if row.read_at is None:
        row.read_at = datetime.utcnow()
    return serialize_customer_notification(row)


def mark_all_customer_notifications_read(db: Session, customer_id: int) -> int:
    now = datetime.utcnow()
    rows = (
        db.query(CustomerNotification)
        .filter(
            CustomerNotification.customer_id == customer_id,
            CustomerNotification.read_at.is_(None),
            CustomerNotification.dismissed_at.is_(None),
        )
        .all()
    )
    for row in rows:
        row.read_at = now
    return len(rows)


def dismiss_customer_notification(
    db: Session,
    customer_id: int,
    notification_id: int,
) -> dict[str, Any] | None:
    row = (
        db.query(CustomerNotification)
        .filter(
            CustomerNotification.id == notification_id,
            CustomerNotification.customer_id == customer_id,
            CustomerNotification.dismissed_at.is_(None),
        )
        .first()
    )
    if not row:
        return None
    now = datetime.utcnow()
    row.dismissed_at = now
    if row.read_at is None:
        row.read_at = now
    return serialize_customer_notification(row)
