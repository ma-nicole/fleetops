# FleetOps Complete End-to-End QA Audit Report

**Date:** 2026-07-12  
**Scope:** Full system QA per audit plan (modules, UI, API, workflow, analytics, reports, security)  
**Constraint:** No redesign; fix only verified defects; preserve existing workflows  

---

## Coverage summary

| Area | Result |
|------|--------|
| Backend health | Running (`/health` OK) |
| Frontend | Pages return HTTP 200 for role dashboards + key modules |
| Seed accounts | All 6 roles login OK (`password`) after `seed_db.py` |
| Auth E2E | **8/8 passed** |
| Payment approval E2E | **8/8 passed** (after session `expire_all` fix) |
| Analytics center E2E | **23/23 passed** |
| Toll corridor smoke | **5/5 passed** (incl. explicit no-expressway ₱0) |
| Cost estimation smoke | **PASS** |
| API smoke | **PASS** (after password policy + date/slot fixes) |
| Module API/FE smoke | Role logins + core endpoints + FE route reachability |
| Golden workflow | **PASS (0 failed)** booking→payment→goods→cargo→dispatch→accept→depart→arrived→en route; completion correctly blocked pending POD receiving docs |
| Pytest | **Not run** — `pytest` not installed in local Python env (`requirements.txt` has no pytest) |

**Roles exercised:** admin, manager, dispatcher, driver, helper, customer  

**Golden path sample (booking #224):** toll matrix matched ₱1,120 (Balintawak→San Fernando Class 3); quoted cost ₱8,245.97; trip #216 progressed through en route destination. Completion returned expected 400 requiring receiving document + QR + digital signature (by design).

---

## 1. Critical Issues

*None open after audit fixes.*

| ID | Module | Page / API | Description | Root cause | Recommended fix | Status |
|----|--------|------------|-------------|------------|-----------------|--------|
| C1 | Booking | `POST /api/bookings/with-documents` | Valid booking with e-signature failed with opaque 500 (“Unable to generate signed terms PDF”) | `fpdf.image()` raised `OSError` on some PNG streams; exception swallowed without logging | Skip unreadable signature image embed and continue PDF generation; log failures | **Fixed** in `terms_agreement_pdf.py` + logging in `bookings.py` |

---

## 2. High Priority Issues

| ID | Module | Page / API | Description | Root cause | Recommended fix | Status |
|----|--------|------------|-------------|------------|-----------------|--------|
| H1 | Dispatch | Assignment / availability | Seeded “live” trips left trucks/drivers/helpers forever busy; auto-assign failed for future bookings; message claimed false “window overlap” | Seed kept many `IN_DELIVERY`/`LOADING` trips; live-busy conflicts block all windows; message text inaccurate | Seed completes trips older than 3 days; clarify conflict message for live-busy | **Fixed** (`seed_db.py`, `dispatch_resource_availability.py`) |
| H2 | Driver / Workflow | `POST .../depart`, `.../arrived-pickup` | Empty body returned 422 requiring unused `status` field | Endpoints typed as `TripStatusUpdate` with required `status` even though status is set server-side | Use `TripLocationNote` body (optional notes/location) | **Fixed** (`schemas/trip.py`, `workflow.py`) |
| H3 | Tooling | `backend/api_smoke_test.py` | Smoke abort: register password rejected; valid booking used past date / invalid slot | Password policy requires upper+special; slots only `08:00/11:30/14:00/17:30` | Align smoke payloads with policy | **Fixed** |
| H4 | Tooling | `scripts/payment_approval_e2e_test.py` | Crash `AttributeError: 'NoneType' has no attribute 'id'` after create | TestClient commit not visible in open SQLAlchemy session | `db.expire_all()` then re-query | **Fixed** |

---

## 3. Medium Priority Issues

| ID | Module | Page / API | Description | Root cause | Recommended fix | Status |
|----|--------|------------|-------------|------------|-----------------|--------|
| M1 | Database / Seed | Goods declaration E2E | `goods_declaration_review_e2e_test` fails: no booking with declaration file | Seed creates bookings/trips/payments but not cargo declaration uploads | Seed sample declaration paths or document multipart bookings | **Open** |
| M2 | Workflow | Manager approve after payment verify | `POST /workflow/booking/{id}/approve` returns 400 for `PAYMENT_VERIFIED` | Payment verify already advances status; separate manager approve not applicable | Document status machine; UI should skip approve when already payment-verified | **Open** (behavior intentional; UX clarity needed) |
| M3 | Reports UI | `/reports/generate`, `/reports/final` | Uses `DriverDataFlowService` localStorage mock — not live API reports | Legacy demo flow | Wire to `/api/reports/*` or mark page deprecated | **Open** |
| M4 | Environment | Local QA | Empty DB / unrepaired passwords blocked all role tests at start | Seed not applied | Run `python seed_db.py` (and `--repair-passwords` when needed) | **Mitigated** (seeded during audit) |
| M5 | Deps | passlib / bcrypt | `(trapped) error reading bcrypt version` warnings | passlib vs bcrypt package version skew | Pin compatible `bcrypt`/`passlib` versions | **Open** (login still works) |

---

## 4. Low Priority Issues

| ID | Module | Page / API | Description | Root cause | Recommended fix | Status |
|----|--------|------------|-------------|------------|-----------------|--------|
| L1 | Tooling | pytest | Cannot run `backend/tests` | pytest not in env / not listed in `requirements.txt` | Add pytest to dev requirements; document install | **Open** |
| L2 | Reports | Product gap | No Excel (.xlsx) export endpoint found | Not implemented | Only add if product requires it | **Open** (gap, not regression) |
| L3 | Seed | `datetime.utcnow()` deprecations | Many `DeprecationWarning`s in seed | Python 3.12+ prefers timezone-aware UTC | Replace with `datetime.now(UTC)` | **Open** |
| L4 | Auth | Register | Dev seed password `password` would fail register policy | Seed bypasses customer register validators | Keep seed as-is; document difference | **Open** (by design for local seed) |

---

## 5. UI Issues

| ID | Module | Page | Description | Root cause | Recommended fix | Status |
|----|--------|------|-------------|------------|-----------------|--------|
| U1 | Customer | Booking progress tracker | Many stages overflowed card (pre-audit) | Horizontal stepper without wrap/containment | Wrap on desktop; scroll on mobile; card `overflow:hidden` | **Fixed earlier** (`WorkflowTimeline`, `CustomerBookingWorkflowTracker`) |
| U2 | Shell | App main content | Wide tables/charts can spill past main column | Missing `min-width:0` / overflow clip on `.app-main` | Add containment CSS | **Fixed** (`globals.css`) |
| U3 | Dispatcher | week-board / job-assignments | Wide tables rely on `overflow-x: auto` | Dense operational grids | Keep horizontal scroll; acceptable pattern | **Noted** (no functional break) |
| U4 | Reports | `/reports/generate` | Empty list until localStorage seeded | Mock service | See M3 | **Open** |

---

## 6. Backend Issues

| ID | Module | Endpoint | Description | Root cause | Recommended fix | Status |
|----|--------|----------|-------------|------------|-----------------|--------|
| B1 | Booking docs | with-documents PDF | See C1 | Image embed failure | Fixed | **Fixed** |
| B2 | Workflow | depart / arrived-pickup | See H2 | Wrong request model | Fixed | **Fixed** |
| B3 | Dispatch | Conflict messaging | See H1 | live_busy treated as overlap in copy | Fixed | **Fixed** |
| B4 | Notifications | Email on booking/payment | Logs `RESEND_API_KEY is not configured` | Missing env | Configure Resend for non-dev | **Open** (expected locally) |

---

## 7. Database Issues

| ID | Module | Description | Root cause | Recommended fix | Status |
|----|--------|-------------|------------|-----------------|--------|
| D1 | Seed trips | Historical operational bookings left in non-terminal trip statuses | Seed status matrix | Complete trips with `days_ago > 3` | **Fixed** in `seed_db.py` |
| D2 | Seed declarations | No `cargo_declaration_storage_path` rows for goods-review E2E | Seed omission | Extend seed | **Open** (M1) |
| D3 | CRUD smoke | Admin trucks/users/toll matrix list OK; payment verify CRUD OK during golden path | — | — | **Pass** |

---

## 8. Analytics Issues

| ID | Module | Description | Root cause | Recommended fix | Status |
|----|--------|-------------|------------|-----------------|--------|
| A1 | Admin analytics | Dashboard keys load; module audit OK; role blocks OK | — | — | **Pass** (23/23 E2E) |
| A2 | AI interpretation | `/api/admin/analytics/chart-interpretation` + expense interpretation used by E2E | — | — | **Pass** (per analytics E2E) |
| A3 | Predictive | `/api/analytics/predict-trip-cost`, forecast endpoints exist (POST/GET under `/api/analytics`) | Wrong probe paths returned 404 during ad-hoc check | Use documented POST paths | **Pass** when correct endpoints used |
| A4 | Customer analytics | `/api/customer/analytics` 200 | — | — | **Pass** |

---

## 9. Report Issues

| ID | Module | Description | Root cause | Recommended fix | Status |
|----|--------|-------------|------------|-----------------|--------|
| R1 | CSV exports | `/api/reports/bookings.csv`, `/api/reports/fleet.csv`, `/api/manager/finance.csv`, `/api/manager/maintenance.csv` return `text/csv` 200 | — | — | **Pass** |
| R2 | PDF | Terms agreement PDF generation path fixed; payment proof download works in payment E2E | — | — | **Pass** (after C1) |
| R3 | Excel | No Excel export | Not built | Product decision | **Open** (L2) |
| R4 | UI generate page | Mock localStorage reports; missing Generated By/Date from API | Legacy page | Replace or hide | **Open** (M3) |

---

## 10. Performance Issues

| ID | Module | Description | Root cause | Recommended fix | Status |
|----|--------|-------------|------------|-----------------|--------|
| P1 | Geocoding / toll | Booking create / toll estimate calls Nominatim + OSRM (multi-second) | External HTTP | Cache (already present for geocode); keep as-is for accuracy | **Noted** |
| P2 | Analytics | Admin analytics can be heavy; client uses longer timeout (120s) by design | Large aggregations | Monitor; paginate if needed | **Noted** |
| P3 | Duplicate API | Not systematically profiled in browser DevTools this pass | — | Follow-up with React Profiler / network waterfall | **Open** (low evidence) |

---

## Security checks (Phase 12)

| Check | Result |
|-------|--------|
| JWT login + `/api/auth/me` | Pass |
| Wrong password 401 + lockout messaging | Pass (auth E2E) |
| Unauthenticated `/me` | 401 Pass |
| Customer denied `/api/admin/users` | 403 Pass |
| Driver/helper denied admin analytics | 403 Pass (module smoke) |
| Password policy (upper/lower/digit/special) | 422 on weak register Pass |
| Role guard on frontend | `useRoleGuard` present on protected pages |
| Session seed passwords | Documented local-only `password` |

---

## Form validation (Phase 5) — spot checks

| Form / API | Empty/invalid | Result |
|------------|---------------|--------|
| Register short password / short name | 422 with field errors | Pass |
| Register missing complexity | 422 | Pass |
| Booking negative weight / short location / past date / missing slot | 422 | Pass |
| Booking valid slot + future date | 200 | Pass |
| Payment proof submit | 200 → for_verification | Pass |
| Double-submit / button disable | Not fully UI-automated | Partial — recommend UI follow-up |

---

## Fixes applied during this audit

1. `backend/app/services/terms_agreement_pdf.py` — resilient signature image embed  
2. `backend/app/api/routes/bookings.py` — log PDF generation failures  
3. `backend/app/schemas/trip.py` + `workflow.py` — `TripLocationNote` for depart/arrived-pickup  
4. `backend/app/services/dispatch_resource_availability.py` — accurate live-busy conflict message  
5. `seed_db.py` — complete older seed trips so dispatch stays usable  
6. `backend/api_smoke_test.py` — policy-compliant password + valid schedule  
7. `scripts/payment_approval_e2e_test.py` — session refresh after create  
8. `frontend/app/globals.css` — `.app-main` overflow containment  
9. QA harness scripts: `scripts/qa_module_smoke.py`, `scripts/qa_golden_workflow.py`

---

## Recommended next actions (not done this pass)

1. Add `pytest` to dev dependencies and CI.  
2. Seed at least one booking with cargo declaration + signature for goods-review E2E.  
3. Retire or rewire `/reports/generate` mock page.  
4. Browser DevTools pass for console errors on every sidebar link (manual).  
5. Pin bcrypt/passlib versions to silence warnings.

---

## Verdict

Core operational path (auth → book with toll → pay → verify → goods/cargo → dispatch → driver progress) is **working** after verified fixes. Remaining items are seed completeness, legacy mock report UI, tooling (pytest), and documentation/UX around status transitions—not blockers for the primary FleetOps workflow.
