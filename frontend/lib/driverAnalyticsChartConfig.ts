import type { AnalyticsChartKind } from "@/lib/analyticsChartConfig";
import type { InferredChartMeta } from "@/lib/chartDrilldownUtils";

export const DRIVER_FEATURE_CHART_KINDS: Record<string, AnalyticsChartKind> = {
  trip_logs: "horizontalBar",
  completed_deliveries: "horizontalBar",
  travel_time_reports: "line",
  fuel_usage_prediction: "scatter",
  travel_time_estimation: "scatter",
  route_history: "horizontalBar",
  distance_records: "horizontalBar",
  past_delivery_routes: "horizontalBar",
  optimal_route_prediction: "horizontalBar",
  vehicle_usage_logs: "horizontalBar",
  maintenance_records: "horizontalBar",
  maintenance_need_prediction: "bar",
  breakdown_risk_prediction: "horizontalBar",
  delay_records: "horizontalBar",
  delivery_confirmation_logs: "line",
  shipment_records: "horizontalBar",
  trip_progress_updates: "bar",
  completion_time_prediction: "line",
  delay_likelihood_prediction: "line",
};

export function driverPreferredChartKind(featureKey: string): AnalyticsChartKind | undefined {
  return DRIVER_FEATURE_CHART_KINDS[featureKey];
}

export function driverChartUnit(featureKey: string): string | undefined {
  const units: Record<string, string> = {
    trip_logs: "trips",
    completed_deliveries: "deliveries",
    route_history: "trips",
    distance_records: "km",
    vehicle_usage_logs: "trips",
    maintenance_records: "reports",
    travel_time_reports: "hours",
    delivery_confirmation_logs: "deliveries",
    completion_time_prediction: "hours",
    fuel_usage_prediction: "liters",
    travel_time_estimation: "minutes",
    delay_records: "delays",
    trip_progress_updates: "trips",
    delay_likelihood_prediction: "%",
  };
  return units[featureKey];
}

function resolveDriverTripChartMeta(chart: Record<string, unknown>[]): InferredChartMeta | null {
  if (!chart.length) return null;
  if (chart.some((row) => row.trip_status != null && row.trip_count != null)) {
    return {
      kind: "horizontalBar",
      labelKey: "trip_status",
      valueKey: "trip_count",
      xKey: "trip_status",
      yKey: "trip_count",
      fieldKeys: ["trip_status", "trip_id", "route", "delivery_date", "status", "truck"],
    };
  }
  if (chart.some((row) => row.period != null && row.trip_count != null)) {
    return {
      kind: "horizontalBar",
      labelKey: "period",
      valueKey: "trip_count",
      xKey: "period",
      yKey: "trip_count",
      fieldKeys: ["period", "trip_id", "route", "delivery_date", "trip_status", "truck"],
      monthFromX: true,
    };
  }
  if (chart.some((row) => row.route != null && row.trip_count != null)) {
    return {
      kind: "horizontalBar",
      labelKey: "route",
      valueKey: "trip_count",
      xKey: "route",
      yKey: "trip_count",
      fieldKeys: ["route", "trip_id", "delivery_date", "trip_status", "truck"],
    };
  }
  return null;
}

export function driverResolveChartMeta(
  featureKey: string,
  chart: Record<string, unknown>[],
): InferredChartMeta | null {
  if (featureKey === "trip_logs" || featureKey === "completed_deliveries") {
    return resolveDriverTripChartMeta(chart);
  }
  if (
    featureKey === "travel_time_reports" &&
    chart.some((row) => row.avg_travel_hours != null && (row.period != null || row.month != null))
  ) {
    const periodKey = chart.some((row) => row.period != null) ? "period" : "month";
    return {
      kind: "line",
      labelKey: periodKey,
      valueKey: "avg_travel_hours",
      xKey: periodKey,
      yKey: "avg_travel_hours",
      fieldKeys: ["period", "month", "delivery_date", "travel_time_hours", "route", "trip_id"],
      monthFromX: true,
    };
  }
  if (
    featureKey === "delivery_confirmation_logs" &&
    chart.some((row) => row.confirmed_delivery_count != null && row.period != null)
  ) {
    return {
      kind: "line",
      labelKey: "period",
      valueKey: "confirmed_delivery_count",
      xKey: "period",
      yKey: "confirmed_delivery_count",
      fieldKeys: ["period", "delivery_date", "route", "trip_id", "pod_confirmed", "truck"],
      monthFromX: true,
    };
  }
  if (
    featureKey === "completion_time_prediction" &&
    chart.some(
      (row) =>
        row.period != null &&
        (row.actual_completion_hours != null || row.predicted_completion_hours != null),
    )
  ) {
    return {
      kind: "line",
      labelKey: "period",
      valueKey: "actual_completion_hours",
      xKey: "period",
      yKey: "actual_completion_hours",
      seriesKeys: ["actual_completion_hours", "predicted_completion_hours"],
      fieldKeys: ["period", "delivery_date", "travel_time_hours", "route", "trip_id"],
      monthFromX: true,
    };
  }
  if (
    featureKey === "fuel_usage_prediction" &&
    chart.some((row) => row.distance_km != null && (row.fuel_liters != null || row.predicted_fuel_liters != null))
  ) {
    return {
      kind: "scatter",
      labelKey: "distance_km",
      valueKey: "fuel_liters",
      xKey: "distance_km",
      yKey: "fuel_liters",
      secondarySeriesKey: "predicted_fuel_liters",
      fieldKeys: ["distance_km", "fuel_liters", "trip_id", "route", "delivery_date", "fuel_usage_liters"],
    };
  }
  if (
    featureKey === "travel_time_estimation" &&
    chart.some(
      (row) => row.distance_km != null && (row.travel_duration_minutes != null || row.predicted_travel_minutes != null),
    )
  ) {
    return {
      kind: "scatter",
      labelKey: "distance_km",
      valueKey: "travel_duration_minutes",
      xKey: "distance_km",
      yKey: "travel_duration_minutes",
      secondarySeriesKey: "predicted_travel_minutes",
      fieldKeys: ["distance_km", "travel_duration_minutes", "trip_id", "route", "delivery_date", "travel_time_hours"],
    };
  }
  if (
    featureKey === "delay_likelihood_prediction" &&
    chart.some(
      (row) =>
        row.period != null &&
        (row.actual_delay_rate_pct != null || row.forecast_delay_rate_pct != null),
    )
  ) {
    return {
      kind: "line",
      labelKey: "period",
      valueKey: "actual_delay_rate_pct",
      xKey: "period",
      yKey: "actual_delay_rate_pct",
      seriesKeys: ["actual_delay_rate_pct", "forecast_delay_rate_pct"],
      fieldKeys: ["period", "delivery_date", "route", "trip_id", "truck", "delay_signal"],
      monthFromX: true,
    };
  }
  if (
    featureKey === "delay_likelihood_prediction" &&
    chart.some((row) => row.trip_outcome != null && row.trip_count != null)
  ) {
    return {
      kind: "bar",
      labelKey: "trip_outcome",
      valueKey: "trip_count",
      xKey: "trip_outcome",
      yKey: "trip_count",
      fieldKeys: ["trip_outcome", "delay_signal", "route", "trip_id", "delivery_date", "truck"],
    };
  }
  if (
    featureKey === "trip_progress_updates" &&
    chart.some((row) => row.trip_status != null && row.trip_count != null)
  ) {
    return {
      kind: "bar",
      labelKey: "trip_status",
      valueKey: "trip_count",
      xKey: "trip_status",
      yKey: "trip_count",
      fieldKeys: ["trip_status", "status", "route", "trip_id", "delivery_date", "truck", "update_at"],
    };
  }
  if (
    featureKey === "delay_records" &&
    chart.some((row) => row.delay_cause != null && row.delay_count != null)
  ) {
    return {
      kind: "horizontalBar",
      labelKey: "delay_cause",
      valueKey: "delay_count",
      xKey: "delay_cause",
      yKey: "delay_count",
      fieldKeys: ["delay_cause", "cause", "route", "trip_id", "delivery_date", "truck", "status"],
    };
  }
  if (
    featureKey === "maintenance_records" &&
    chart.some((row) => row.truck != null && row.report_count != null)
  ) {
    return {
      kind: "horizontalBar",
      labelKey: "truck",
      valueKey: "report_count",
      xKey: "truck",
      yKey: "report_count",
      fieldKeys: ["truck", "status", "reported_issue", "severity", "delivery_date"],
    };
  }
  if (
    featureKey === "vehicle_usage_logs" &&
    chart.some((row) => row.truck != null && row.trip_count != null)
  ) {
    return {
      kind: "horizontalBar",
      labelKey: "truck",
      valueKey: "trip_count",
      xKey: "truck",
      yKey: "trip_count",
      fieldKeys: ["truck"],
    };
  }
  if (
    featureKey === "maintenance_need_prediction" &&
    chart.some((row) => row.truck != null && row.severity_rank != null)
  ) {
    return {
      kind: "bar",
      labelKey: "truck",
      valueKey: "severity_rank",
      xKey: "truck",
      yKey: "severity_rank",
      fieldKeys: ["truck", "predicted_severity", "risk_score", "priority_level"],
    };
  }
  if (
    featureKey === "breakdown_risk_prediction" &&
    chart.some((row) => row.truck != null && row.risk_rank != null)
  ) {
    return {
      kind: "horizontalBar",
      labelKey: "truck",
      valueKey: "risk_rank",
      xKey: "risk_rank",
      yKey: "truck",
      fieldKeys: ["truck", "breakdown_risk", "breakdown_count", "trip_count", "cause", "route"],
    };
  }
  if (
    featureKey === "shipment_records" &&
    chart.some((row) => row.region != null && row.trip_count != null)
  ) {
    return {
      kind: "horizontalBar",
      labelKey: "region",
      valueKey: "trip_count",
      xKey: "region",
      yKey: "trip_count",
      fieldKeys: ["region", "route", "trip_id", "booking_id", "delivery_date", "status", "truck"],
    };
  }
  return null;
}

export function driverFeatureNote(featureKey: string, blockNote?: string | null): string | undefined {
  if (featureKey === "trip_logs") {
    return (
      blockNote ??
      "Trips by delivery status (Completed, Delayed, Ongoing). Use time granularity and click period bars to drill Year → Quarter → Month → Week → Day → Route."
    );
  }
  if (featureKey === "completed_deliveries") {
    return (
      blockNote ??
      "Completed deliveries by status (Completed, Delayed, Ongoing). Click period bars to drill Year → Quarter → Month → Week → Day → Route."
    );
  }
  if (featureKey === "travel_time_reports") {
    return (
      blockNote ??
      "Average travel time (hours) over the selected period. Start at Year view (e.g. 2025), then click points to drill down to Quarter → Month → Week → Day."
    );
  }
  if (featureKey === "delivery_confirmation_logs") {
    return (
      blockNote ??
      "Number of confirmed deliveries over time. Use time granularity and click points to drill Year → Quarter → Month → Week → Day."
    );
  }
  if (featureKey === "completion_time_prediction") {
    return (
      blockNote ??
      "Actual vs predicted completion time (hours). Use time granularity and click points to drill Year → Quarter → Month → Week → Day."
    );
  }
  if (featureKey === "fuel_usage_prediction") {
    return (
      blockNote ??
      "Fuel Usage Prediction using Linear Regression. Blue dots are actual liters vs distance traveled; the red line is the predicted trend."
    );
  }
  if (featureKey === "travel_time_estimation") {
    return (
      blockNote ??
      "Travel Time Estimation using Linear Regression. Blue dots are actual travel duration (minutes) vs distance; the red line is the predicted trend."
    );
  }
  if (featureKey === "delay_records") {
    return (
      blockNote ??
      "Delay records grouped by cause (Traffic, Loading Delay, Breakdown, Weather, Driver Issue, etc.). Click a bar to drill down to individual incidents."
    );
  }
  if (featureKey === "trip_progress_updates") {
    return (
      blockNote ??
      "Trip progress grouped by status (Assigned, In Delivery, Completed, etc.). Click a bar to drill down to matching trips or status updates."
    );
  }
  if (featureKey === "delay_likelihood_prediction") {
    return (
      blockNote ??
      "Historical vs forecasted delay likelihood from delay logs, late completions, and trips past ETA. Use time granularity and click points to drill Year → Quarter → Month → Week → Day."
    );
  }
  if (featureKey === "maintenance_records") {
    return (
      blockNote ??
      "Maintenance reports per truck assigned to your trips. Counts include open and resolved records."
    );
  }
  if (featureKey === "vehicle_usage_logs") {
    return (
      blockNote ??
      "Trip count per assigned vehicle. Click any bar to drill down to individual trips for that truck."
    );
  }
  if (featureKey === "maintenance_need_prediction") {
    return (
      blockNote ??
      "Predicted maintenance severity for each assigned truck. Y-axis shows Low, Medium, or High risk."
    );
  }
  if (featureKey === "breakdown_risk_prediction") {
    return (
      blockNote ??
      "Predicted breakdown risk for each assigned truck. X-axis shows Low, Medium, or High risk."
    );
  }
  if (featureKey === "shipment_records") {
    return (
      blockNote ??
      "Shipments aggregated by Luzon region (North Luzon, Metro Manila, South Luzon). Click a bar to drill down to individual records."
    );
  }
  return blockNote ?? undefined;
}
