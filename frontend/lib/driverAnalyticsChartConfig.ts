import type { AnalyticsChartKind } from "@/lib/analyticsChartConfig";

export const DRIVER_FEATURE_CHART_KINDS: Record<string, AnalyticsChartKind> = {
  trip_logs: "horizontalBar",
  completed_deliveries: "line",
  travel_time_reports: "line",
  route_history: "horizontalBar",
  distance_records: "horizontalBar",
  past_delivery_routes: "horizontalBar",
  optimal_route_prediction: "horizontalBar",
  vehicle_usage_logs: "horizontalBar",
  delay_records: "horizontalBar",
  delivery_confirmation_logs: "pie",
  shipment_records: "horizontalBar",
  trip_progress_updates: "line",
};

export function driverPreferredChartKind(featureKey: string): AnalyticsChartKind | undefined {
  return DRIVER_FEATURE_CHART_KINDS[featureKey];
}

export function driverChartUnit(featureKey: string): string | undefined {
  const units: Record<string, string> = {
    trip_logs: "trips",
    route_history: "trips",
    distance_records: "km",
    vehicle_usage_logs: "trips",
    travel_time_reports: "hours",
    delay_records: "delays",
  };
  return units[featureKey];
}
