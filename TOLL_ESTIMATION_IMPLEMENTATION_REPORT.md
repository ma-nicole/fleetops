# Toll Matrix Matching — Audit & Fix Report

**Date:** 2026-07-12  
**Scope:** Automatic toll computation returning ₱0 (no plaza match) → nearest-entry/exit + Class 3 matrix matching

---

## Root cause

1. **Toll Matrix sample rows were not seeded on startup.** Only plaza coordinates were synced (`ensure_toll_plaza_coords_seeded`). Fresh / sparse DBs had plazas (or none) but missing Class 3 `toll_matrix` fees → matching failed.
2. **Matching preferred exact/fuzzy address text** against plaza names. Customer addresses like “Quezon City, Metro Manila” never equaled “Mindanao Ave.”, so geo matching was only a secondary fallback and often never reached a matrix row.
3. **On miss, quotation silently used flat `toll_fees_php_per_trip` (often 0)** because `pricing_with_toll_matrix` omitted `toll_budget_per_truck` when `resolve_booking_toll_estimate` returned `None`.
4. **Failure messaging said “No toll plaza match found / Flat toll fallback”** instead of explaining nearby-entry, Class 3, or no-expressway cases.

---

## Fix summary

| Requirement | Implementation |
|-------------|----------------|
| Nearest entry/exit (not exact address) | Primary path: geocode pickup/dropoff → top-K plazas → closest valid Class 3 matrix pair (`entry_km + exit_km`) |
| All vehicle types = Class 3 | `DEFAULT_VEHICLE_CLASS` forced in resolve + pricing |
| Explicit miss reasons | Messages: nearby entry/exit missing, Class 3 missing for route, or `No expressway detected. Toll = ₱0.` |
| No silent ₱0 / no flat fallback | Always inject explicit `toll_budget_per_truck` (matched fee or `0.0` with reason) |
| Seed matrix + plazas | `ensure_toll_reference_data()` on app startup |
| Debug logging | Logs coords, entry/exit, matrix segments, class, fee, or miss reason |

---

## Files modified

- `backend/app/services/toll_matrix.py` — nearest-geo-first resolve, Class 3 force, miss explanations, logging
- `backend/app/services/toll_plaza_matching.py` — messages, geo meta (`straight_line_km`), top-K=8
- `backend/app/services/toll_plaza_seed.py` — plaza + Class 3 matrix sample seed
- `backend/app/services/booking_pricing.py` — always pass explicit toll into freight quote
- `backend/app/main.py` — startup calls `ensure_toll_reference_data`
- `backend/app/data/nlex_sctex_class3_sample.json` — south/CAVITEX reverse pairs (e.g. Santa Rosa→Batangas)
- `backend/app/data/toll_plaza_coords_seed.json` — NLEX/SCTEX/SLEX/STAR/CAVITEX plazas (prior expansion)
- `scripts/toll_matrix_corridor_smoke.py` — local corridor verification

---

## Database queries used

```sql
-- Active plazas with coordinates (nearest entry/exit)
SELECT * FROM toll_plazas
WHERE status = 'active' AND latitude IS NOT NULL AND longitude IS NOT NULL;

-- Class 3 matrix edges for fee lookup / multi-segment path
SELECT * FROM toll_matrix
WHERE status = 'active'
  AND vehicle_class = 'Class 3'
  AND effective_date <= :as_of
ORDER BY effective_date DESC;

-- Seed insert (idempotent by normalized entry/exit/class)
INSERT INTO toll_matrix (entry_point, exit_point, vehicle_class, toll_fee, effective_date, status)
VALUES (...);
```

Runtime path uses SQLAlchemy equivalents in `lookup_toll_matrix`, `_latest_active_edges`, and `_plazas_with_coords`.

---

## Corridor smoke results (local)

| Corridor | Detected entry → exit | Toll (Class 3) | Quote `toll_fees_php` |
|----------|----------------------|----------------|------------------------|
| Metro Manila → Pampanga | Balintawak → San Fernando | ₱1,120 | ₱1,120 |
| Metro Manila → Tarlac | Balintawak → Tarlac | ₱1,940 | ₱1,940 |
| Laguna → Batangas | Santa Rosa → Batangas | ₱636 | ₱636 |
| Cavite → Manila | Kawit → Magallanes | ₱285 | ₱285 |
| Local Makati → Makati | — | ₱0 | Message: `No expressway detected. Toll = ₱0.` |

Run: `cd backend && python ../scripts/toll_matrix_corridor_smoke.py`

---

## Sample computation (one booking)

**Pickup:** Quezon City, Metro Manila  
**Dropoff:** San Fernando, Pampanga  
**Vehicle class used:** Class 3 (forced)  
**Cargo:** 10 t · **Distance used in smoke quote:** 80 km  

1. Geocode pickup ≈ `(14.651, 121.049)`, dropoff ≈ `(15.028, 120.694)`
2. Nearest entry plazas include Balintawak / Mindanao Ave.; nearest exit includes San Fernando
3. Closest valid Class 3 matrix row: **Balintawak → San Fernando** (`matrix_id=7`, fee **1120**)
4. `pricing_with_toll_matrix` sets `toll_budget_per_truck=1120` → `toll_fees_php=1120` in quotation total

---

## Matching flow (current)

```
Pickup location → geocode → nearest toll entry candidates
Dropoff location → geocode → nearest toll exit candidates
        ↓
Score pairs by (entry_km + exit_km); require Class 3 Toll Matrix row
(or short multi-segment path of Class 3 edges)
        ↓
Inject toll into freight quotation (never silent flat-knob fallback)
```

Manual plaza override and waypoint segments remain supported overrides. Text/alias matching is secondary only when geo matching finds no matrix pair.
