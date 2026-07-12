# Toll Matrix Matching — Audit & Fix Report

**Date:** 2026-07-12  
**Status:** Fixed (nearest entry/exit + Class matching; no silent ₱0)

## Root cause

1. **Text-first plaza matching** — Full booking addresses rarely match plaza canonical names, so matching failed before nearest-geo ran reliably.
2. **Toll Matrix sample not seeded on startup** — Plaza coordinates were seeded; matrix fee rows often missing → no entry+exit+class hit.
3. **Silent ₱0 fallback** — When `resolve_booking_toll_estimate` returned `None`, `customer_freight_pricing` used `knobs.toll_fees_php_per_trip` (default 0) with no explanation.

## Flow (booking → quotation)

```
Pickup / dropoff / weight / distance
        ↓
pricing_with_toll_matrix()
        ↓
resolve_booking_toll_estimate()
  1. waypoint segments (optional)
  2. manual entry/exit (optional)
  3. PRIMARY: geocode → nearest entry near pickup + nearest exit near dropoff
     → match Toll Matrix (entry + exit + vehicle class)
     → multi-segment BFS if no direct row
  4. optional route-catalog / fuzzy text assist
        ↓
customer_freight_pricing(..., toll_budget_per_truck=<matrix fee or 0>)
        ↓
quoted_total includes toll_fees_php
```

## Matching algorithm (requirement)

Pickup → nearest toll **entry**  
Dropoff → nearest toll **exit**  
→ Match entry + exit + vehicle class  
→ Retrieve fee from Toll Matrix  
→ If multiple valid pairs, prefer lowest `entry_km + exit_km` (closest valid route)

Not used: exact full-address string equality as the primary path.

## Failure messages (no silent ₱0)

| Situation | Message |
|-----------|---------|
| Both ends geocoded, no plaza in search radius | `No expressway detected. Toll = ₱0.` |
| No nearby entry | `No nearby toll entry found.` |
| No nearby exit | `No nearby toll exit found.` |
| Pair exists for other classes only | `{Class} does not exist for this toll route (A → B). Available: …` |
| Nearby plazas but no matrix edge | `No Toll Matrix route exists between the nearest entry and exit plazas.` |

## Files modified

| File | Change |
|------|--------|
| `backend/app/services/toll_plaza_matching.py` | Nearest-geo primary helpers; expressway vs no-entry messages; debug meta |
| `backend/app/services/toll_matrix.py` | Nearest-first resolve; vehicle-class normalize/explain; always return explicit fee + logs |
| `backend/app/services/booking_pricing.py` | Always inject matrix toll (never knobs fallback); pass `route_distance_km` |
| `backend/app/services/toll_plaza_seed.py` | Seed plazas **and** matrix sample on startup |
| `backend/app/main.py` | Call `ensure_toll_reference_data` |
| `backend/app/data/toll_plaza_coords_seed.json` | Balintawak, STAR, CAVITEX plazas |
| `backend/app/data/nlex_sctex_class3_sample.json` | Class 3 pairs for test corridors |

## Database queries used

```sql
-- Active plazas with coordinates (nearest entry/exit)
SELECT * FROM toll_plazas
WHERE status = 'active' AND latitude IS NOT NULL AND longitude IS NOT NULL;

-- Active matrix edges for vehicle class as of date
SELECT * FROM toll_matrix
WHERE status = 'active'
  AND vehicle_class = 'Class 3'
  AND effective_date <= CURDATE()
ORDER BY effective_date DESC;

-- Vehicle classes available for a specific entry→exit
SELECT DISTINCT vehicle_class FROM toll_matrix
WHERE status = 'active'
  AND entry_point = ? AND exit_point = ?
  AND effective_date <= CURDATE();
```

Startup seed: upsert from `toll_plaza_coords_seed.json` + insert missing rows from `nlex_sctex_class3_sample.json`.

## Local corridor tests (geocode stubbed to city centers)

| Route | Entry → Exit | Toll (Class 3) | Injected into quote |
|-------|--------------|----------------|---------------------|
| Metro Manila → Pampanga | Mindanao Ave. → San Fernando | ₱1,180 | yes (`toll_fees_php=1180`) |
| Metro Manila → Tarlac | Mindanao Ave. → Tarlac | ₱2,008 | yes |
| Laguna → Batangas | Santa Rosa → Batangas | ₱636 | yes |
| Cavite → Manila | Kawit → Magallanes | ₱285 | yes |
| Tuguegarao → Laoag (no NCR expressway) | — | ₱0 | message: `No expressway detected. Toll = ₱0.` |
| MM → Pampanga, Class 9 | — | ₱0 | `Class 9 does not exist for this toll route (Mindanao Ave. → San Fernando). Available: Class 3.` |

## Sample computation (MM → Pampanga, 10 t, 80 km)

- Detected entry: **Mindanao Ave.** (near Quezon City)  
- Detected exit: **San Fernando**  
- Matrix record: Class 3, effective 2026-01-20, fee **₱1,180**  
- Quote: `toll_fees_php = 1180` added into `quoted_total` (cargo + fuel + driver 10% + helper 4.62% + toll)

## Debug logging

Logger messages include: pickup/dropoff lat/lon, nearest entry/exit candidates, matched matrix id(s), vehicle class, computed toll, and explicit zero reasons.
