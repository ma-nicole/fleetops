"""Customer role analytics — four pillars from customer-owned records only."""
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.entities import BookingStatus, CargoTypeCategory, CustomerSavedSite, PaymentStatus, ServiceType, User
from app.services.admin_analytics import (
    AnalyticsFilters,
    _activity_date,
    _booking_in_filters,
    _load_customer_context,
    _primary_trip,
    _route_key,
    _shipment_category,
)
from app.services.manager_role_analytics import _block, _combine_forecast_chart, _empty, _empty_predict, _forecast_series, _monthly_series
from app.services.cargo_type_classification import cargo_type_category_label
from app.services.time_bucket import period_chart_row, period_key, rollup_nested_series, sort_period_keys

_WEEKDAYS = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
_HEATMAP_HOURS = tuple(range(7, 21))
_LOGIN_ACTIVITY_TYPES = ("login", "logout", "password_reset", "profile_update")
_TERMINAL_BOOKING_STATUSES = frozenset(
    {
        BookingStatus.COMPLETED,
        BookingStatus.CANCELLED,
        BookingStatus.REJECTED,
        BookingStatus.EXPIRED,
        BookingStatus.PAYMENT_REJECTED,
    }
)


def _activity_heatmap_chart(timestamps: list[datetime]) -> list[dict[str, Any]]:
    """Day-of-week × hour density grid for account activity heatmaps."""
    counts: dict[tuple[int, int], int] = defaultdict(int)
    for ts in timestamps:
        if not ts:
            continue
        hour = ts.hour
        if hour not in _HEATMAP_HOURS:
            continue
        counts[(ts.weekday(), hour)] += 1
    return [
        {
            "day": _WEEKDAYS[dow],
            "day_index": dow,
            "hour": hour,
            "count": counts.get((dow, hour), 0),
        }
        for dow in range(7)
        for hour in _HEATMAP_HOURS
    ]


def _format_quarter_label(period: str) -> str:
    if "-Q" in period:
        year, quarter = period.split("-Q")
        return f"{year} Q{quarter}"
    return period


def _login_activity_drill_row(
    *,
    timestamp: datetime,
    activity_type: str,
    source: str,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    pk = period_key(timestamp, "quarterly") or "—"
    row: dict[str, Any] = {
        "date": timestamp.date().isoformat(),
        "time": timestamp.strftime("%H:%M"),
        "timestamp": timestamp.isoformat(),
        "period": _format_quarter_label(pk) if pk != "—" else "—",
        "activity_type": activity_type,
        "source": source,
    }
    if extra:
        row.update(extra)
    return row


def _collect_customer_login_activity(
    *,
    customer: User,
    bookings: list,
    all_payments: list,
    saved_sites: list[CustomerSavedSite],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Build login-history events and quarterly stacked chart from real customer account actions."""
    events: list[dict[str, Any]] = []

    if customer.created_at:
        events.append(
            _login_activity_drill_row(
                timestamp=customer.created_at,
                activity_type="login",
                source="account_registration",
                extra={"customer_id": customer.id},
            )
        )

    if customer.password_reset_expires_at:
        requested_at = customer.password_reset_expires_at - timedelta(
            minutes=settings.password_reset_token_expire_minutes
        )
        events.append(
            _login_activity_drill_row(
                timestamp=requested_at,
                activity_type="password_reset",
                source="password_reset_request",
                extra={"customer_id": customer.id},
            )
        )

    for site in saved_sites:
        if site.created_at:
            events.append(
                _login_activity_drill_row(
                    timestamp=site.created_at,
                    activity_type="profile_update",
                    source="saved_site",
                    extra={"site_id": site.id, "address": site.address[:120]},
                )
            )

    for b in bookings:
        created = b.created_at
        if created:
            events.append(
                _login_activity_drill_row(
                    timestamp=created,
                    activity_type="login",
                    source="booking_submitted",
                    extra={"booking_id": b.id},
                )
            )
        status = b.status.value if hasattr(b.status, "value") else str(b.status)
        if b.status in _TERMINAL_BOOKING_STATUSES and b.updated_at:
            events.append(
                _login_activity_drill_row(
                    timestamp=b.updated_at,
                    activity_type="logout",
                    source="booking_closed",
                    extra={"booking_id": b.id, "status": status},
                )
            )
        for ts, src in (
            (b.customs_customer_updated_at, "customs_update"),
            (b.cargo_declaration_uploaded_at, "cargo_declaration"),
            (b.terms_agreement_uploaded_at, "terms_agreement"),
            (b.terms_agreed_at, "terms_agreed"),
        ):
            if ts:
                events.append(
                    _login_activity_drill_row(
                        timestamp=ts,
                        activity_type="profile_update",
                        source=src,
                        extra={"booking_id": b.id},
                    )
                )

    for p in all_payments:
        ts = p.proof_uploaded_at or p.created_at
        if ts:
            events.append(
                _login_activity_drill_row(
                    timestamp=ts,
                    activity_type="login",
                    source="payment_proof_uploaded",
                    extra={"payment_id": p.id, "booking_id": p.booking_id},
                )
            )

    buckets: dict[str, dict[str, int]] = defaultdict(
        lambda: {key: 0 for key in _LOGIN_ACTIVITY_TYPES}
    )
    for ev in events:
        ts = datetime.fromisoformat(str(ev["timestamp"]))
        pk = period_key(ts, "quarterly")
        if not pk:
            continue
        activity = str(ev["activity_type"])
        if activity in buckets[pk]:
            buckets[pk][activity] += 1

    chart_rows = rollup_nested_series(buckets, "quarterly", limit=12)
    for row in chart_rows:
        pk = str(row["period"])
        row["period"] = _format_quarter_label(pk)
        row["total"] = sum(int(row.get(k) or 0) for k in _LOGIN_ACTIVITY_TYPES)

    events.sort(key=lambda r: (r["date"], r["time"]), reverse=True)
    return chart_rows, events[:80]


def _profile_records_field_rows(
    *,
    customer: User,
    bookings: list,
    saved_sites: list[CustomerSavedSite],
) -> list[dict[str, Any]]:
    """Per-field profile completion audit for the authenticated customer."""
    cargo_uploads = sum(1 for b in bookings if b.cargo_declaration_uploaded_at)
    terms_uploads = sum(
        1 for b in bookings if b.terms_agreement_uploaded_at or b.terms_agreed_at
    )
    customs_updates = sum(1 for b in bookings if b.customs_customer_updated_at)

    checks: list[tuple[str, bool, Any]] = [
        ("Phone number", bool((customer.phone or "").strip()), customer.phone or "—"),
        ("Company name", bool((customer.company_name or "").strip()), customer.company_name or "—"),
        ("Saved delivery sites", bool(saved_sites), len(saved_sites)),
        ("Cargo declaration uploads", cargo_uploads > 0, cargo_uploads),
        ("Terms agreement uploads", terms_uploads > 0, terms_uploads),
        ("Customs profile updates", customs_updates > 0, customs_updates),
    ]
    rows: list[dict[str, Any]] = []
    for field, updated, value in checks:
        rows.append(
            {
                "customer_id": customer.id,
                "field": field,
                "profile_updated": "Yes" if updated else "No",
                "value": value,
            }
        )
    return rows


def _profile_updated_status_chart(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    yes = sum(1 for row in rows if row.get("profile_updated") == "Yes")
    no = sum(1 for row in rows if row.get("profile_updated") == "No")
    if yes == 0 and no == 0:
        return []
    return [{"profile_updated": "Yes", "count": yes}, {"profile_updated": "No", "count": no}]


_RECEIPT_SETTLEMENT_DISPLAY = ("Paid", "Pending", "Refunded")


def _payment_settlement_status(raw_status: str | None) -> str:
    token = str(raw_status or "").strip().lower()
    if token == PaymentStatus.VERIFIED.value:
        return "Paid"
    if token == PaymentStatus.REFUNDED.value:
        return "Refunded"
    return "Pending"


def _receipts_settlement_block(payment_rows: list[dict[str, Any]]) -> dict[str, Any]:
    """Donut chart: issued invoice settlement status (Paid / Pending / Refunded)."""
    counts: dict[str, int] = {label: 0 for label in _RECEIPT_SETTLEMENT_DISPLAY}
    drilldown: list[dict[str, Any]] = []
    for row in payment_rows:
        settlement = _payment_settlement_status(row.get("status"))
        counts[settlement] = counts.get(settlement, 0) + 1
        drilldown.append(
            {
                "payment_id": row.get("payment_id"),
                "booking_id": row.get("booking_id"),
                "date": row.get("date"),
                "amount_php": row.get("amount_php"),
                "reference": row.get("reference"),
                "status": row.get("status"),
                "settlement_status": settlement,
            }
        )
    drilldown.sort(key=lambda r: str(r.get("date") or ""), reverse=True)
    total = sum(counts.values())
    if total == 0:
        return _empty("No data available yet.")
    chart = [{"settlement_status": label, "count": counts[label]} for label in _RECEIPT_SETTLEMENT_DISPLAY]
    top_status = max(counts.items(), key=lambda item: item[1])[0]
    return _block(
        kpis=[
            {"label": "Issued invoices", "value": total},
            {"label": "Dominant status", "value": top_status},
        ],
        chart=chart,
        drilldown=drilldown[:80],
        note=(
            "Receipts: Distribution of Issued Invoice Settlement Status. "
            "Paid = verified payments; Pending = awaiting verification; Refunded = refunded invoices."
        ),
    )


_SERVICE_SECTOR_DISPLAY = ("Cold Chain", "Heavy Cargo", "Express Delivery", "Standard Delivery")
_COLD_CHAIN_CATEGORIES = frozenset({"food_perishable", "pharmaceuticals"})
_HEAVY_CARGO_CATEGORIES = frozenset({"construction", "automotive", "chemicals_hazmat", "flammable"})
_HEAVY_CARGO_MIN_TONS = 15.0


def _classify_service_sector(booking) -> str:
    """Map a booking to one of four customer service sectors using cargo and service type."""
    cargo_cat = ""
    if getattr(booking, "cargo_type_category", None) is not None:
        cargo_cat = (
            booking.cargo_type_category.value
            if hasattr(booking.cargo_type_category, "value")
            else str(booking.cargo_type_category)
        ).strip().lower()
    weight = float(getattr(booking, "cargo_weight_tons", 0) or 0)
    service_val = (
        booking.service_type.value
        if hasattr(booking.service_type, "value")
        else str(booking.service_type or "")
    ).strip().lower()

    if cargo_cat in _COLD_CHAIN_CATEGORIES:
        return "Cold Chain"
    if cargo_cat in _HEAVY_CARGO_CATEGORIES or weight >= _HEAVY_CARGO_MIN_TONS:
        return "Heavy Cargo"
    if service_val == ServiceType.CUSTOMIZED.value:
        return "Express Delivery"
    return "Standard Delivery"


def _service_selection_history_block(bookings: list) -> dict[str, Any]:
    """Horizontal bar chart: order volume by service sector."""
    sector_counts: dict[str, int] = {label: 0 for label in _SERVICE_SECTOR_DISPLAY}
    drilldown: list[dict[str, Any]] = []
    for b in bookings:
        sector = _classify_service_sector(b)
        sector_counts[sector] = sector_counts.get(sector, 0) + 1
        cargo_cat = ""
        if getattr(b, "cargo_type_category", None) is not None:
            cargo_cat = (
                b.cargo_type_category.value
                if hasattr(b.cargo_type_category, "value")
                else str(b.cargo_type_category)
            )
        drilldown.append(
            {
                "booking_id": b.id,
                "date": b.created_at.date().isoformat() if b.created_at else "—",
                "service_sector": sector,
                "service_type": str(
                    b.service_type.value if hasattr(b.service_type, "value") else b.service_type
                ),
                "cargo_type_category": cargo_cat or "—",
                "cargo_weight_tons": float(b.cargo_weight_tons or 0),
                "route": _route_key(b.pickup_location, b.dropoff_location),
            }
        )
    drilldown.sort(key=lambda r: r["date"], reverse=True)
    # Chart rows top-to-bottom: Cold Chain → Standard Delivery (Recharts category axis).
    chart = [
        {"service_category": label, "order_count": sector_counts.get(label, 0)}
        for label in reversed(_SERVICE_SECTOR_DISPLAY)
    ]
    total_orders = sum(sector_counts.values())
    if total_orders == 0:
        return _empty("No data available yet.")
    top_sector = max(sector_counts.items(), key=lambda x: x[1])[0]
    return _block(
        kpis=[
            {"label": "Total orders logged", "value": total_orders},
            {"label": "Most selected sector", "value": top_sector},
        ],
        chart=chart,
        drilldown=drilldown[:80],
        note=(
            "Most Frequently Selected Customer Services (Historical Volumetric Distribution). "
            "Sectors derived from your booking cargo type, weight, and service type."
        ),
    )


_TRUCK_TYPE_DISPLAY = ("Closed Container (20ft)", "Closed Container (40ft)", "Open Cargo")
_TRUCK_TYPE_CHART_LABELS = {
    "Closed Container (20ft)": "20ft Closed",
    "Closed Container (40ft)": "40ft Closed",
    "Open Cargo": "Open Cargo",
}
_TRUCK_SERVICE_SERIES = ("Cold Chain", "Express Delivery", "Standard Delivery", "Heavy Cargo")
_CONTAINER_40FT_MIN_TONS = 22.0
_CONTAINER_20FT_MIN_TONS = 10.0


def _classify_truck_container_category(booking, trip, truck) -> str:
    """Classify fleet unit into closed 20ft / closed 40ft / open cargo using assigned truck or cargo weight."""
    label = ""
    capacity = 0.0
    if truck is not None:
        label = f"{getattr(truck, 'model_name', '') or ''} {getattr(truck, 'code', '') or ''}".lower()
        capacity = float(getattr(truck, "capacity_tons", 0) or 0)
    if not capacity:
        capacity = float(getattr(booking, "cargo_weight_tons", 0) or 0)
    if any(token in label for token in ("open", "flatbed", "flat bed", "open cargo")):
        return "Open Cargo"
    if capacity >= _CONTAINER_40FT_MIN_TONS:
        return "Closed Container (40ft)"
    if capacity >= _CONTAINER_20FT_MIN_TONS:
        return "Closed Container (20ft)"
    return "Open Cargo"


def _truck_preference_records_block(bookings: list, trips_by_booking: dict) -> dict[str, Any]:
    """Grouped column chart: truck container type × service sector selection counts."""
    matrix: dict[str, dict[str, int]] = {
        truck_type: {sector: 0 for sector in _TRUCK_SERVICE_SERIES} for truck_type in _TRUCK_TYPE_DISPLAY
    }
    drilldown: list[dict[str, Any]] = []
    for b in bookings:
        trip = trips_by_booking.get(b.id)
        truck = getattr(trip, "truck", None) if trip is not None else None
        truck_type = _classify_truck_container_category(b, trip, truck)
        service_sector = _classify_service_sector(b)
        if truck_type not in matrix:
            matrix[truck_type] = {sector: 0 for sector in _TRUCK_SERVICE_SERIES}
        matrix[truck_type][service_sector] = matrix[truck_type].get(service_sector, 0) + 1
        drilldown.append(
            {
                "booking_id": b.id,
                "trip_id": trip.id if trip else None,
                "date": b.created_at.date().isoformat() if b.created_at else "—",
                "truck_type": truck_type,
                "truck_type_full": truck_type,
                "truck_type_chart": _TRUCK_TYPE_CHART_LABELS.get(truck_type, truck_type),
                "service_sector": service_sector,
                "truck_code": getattr(truck, "code", None) if truck else "—",
                "truck_capacity_tons": float(getattr(truck, "capacity_tons", 0) or 0) if truck else None,
                "cargo_weight_tons": float(b.cargo_weight_tons or 0),
                "route": _route_key(b.pickup_location, b.dropoff_location),
            }
        )
    drilldown.sort(key=lambda r: r["date"], reverse=True)
    chart = []
    for truck_type in _TRUCK_TYPE_DISPLAY:
        counts = matrix.get(truck_type, {})
        row: dict[str, Any] = {
            "truck_type": _TRUCK_TYPE_CHART_LABELS.get(truck_type, truck_type),
            "truck_type_full": truck_type,
        }
        for sector in _TRUCK_SERVICE_SERIES:
            row[sector] = counts.get(sector, 0)
        row["total"] = sum(int(row.get(s) or 0) for s in _TRUCK_SERVICE_SERIES)
        chart.append(row)
    total_selections = sum(int(row.get("total") or 0) for row in chart)
    if total_selections == 0:
        return _empty("No data available yet.")
    top_pair = max(
        ((tt, sec, matrix[tt][sec]) for tt in _TRUCK_TYPE_DISPLAY for sec in _TRUCK_SERVICE_SERIES),
        key=lambda x: x[2],
    )
    return _block(
        kpis=[
            {"label": "Selection count", "value": total_selections},
            {"label": "Top pairing", "value": f"{top_pair[0]} · {top_pair[1]}"},
        ],
        chart=chart,
        drilldown=drilldown[:80],
        note=(
            "Truck Type Preferences Segmented by Service Categories. "
            "Container types are inferred from assigned truck capacity (20ft / 40ft / open cargo) "
            "and cross-tabulated with your booking service sectors."
        ),
    )


_BOOKING_FULFILLMENT_SERIES = ("Approved", "Cancelled", "Completed", "Pending")
_BOOKING_CANCELLED_STATUSES = frozenset(
    {
        BookingStatus.CANCELLED,
        BookingStatus.REJECTED,
        BookingStatus.PAYMENT_REJECTED,
        BookingStatus.EXPIRED,
    }
)
_BOOKING_APPROVED_STATUSES = frozenset(
    {
        BookingStatus.APPROVED,
        BookingStatus.ASSIGNED,
        BookingStatus.ACCEPTED,
        BookingStatus.ENROUTE,
        BookingStatus.LOADING,
        BookingStatus.OUT_FOR_DELIVERY,
        BookingStatus.READY_FOR_ASSIGNMENT,
        BookingStatus.PAYMENT_VERIFIED,
    }
)
_BOOKING_PENDING_STATUSES = frozenset(
    {
        BookingStatus.PENDING_PAYMENT,
        BookingStatus.PAYMENT_VERIFICATION,
        BookingStatus.PENDING_APPROVAL,
    }
)


def _format_month_cohort_label(month_key: str) -> str:
    try:
        dt = datetime.strptime(f"{month_key}-01", "%Y-%m-%d")
        return dt.strftime("%b %Y")
    except ValueError:
        return month_key


def _booking_fulfillment_status(booking) -> str:
    raw = booking.status
    try:
        st = raw if isinstance(raw, BookingStatus) else BookingStatus(str(raw))
    except ValueError:
        return "Pending"
    if st in _BOOKING_CANCELLED_STATUSES:
        return "Cancelled"
    if st == BookingStatus.COMPLETED:
        return "Completed"
    if st in _BOOKING_APPROVED_STATUSES:
        return "Approved"
    if st in _BOOKING_PENDING_STATUSES:
        return "Pending"
    return "Pending"


def _booking_records_block(bookings: list) -> dict[str, Any]:
    """Monthly stacked column chart: order status distribution by booking cohort."""
    buckets: dict[str, dict[str, int]] = defaultdict(
        lambda: {label: 0 for label in _BOOKING_FULFILLMENT_SERIES}
    )
    drilldown: list[dict[str, Any]] = []
    for b in bookings:
        created = b.created_at
        month_key = period_key(created, "monthly") if created else None
        if not month_key:
            continue
        fulfillment = _booking_fulfillment_status(b)
        buckets[month_key][fulfillment] = buckets[month_key].get(fulfillment, 0) + 1
        drilldown.append(
            {
                "booking_id": b.id,
                "date": created.date().isoformat() if created else "—",
                "month_cohort": month_key,
                "period": _format_month_cohort_label(month_key),
                "fulfillment_status": fulfillment,
                "booking_status": str(b.status.value if hasattr(b.status, "value") else b.status),
                "route": _route_key(b.pickup_location, b.dropoff_location),
            }
        )
    drilldown.sort(key=lambda r: r["date"], reverse=True)
    if not buckets:
        return _empty("No data available yet.")
    chart: list[dict[str, Any]] = []
    for month_key in sort_period_keys(list(buckets.keys()), "monthly")[-24:]:
        counts = buckets[month_key]
        row: dict[str, Any] = {
            "period": _format_month_cohort_label(month_key),
            "month_cohort": month_key,
        }
        for label in _BOOKING_FULFILLMENT_SERIES:
            row[label] = counts.get(label, 0)
        row["total"] = sum(int(row.get(l) or 0) for l in _BOOKING_FULFILLMENT_SERIES)
        chart.append(row)
    total_orders = sum(int(r.get("total") or 0) for r in chart)
    peak = max(chart, key=lambda r: int(r.get("total") or 0))
    return _block(
        kpis=[
            {"label": "Logged orders", "value": total_orders},
            {"label": "Peak month", "value": f"{peak['period']} ({peak['total']})"},
        ],
        chart=chart,
        drilldown=drilldown[:80],
        note=(
            "Monthly Booking Fulfillment & Order Status Distribution. "
            "Stacked counts by submission month from your real booking workflow statuses."
        ),
    )


def _booking_history_block(bookings: list) -> dict[str, Any]:
    """Month-over-month line chart: total logged booking volume by operational period."""
    buckets: dict[str, int] = defaultdict(int)
    drilldown: list[dict[str, Any]] = []
    for b in bookings:
        created = b.created_at
        month_key = period_key(created, "monthly") if created else None
        if not month_key:
            continue
        buckets[month_key] += 1
        drilldown.append(
            {
                "booking_id": b.id,
                "date": created.date().isoformat() if created else "—",
                "month_cohort": month_key,
                "period": month_key,
                "route": _route_key(b.pickup_location, b.dropoff_location),
                "status": str(b.status.value if hasattr(b.status, "value") else b.status),
            }
        )
    drilldown.sort(key=lambda r: r["date"], reverse=True)
    if not buckets:
        return _empty("No data available yet.")
    chart: list[dict[str, Any]] = []
    for month_key in sort_period_keys(list(buckets.keys()), "monthly")[-30:]:
        chart.append({"period": month_key, "month_cohort": month_key, "count": buckets[month_key]})
    total_bookings = sum(int(r.get("count") or 0) for r in chart)
    peak = max(chart, key=lambda r: int(r.get("count") or 0))
    latest = chart[-1]
    return _block(
        kpis=[
            {"label": "Total bookings logged", "value": total_bookings},
            {"label": "Latest month", "value": f"{latest['period']} ({latest['count']})"},
            {"label": "Peak month", "value": f"{peak['period']} ({peak['count']})"},
        ],
        chart=chart,
        drilldown=drilldown[:80],
        note=(
            "Historical Booking Volume Trend (Month-over-Month). "
            "Tracks total submitted bookings per operational period to spot volume momentum and seasonal shifts."
        ),
    )


_ORDER_CARGO_DISPLAY = (
    "Clothing",
    "Medical Supplies",
    "Construction Materials",
    "Electronics",
    "Food",
    "Furniture",
)
_CARGO_ENUM_TO_ORDER_DISPLAY: dict[str, str] = {
    CargoTypeCategory.TEXTILES.value: "Clothing",
    CargoTypeCategory.PHARMACEUTICALS.value: "Medical Supplies",
    CargoTypeCategory.CONSTRUCTION.value: "Construction Materials",
    CargoTypeCategory.ELECTRONICS.value: "Electronics",
    CargoTypeCategory.FOOD_PERISHABLE.value: "Food",
    CargoTypeCategory.FOOD_NON_PERISHABLE.value: "Food",
    CargoTypeCategory.FURNITURE.value: "Furniture",
}
_CARGO_DESC_HINTS: dict[str, tuple[str, ...]] = {
    "Clothing": ("cloth", "garment", "textile", "apparel", "fabric"),
    "Medical Supplies": ("medical", "medicine", "pharma", "hospital", "surgical"),
    "Construction Materials": ("cement", "steel", "construction", "lumber", "aggregate", "rebar"),
    "Electronics": ("electronic", "appliance", "computer", "laptop", "phone", "gadget"),
    "Food": ("food", "grocery", "perishable", "frozen", "produce", "rice"),
    "Furniture": ("furniture", "fixture", "sofa", "cabinet", "table", "chair"),
}


def _resolve_order_cargo_classification(booking) -> str:
    raw = getattr(booking, "cargo_type_category", None)
    cat = raw.value if hasattr(raw, "value") else str(raw or "").strip().lower()
    if cat in _CARGO_ENUM_TO_ORDER_DISPLAY:
        return _CARGO_ENUM_TO_ORDER_DISPLAY[cat]
    desc = (getattr(booking, "cargo_description", None) or "").strip().lower()
    if desc:
        for label, hints in _CARGO_DESC_HINTS.items():
            if any(token in desc for token in hints):
                return label
    return "Other"


def _order_details_block(bookings: list) -> dict[str, Any]:
    """Horizontal bar chart: volumetric distribution by cargo classification."""
    counts: dict[str, int] = {label: 0 for label in _ORDER_CARGO_DISPLAY}
    other_count = 0
    drilldown: list[dict[str, Any]] = []
    for b in bookings:
        cargo_label = _resolve_order_cargo_classification(b)
        raw = getattr(b, "cargo_type_category", None)
        cargo_cat = raw.value if hasattr(raw, "value") else str(raw or "").strip().lower()
        if cargo_label in counts:
            counts[cargo_label] += 1
        else:
            other_count += 1
        drilldown.append(
            {
                "booking_id": b.id,
                "date": b.created_at.date().isoformat() if b.created_at else "—",
                "cargo_classification": cargo_label,
                "cargo_type_category": cargo_cat or "—",
                "cargo_type_label": cargo_type_category_label(cargo_cat or None),
                "cargo_description": (getattr(b, "cargo_description", None) or "—")[:120],
                "cargo_weight_tons": float(getattr(b, "cargo_weight_tons", 0) or 0),
                "route": _route_key(b.pickup_location, b.dropoff_location),
                "status": str(b.status.value if hasattr(b.status, "value") else b.status),
            }
        )
    drilldown.sort(key=lambda r: r["date"], reverse=True)
    total_bookings = sum(counts.values()) + other_count
    if total_bookings == 0:
        return _empty("No data available yet.")
    chart = [
        {"cargo_classification": label, "booking_count": counts[label]}
        for label in reversed(_ORDER_CARGO_DISPLAY)
    ]
    if other_count > 0:
        chart.insert(0, {"cargo_classification": "Other", "booking_count": other_count})
    top_class = max(
        {**counts, **({"Other": other_count} if other_count else {})}.items(),
        key=lambda item: item[1],
    )[0]
    return _block(
        kpis=[
            {"label": "Total bookings logged", "value": total_bookings},
            {"label": "Top cargo class", "value": top_class},
        ],
        chart=chart,
        drilldown=drilldown[:80],
        note=(
            "Order Details: Volumetric Distribution by Cargo Type. "
            "Absolute booking volume per cargo classification from your declared cargo categories."
        ),
    )


def _customer_bookings(ctx: dict, f: AnalyticsFilters, customer_id: int) -> list:
    rows = []
    for booking in ctx["bookings"]:
        if booking.customer_id != customer_id:
            continue
        trip = _primary_trip(ctx, booking.id)
        if _booking_in_filters(booking, trip, f):
            rows.append(booking)
    return rows


def _customer_delivery_success_rate_over_time(
    shipment_rows: list[dict[str, Any]],
    f: AnalyticsFilters,
    *,
    limit: int = 36,
) -> list[dict[str, Any]]:
    """Aggregate delivered / total customer shipments per selected time bucket."""
    period_total: dict[str, int] = defaultdict(int)
    period_delivered: dict[str, int] = defaultdict(int)
    for row in shipment_rows:
        raw = row.get("date")
        if not raw or raw == "—":
            continue
        try:
            ref = date.fromisoformat(str(raw)[:10])
        except ValueError:
            continue
        bucket = period_key(ref, f.granularity)
        if not bucket:
            continue
        period_total[bucket] += 1
        if str(row.get("status") or "").lower() == "delivered":
            period_delivered[bucket] += 1
    keys = sort_period_keys(list(period_total.keys()), f.granularity)[-limit:]
    chart: list[dict[str, Any]] = []
    for bucket in keys:
        total = period_total[bucket]
        delivered = period_delivered[bucket]
        rate = round(delivered / total, 3) if total > 0 else 0.0
        chart.append(
            period_chart_row(
                bucket,
                delivery_success_rate=rate,
                delivered=delivered,
                total=total,
            )
        )
    return chart


def _delivery_performance_block(shipment_rows: list[dict[str, Any]], f: AnalyticsFilters) -> dict[str, Any]:
    """Descriptive delivery performance: success rate trend by selected time granularity."""
    if not shipment_rows:
        return _empty("No data available yet.")
    chart = _customer_delivery_success_rate_over_time(shipment_rows, f)
    if not chart:
        return _empty("Insufficient data for the selected time bucket.")
    total = len(shipment_rows)
    delivered = sum(1 for row in shipment_rows if str(row.get("status") or "").lower() == "delivered")
    overall_pct = round((delivered / total) * 100, 1) if total > 0 else 0.0
    latest = chart[-1]
    avg_rate = round(sum(float(row["delivery_success_rate"]) for row in chart) / len(chart), 3)
    gran = f.granularity.replace("_", " ")
    return _block(
        kpis=[
            {"label": "Overall success rate", "value": f"{overall_pct:.1f}%"},
            {"label": f"Latest period ({latest['period']})", "value": f"{latest['delivery_success_rate'] * 100:.1f}%"},
            {"label": "Average rate (periods shown)", "value": f"{avg_rate * 100:.1f}%"},
        ],
        chart=chart,
        drilldown=shipment_rows[:80],
        note=(
            "Delivery Success Rate Over Time. Raw shipment outcomes are aggregated into the selected "
            f"({gran}) time bucket so the chart reflects daily, weekly, monthly, quarterly, or yearly performance views."
        ),
    )


def build_customer_role_analytics(
    db: Session,
    f: AnalyticsFilters,
    *,
    customer: User,
) -> dict[str, Any]:
    ctx = _load_customer_context(db, customer.id)
    bookings = _customer_bookings(ctx, f, customer.id)
    booking_ids = {b.id for b in bookings}
    trips_by_booking = {bid: _primary_trip(ctx, bid) for bid in booking_ids}

    verified_payments = [
        p for p in ctx["payments"] if p.customer_id == customer.id and p.booking_id in booking_ids and p.status == PaymentStatus.VERIFIED
    ]
    all_payments = [p for p in ctx["payments"] if p.customer_id == customer.id and p.booking_id in booking_ids]

    # 1) Account Management
    activity_times: list[datetime] = []
    account_rows = []
    for b in bookings:
        trip = trips_by_booking.get(b.id)
        created = b.created_at
        if created:
            activity_times.append(created)
        account_rows.append(
            {
                "booking_id": b.id,
                "trip_id": trip.id if trip else None,
                "date": created.date().isoformat() if created else "—",
                "day_of_week": _WEEKDAYS[created.weekday()] if created else "—",
                "hour": created.hour if created else None,
                "route": _route_key(b.pickup_location, b.dropoff_location),
                "status": str(b.status.value if hasattr(b.status, "value") else b.status),
                "source": "booking",
            }
        )
    account_rows.sort(key=lambda r: r["date"], reverse=True)

    payment_rows = []
    for p in sorted(all_payments, key=lambda x: x.created_at or datetime.min, reverse=True):
        paid_ts = p.paid_at or p.created_at
        if paid_ts:
            activity_times.append(paid_ts)
        payment_rows.append(
            {
                "payment_id": p.id,
                "booking_id": p.booking_id,
                "date": paid_ts.date().isoformat() if paid_ts else "—",
                "day_of_week": _WEEKDAYS[paid_ts.weekday()] if paid_ts else "—",
                "hour": paid_ts.hour if paid_ts else None,
                "amount_php": round(float(p.amount or 0), 2),
                "status": str(p.status.value if hasattr(p.status, "value") else p.status),
                "reference": p.reference or "—",
                "source": "payment",
            }
        )

    activity_drilldown = sorted(account_rows + payment_rows, key=lambda r: r["date"], reverse=True)[:50]
    activity_heatmap = _activity_heatmap_chart(activity_times)
    account_desc_activity = (
        _empty("No data available yet.")
        if not activity_drilldown
        else _block(
            kpis=[
                {"label": "Total bookings", "value": len(account_rows)},
                {"label": "Completed", "value": sum(1 for b in bookings if str(b.status.value if hasattr(b.status, "value") else b.status) == BookingStatus.COMPLETED.value)},
            ],
            chart=activity_heatmap,
            drilldown=activity_drilldown,
            note="Account Activity Logs Density (Day of Week vs. Hour of Day). Darker cells indicate higher interaction frequency.",
        )
    )

    account_desc_payments = (
        _empty("No data available yet.")
        if not payment_rows
        else _block(
            kpis=[
                {"label": "Payment records", "value": len(payment_rows)},
                {"label": "Verified", "value": sum(1 for p in payment_rows if p["status"] == PaymentStatus.VERIFIED.value)},
            ],
            chart=[],
            drilldown=payment_rows[:50],
        )
    )

    saved_sites = db.query(CustomerSavedSite).filter(CustomerSavedSite.customer_id == customer.id).all()
    profile_field_rows = _profile_records_field_rows(
        customer=customer,
        bookings=bookings,
        saved_sites=saved_sites,
    )
    profile_status_chart = _profile_updated_status_chart(profile_field_rows)
    profile_yes = sum(1 for row in profile_field_rows if row["profile_updated"] == "Yes")
    account_desc_profile = (
        _empty("No data available yet.")
        if not profile_field_rows
        else _block(
            kpis=[
                {"label": "Profile fields tracked", "value": len(profile_field_rows)},
                {"label": "Updated fields", "value": profile_yes},
            ],
            chart=profile_status_chart,
            drilldown=profile_field_rows,
            note=(
                "Profile Records Summary (Profile Updated Status Distribution). "
                "Yes = modified or completed profile fields; No = unmodified defaults."
            ),
        )
    )
    login_chart, login_drilldown = _collect_customer_login_activity(
        customer=customer,
        bookings=bookings,
        all_payments=all_payments,
        saved_sites=saved_sites,
    )
    account_desc_login_history = (
        _empty("No data available yet.")
        if not login_drilldown
        else _block(
            kpis=[
                {"label": "Logged activities", "value": len(login_drilldown)},
                {"label": "Quarters tracked", "value": len(login_chart)},
            ],
            chart=login_chart,
            drilldown=login_drilldown,
            note=(
                "Historical Activity Logs & Login Trends by Quarter. "
                "Stacked counts from real account actions: registration and booking/payment submissions (Login), "
                "closed bookings (Logout), password-reset or payment-rejection recovery (Password Reset), "
                "and profile or document updates (Profile Update)."
            ),
        )
    )

    monthly_bookings: dict[str, int] = defaultdict(int)
    for b in bookings:
        d = _activity_date(b.created_at)
        if d:
            monthly_bookings[d.strftime("%Y-%m")] += 1
    booking_series = _monthly_series([(m, float(c)) for m, c in sorted(monthly_bookings.items())], min_points=2)
    booking_forecast = _forecast_series(booking_series, 3) if booking_series is not None else None
    account_pred_activity = (
        _empty_predict()
        if not booking_forecast
        else _block(
            kpis=[{"label": "Next period bookings (est.)", "value": booking_forecast[0]["value"]}],
            chart=_combine_forecast_chart(
                [(m, float(c)) for m, c in sorted(monthly_bookings.items())],
                booking_forecast,
                actual_key="actual_bookings",
                forecast_key="forecast_bookings",
            ),
            drilldown=account_rows[:20],
        )
    )

    payment_rate = round((len(verified_payments) / len(all_payments)) * 100, 1) if all_payments else None
    account_pred_payment = (
        _empty_predict()
        if payment_rate is None
        else _block(
            kpis=[{"label": "Verified payment rate %", "value": payment_rate}],
            chart=[],
            drilldown=payment_rows[:30],
            note="Estimated from your historical payment verification outcomes.",
        )
    )

    # 2) Service Selection
    route_counts: dict[str, int] = defaultdict(int)
    estimate_rows = []
    for b in bookings:
        rk = _route_key(b.pickup_location, b.dropoff_location)
        route_counts[rk] += 1
        estimate_rows.append(
            {
                "booking_id": b.id,
                "route": rk,
                "date": b.created_at.date().isoformat() if b.created_at else "—",
                "estimated_cost_php": round(float(b.estimated_cost or 0), 2),
                "status": str(b.status.value if hasattr(b.status, "value") else b.status),
            }
        )
    route_rows = [{"route": r, "count": c} for r, c in sorted(route_counts.items(), key=lambda x: -x[1])]
    service_desc_preferences = (
        _empty("No data available yet.")
        if not route_rows
        else _block(
            kpis=[{"label": "Routes used", "value": len(route_rows)}],
            chart=route_rows[:12],
            drilldown=estimate_rows[:50],
        )
    )
    service_desc_selection_history = _service_selection_history_block(bookings)
    service_desc_estimates = (
        _empty("No data available yet.")
        if not estimate_rows
        else _block(
            kpis=[
                {"label": "Cost estimate records", "value": len(estimate_rows)},
                {"label": "Avg estimate (₱)", "value": round(sum(float(r["estimated_cost_php"]) for r in estimate_rows) / len(estimate_rows), 2)},
            ],
            chart=estimate_rows[:12],
            drilldown=estimate_rows[:50],
        )
    )
    service_desc_truck_pref = _truck_preference_records_block(bookings, trips_by_booking)
    service_desc_routes = service_desc_preferences

    service_pred_route = (
        _empty_predict()
        if not route_rows
        else _block(
            kpis=[{"label": "Likely next route", "value": route_rows[0]["route"]}],
            chart=route_rows[:12],
            drilldown=estimate_rows[:30],
            note="Most frequently booked route in your history.",
        )
    )
    service_pred_budget = (
        _empty_predict()
        if len(estimate_rows) < 2
        else _block(
            kpis=[
                {"label": "Latest estimate (₱)", "value": estimate_rows[0]["estimated_cost_php"]},
                {"label": "Typical estimate (₱)", "value": round(sum(float(r["estimated_cost_php"]) for r in estimate_rows) / len(estimate_rows), 2)},
            ],
            chart=estimate_rows[:12],
            drilldown=estimate_rows[:30],
            note="Historical estimate trend for planning future bookings.",
        )
    )

    # 3) Booking Management
    status_counts: dict[str, int] = defaultdict(int)
    booking_rows = []
    cancelled_rows = []
    for b in bookings:
        trip = trips_by_booking.get(b.id)
        label = _shipment_category(b, trip, ctx["delay_logs"])
        status_counts[label] += 1
        row = {
            "booking_id": b.id,
            "trip_id": trip.id if trip else None,
            "date": b.created_at.date().isoformat() if b.created_at else "—",
            "route": _route_key(b.pickup_location, b.dropoff_location),
            "status": label,
        }
        booking_rows.append(row)
        if label == "cancelled":
            cancelled_rows.append(row)
    booking_rows.sort(key=lambda r: r["date"], reverse=True)
    booking_desc_status = (
        _empty("No data available yet.")
        if not booking_rows
        else _block(
            kpis=[{"label": "Bookings tracked", "value": len(booking_rows)}],
            chart=[{"status": k, "count": v} for k, v in sorted(status_counts.items(), key=lambda x: -x[1])],
            drilldown=booking_rows[:50],
        )
    )
    booking_desc_records = _booking_records_block(bookings)
    booking_desc_history = _booking_history_block(bookings)
    booking_desc_order_details = _order_details_block(bookings)
    booking_desc_payments = account_desc_payments
    booking_desc_cancellations = (
        _empty("No data available yet.")
        if not cancelled_rows
        else _block(
            kpis=[{"label": "Cancelled bookings", "value": len(cancelled_rows)}],
            chart=[],
            drilldown=cancelled_rows[:50],
        )
    )

    completion_rate = round((status_counts.get("delivered", 0) / len(booking_rows)) * 100, 1) if booking_rows else None
    booking_pred_completion = (
        _empty_predict()
        if completion_rate is None
        else _block(
            kpis=[{"label": "Historical completion rate %", "value": completion_rate}],
            chart=[{"status": "delivered", "count": status_counts.get("delivered", 0)}, {"status": "others", "count": len(booking_rows) - status_counts.get("delivered", 0)}],
            drilldown=booking_rows[:30],
        )
    )
    cancellation_rate = round((len(cancelled_rows) / len(booking_rows)) * 100, 1) if booking_rows else None
    booking_pred_cancellation = (
        _empty_predict()
        if cancellation_rate is None
        else _block(
            kpis=[{"label": "Historical cancellation rate %", "value": cancellation_rate}],
            chart=[],
            drilldown=cancelled_rows[:30] if cancelled_rows else booking_rows[:10],
        )
    )

    # 4) Shipment Tracking
    shipment_rows = []
    delivery_hours: list[float] = []
    for b in bookings:
        trip = trips_by_booking.get(b.id)
        label = _shipment_category(b, trip, ctx["delay_logs"])
        hours = None
        if trip and trip.departure_time and trip.completed_at:
            hours = max(0.0, (trip.completed_at - trip.departure_time).total_seconds() / 3600)
            delivery_hours.append(hours)
        shipment_rows.append(
            {
                "booking_id": b.id,
                "trip_id": trip.id if trip else None,
                "route": _route_key(b.pickup_location, b.dropoff_location),
                "date": b.scheduled_date.isoformat() if b.scheduled_date else "—",
                "delivery_hours": round(hours, 2) if hours is not None else None,
                "status": label,
                "delay_reason": (ctx["delay_logs"].get(trip.id) if trip else None) or "—",
            }
        )
    shipment_rows.sort(key=lambda r: r["date"], reverse=True)
    track_desc_timeline = (
        _empty("No data available yet.")
        if not shipment_rows
        else _block(
            kpis=[{"label": "Tracked shipments", "value": len(shipment_rows)}],
            chart=[{"status": k, "count": v} for k, v in sorted(status_counts.items(), key=lambda x: -x[1])],
            drilldown=shipment_rows[:50],
        )
    )
    track_desc_performance = _delivery_performance_block(shipment_rows, f)
    track_desc_updates = (
        _empty("No data available yet.")
        if not shipment_rows
        else _block(
            kpis=[{"label": "Status updates", "value": len(shipment_rows)}],
            chart=[],
            drilldown=shipment_rows[:50],
        )
    )
    track_desc_payment_records = account_desc_payments
    track_desc_transaction_history = (
        _empty("No data available yet.")
        if not payment_rows
        else _block(
            kpis=[{"label": "Transactions", "value": len(payment_rows)}],
            chart=[],
            drilldown=payment_rows[:50],
        )
    )
    track_desc_receipts = _receipts_settlement_block(payment_rows)

    delay_rows = [r for r in shipment_rows if r["status"] == "delayed"]
    track_pred_delay = (
        _empty_predict()
        if not shipment_rows
        else _block(
            kpis=[{"label": "Historical delay rate %", "value": round((len(delay_rows) / len(shipment_rows)) * 100, 1)}],
            chart=[{"status": "delayed", "count": len(delay_rows)}, {"status": "non_delayed", "count": len(shipment_rows) - len(delay_rows)}],
            drilldown=delay_rows[:30] if delay_rows else shipment_rows[:10],
        )
    )
    track_pred_eta = (
        _empty_predict()
        if len(delivery_hours) < 2
        else _block(
            kpis=[{"label": "Expected delivery hours", "value": round(sum(delivery_hours) / len(delivery_hours), 2)}],
            chart=[{"sample": i + 1, "hours": round(v, 2)} for i, v in enumerate(delivery_hours[:12])],
            drilldown=shipment_rows[:30],
            note="Estimate from historical completed-trip durations.",
        )
    )

    return {
        "account_management": {
            "descriptive": {
                "account_activity": account_desc_activity,
                "payment_profile": account_desc_payments,
                "profile_summary": account_desc_profile,
                "account_activity_logs": account_desc_activity,
                "login_history": account_desc_login_history,
                "profile_records": account_desc_profile,
            },
            "predictive": {
                "booking_activity_forecast": account_pred_activity,
                "payment_success_trend": account_pred_payment,
            },
        },
        "service_selection": {
            "descriptive": {
                "service_preferences": service_desc_preferences,
                "cost_estimate_history": service_desc_estimates,
                "route_interest": service_desc_routes,
                "service_selection_history": service_desc_selection_history,
                "truck_preference_records": service_desc_truck_pref,
            },
            "predictive": {
                "service_recommendation": service_pred_route,
                "budget_projection": service_pred_budget,
            },
        },
        "booking_management": {
            "descriptive": {
                "booking_status_overview": booking_desc_status,
                "payment_history": booking_desc_payments,
                "cancellation_records": booking_desc_cancellations,
                "booking_records": booking_desc_records,
                "booking_history": booking_desc_history,
                "order_details": booking_desc_order_details,
            },
            "predictive": {
                "booking_completion_forecast": booking_pred_completion,
                "cancellation_risk": booking_pred_cancellation,
            },
        },
        "shipment_tracking": {
            "descriptive": {
                "shipment_status_timeline": track_desc_timeline,
                "delivery_performance": track_desc_performance,
                "tracking_updates": track_desc_updates,
                "payment_records": track_desc_payment_records,
                "transaction_history": track_desc_transaction_history,
                "receipts": track_desc_receipts,
            },
            "predictive": {
                "delay_likelihood": track_pred_delay,
                "eta_projection": track_pred_eta,
            },
        },
    }
