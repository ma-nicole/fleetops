"""Resource availability — only ACTIVE bookings reserve trucks/drivers/helpers."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from app.models.entities import BookingStatus, TripStatus
from app.services.dispatch_resource_availability import (
    _active_trips,
    _global_resource_status,
    evaluate_truck_for_booking,
    heal_orphaned_trips_on_terminal_bookings,
)


def test_only_active_booking_resources_are_on_trip():
    """One active booking reserves only its own truck/driver/helper."""
    active_booking = SimpleNamespace(id=100, status=BookingStatus.OUT_FOR_DELIVERY)
    active_trip = SimpleNamespace(
        id=1,
        truck_id=1,
        driver_id=10,
        helper_id=20,
        status=TripStatus.IN_DELIVERY,
        booking_id=100,
    )
    trip_rows = [(active_trip, active_booking)]
    assignment_rows: list = []

    assert (
        _global_resource_status(
            MagicMock(),
            kind="truck",
            resource_id=1,
            trip_rows=trip_rows,
            assignment_rows=assignment_rows,
            truck=SimpleNamespace(id=1, status="available"),
        )
        == "on_trip"
    )
    assert (
        _global_resource_status(
            MagicMock(),
            kind="truck",
            resource_id=2,
            trip_rows=trip_rows,
            assignment_rows=assignment_rows,
            truck=SimpleNamespace(id=2, status="available"),
        )
        == "available"
    )
    assert (
        _global_resource_status(
            MagicMock(),
            kind="driver",
            resource_id=11,
            trip_rows=trip_rows,
            assignment_rows=assignment_rows,
            user=SimpleNamespace(id=11, availability_status="available"),
        )
        == "available"
    )


def test_python_filter_drops_completed_booking_trips():
    db = MagicMock()
    completed_booking = SimpleNamespace(id=1, status=BookingStatus.COMPLETED)
    open_trip = SimpleNamespace(id=9, status=TripStatus.IN_DELIVERY, truck_id=1, driver_id=2, helper_id=3)

    query = MagicMock()
    db.query.return_value = query
    query.join.return_value = query
    query.filter.return_value = query
    # Simulate SQL incorrectly returning a completed booking — Python post-filter must drop it.
    query.all.return_value = [(open_trip, completed_booking)]

    assert _active_trips(db) == []


def test_heal_closes_orphan_trip_on_completed_booking():
    booking = SimpleNamespace(id=50, status=BookingStatus.COMPLETED)
    trip = SimpleNamespace(
        id=7,
        booking_id=50,
        truck_id=1,
        driver_id=2,
        helper_id=3,
        status=TripStatus.IN_DELIVERY,
        completed_at=None,
        helper_progress_status=None,
    )

    db = MagicMock()
    call_n = {"i": 0}

    def query_factory(*_args, **_kwargs):
        call_n["i"] += 1
        q = MagicMock()
        if call_n["i"] == 1:
            # Trip/Booking candidate query
            q.join.return_value.all.return_value = [(trip, booking)]
            return q
        if call_n["i"] == 2:
            # TruckAssignment.update for the orphan trip
            q.filter.return_value.update.return_value = 1
            return q
        # Dangling assignment sweep
        q.join.return_value.filter.return_value.all.return_value = []
        return q

    db.query.side_effect = query_factory

    with patch("app.services.dispatch_resource_availability.release_trip_resources") as release:
        healed = heal_orphaned_trips_on_terminal_bookings(db)

    assert trip.status == TripStatus.COMPLETED
    assert healed >= 1
    release.assert_called_once()


def test_assigned_badge_not_assignable():
    truck = SimpleNamespace(id=1, code="T1", status="available", capacity_tons=10, availability_status="available")
    booking = SimpleNamespace(id=5)
    with (
        patch("app.services.dispatch_resource_availability._active_trips", return_value=[]),
        patch("app.services.dispatch_resource_availability._active_assignments", return_value=[]),
        patch("app.services.dispatch_resource_availability._global_resource_status", return_value="assigned"),
        patch(
            "app.services.dispatch_resource_availability._conflicts_for_resource",
            return_value=[
                {
                    "booking_id": 9,
                    "live_busy": True,
                    "calendar_overlap": False,
                    "scheduled_date": "2026-07-01",
                    "scheduled_time_slot": "08:00",
                }
            ],
        ),
    ):
        row = evaluate_truck_for_booking(MagicMock(), truck, booking)
    assert row["assignable"] is False
    assert row["status"] == "assigned"
