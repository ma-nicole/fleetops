# Toll Estimation — NLEX-SCTEX Descriptive Matrix

**Approach:** Admin-maintained entry/exit plaza toll fares (VAT-inclusive). No Google Maps or external toll API gate detection. Distance routing remains unchanged; toll fees come only from the descriptive matrix.

---

## Admin Toll Matrix Fields

| Field | Example |
|-------|---------|
| Entry point | Mindanao Ave. |
| Exit point | Tarlac |
| Vehicle class | Class 3 |
| Toll fee | 2008 |
| Effective date | 2026-01-20 |
| Status | active / inactive |

Sample NLEX-SCTEX Class 3 rows: `backend/app/data/nlex_sctex_class3_sample.json`

---

## Booking Flow (unchanged sequence)

1. Customer selects pickup/dropoff (existing workflow).
2. System geocodes for **distance only** (OSRM/Nominatim — not used for toll gates).
3. Pickup/dropoff text is matched to matrix **entry point → exit point** (exact, then fuzzy).
4. Latest **effective_date ≤ booking date** row is used.
5. **Estimated toll** = matrix `toll_fee` × truck count.
6. If no match: *"No toll estimate available for this route."* — booking continues with flat toll fallback.

---

## Transit & Completion

- **Driver additional toll entries** adjust actual expense during transit.
- **Actual toll** = estimated + additional entries.
- **Toll variance** = actual − estimated.
- **Historical toll records** store entry/exit, effective date, estimated/actual/variance for analytics.

---

## Key Files

- Model: `backend/app/models/entities.py` (`TollMatrix`, `HistoricalTollRecord`)
- Lookup: `backend/app/services/toll_matrix.py`
- Admin API: `backend/app/api/routes/toll_matrix.py`
- Admin UI: `frontend/app/modules/administration/tolls/page.tsx`
- Booking quote: `frontend/components/CostCalculator.tsx`

---

## Verification

```bash
cd backend && python -m uvicorn app.main:app --reload --port 8000
python scripts/toll_e2e_smoke_test.py
```

Integration test confirmed: San Fernando → San Simon, Class 3 → toll fee ₱146 from matrix.
