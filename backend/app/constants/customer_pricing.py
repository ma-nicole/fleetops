"""Fixed terms in the customer quote / profit model (admin only edits diesel ₱/L and toll)."""

# Gross cargo per truck load = tons_on_truck × CARGO_RATE_PHP_PER_TON
CARGO_RATE_PHP_PER_TON: float = 650.0

# Fuel liters per truck for the routed leg = road_km / TRUCK_FUEL_KMPL
TRUCK_FUEL_KMPL: float = 4.0

# Shares are fractions of that truck's cargo gross (tons_on_truck × cargo rate)
DRIVER_FREIGHT_SHARE_RATE: float = 0.10
HELPER_FREIGHT_SHARE_RATE: float = 0.0462
