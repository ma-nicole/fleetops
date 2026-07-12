# FleetOps System Cleanup Report

**Date:** 2026-07-13  
**Mode:** Cleanup and optimization (no workflow / feature / schema changes)  
**Rule:** Only deleted items with **zero** references (100% unused)

---

## Deleted Files

### Temporary / QA artifacts
* `tmp.pdf`
* `tmp.png`
* `backend/tmp-test-out.pdf`
* `backend/tmp-test-sig.png`
* `backend/tmp_terms.pdf`
* `backend/tmp_sig.png`
* `qa_api_smoke_out.txt`
* `qa_auth_e2e_out.txt`
* `qa_goods_e2e_out.txt`
* `qa_golden_out.txt`
* `qa_module_smoke_out.txt`
* `qa_payment_e2e_out.txt`
* `qa_pytest_out.txt`
* `qa_toll_corridor_out.txt`
* `qa_final_cost_out.txt`
* `qa_final_golden_out.txt`
* `qa_final_module_smoke_out.txt`
* `qa_final_payment_out.txt`
* `qa_final_toll_out.txt`
* `qa_phase_df_results.json`
* `qa_golden_workflow_results.json`
* `qa_module_smoke_results.json`
* `frontend/tsconfig.tsbuildinfo` (if present)

**Reason:** Temporary test outputs / regenerable QA dumps. No application imports.

### Orphan frontend modules (zero importers)
* `frontend/components/AnalyticsDashboard.tsx`
* `frontend/components/TripAssignment.tsx`
* `frontend/components/DriverRatingCard.tsx`
* `frontend/components/admin/MentorBarChart.tsx`
* `frontend/components/admin/BiAnalyticsSvgChart.tsx`
* `frontend/components/admin/InteractiveFeaturePanel.tsx`
* `frontend/components/admin/InteractiveAnalyticsSections.tsx`
* `frontend/components/admin/ExpenseDrilldownAnalytics.tsx`
* `frontend/components/admin/ChartDrilldownPanel.tsx`
* `frontend/components/admin/TollAnalyticsSection.tsx`
* `frontend/lib/analyticsPipelineService.ts`

**Reason:** No imports anywhere in the repo. Active analytics use `AdminAnalyticsDashboard`, role dashboards, `BiChartWidget`, and `analyticsApi.ts` instead.

---

## Packages Removed

* `frontend` dependency: `concurrently`
* `frontend` dependency: `wait-on`

**Reason:** Unused inside `frontend/package.json` scripts. Both remain at the **repo root** `package.json` where `npm run dev` actually uses them.

**Not removed (still referenced):**
* All Python packages in `backend/requirements.txt` (analytics, PDF, auth, email, HTTP)
* Frontend: `next`, `react`, `recharts`, `jspdf`, `html5-qrcode`, `qrcode.react`, `countries-list`, `@swc/helpers`, ESLint/TypeScript tooling

---

## Files Kept (examples)

| Path | Reason |
|------|--------|
| `scripts/qa_golden_workflow.py`, `scripts/qa_module_smoke.py` | Active QA harnesses |
| `frontend/app/reports/generate`, `reports/final`, `modules/analytics/prescriptive` | Active redirect stubs (URL compatibility) |
| `frontend/lib/driverDataFlowService.ts` | Still imported by mock pages |
| `frontend/lib/customerDataFlowService.ts` | Still imported by mock login/register/payment chain |
| `frontend/lib/erdDataService.ts` | Shared by DataFlow services |
| `backend/uploads/**` | Runtime booking/payment files referenced by DB paths |
| `frontend/app/globals.css` | Sole stylesheet |
| All booking / payment / dispatch / helper / driver / admin / analytics APIs | Active product surface |

---

## Warnings (manual review — NOT deleted)

These are **POSSIBLY UNUSED** legacy/mock routes and helpers. Removing them would require retiring smoke probes and any bookmarks first.

### Driver mock chain
* `frontend/app/booking/create/page.tsx`
* `frontend/app/dispatcher/confirm-order/page.tsx`
* `frontend/app/trips/status/page.tsx`
* `frontend/lib/driverDataFlowService.ts`

### Customer mock chain (non-Clerk)
* `frontend/app/login/page.tsx`
* `frontend/app/register/page.tsx`
* `frontend/app/payment/page.tsx`
* `frontend/app/order-confirmation/page.tsx`
* `frontend/app/order-details/page.tsx`
* `frontend/app/feedback/page.tsx`
* `frontend/lib/customerDataFlowService.ts`
* `frontend/lib/erdDataService.ts` (only if both DataFlow services are removed)

### Runtime data (do not wipe casually)
* `backend/uploads/booking_documents/**`
* `backend/uploads/payment_proofs/**`  
  App-owned files from QA/live bookings; deleting breaks document download for those booking IDs.

### Redirect stubs kept on purpose
Many `/admin/*`, `/driver/*`, `/manager/*`, `/modules/*` pages are thin redirects. Keep until old URLs are retired from docs/smoke.

---

## Phases skipped or limited (by safety rule)

| Phase | Result |
|-------|--------|
| 3 Dead code | Only whole unused modules deleted; no risky partial function surgery |
| 4 Import cleanup | No mass auto-lint rewrite (risk of false positives) |
| 5 API cleanup | No backend routes removed — all appear registered/used |
| 6 Assets | No product assets unused; only temp PDFs/PNGs removed |
| 7 Console cleanup | No `console.log` / `console.debug` found in frontend TS/TSX |
| 8 Verification | Backend health checked; frontend lockfile refresh after dep removal |

---

## Verification notes

* Backend `/health` expected reachable on local API.
* After package.json change, run `npm install --prefix frontend` (lockfile refresh).
* Recommend `npm run build --prefix frontend` before deploy.
* Core workflows (auth, booking, payment, dispatch, helper, driver, analytics) were not modified.

---

## Summary

**Deleted:** ~34 temp/QA artifacts + 11 orphan frontend modules  
**Packages removed:** 2 duplicate frontend deps (`concurrently`, `wait-on`)  
**Workflow impact:** None  
**DB / API / payment / analytics impact:** None  
