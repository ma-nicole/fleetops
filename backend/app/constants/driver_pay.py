"""Driver trip pay accrual (cargo-based share) — used when payroll lines are not stored per trip."""

# Cargo gross: tons × rate (PHP), then driver share of gross.
CARGO_GROSS_PHP_PER_TON = 650.0
DRIVER_SHARE_OF_CARGO_GROSS = 0.10


def driver_pay_from_cargo_tons(cargo_weight_tons: float | None) -> float:
    tons = float(cargo_weight_tons or 0)
    gross = tons * CARGO_GROSS_PHP_PER_TON
    return round(gross * DRIVER_SHARE_OF_CARGO_GROSS, 2)
