"""Assigned Trips board must keep every non-terminal leg visible."""

from types import SimpleNamespace

from app.models.entities import TripStatus
from app.services.dispatch_operations_center import ACTIVE_EXECUTION, TERMINAL_TRIP, _display_status


def test_active_execution_covers_full_lifecycle_until_complete():
    assert TripStatus.PENDING in ACTIVE_EXECUTION
    assert TripStatus.ASSIGNED in ACTIVE_EXECUTION
    assert TripStatus.ACCEPTED in ACTIVE_EXECUTION
    assert TripStatus.DEPARTED in ACTIVE_EXECUTION
    assert TripStatus.LOADING in ACTIVE_EXECUTION
    assert TripStatus.IN_DELIVERY in ACTIVE_EXECUTION
    assert TripStatus.COMPLETED not in ACTIVE_EXECUTION
    assert TripStatus.CANCELLED not in ACTIVE_EXECUTION
    assert TERMINAL_TRIP == (TripStatus.COMPLETED, TripStatus.CANCELLED)


def test_display_status_keeps_in_progress_milestones():
    cases = [
        (TripStatus.ASSIGNED, None, "assigned"),
        (TripStatus.ACCEPTED, "for_pickup", "for_pickup"),
        (TripStatus.LOADING, "picked_up", "picked_up"),
        (TripStatus.IN_DELIVERY, "en_route", "en_route"),
        (TripStatus.IN_DELIVERY, "dropped_off", "dropped_off"),
    ]
    for st, hp, expected in cases:
        trip = SimpleNamespace(status=st, helper_progress_status=hp)
        assert _display_status(trip) == expected
