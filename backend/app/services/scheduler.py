from datetime import date

from sqlalchemy.orm import Session

from app.models.entities import Booking, Trip, Truck, User, UserRole


def find_available_truck(db: Session, scheduled_date: date) -> Truck | None:
    scheduled_truck_ids = (
        db.query(Trip.truck_id)
        .join(Booking, Booking.id == Trip.booking_id)
        .filter(Booking.scheduled_date == scheduled_date)
        .all()
    )
    blocked_ids = {row[0] for row in scheduled_truck_ids}

    return db.query(Truck).filter(~Truck.id.in_(blocked_ids) if blocked_ids else True).first()


def find_available_driver(db: Session, scheduled_date: date) -> User | None:
    scheduled_driver_ids = (
        db.query(Trip.driver_id)
        .join(Booking, Booking.id == Trip.booking_id)
        .filter(Booking.scheduled_date == scheduled_date)
        .all()
    )
    blocked_ids = {row[0] for row in scheduled_driver_ids}

    query = db.query(User).filter(User.role == UserRole.DRIVER)
    if blocked_ids:
        query = query.filter(~User.id.in_(blocked_ids))
    return query.first()
