"""Email document-review participants when booking documents need attention."""

from __future__ import annotations

import html
import logging

from sqlalchemy.orm import Session

from app.models.entities import Booking, User, UserRole
from app.services.goods_declaration_review import goods_declaration_review_label
from app.services.notifications import send_email_notification

logger = logging.getLogger(__name__)

_REVIEWER_ROLES = (UserRole.ADMIN, UserRole.MANAGER, UserRole.DISPATCHER)


def notify_reviewers_documents_resubmitted(db: Session, booking: Booking) -> None:
    """Notify admin, manager, and dispatcher inboxes that a customer resubmitted documents."""
    reviewers = (
        db.query(User)
        .filter(User.role.in_(_REVIEWER_ROLES))
        .filter(User.email.isnot(None))
        .filter(User.email != "")
        .all()
    )
    if not reviewers:
        logger.info("No reviewer emails configured for document resubmit notification.")
        return

    customer = db.query(User).filter(User.id == booking.customer_id).first()
    customer_label = html.escape(customer.full_name if customer else f"Customer #{booking.customer_id}")
    route = html.escape(f"{booking.pickup_location} → {booking.dropoff_location}")

    subject = f"Documents resubmitted — booking #{booking.id}"
    body = f"""
    <html><body style="font-family: system-ui, sans-serif; color: #333;">
      <h2 style="color:#3730A3;">Customer resubmitted booking documents</h2>
      <p><strong>Booking #{booking.id}</strong> — {customer_label}</p>
      <p style="color:#555;">{route}</p>
      <p>Review status is now <strong>Resubmitted</strong>. Please review the updated declaration and terms in the admin goods declaration queue.</p>
      <p style="font-size:12px;color:#888;">FleetOpt automated notification.</p>
    </body></html>
    """

    for reviewer in reviewers:
        try:
            send_email_notification(reviewer.email, subject, body)
        except Exception:
            logger.exception("Failed to notify %s about resubmitted documents.", reviewer.email)


def notify_customer_document_review_decision(
    db: Session,
    booking: Booking,
    *,
    status: str,
    remarks: str | None = None,
) -> None:
    """Notify the customer immediately when documents are approved, rejected, or need revision."""
    customer = db.query(User).filter(User.id == booking.customer_id).first()
    if not customer or not customer.email:
        logger.info("No customer email configured for document review notification.")
        return

    label = goods_declaration_review_label(status)
    route = html.escape(f"{booking.pickup_location} -> {booking.dropoff_location}")
    safe_remarks = html.escape((remarks or "").strip())
    remarks_html = (
        f"<p><strong>Reviewer remarks:</strong> {safe_remarks}</p>"
        if safe_remarks
        else ""
    )
    next_step = {
        "revision_requested": "Please open your booking/payment page and upload revised documents.",
        "rejected": "This booking document review is closed. Please contact FleetOps support if you need assistance.",
        "approved": "No document action is needed from you. FleetOps will continue processing the booking.",
    }.get(status, "Please check your FleetOps account for the latest booking status.")

    subject = f"Document review update - booking #{booking.id}: {label}"
    body = f"""
    <html><body style="font-family: system-ui, sans-serif; color: #333;">
      <h2 style="color:#3730A3;">Booking document review update</h2>
      <p><strong>Booking #{booking.id}</strong></p>
      <p style="color:#555;">{route}</p>
      <p>Review status is now <strong>{html.escape(label)}</strong>.</p>
      {remarks_html}
      <p>{html.escape(next_step)}</p>
      <p style="font-size:12px;color:#888;">FleetOpt automated notification.</p>
    </body></html>
    """

    try:
        send_email_notification(customer.email, subject, body)
    except Exception:
        logger.exception("Failed to notify customer about document review decision.")
