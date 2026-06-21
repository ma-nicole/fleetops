import type { AnalyticsChartKind } from "@/lib/analyticsChartConfig";
import type { InferredChartMeta } from "@/lib/chartDrilldownUtils";

const TRUCK_PREFERENCE_SERIES = ["Cold Chain", "Express Delivery", "Standard Delivery", "Heavy Cargo"] as const;
const BOOKING_FULFILLMENT_SERIES = ["Approved", "Cancelled", "Completed", "Pending"] as const;
const TRUCK_TYPE_ORDER = ["Closed Container (20ft)", "Closed Container (40ft)", "Open Cargo"] as const;
const TRUCK_TYPE_CHART_LABELS: Record<string, string> = {
  "Closed Container (20ft)": "20ft Closed",
  "Closed Container (40ft)": "40ft Closed",
  "Open Cargo": "Open Cargo",
};

function isTruckPreferenceChartRow(row: Record<string, unknown>): boolean {
  return (
    row.truck_type != null &&
    TRUCK_PREFERENCE_SERIES.some((sector) => row[sector] != null)
  );
}

export function buildTruckPreferenceChart(
  chart: Record<string, unknown>[],
  drilldown: Record<string, unknown>[],
): Record<string, unknown>[] {
  const fromChart = chart.filter(isTruckPreferenceChartRow);
  if (fromChart.length) return fromChart;

  if (!drilldown.length) return chart;

  const matrix: Record<string, Record<string, number>> = {};
  for (const truckType of TRUCK_TYPE_ORDER) {
    matrix[truckType] = Object.fromEntries(TRUCK_PREFERENCE_SERIES.map((sector) => [sector, 0]));
  }

  for (const row of drilldown) {
    const truckType = String(row.truck_type_full ?? row.truck_type ?? "").trim();
    const sector = String(row.service_sector ?? "").trim();
    if (!truckType || !TRUCK_PREFERENCE_SERIES.includes(sector as (typeof TRUCK_PREFERENCE_SERIES)[number])) {
      continue;
    }
    if (!matrix[truckType]) {
      matrix[truckType] = Object.fromEntries(TRUCK_PREFERENCE_SERIES.map((s) => [s, 0]));
    }
    matrix[truckType][sector] = (matrix[truckType][sector] ?? 0) + 1;
  }

  return TRUCK_TYPE_ORDER.map((truckType) => {
    const counts = matrix[truckType] ?? {};
    const next: Record<string, unknown> = {
      truck_type: TRUCK_TYPE_CHART_LABELS[truckType] ?? truckType,
      truck_type_full: truckType,
    };
    for (const sector of TRUCK_PREFERENCE_SERIES) {
      next[sector] = counts[sector] ?? 0;
    }
    next.total = TRUCK_PREFERENCE_SERIES.reduce((sum, sector) => sum + Number(next[sector] ?? 0), 0);
    return next;
  });
}

export const CUSTOMER_FEATURE_CHART_KINDS: Record<string, AnalyticsChartKind> = {
  account_activity_logs: "heatmap",
  login_history: "stackedBar",
  profile_records: "pie",
  service_selection_history: "horizontalBar",
  truck_preference_records: "groupedBar",
  booking_records: "stackedBar",
  booking_history: "line",
  order_details: "horizontalBar",
  receipts: "pie",
  delivery_performance: "line",
};

function isHeatmapChartRow(row: Record<string, unknown>): boolean {
  return row.day != null && row.hour != null && row.count != null;
}

function isBookingHistoryChartRow(row: Record<string, unknown>): boolean {
  return row.period != null && row.count != null && !isHeatmapChartRow(row);
}

function isBookingRecordsChartRow(row: Record<string, unknown>): boolean {
  return (
    row.period != null &&
    BOOKING_FULFILLMENT_SERIES.some((status) => row[status] != null)
  );
}

function bookingHistoryFromDrilldown(drilldown: Record<string, unknown>[]): Record<string, unknown>[] {
  const buckets: Record<string, number> = {};
  for (const row of drilldown) {
    const month = String(row.month_cohort ?? row.period ?? row.date ?? "").slice(0, 7);
    if (month.length < 7) continue;
    buckets[month] = (buckets[month] ?? 0) + 1;
  }
  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, count]) => ({ period, month_cohort: period, count }));
}

function bookingRecordsFromDrilldown(drilldown: Record<string, unknown>[]): Record<string, unknown>[] {
  const buckets: Record<string, Record<string, number>> = {};
  for (const row of drilldown) {
    const month = String(row.month_cohort ?? row.period ?? row.date ?? "").slice(0, 7);
    if (month.length < 7) continue;
    const status = String(row.fulfillment_status ?? row.status ?? "Pending");
    const series = BOOKING_FULFILLMENT_SERIES.includes(status as (typeof BOOKING_FULFILLMENT_SERIES)[number])
      ? status
      : "Pending";
    buckets[month] ??= Object.fromEntries(BOOKING_FULFILLMENT_SERIES.map((key) => [key, 0]));
    buckets[month][series] = (buckets[month][series] ?? 0) + 1;
  }
  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, counts]) => {
      const next: Record<string, unknown> = { period, month_cohort: period };
      for (const status of BOOKING_FULFILLMENT_SERIES) {
        next[status] = counts[status] ?? 0;
      }
      next.total = BOOKING_FULFILLMENT_SERIES.reduce((sum, status) => sum + Number(next[status] ?? 0), 0);
      return next;
    });
}

export function buildBookingHistoryChart(
  chart: Record<string, unknown>[],
  drilldown: Record<string, unknown>[],
): Record<string, unknown>[] {
  const fromChart = chart.filter(isBookingHistoryChartRow);
  const fromDrilldown = bookingHistoryFromDrilldown(drilldown);
  if (fromDrilldown.length >= fromChart.length && fromDrilldown.length) return fromDrilldown;
  if (fromChart.length) return fromChart;
  return fromDrilldown;
}

export function buildBookingRecordsChart(
  chart: Record<string, unknown>[],
  drilldown: Record<string, unknown>[],
): Record<string, unknown>[] {
  const fromChart = chart.filter(isBookingRecordsChartRow);
  const fromDrilldown = bookingRecordsFromDrilldown(drilldown);
  if (fromDrilldown.length >= fromChart.length && fromDrilldown.length) return fromDrilldown;
  if (fromChart.length) return fromChart;
  return fromDrilldown;
}

export function normalizeCustomerFeatureChart(
  featureKey: string,
  chart: Record<string, unknown>[],
  drilldown: Record<string, unknown>[],
): Record<string, unknown>[] {
  if (featureKey === "booking_history") {
    return buildBookingHistoryChart(chart, drilldown);
  }
  if (featureKey === "booking_records") {
    return buildBookingRecordsChart(chart, drilldown);
  }
  if (featureKey === "account_activity_logs") {
    return chart.filter(isHeatmapChartRow);
  }
  if (featureKey === "login_history") {
    return chart.filter(
      (row) =>
        row.period != null &&
        (row.login != null ||
          row.logout != null ||
          row.password_reset != null ||
          row.profile_update != null),
    );
  }
  if (featureKey === "truck_preference_records") {
    return buildTruckPreferenceChart(chart, drilldown);
  }
  return chart;
}

export function customerResolveChartMeta(
  featureKey: string,
  chart: Record<string, unknown>[],
): InferredChartMeta | null {
  if (featureKey === "booking_history" && chart.length) {
    return {
      kind: "line",
      labelKey: "period",
      valueKey: "count",
      xKey: "period",
      yKey: "count",
      fieldKeys: ["period", "month_cohort"],
      monthFromX: true,
    };
  }
  if (featureKey === "booking_records" && chart.some(isBookingRecordsChartRow)) {
    return {
      kind: "stackedBar",
      labelKey: "period",
      valueKey: "Approved",
      xKey: "period",
      yKey: "Approved",
      seriesKeys: [...BOOKING_FULFILLMENT_SERIES],
      fieldKeys: ["period", "month_cohort", "fulfillment_status"],
      monthFromX: true,
    };
  }
  if (featureKey === "account_activity_logs" && chart.some(isHeatmapChartRow)) {
    return {
      kind: "heatmap",
      labelKey: "day",
      valueKey: "count",
      xKey: "hour",
      yKey: "day",
      fieldKeys: ["day_of_week", "hour"],
    };
  }
  if (
    featureKey === "login_history" &&
    chart.some(
      (row) =>
        row.login != null ||
        row.logout != null ||
        row.password_reset != null ||
        row.profile_update != null,
    )
  ) {
    return {
      kind: "stackedBar",
      labelKey: "period",
      valueKey: "login",
      xKey: "period",
      yKey: "login",
      seriesKeys: ["login", "logout", "password_reset", "profile_update"],
      fieldKeys: ["period", "activity_type", "date", "timestamp"],
      monthFromX: true,
    };
  }
  if (
    featureKey === "delivery_performance" &&
    chart.some((row) => row.period != null && row.delivery_success_rate != null)
  ) {
    return {
      kind: "line",
      labelKey: "period",
      valueKey: "delivery_success_rate",
      xKey: "period",
      yKey: "delivery_success_rate",
      seriesKeys: ["delivery_success_rate"],
      fieldKeys: ["period", "status", "date"],
      monthFromX: true,
    };
  }
  if (featureKey === "truck_preference_records" && chart.some(isTruckPreferenceChartRow)) {
    return {
      kind: "groupedBar",
      labelKey: "truck_type",
      valueKey: "Cold Chain",
      xKey: "truck_type",
      yKey: "Cold Chain",
      seriesKeys: [...TRUCK_PREFERENCE_SERIES],
      fieldKeys: ["truck_type", "truck_type_full", "service_sector"],
    };
  }
  return null;
}

export function customerFeatureNote(featureKey: string, blockNote?: string | null): string | undefined {
  if (featureKey === "booking_history") {
    return (
      "Historical Booking Volume Trend (Month-over-Month). " +
      "Tracks total submitted bookings per operational period to spot volume momentum and seasonal shifts."
    );
  }
  if (featureKey === "booking_records") {
    return (
      "Monthly Booking Fulfillment & Order Status Distribution. " +
      "Stacked counts by submission month from your real booking workflow statuses."
    );
  }
  if (featureKey === "delivery_performance") {
    return (
      "Delivery Success Rate Over Time. Raw shipment outcomes are aggregated into the selected " +
      "time bucket (daily, weekly, monthly, quarterly, or yearly) to show period-over-period delivery performance."
    );
  }
  if (featureKey === "login_history") {
    return (
      "Historical Activity Logs & Login Trends. Stacked counts from real account actions: Login, Logout, " +
      "Password Reset, and Profile Update. Use the time rollup to view by year, quarter, month, week, or day."
    );
  }
  return blockNote ?? undefined;
}

export function customerPreferredChartKind(featureKey: string): AnalyticsChartKind | undefined {
  return CUSTOMER_FEATURE_CHART_KINDS[featureKey];
}

export function customerChartUnit(featureKey: string): string | undefined {
  const units: Record<string, string> = {
    account_activity_logs: "events",
    login_history: "logged activities",
    profile_records: "fields",
    service_selection_history: "orders",
    truck_preference_records: "selections",
    booking_records: "logged orders",
    booking_history: "Total Bookings Logged",
    order_details: "Total Bookings Logged",
    receipts: "invoices",
    delivery_performance: "Delivery Success Rate",
  };
  return units[featureKey];
}
