#!/usr/bin/env python3
"""Local Toll Matrix corridor smoke test (no HTTP API required).

Seeds plaza coords + Class 3 matrix sample, then resolves toll for key corridors.
Run from repo root or backend/:

  cd backend && python ../scripts/toll_matrix_corridor_smoke.py
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1] / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))
os.chdir(BACKEND)

from app.core.config import settings  # noqa: E402
from app.db import SessionLocal  # noqa: E402
from app.services.booking_pricing import pricing_with_toll_matrix  # noqa: E402
from app.services.toll_matrix import resolve_booking_toll_estimate  # noqa: E402
from app.services.toll_plaza_seed import ensure_toll_reference_data  # noqa: E402

CORRIDORS = [
    ("Metro Manila → Pampanga", "Quezon City, Metro Manila, Philippines", "San Fernando, Pampanga, Philippines"),
    ("Metro Manila → Tarlac", "Quezon City, Metro Manila, Philippines", "Tarlac City, Tarlac, Philippines"),
    ("Laguna → Batangas", "Santa Rosa, Laguna, Philippines", "Batangas City, Batangas, Philippines"),
    ("Cavite → Manila", "Kawit, Cavite, Philippines", "Makati City, Metro Manila, Philippines"),
    ("Local (no expressway)", "Makati City, Metro Manila, Philippines", "Makati City, Metro Manila, Philippines"),
]


def main() -> int:
    db = SessionLocal()
    try:
        seeded = ensure_toll_reference_data(db)
        print(f"Seed: {seeded}")
        print(f"Matrix rows (Class 3): ", end="")
        from app.models.entities import TollMatrix

        n = db.query(TollMatrix).filter(TollMatrix.vehicle_class == "Class 3").count()
        print(n)
        print()

        failed = 0
        for label, pickup, dropoff in CORRIDORS:
            fee, meta = resolve_booking_toll_estimate(
                db,
                pickup_location=pickup,
                dropoff_location=dropoff,
                vehicle_class="Class 1",  # must still price as Class 3
                truck_count=1,
                settings=settings,
            )
            matched = bool(meta.get("matched"))
            msg = meta.get("message") or ""
            entry = meta.get("entry_point")
            exit_ = meta.get("exit_point")
            vc = meta.get("vehicle_class")
            print(f"=== {label} ===")
            print(f"  pickup_coords=({meta.get('pickup_lat')}, {meta.get('pickup_lon')})")
            print(f"  dropoff_coords=({meta.get('dropoff_lat')}, {meta.get('dropoff_lon')})")
            print(f"  entry={entry!r} exit={exit_!r} class={vc} toll={fee} matched={matched}")
            print(f"  method={meta.get('match_method')} message={msg!r}")
            if meta.get("segments"):
                print(f"  segments={meta.get('segments')}")

            pricing, _ = pricing_with_toll_matrix(
                db,
                pickup_location=pickup,
                dropoff_location=dropoff,
                cargo_weight_tons=10,
                distance_km=80,
                settings=settings,
            )
            print(f"  quote toll_fees_php={pricing.get('toll_fees_php')} total={pricing.get('quoted_total')}")

            expect_nonzero = "no expressway" not in label.lower()
            if expect_nonzero:
                if not matched or float(fee or 0) <= 0:
                    print("  FAIL expected non-zero toll")
                    failed += 1
                elif vc != "Class 3":
                    print("  FAIL expected Class 3")
                    failed += 1
                else:
                    print("  PASS")
            else:
                if float(fee or 0) == 0 and ("expressway" in msg.lower() or not matched):
                    print("  PASS (explicit zero)")
                else:
                    print(f"  FAIL expected explicit no-expressway zero, got fee={fee} msg={msg!r}")
                    failed += 1
            print()

        return 1 if failed else 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
