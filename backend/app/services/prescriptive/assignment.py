"""Driver / vehicle / helper assignment recommender (paper Fig 25)."""
from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.models.entities import (
    Booking,
    DriverProfile,
    HelperProfile,
    Trip,
    Truck,
    User,
    UserRole,
)
from app.schemas.predict import AssignmentCandidate, AssignmentRecommendResponse


def _is_truck_busy(db: Session, truck: Truck, on_date: date) -> bool:
    return (
        db.query(Trip)
        .join(Booking, Booking.id == Trip.booking_id)
        .filter(Trip.truck_id == truck.id, Booking.scheduled_date == on_date)
        .first()
        is not None
    )


def _is_driver_busy(db: Session, driver_id: int, on_date: date) -> bool:
    return (
        db.query(Trip)
        .join(Booking, Booking.id == Trip.booking_id)
        .filter(Trip.driver_id == driver_id, Booking.scheduled_date == on_date)
        .first()
        is not None
    )


def _score_truck(truck: Truck, cargo_tons: float) -> tuple[float, list[str]]:
    reasons: list[str] = []
    capacity_score = 0.0
    if truck.capacity_tons >= cargo_tons:
        slack = truck.capacity_tons - cargo_tons
        # Prefer trucks whose capacity is slightly above the load (less wasted capacity).
        capacity_score = max(0.0, 100 - slack * 5)
        reasons.append(f"Capacity {truck.capacity_tons}t fits cargo {cargo_tons}t (slack {round(slack,1)}t)")
    else:
        capacity_score = 0.0
        reasons.append(f"⚠️ Capacity {truck.capacity_tons}t below cargo {cargo_tons}t")

    age_penalty = max(0.0, (truck.age_years or 0) - 5) * 4
    reasons.append(f"Age {truck.age_years}y → −{round(age_penalty, 1)}")
    score = capacity_score - age_penalty
    return max(0.0, score), reasons


def _score_driver(profile: DriverProfile | None) -> tuple[float, list[str]]:
    reasons: list[str] = []
    if profile is None:
        return 60.0, ["No driver profile yet → baseline score 60"]
    score = profile.rating * 10  # max 50
    reasons.append(f"Driver rating {profile.rating} → +{round(score, 1)}")
    if profile.compliance_status == "compliant":
        score += 30
        reasons.append("Compliance compliant → +30")
    elif profile.compliance_status == "warning":
        score += 10
        reasons.append("Compliance warning → +10")
    else:
        reasons.append("Compliance non-compliant → +0")
    return score, reasons


def recommend_assignment(db: Session, booking_id: int) -> AssignmentRecommendResponse:
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        return AssignmentRecommendResponse(booking_id=booking_id, best=None, alternatives=[])

    on_date = booking.scheduled_date
    cargo = float(booking.cargo_weight_tons or 0)

    candidate_trucks = db.query(Truck).all()
    candidate_drivers = (
        db.query(User).filter(User.role == UserRole.DRIVER).all()
    )
    candidate_helpers = (
        db.query(User).filter(User.role == UserRole.HELPER).all()
    )

    candidates: list[AssignmentCandidate] = []
    for truck in candidate_trucks:
        if _is_truck_busy(db, truck, on_date):
            continue
        truck_score, truck_reasons = _score_truck(truck, cargo)

        for driver in candidate_drivers:
            if _is_driver_busy(db, driver.id, on_date):
                continue
            profile = db.query(DriverProfile).filter(DriverProfile.user_id == driver.id).first()
            driver_score, driver_reasons = _score_driver(profile)

            helper = next(iter(candidate_helpers), None)
            helper_id = helper.id if helper else None
            helper_name = helper.full_name if helper else None

            total = round(truck_score + driver_score, 2)
            candidates.append(
                AssignmentCandidate(
                    truck_id=truck.id,
                    truck_code=truck.code,
                    driver_id=driver.id,
                    driver_name=driver.full_name,
                    helper_id=helper_id,
                    helper_name=helper_name,
                    score=total,
                    reasoning=truck_reasons + driver_reasons,
                )
            )

    if not candidates:
        return AssignmentRecommendResponse(booking_id=booking_id, best=None, alternatives=[])

    candidates.sort(key=lambda c: c.score, reverse=True)
    return AssignmentRecommendResponse(
        booking_id=booking_id,
        best=candidates[0],
        alternatives=candidates[1:5],
    )
