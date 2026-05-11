"""Fleet sizing rules for scheduling and capacity checks."""

from __future__ import annotations

import math

# Operational constraint: four trucks / drivers available for customer bookings.
FLEET_TRUCK_COUNT = 4
TRUCK_MAX_CAPACITY_TONS = 42.0
MAX_BOOKING_WEIGHT_TONS = FLEET_TRUCK_COUNT * TRUCK_MAX_CAPACITY_TONS

# Used to estimate how long a route ties up trucks (overlap with later windows).
DEFAULT_ROAD_SPEED_KMH_FOR_ETA = 35.0
MIN_TRIP_DURATION_HOURS = 2.0


def trucks_required_for_cargo(cargo_weight_tons: float) -> int:
    """How many 42 t trucks are needed to haul this load simultaneously."""
    w = float(cargo_weight_tons or 0)
    if w <= 0:
        return 1
    n = math.ceil(w / TRUCK_MAX_CAPACITY_TONS)
    return min(FLEET_TRUCK_COUNT, max(1, n))


def cargo_exceeds_fleet(cargo_weight_tons: float) -> bool:
    """True when the load cannot be covered by four trucks at once."""
    w = float(cargo_weight_tons or 0)
    if w <= 0:
        return True
    return w > MAX_BOOKING_WEIGHT_TONS
