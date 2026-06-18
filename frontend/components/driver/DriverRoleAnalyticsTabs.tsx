"use client";

import { RoleAnalyticsGrid, type AnalyticsCategoryTab } from "@/components/admin/RoleAnalyticsGrid";
import type { DriverRoleAnalyticsPayload } from "@/lib/analyticsApi";

const FEATURE_LABELS: Record<string, Record<string, string>> = {
  trip_execution: {
    trip_logs: "Trip Logs",
    completed_deliveries: "Completed Deliveries",
    travel_time_reports: "Travel Time Reports",
    trip_duration_prediction: "Trip Duration Prediction",
    fuel_usage_prediction: "Fuel Usage Prediction",
  },
  route_navigation: {
    route_history: "Route History",
    distance_records: "Distance Records",
    past_delivery_routes: "Past Delivery Routes",
    optimal_route_prediction: "Optimal Route Prediction",
    travel_time_estimation: "Travel Time Estimation",
  },
  delivery_reporting: {
    delivery_confirmation_logs: "Delivery Confirmation Logs",
    shipment_records: "Shipment Records",
    completion_time_prediction: "Completion Time Prediction",
  },
  vehicle_monitoring: {
    vehicle_usage_logs: "Vehicle Usage Logs",
    maintenance_records: "Maintenance Records",
    maintenance_need_prediction: "Maintenance Need Prediction",
    breakdown_risk_prediction: "Breakdown Risk Prediction",
  },
  trip_status: {
    trip_progress_updates: "Trip Progress Updates",
    delay_records: "Delay Records",
    delay_likelihood_prediction: "Delay Likelihood Prediction",
  },
};

const CATEGORY_TABS: AnalyticsCategoryTab[] = [
  { id: "trip-execution", label: "Trip Execution", include: [{ pillar: "trip_execution" }] },
  { id: "route-navigation", label: "Route Navigation", include: [{ pillar: "route_navigation" }] },
  { id: "vehicle-monitoring", label: "Vehicle Monitoring", include: [{ pillar: "vehicle_monitoring" }] },
  { id: "delivery-reporting", label: "Delivery Reporting", include: [{ pillar: "delivery_reporting" }] },
  { id: "trip-updating", label: "Trip Updating", include: [{ pillar: "trip_status" }] },
];

export default function DriverRoleAnalyticsTabs({ data }: { data: DriverRoleAnalyticsPayload }) {
  return (
    <RoleAnalyticsGrid
      dashboardTitle="Driver Analytics"
      categoryTabs={CATEGORY_TABS}
      featureLabels={FEATURE_LABELS}
      data={data}
    />
  );
}
