from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.security import require_roles, get_current_user
from app.db import get_db
from app.models.entities import DriverRating, Trip, User, UserRole
from app.schemas.manager import DriverRatingRequest


router = APIRouter(prefix="/ratings", tags=["ratings"])


@router.post("/driver")
def rate_driver(
    payload: DriverRatingRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Rate a driver after trip completion"""
    trip = db.query(Trip).filter(Trip.id == payload.trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    # Verify the rater is the customer who booked this trip
    from app.models.entities import Booking
    booking = db.query(Booking).filter(Booking.id == trip.booking_id).first()
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
):
    """Get all ratings for a driver"""
    ratings = db.query(DriverRating).filter(DriverRating.driver_id == driver_id).all()
    avg_rating = db.query(func.avg(DriverRating.rating)).filter(
        DriverRating.driver_id == driver_id
    ).scalar() or 0.0

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
