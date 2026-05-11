"""Latest verified payment amount per booking (for driver/helper/dispatch views)."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.entities import Payment, PaymentStatus


def paid_verified_amount_by_booking_ids(db: Session, booking_ids: list[int]) -> dict[int, float]:
    if not booking_ids:
        return {}
    uniq = list({int(x) for x in booking_ids if x})
    rows = (
        db.query(Payment)
        .filter(Payment.booking_id.in_(uniq), Payment.status == PaymentStatus.VERIFIED)
        .order_by(Payment.id.desc())
        .all()
    )
    out: dict[int, float] = {}
    for p in rows:
        if p.booking_id not in out:
            out[p.booking_id] = float(p.amount or 0)
    return out
