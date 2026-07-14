"""Customer in-app notifications for document review and support."""

from datetime import datetime

import pytest

from app.models.entities import Booking, BookingStatus, CustomerNotification, ServiceType
from app.services.customer_notifications import (
    count_unread_customer_notifications,
    dismiss_customer_notification,
    list_customer_notifications,
    mark_customer_notification_read,
    notify_customer_document_review,
    notify_customer_support_received,
)

pytest_plugins = ["test_integration"]


def _booking(db, customer) -> Booking:
    b = Booking(
        customer_id=customer.id,
        pickup_location="Manila",
        dropoff_location="Cebu",
        service_type=ServiceType.FIXED,
        cargo_weight_tons=2.0,
        scheduled_date=datetime.utcnow().date(),
        estimated_cost=1000.0,
        status=BookingStatus.PAYMENT_VERIFIED,
    )
    db.add(b)
    db.flush()
    return b


def test_document_revision_creates_unread_notification(db, test_users):
    customer = test_users["customer"]
    booking = _booking(db, customer)
    row = notify_customer_document_review(
        db,
        booking,
        status="revision_requested",
        remarks="Missing seal photo",
    )
    db.flush()
    assert row is not None
    assert row.kind == "document_revision"
    assert count_unread_customer_notifications(db, customer.id) == 1
    listed = list_customer_notifications(db, customer.id)
    assert len(listed) == 1
    assert listed[0]["read"] is False


def test_document_rejected_and_mark_read(db, test_users):
    customer = test_users["customer"]
    booking = _booking(db, customer)
    notify_customer_document_review(db, booking, status="rejected", remarks="Prohibited cargo")
    db.flush()
    listed = list_customer_notifications(db, customer.id)
    nid = listed[0]["id"]
    mark_customer_notification_read(db, customer.id, nid)
    db.flush()
    assert count_unread_customer_notifications(db, customer.id) == 0
    assert list_customer_notifications(db, customer.id)[0]["read"] is True


def test_dismiss_hides_notification(db, test_users):
    customer = test_users["customer"]
    notify_customer_support_received(db, customer_id=customer.id, booking_id=None, category="support")
    db.flush()
    nid = list_customer_notifications(db, customer.id)[0]["id"]
    dismiss_customer_notification(db, customer.id, nid)
    db.flush()
    assert list_customer_notifications(db, customer.id) == []
    assert db.query(CustomerNotification).filter_by(id=nid).first().dismissed_at is not None


def test_support_clears_document_unread_and_is_already_read(db, test_users):
    customer = test_users["customer"]
    booking = _booking(db, customer)
    notify_customer_document_review(db, booking, status="rejected", remarks="Prohibited cargo")
    db.flush()
    assert count_unread_customer_notifications(db, customer.id) == 1

    conf = notify_customer_support_received(
        db, customer_id=customer.id, booking_id=booking.id, category="support"
    )
    db.flush()
    assert conf.read_at is not None
    assert count_unread_customer_notifications(db, customer.id) == 0
    kinds = {n["kind"] for n in list_customer_notifications(db, customer.id)}
    assert "document_rejected" in kinds
    assert "support_received" in kinds
    assert all(n["read"] for n in list_customer_notifications(db, customer.id))


def test_approved_does_not_create_notification(db, test_users):
    customer = test_users["customer"]
    booking = _booking(db, customer)
    assert notify_customer_document_review(db, booking, status="approved") is None
    assert count_unread_customer_notifications(db, customer.id) == 0
