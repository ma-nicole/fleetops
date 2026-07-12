# FleetOpts Thesis Objective Audit

Audit date: 2026-07-12

Status meanings:

- **Fully Implemented** — the objective has a working data path, API/service logic, and a visible user interface.
- **Partially Implemented** — useful implementation exists, but one or more required outputs are absent or data-dependent behavior is not clearly exposed.
- **Not Implemented** — no working system implementation was found.

## Executive result

The booking, approval, payment, dispatch, assignment, trip execution, completion, reporting, and role-based analytics workflows were already implemented and were not redesigned. The audit identified three material analytics gaps: cost regression transparency and target leakage, incomplete operational forecasting coverage, and incomplete route-optimization evidence in the UI. These gaps were corrected in the existing analytics modules.

| Thesis objective | Before audit | After targeted improvements | System evidence |
|---|---|---|---|
| Integrated booking and customer transaction workflow | Fully Implemented | Fully Implemented | `frontend/app/booking`, `backend/app/api/routes/bookings.py`, `payments.py`, `workflow.py` |
| Dispatch, scheduling, truck/driver/helper assignment, and trip monitoring | Fully Implemented | Fully Implemented | `frontend/app/dispatcher`, `backend/app/api/routes/dispatch.py`, `schedule.py`, `backend/app/services/prescriptive/assignment.py` |
| Historical and role-based operational analytics | Fully Implemented | Fully Implemented | `backend/app/services/admin_analytics.py`, `manager_role_analytics.py`, `dispatcher_role_analytics.py`, `driver_role_analytics.py`, `customer_role_analytics.py` |
| Regression-based operational cost prediction | Partially Implemented | Fully Implemented | `backend/app/services/predictive/cost_model.py`, `GET /api/analytics/cost-regression`, `POST /api/analytics/predict-trip-cost`, `frontend/app/modules/analytics/predictions/page.tsx` |
| Booking-demand time-series forecasting | Partially Implemented | Fully Implemented | `backend/app/services/predictive/operational_forecast.py`, `GET /api/analytics/forecast-operations`, predictive analytics page |
| Fuel-usage time-series forecasting | Partially Implemented | Fully Implemented | same operational forecast service and page; source is `FuelLog.liters` and `recorded_at` |
| Fleet-maintenance time-series forecasting | Partially Implemented | Fully Implemented | same operational forecast service and page; source is maintenance-event history |
| Delivery-trend time-series forecasting | Partially Implemented | Fully Implemented | same operational forecast service and page; source is completed-trip history |
| Algorithmic routing optimization | Partially Implemented | Fully Implemented | `backend/app/services/prescriptive/routing_astar.py`, `POST /api/analytics/optimize-route`, route optimizer page |
| Predictive decision support beyond charts | Partially Implemented | Fully Implemented | predictive analytics page and `frontend/components/admin/BiChartWidget.tsx` |
| Filters, Year → Quarter → Month → Week → Day drilldown, appropriate charts, tables, and statistics | Fully Implemented in role analytics; partial in the legacy prediction page | Fully Implemented | `TimeGranularityPicker.tsx`, `BiChartWidget.tsx`, `DrillDownAnalyticsModal`, predictive analytics page |
| Unified single-screen switcher for every role | Partially Implemented | Partially Implemented | Role-specific screens are complete, but there is intentionally no cross-role switcher; see `docs/analytics-compliance-matrix.md` |

## Regression audit

### Finding before improvement

The existing cost predictor used deterministic formulas and a regression residual adjustment only for the final total. The training function used fuel, toll, and labor costs as input features while also defining their sum as the target. That created target leakage and made the reported R² unsuitable as evidence of predictive quality. Driver and helper costs were not exposed as separate regression targets.

### Implemented correction

The operational estimator now fits five independent multiple linear regressions using only trip characteristics:

- Features: distance, duration, and cargo weight.
- Targets: fuel cost, toll cost, driver cost, helper cost, and total operational cost.
- Evidence exposed: model name, training status, sample size, per-target prediction, per-target R², coefficients, intercept, interpretation, and recommendation.
- Safeguard: when fewer than five usable completed trips exist, the UI explicitly reports the sample limitation and uses the existing deterministic formulas as a fallback.
- Compatibility: the existing `labor_cost`, manager-dashboard `score`, and `reason` response fields remain available.

R² is an in-sample diagnostic. The page explicitly warns that it should be interpreted cautiously for small samples.

## Forecasting audit

### Finding before improvement

The endpoint named `forecast-monthly` forecast total monthly trip cost, not booking demand. Forecast-like blocks existed in role analytics, but there was no single auditable page that presented all four required series in the prescribed order.

### Implemented correction

The operational forecasting endpoint now returns four separate series:

| Forecast | Historical source | Default chart | Forecast method |
|---|---|---|---|
| Booking Demand | Booking creation timestamps | Line | Holt-Winters additive trend; moving-average fallback for limited history |
| Fuel Usage | Fuel-log liters and recording timestamps | Area | Same auditable method selection |
| Fleet Maintenance | Maintenance-event timestamps | Bar | Same auditable method selection |
| Delivery Trends | Completed-trip timestamps | Line | Same auditable method selection |

Every forecast panel visibly follows: Historical Data → Forecast Graph → Forecast Values → Forecast Method → Interpretation → Recommendation. It also includes KPIs, a data table, statistical summary, date filters, horizon controls, and the full time-granularity drilldown.

## Routing optimization audit

### Finding before improvement

A real A* service already existed and compared alternative paths using distance, time, or modeled cost. The UI showed distance, fuel, toll, time penalty, and maintenance penalty. It did not show estimated travel time, the optimization method in the response, or a direct reason for selection. The heuristic also used a fixed cost multiplier even when optimizing distance or time.

### Implemented correction

- The heuristic is now objective-aware and calibrated as a conservative lower bound.
- The result exposes selected route, distance, estimated travel time, fuel cost, toll cost, total modeled cost, constraints, objective, method, and selection reason.
- Alternatives remain visible for comparison.
- The existing A* persistence path for booking route options is unchanged.

The bundled graph remains an illustrative operational network unless `data/road_graph.json` is supplied. The optimizer does not claim to use live traffic.

## Decision-support and presentation audit

Role analytics already supplied filters, drilldown source records, multiple chart types, statistics, comparisons, and on-demand AI explanation. Predictive widgets now also display a deterministic system interpretation and an actionable recommendation without requiring the user to open a drilldown or call an AI provider.

The full role/function/bullet mapping remains in `docs/analytics-compliance-matrix.md`. That matrix covers Manager, Dispatcher, Driver, and Customer descriptive and predictive objectives. Its only open information-architecture item is the optional unified cross-role switcher; the role-specific implementations themselves remain available.

## Verification evidence

- Python syntax compilation: passed for the complete `backend/app` tree.
- Frontend TypeScript check: passed.
- Next.js production build: passed; all 143 routes generated.
- Backend integration tests were extended for component regression outputs, the four forecast modules, and route selection evidence.
- Runtime execution of backend tests requires the project's Python dependencies and configured test database; this audit environment did not contain a runnable project Python installation.

## Data-quality limitations

- Regression uses a formula fallback until five usable completed trips exist.
- Forecasts use a disclosed moving-average fallback when history is too short or constant for Holt-Winters.
- Forecast accuracy depends on consistent booking, fuel-log, maintenance, and trip-completion records.
- Live traffic and commercial map routing are outside the current thesis implementation; route optimization operates on the configured road graph and active truck-ban constraints.
