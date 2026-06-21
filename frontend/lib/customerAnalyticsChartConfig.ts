import type { AnalyticsChartKind } from "@/lib/analyticsChartConfig";
import type { InferredChartMeta } from "@/lib/chartDrilldownUtils";

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

export function buildBookingHistoryChart(
  chart: Record<string, unknown>[],
  drilldown: Record<string, unknown>[],
): Record<string, unknown>[] {
  const fromChart = chart.filter(isBookingHistoryChartRow);
  if (fromChart.length) return fromChart;

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

export function normalizeCustomerFeatureChart(
  featureKey: string,
  chart: Record<string, unknown>[],
  drilldown: Record<string, unknown>[],
): Record<string, unknown>[] {
  if (featureKey === "booking_history") {
    return buildBookingHistoryChart(chart, drilldown);
  }
  if (featureKey === "account_activity_logs") {
    return chart.filter(isHeatmapChartRow);
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
  return null;
}

export function customerFeatureNote(featureKey: string, blockNote?: string | null): string | undefined {
  if (featureKey === "booking_history") {
    return (
      "Historical Booking Volume Trend (Month-over-Month). " +
      "Tracks total submitted bookings per operational period to spot volume momentum and seasonal shifts."
    );
  }
  if (featureKey === "delivery_performance") {
    return (
      "Delivery Success Rate Over Time. Raw shipment outcomes are aggregated into the selected " +
      "time bucket (daily, weekly, monthly, quarterly, or yearly) to show period-over-period delivery performance."
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
