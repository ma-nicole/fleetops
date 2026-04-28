import csv
import io

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db import get_db
from app.models.entities import Booking, Trip, User, UserRole


router = APIRouter(prefix="/reports", tags=["reports"])


def _csv_stream(rows: list[list[str]], headers: list[str]) -> io.StringIO:
    stream = io.StringIO()
    writer = csv.writer(stream)
    writer.writerow(headers)
    writer.writerows(rows)
    stream.seek(0)
    return stream


@router.get("/bookings.csv")
def bookings_report(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.MANAGER, UserRole.ADMIN, UserRole.DISPATCHER)),
):
    bookings = db.query(Booking).all()
    rows = [
        [
            str(item.id),
            str(item.customer_id),
            item.pickup_location,
            item.dropoff_location,
            item.status.value,
            f"{item.estimated_cost}",
        ]
        for item in bookings
    ]
    stream = _csv_stream(rows, ["booking_id", "customer_id", "pickup", "dropoff", "status", "estimated_cost"])
    return StreamingResponse(iter([stream.getvalue()]), media_type="text/csv")


@router.get("/fleet.csv")
def fleet_report(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.MANAGER, UserRole.ADMIN)),
):
    trips = db.query(Trip).all()
    rows = [
        [
            str(item.id),
            str(item.truck_id),
            str(item.driver_id),
            f"{item.distance_km}",
            f"{item.fuel_cost + item.toll_cost + item.labor_cost}",
        ]
        for item in trips
    ]
    stream = _csv_stream(rows, ["trip_id", "truck_id", "driver_id", "distance_km", "total_cost"])
    return StreamingResponse(iter([stream.getvalue()]), media_type="text/csv")
