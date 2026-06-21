import type { AnalyticsChartKind } from "@/lib/analyticsChartConfig";

/** Descriptive analytics — explicit chart kinds matched to aggregated data shape. */
export const DISPATCHER_DESCRIPTIVE_CHART_KINDS: Record<string, AnalyticsChartKind> = {
  trip_schedules: "horizontalBar",
  dispatch_logs: "pie",
  delivery_records: "bar",
  route_history: "horizontalBar",
  travel_time_records: "line",
  delivery_performance_logs: "stackedBar",
  truck_availability: "pie",
  vehicle_utilization: "horizontalBar",
  driver_schedules: "line",
  assignment_history: "stackedBar",
  trip_completion_logs: "line",
  order_details: "line",
  shipment_status_logs: "pie",
  delivery_progress: "area",
  dispatch_records: "line",
  trip_summaries: "stackedBar",
  operational_performance_logs: "horizontalBar",
};

/** Predictive / prescriptive chart kinds (unchanged). */
export const DISPATCHER_PREDICTIVE_CHART_KINDS: Record<string, AnalyticsChartKind> = {
  optimal_scheduling: "bar",
  workload_forecasting: "line",
  optimal_route_prediction: "horizontalBar",
  traffic_delay_prediction: "horizontalBar",
  vehicle_allocation: "bar",
  truck_demand_forecasting: "line",
  driver_workload_prediction: "horizontalBar",
  staffing_demand_forecasting: "line",
  delivery_delay_prediction: "pie",
  order_completion_forecasting: "line",
  schedule_conflict_prediction: "pie",
  truck_shortage_prediction: "bar",
  operational_issue_forecasting: "line",
};

export const DISPATCHER_FEATURE_CHART_KINDS: Record<string, AnalyticsChartKind> = {
  ...DISPATCHER_DESCRIPTIVE_CHART_KINDS,
  ...DISPATCHER_PREDICTIVE_CHART_KINDS,
};

/** Y-axis / tooltip unit labels for descriptive widgets. */
export const DISPATCHER_CHART_UNITS: Record<string, string> = {
  trip_schedules: "Number of Trips",
  dispatch_logs: "Dispatch Events",
  delivery_records: "Number of Trips",
  route_history: "deliveries",
  travel_time_records: "hours",
  delivery_performance_logs: "deliveries",
  truck_availability: "trucks",
  vehicle_utilization: "trips",
  driver_schedules: "assignments",
  assignment_history: "trips",
  trip_completion_logs: "hours",
  order_details: "orders",
  shipment_status_logs: "shipments",
  delivery_progress: "active trips",
  dispatch_records: "records",
  trip_summaries: "trips",
  operational_performance_logs: "deliveries",
};

export function dispatcherPreferredChartKind(featureKey: string): AnalyticsChartKind | undefined {
  return DISPATCHER_FEATURE_CHART_KINDS[featureKey];
}

export function dispatcherChartUnit(featureKey: string): string | undefined {
  return DISPATCHER_CHART_UNITS[featureKey];
}
