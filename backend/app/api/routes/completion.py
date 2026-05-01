"""Trip completion-report endpoints (paper Driver DFD Fig 13)."""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_current_user, require_roles
from app.db import get_db
from app.models.entities import (
    Booking,
    BookingStatus,
    CompletionReport,
    FuelLog,
    ReportStatus,
    TollLog,
    Trip,
    TripStatus,
    User,
    UserRole,
)
from app.schemas.trip_logs import (
    CompletionReportRead,
    FuelLogCreate,
    FuelLogRead,
    TollLogCreate,
    TollLogRead,
)
from app.services.feedback_loop import record_trip_feedback


router = APIRouter(prefix="/trips", tags=["trip-logs"])


def _ensure_owner(trip: Trip, user: User) -> None:
    if user.role == UserRole.DRIVER and trip.driver_id != user.id:
        raise HTTPException(status_code=403, detail="Not your trip")


# ------------- Fuel logs -------------

@router.post("/{trip_id}/fuel-log", response_model=FuelLogRead)
def add_fuel_log(
    trip_id: int,
    payload: FuelLogCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.DRIVER, UserRole.DISPATCHER, UserRole.MANAGER, UserRole.ADMIN)),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    _ensure_owner(trip, user)

    log = FuelLog(
        trip_id=trip.id,
        truck_id=trip.truck_id,
        driver_id=trip.driver_id,
        liters=payload.liters,
        cost=payload.cost,
        odometer_km=payload.odometer_km,
        receipt_url=payload.receipt_url,
    )
    trip.fuel_cost = (trip.fuel_cost or 0) + payload.cost
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


@router.get("/{trip_id}/fuel-logs", response_model=list[FuelLogRead])
def list_fuel_logs(
    trip_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    _ensure_owner(trip, user)
    return db.query(FuelLog).filter(FuelLog.trip_id == trip_id).order_by(FuelLog.recorded_at.desc()).all()


# ------------- Toll logs -------------

@router.post("/{trip_id}/toll-log", response_model=TollLogRead)
def add_toll_log(
    trip_id: int,
    payload: TollLogCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.DRIVER, UserRole.DISPATCHER, UserRole.MANAGER, UserRole.ADMIN)),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    _ensure_owner(trip, user)

    log = TollLog(
        trip_id=trip.id,
        driver_id=trip.driver_id,
        location=payload.location,
        amount=payload.amount,
        receipt_url=payload.receipt_url,
    )
    trip.toll_cost = (trip.toll_cost or 0) + payload.amount
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


@router.get("/{trip_id}/toll-logs", response_model=list[TollLogRead])
def list_toll_logs(
    trip_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    _ensure_owner(trip, user)
    return db.query(TollLog).filter(TollLog.trip_id == trip_id).order_by(TollLog.recorded_at.desc()).all()


# ------------- Completion report -------------

@router.post("/{trip_id}/generate-report", response_model=CompletionReportRead)
def generate_completion_report(
    trip_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.DRIVER, UserRole.DISPATCHER, UserRole.MANAGER, UserRole.ADMIN)),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip.status != TripStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Trip must be completed before generating a report")
    _ensure_owner(trip, user)

    fuel_total = sum(f.cost for f in db.query(FuelLog).filter(FuelLog.trip_id == trip.id).all()) or trip.fuel_cost
    toll_total = sum(t.amount for t in db.query(TollLog).filter(TollLog.trip_id == trip.id).all()) or trip.toll_cost
    labor_total = trip.labor_cost or 0
    maintenance_total = trip.maintenance_cost or 0
    total_cost = round(fuel_total + toll_total + labor_total + maintenance_total, 2)

    summary_text = (
        f"Trip {trip.id} | distance {trip.distance_km}km | "
        f"fuel ₱{round(fuel_total,2)} | toll ₱{round(toll_total,2)} | "
        f"labor ₱{round(labor_total,2)}"
    )

    existing = db.query(CompletionReport).filter(CompletionReport.trip_id == trip.id).first()
    if existing:
        existing.fuel_total = round(fuel_total, 2)
        existing.toll_total = round(toll_total, 2)
        existing.labor_total = round(labor_total, 2)
        existing.maintenance_total = round(maintenance_total, 2)
        existing.total_cost = total_cost
        existing.summary = summary_text
        existing.status = ReportStatus.SUBMITTED
        db.commit()
        db.refresh(existing)
        return existing

    report = CompletionReport(
        trip_id=trip.id,
        booking_id=trip.booking_id,
        generated_by_id=user.id,
        summary=summary_text,
        fuel_total=round(fuel_total, 2),
        toll_total=round(toll_total, 2),
        labor_total=round(labor_total, 2),
        maintenance_total=round(maintenance_total, 2),
        total_cost=total_cost,
        status=ReportStatus.SUBMITTED,
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    # Feedback loop: compare predicted vs actual
    record_trip_feedback(db, trip)

    return report


@router.get("/{trip_id}/report", response_model=CompletionReportRead)
def get_completion_report(
    trip_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    report = db.query(CompletionReport).filter(CompletionReport.trip_id == trip_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if user.role == UserRole.DRIVER and trip.driver_id != user.id:
        raise HTTPException(status_code=403, detail="Not your trip")
    if user.role == UserRole.CUSTOMER:
        booking = db.query(Booking).filter(Booking.id == trip.booking_id).first()
        if not booking or booking.customer_id != user.id:
            raise HTTPException(status_code=403, detail="Not your trip")

    return report


@router.post("/{trip_id}/report/confirm", response_model=CompletionReportRead)
def confirm_completion_report(
    trip_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.DISPATCHER, UserRole.MANAGER, UserRole.ADMIN)),
):
    report = db.query(CompletionReport).filter(CompletionReport.trip_id == trip_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if report.status != ReportStatus.SUBMITTED:
        raise HTTPException(status_code=400, detail=f"Report is in {report.status.value} status")
    report.status = ReportStatus.CONFIRMED
    report.confirmed_by_id = user.id
    report.confirmed_at = datetime.utcnow()

    booking = db.query(Booking).filter(Booking.id == report.booking_id).first()
    if booking and booking.status != BookingStatus.COMPLETED:
        booking.status = BookingStatus.COMPLETED

    db.commit()
    db.refresh(report)
    return report
