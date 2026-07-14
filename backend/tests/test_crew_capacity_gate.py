"""Unit tests: calendar-overlap crew capacity + dispatcher assignability."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from app.models.entities import BookingStatus, TripStatus
from app.services.booking_schedule import CrewWindowCapacity
from app.services.dispatch_resource_availability import (
    evaluate_driver_for_booking,
    evaluate_helper_for_booking,
    evaluate_truck_for_booking,
    _conflicts_for_resource,
)


def test_crew_capacity_message_lists_shortages():
    crew = CrewWindowCapacity(trucks=0, drivers=1, helpers=0, required=1, can_book=False)
    assert crew.message is not None
    assert "trucks" in crew.message
    assert "helpers" in crew.message
    assert CrewWindowCapacity(2, 2, 2, 1, True).message is None


def test_conflicts_ignore_live_busy_when_windows_do_not_overlap():
    """On-trip resource for Jul 14 must not conflict with a Jul 23 booking window."""
    cfg = SimpleNamespace()
    target = SimpleNamespace(
        id=233,
        scheduled_date=date(2026, 7, 23),
        scheduled_time_slot="14:00",
        pickup_location="A",
        dropoff_location="B",
    )
    live_booking = SimpleNamespace(
        id=100,
        scheduled_date=date(2026, 7, 14),
        scheduled_time_slot="08:00",
        status=BookingStatus.OUT_FOR_DELIVERY,
    )
    live_trip = SimpleNamespace(
        id=9,
        booking_id=100,
        truck_id=1,
        driver_id=2,
        helper_id=3,
        status=TripStatus.IN_DELIVERY,
        duration_hours=4.0,
        booking=live_booking,
    )

    db = MagicMock()

    with (
        patch(
            "app.services.dispatch_resource_availability.booking_interval_resolved",
            side_effect=[
                # target booking window Jul 23
                (datetime(2026, 7, 23, 14, 0), datetime(2026, 7, 23, 20, 0)),
            ],
        ),
        patch(
            "app.services.dispatch_resource_availability._active_trips",
            return_value=[(live_trip, live_booking)],
        ),
        patch(
            "app.services.dispatch_resource_availability._active_assignments",
            return_value=[],
        ),
        patch(
            "app.services.dispatch_resource_availability.trip_interval",
            return_value=(datetime(2026, 7, 14, 8, 0), datetime(2026, 7, 14, 12, 0)),
        ),
    ):
        conflicts = _conflicts_for_resource(
            db, kind="truck", resource_id=1, booking=target, cfg=cfg
        )
    assert conflicts == []


def test_conflicts_detected_when_windows_overlap():
    cfg = SimpleNamespace()
    target = SimpleNamespace(id=233)
    other = SimpleNamespace(id=100, scheduled_date=date(2026, 7, 23), scheduled_time_slot="14:00")
    trip = SimpleNamespace(
        id=9,
        booking_id=100,
        truck_id=1,
        status=TripStatus.ASSIGNED,
    )
    db = MagicMock()
    start = datetime(2026, 7, 23, 14, 0)
    end = datetime(2026, 7, 23, 18, 0)
    with (
        patch(
            "app.services.dispatch_resource_availability.booking_interval_resolved",
            return_value=(start, end),
        ),
        patch(
            "app.services.dispatch_resource_availability._active_trips",
            return_value=[(trip, other)],
        ),
        patch(
            "app.services.dispatch_resource_availability._active_assignments",
            return_value=[],
        ),
        patch(
            "app.services.dispatch_resource_availability.trip_interval",
            return_value=(start + timedelta(hours=1), end + timedelta(hours=1)),
        ),
        patch(
            "app.services.dispatch_resource_availability._trip_on_resource",
            return_value=True,
        ),
    ):
        conflicts = _conflicts_for_resource(
            db, kind="truck", resource_id=1, booking=target, cfg=cfg
        )
    assert len(conflicts) == 1
    assert conflicts[0]["booking_id"] == 100


def test_evaluate_truck_assignable_despite_global_on_trip_status():
    """Badge may show On Trip, but assignable is true when the booking window is free."""
    truck = SimpleNamespace(id=1, code="TRK-001", status="available", capacity_tons=30, availability_status="assigned")
    booking = SimpleNamespace(id=233)
    db = MagicMock()

    with (
        patch(
            "app.services.dispatch_resource_availability._active_trips",
            return_value=[],
        ),
        patch(
            "app.services.dispatch_resource_availability._active_assignments",
            return_value=[],
        ),
        patch(
            "app.services.dispatch_resource_availability._global_resource_status",
            return_value="on_trip",
        ),
        patch(
            "app.services.dispatch_resource_availability._conflicts_for_resource",
            return_value=[],
        ),
    ):
        row = evaluate_truck_for_booking(db, truck, booking)

    assert row["status"] == "on_trip"
    assert row["assignable"] is True
    assert row["conflict_reason"] is None


def test_evaluate_driver_and_helper_assignable_without_has_active_block():
    driver = SimpleNamespace(id=10, full_name="Driver A", availability_status="available", role="driver")
    helper = SimpleNamespace(id=11, full_name="Helper A", availability_status="available", role="helper")
    booking = SimpleNamespace(id=233)
    db = MagicMock()

    with (
        patch("app.services.dispatch_resource_availability._active_trips", return_value=[]),
        patch("app.services.dispatch_resource_availability._active_assignments", return_value=[]),
        patch("app.services.dispatch_resource_availability._global_resource_status", return_value="assigned"),
        patch("app.services.dispatch_resource_availability._conflicts_for_resource", return_value=[]),
    ):
        d = evaluate_driver_for_booking(db, driver, booking)
        h = evaluate_helper_for_booking(db, helper, booking)

    assert d["assignable"] is True
    assert h["assignable"] is True
