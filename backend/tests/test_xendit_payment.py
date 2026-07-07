"""Xendit webhook and automatic payment verification tests."""

from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../backend"))

from app.models.entities import (
    Booking,
    BookingStatus,
    Payment,
    PaymentStatus,
    ServiceType,
    Transaction,
    TruckSlotHold,
    TruckSlotHoldStatus,
    User,
    UserRole,
    XenditWebhookEvent,
)
from app.services.xendit_payment import (
    XENDIT_STATUS_PAID,
    XENDIT_STATUS_PENDING,
    build_xendit_external_id,
    handle_xendit_webhook,
)

pytest_plugins = ["test_integration"]

from sqlalchemy.orm import Session


def _seed_booking_payment(db: Session, customer: User, amount: float = 1500.0) -> tuple[Booking, Payment]:
    booking = Booking(
        customer_id=customer.id,
        pickup_location="Manila",
        dropoff_location="Cebu",
        service_type=ServiceType.FIXED,
        cargo_weight_tons=2.0,
        scheduled_date=datetime.utcnow().date(),
        estimated_cost=amount,
        status=BookingStatus.PAYMENT_VERIFICATION,
    )
    db.add(booking)
    db.flush()

    hold = TruckSlotHold(
        booking_id=booking.id,
        schedule_date=booking.scheduled_date,
        time_slot="08:00",
        hold_status=TruckSlotHoldStatus.ON_HOLD,
    )
    db.add(hold)

    txn = Transaction(booking_id=booking.id, customer_id=customer.id, type="booking", amount=amount)
    db.add(txn)
    db.flush()

    external_id = build_xendit_external_id(booking.id)
    payment = Payment(
        booking_id=booking.id,
        transaction_id=txn.id,
        customer_id=customer.id,
        method="gcash",
        amount=amount,
        status=PaymentStatus.FOR_VERIFICATION,
        reference="PAY-TEST01",
        xendit_external_id=external_id,
        xendit_status=XENDIT_STATUS_PENDING,
        xendit_expires_at=datetime.utcnow() + timedelta(hours=1),
    )
    db.add(payment)
    db.commit()
    db.refresh(booking)
    db.refresh(payment)
    return booking, payment


def _success_payload(payment: Payment, amount: float, event_id: str = "evt-success-1") -> dict:
    return {
        "event_id": event_id,
        "event": "qr.payment",
        "status": "COMPLETED",
        "amount": amount,
        "qr_code": {"external_id": payment.xendit_external_id},
        "payment_detail": {"source": "GCASH"},
        "paid_at": datetime.utcnow().isoformat() + "Z",
    }


class TestXenditWebhook:
    def test_success_webhook_auto_verifies_payment(self, db, test_users):
        customer = test_users["customer"]
        booking, payment = _seed_booking_payment(db, customer)

        result = handle_xendit_webhook(db, _success_payload(payment, payment.amount))
        db.refresh(payment)
        db.refresh(booking)
        hold = db.query(TruckSlotHold).filter(TruckSlotHold.booking_id == booking.id).first()

        assert result is not None
        assert payment.status == PaymentStatus.VERIFIED
        assert payment.xendit_status == XENDIT_STATUS_PAID
        assert booking.status == BookingStatus.PAYMENT_VERIFIED
        assert hold is not None
        assert hold.hold_status == TruckSlotHoldStatus.READY_FOR_ASSIGNMENT
        assert payment.reviewed_by_id is None

    def test_duplicate_webhook_is_idempotent(self, db, test_users):
        customer = test_users["customer"]
        _booking, payment = _seed_booking_payment(db, customer)
        payload = _success_payload(payment, payment.amount, event_id="evt-dup-1")

        handle_xendit_webhook(db, payload)
        handle_xendit_webhook(db, payload)
        db.refresh(payment)

        events = db.query(XenditWebhookEvent).filter(XenditWebhookEvent.event_id == "evt-dup-1").all()
        assert len(events) == 1
        assert payment.status == PaymentStatus.VERIFIED

    def test_amount_mismatch_does_not_verify(self, db, test_users):
        customer = test_users["customer"]
        booking, payment = _seed_booking_payment(db, customer, amount=1500.0)

        handle_xendit_webhook(db, _success_payload(payment, 999.0, event_id="evt-mismatch"))
        db.refresh(payment)
        db.refresh(booking)

        assert payment.status == PaymentStatus.FOR_VERIFICATION
        assert booking.status == BookingStatus.PAYMENT_VERIFICATION

    def test_failed_webhook_marks_payment_rejected(self, db, test_users):
        customer = test_users["customer"]
        booking, payment = _seed_booking_payment(db, customer)

        handle_xendit_webhook(
            db,
            {
                "event_id": "evt-failed-1",
                "event": "qr.payment",
                "status": "FAILED",
                "amount": payment.amount,
                "qr_code": {"external_id": payment.xendit_external_id},
            },
        )
        db.refresh(payment)
        db.refresh(booking)

        assert payment.status == PaymentStatus.REJECTED
        assert booking.status == BookingStatus.PAYMENT_REJECTED

    def test_expired_webhook_marks_booking_expired(self, db, test_users):
        customer = test_users["customer"]
        booking, payment = _seed_booking_payment(db, customer)

        handle_xendit_webhook(
            db,
            {
                "event_id": "evt-expired-1",
                "event": "qr.payment",
                "status": "EXPIRED",
                "amount": payment.amount,
                "qr_code": {"external_id": payment.xendit_external_id},
            },
        )
        db.refresh(payment)
        db.refresh(booking)

        assert payment.status == PaymentStatus.REJECTED
        assert booking.status == BookingStatus.EXPIRED

    def test_cancelled_webhook_marks_payment_rejected(self, db, test_users):
        customer = test_users["customer"]
        booking, payment = _seed_booking_payment(db, customer)

        handle_xendit_webhook(
            db,
            {
                "event_id": "evt-cancel-1",
                "event": "qr.payment",
                "status": "CANCELLED",
                "amount": payment.amount,
                "qr_code": {"external_id": payment.xendit_external_id},
            },
        )
        db.refresh(payment)
        db.refresh(booking)

        assert payment.status == PaymentStatus.REJECTED
        assert booking.status == BookingStatus.PAYMENT_REJECTED

    def test_booking_reference_mismatch_is_logged_not_verified(self, db, test_users):
        customer = test_users["customer"]
        booking, payment = _seed_booking_payment(db, customer)
        payment.xendit_external_id = "fleetops-booking-99999-deadbeef"
        db.commit()

        handle_xendit_webhook(db, _success_payload(payment, payment.amount, event_id="evt-ref-bad"))
        db.refresh(payment)
        db.refresh(booking)

        assert payment.status == PaymentStatus.FOR_VERIFICATION
        assert booking.status == BookingStatus.PAYMENT_VERIFICATION
