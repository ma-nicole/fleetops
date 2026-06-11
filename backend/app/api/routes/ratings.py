from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.security import require_roles, get_current_user
from app.db import get_db
from app.models.entities import Booking, DriverRating, Trip, User, UserRole
from app.schemas.manager import DriverRatingRequest
from app.services.dispatcher_booking_assignment import assert_dispatcher_booking_access


router = APIRouter(prefix="/ratings", tags=["ratings"])


@router.post("/driver")
def rate_driver(
    payload: DriverRatingRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.CUSTOMER)),
):
    """Rate a driver after trip completion"""
    trip = db.query(Trip).filter(Trip.id == payload.trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    # Verify the rater is the customer who booked this trip
    booking = db.query(Booking).filter(Booking.id == trip.booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found for this trip")
    if booking.customer_id != user.id:
        raise HTTPException(status_code=403, detail="Only the customer can rate this trip")

    # Check if already rated
    existing_rating = db.query(DriverRating).filter(
        DriverRating.trip_id == payload.trip_id,
        DriverRating.rated_by_customer_id == user.id
    ).first()
    if existing_rating:
        raise HTTPException(status_code=400, detail="This trip has already been rated by you")

    rating = DriverRating(
        trip_id=payload.trip_id,
        driver_id=trip.driver_id,
        rated_by_customer_id=user.id,
        rating=payload.rating,
        comment=payload.comment,
    )

    db.add(rating)
    db.commit()

    # Update driver's overall rating in DriverProfile
    from app.models.entities import DriverProfile
    driver_profile = db.query(DriverProfile).filter(DriverProfile.user_id == trip.driver_id).first()
    if driver_profile:
        avg_rating = db.query(func.avg(DriverRating.rating)).filter(
            DriverRating.driver_id == trip.driver_id
        ).scalar() or 5.0
        driver_profile.rating = round(avg_rating, 1)
        db.commit()

    return {
        "rating_id": rating.id,
        "driver_id": trip.driver_id,
        "rating": rating.rating,
        "updated_driver_average": driver_profile.rating if driver_profile else None
    }


@router.get("/driver/{driver_id}")
def get_driver_ratings(
    driver_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get all ratings for a driver"""
    query = db.query(DriverRating).filter(DriverRating.driver_id == driver_id)
    if user.role == UserRole.CUSTOMER:
        query = query.filter(DriverRating.rated_by_customer_id == user.id)
    elif user.role == UserRole.DRIVER:
        if int(driver_id) != int(user.id):
            raise HTTPException(status_code=403, detail="Not authorized")
    elif user.role == UserRole.DISPATCHER:
        trip_rows = db.query(Trip).filter(Trip.driver_id == driver_id).all()
        allowed_trip_ids: set[int] = set()
        for trip in trip_rows:
            try:
                assert_dispatcher_booking_access(db, user, trip.booking_id)
            except HTTPException:
                continue
            allowed_trip_ids.add(int(trip.id))
        if not allowed_trip_ids:
            return {
                "driver_id": driver_id,
                "average_rating": 0.0,
                "total_ratings": 0,
                "ratings": [],
            }
        query = query.filter(DriverRating.trip_id.in_(allowed_trip_ids))
    elif user.role not in {UserRole.ADMIN, UserRole.MANAGER}:
        raise HTTPException(status_code=403, detail="Not authorized")

    ratings = query.all()
    avg_rating = (sum(float(r.rating or 0) for r in ratings) / len(ratings)) if ratings else 0.0

    return {
        "driver_id": driver_id,
        "average_rating": round(avg_rating, 1),
        "total_ratings": len(ratings),
        "ratings": [
            {
                "rating": r.rating,
                "comment": r.comment,
                "created_at": r.created_at.isoformat(),
            }
            for r in ratings
        ]
    }
