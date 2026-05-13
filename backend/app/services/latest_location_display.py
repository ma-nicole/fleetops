"""Display-only rules for 'Latest location' columns (stored updates unchanged)."""

from __future__ import annotations

import re

from app.models.entities import Trip, TripStatus

NO_LIVE_UPDATE_YET = "No live update yet"

_COORDS = re.compile(r"^\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*$")


def clean_ping_text(raw: str | None) -> str | None:
    if not raw:
        return None
    s = raw.strip()
    if not s or _COORDS.match(s):
        return None
    return s


def latest_location_display_for_trip(
    trip: Trip,
    booking_dropoff: str | None,
    latest_ping_text: str | None,
) -> str:
    """
    Rules:
    - Trip completed (DB) or operational dropped_off / completed → booking drop-off.
    - assigned / for_pickup → 'No live update yet'.
    - picked_up / en_route → latest helper/ping text, or 'No live update yet' if none.
    """
    from app.services.dispatch_operations_center import _display_status

    drop = (booking_dropoff or "").strip()
    ping = clean_ping_text(latest_ping_text)

    if trip.status == TripStatus.COMPLETED:
        return drop if drop else "—"

    disp = _display_status(trip)
    if disp in ("dropped_off", "completed"):
        return drop if drop else "—"
    if disp in ("assigned", "for_pickup"):
        return NO_LIVE_UPDATE_YET
    if disp in ("picked_up", "en_route"):
        return ping if ping else NO_LIVE_UPDATE_YET

    return ping if ping else NO_LIVE_UPDATE_YET
