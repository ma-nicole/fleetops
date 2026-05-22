"""Dispatcher booking ownership via job_orders.assigned_dispatcher_id."""

from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.entities import Booking, JobOrder, User, UserRole


def has_dispatcher_booking_scope(user: User) -> bool:
    """Admin and manager see all bookings; plain dispatchers are scoped."""
    return user.role in {UserRole.ADMIN, UserRole.MANAGER}


def dispatcher_may_view_booking(db: Session, user: User, booking_id: int) -> bool:
    if has_dispatcher_booking_scope(user):
        return True
    if user.role != UserRole.DISPATCHER:
        return False
    job = db.query(JobOrder).filter(JobOrder.booking_id == booking_id).first()
    if not job or job.assigned_dispatcher_id is None:
        return True
    return int(job.assigned_dispatcher_id) == int(user.id)


def assert_dispatcher_booking_access(db: Session, user: User, booking_id: int) -> None:
    if not dispatcher_may_view_booking(db, user, booking_id):
        raise HTTPException(status_code=403, detail="This booking is assigned to another dispatcher.")


def filter_bookings_for_dispatcher(db: Session, user: User, bookings: list[Booking]) -> list[Booking]:
    if has_dispatcher_booking_scope(user):
        return bookings
    if user.role != UserRole.DISPATCHER:
        return bookings
    return [b for b in bookings if dispatcher_may_view_booking(db, user, b.id)]


def blocked_booking_ids_for_dispatcher(db: Session, dispatcher_user_id: int) -> set[int]:
    rows = (
        db.query(JobOrder.booking_id)
        .filter(
            JobOrder.assigned_dispatcher_id.isnot(None),
            JobOrder.assigned_dispatcher_id != dispatcher_user_id,
        )
        .all()
    )
    return {int(r[0]) for r in rows}


def get_or_create_job_order(db: Session, booking_id: int, *, issued_by_id: int) -> JobOrder:
    job = db.query(JobOrder).filter(JobOrder.booking_id == booking_id).first()
    if job:
        return job
    job = JobOrder(
        booking_id=booking_id,
        issued_by_manager_id=issued_by_id,
    )
    db.add(job)
    db.flush()
    return job


def assign_booking_dispatcher(
    db: Session,
    booking: Booking,
    *,
    dispatcher_id: int | None,
    assigned_by: User,
) -> JobOrder:
    if dispatcher_id is not None:
        target = db.query(User).filter(User.id == dispatcher_id, User.role == UserRole.DISPATCHER).first()
        if not target:
            raise ValueError("Dispatcher user not found.")

    job = get_or_create_job_order(db, booking.id, issued_by_id=assigned_by.id)
    job.assigned_dispatcher_id = dispatcher_id
    return job


def auto_assign_dispatcher_on_dispatch_action(db: Session, booking_id: int, actor: User) -> None:
    """When a dispatcher acts on an unassigned booking, claim it for that dispatcher."""
    if actor.role != UserRole.DISPATCHER:
        return
    job = db.query(JobOrder).filter(JobOrder.booking_id == booking_id).first()
    if job is None:
        job = JobOrder(
            booking_id=booking_id,
            issued_by_manager_id=actor.id,
            assigned_dispatcher_id=actor.id,
        )
        db.add(job)
        return
    if job.assigned_dispatcher_id is None:
        job.assigned_dispatcher_id = actor.id


def filter_trips_for_dispatcher(db: Session, user: User, trips: list) -> list:
    if has_dispatcher_booking_scope(user):
        return trips
    if user.role != UserRole.DISPATCHER:
        return trips
    blocked = blocked_booking_ids_for_dispatcher(db, user.id)
    if not blocked:
        return trips
    return [t for t in trips if int(t.booking_id) not in blocked]


def job_order_assignment_map(db: Session, booking_ids: list[int]) -> dict[int, JobOrder]:
    if not booking_ids:
        return {}
    rows = db.query(JobOrder).filter(JobOrder.booking_id.in_(booking_ids)).all()
    return {int(j.booking_id): j for j in rows}
