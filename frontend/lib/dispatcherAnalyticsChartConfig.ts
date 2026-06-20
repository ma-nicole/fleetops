import type { AnalyticsChartKind } from "@/lib/analyticsChartConfig";

/** Explicit chart kinds for dispatcher role analytics feature keys. */
export const DISPATCHER_FEATURE_CHART_KINDS: Record<string, AnalyticsChartKind> = {
  trip_schedules: "line",
  dispatch_logs: "pie",
  delivery_records: "line",
  optimal_scheduling: "bar",
  workload_forecasting: "line",
  route_history: "horizontalBar",
  travel_time_records: "line",
  delivery_performance_logs: "horizontalBar",
  optimal_route_prediction: "horizontalBar",
  traffic_delay_prediction: "horizontalBar",
  truck_availability: "horizontalBar",
  vehicle_utilization: "horizontalBar",
  vehicle_allocation: "bar",
  truck_demand_forecasting: "line",
  driver_schedules: "line",
  assignment_history: "stackedBar",
  trip_completion_logs: "line",
  driver_workload_prediction: "horizontalBar",
  staffing_demand_forecasting: "line",
  order_details: "pie",
  shipment_status_logs: "pie",
  delivery_progress: "pie",
  delivery_delay_prediction: "pie",
  order_completion_forecasting: "line",
  dispatch_records: "pie",
  trip_summaries: "pie",
  operational_performance_logs: "horizontalBar",
  schedule_conflict_prediction: "pie",
  truck_shortage_prediction: "bar",
  operational_issue_forecasting: "line",
};

export function dispatcherPreferredChartKind(featureKey: string): AnalyticsChartKind | undefined {
  return DISPATCHER_FEATURE_CHART_KINDS[featureKey];
}
