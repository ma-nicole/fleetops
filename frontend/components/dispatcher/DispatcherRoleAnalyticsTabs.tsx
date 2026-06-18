"use client";

import { RoleAnalyticsGrid, type AnalyticsCategoryTab } from "@/components/admin/RoleAnalyticsGrid";
import type { DispatcherRoleAnalyticsPayload } from "@/lib/analyticsApi";

const FEATURE_LABELS: Record<string, Record<string, string>> = {
  trip_scheduling: {
    trip_schedules: "Trip Schedules",
    dispatch_logs: "Dispatch Log",
    delivery_records: "Delivery Records",
    optimal_scheduling: "Optimal Scheduling Prediction",
    workload_forecasting: "Workload Forecasting",
  },
  route_coordination: {
    route_history: "Route History",
    travel_time_records: "Travel Time Records",
    delivery_performance_logs: "Delivery Performance Logs",
    optimal_route_prediction: "Optimal Route Prediction",
    traffic_delay_prediction: "Traffic Delay Prediction",
  },
  truck_assignment: {
    truck_availability: "Truck Availability Records",
    vehicle_utilization: "Vehicle Utilization Reports",
    vehicle_allocation: "Vehicle Allocation Prediction",
    truck_demand_forecasting: "Truck Demand Forecasting",
  },
  driver_coordination: {
    driver_schedules: "Driver Schedules",
    assignment_history: "Assignment History",
    trip_completion_logs: "Trip Completion Logs",
    driver_workload_prediction: "Driver Workload Prediction",
    staffing_demand_forecasting: "Staffing Demand Forecasting",
  },
  order_monitoring: {
    order_details: "Order Details",
    shipment_status_logs: "Shipment Status Logs",
    delivery_progress: "Delivery Progress",
    delivery_delay_prediction: "Delivery Delay Prediction",
    order_completion_forecasting: "Order Completion Forecasting",
  },
  operational_support: {
    dispatch_records: "Dispatch Records",
    trip_summaries: "Trip Summaries",
    operational_performance_logs: "Operational Performance Logs",
    schedule_conflict_prediction: "Schedule Conflict Prediction",
    truck_shortage_prediction: "Truck Shortage Prediction",
    operational_issue_forecasting: "Operational Issue Forecasting",
  },
};

const CATEGORY_TABS: AnalyticsCategoryTab[] = [
  { id: "trip-scheduling", label: "Trip Scheduling", include: [{ pillar: "trip_scheduling" }] },
  { id: "route-coordination", label: "Route Coordination", include: [{ pillar: "route_coordination" }] },
  { id: "truck-assignment", label: "Truck Assignment", include: [{ pillar: "truck_assignment" }] },
  { id: "driver-coordination", label: "Driver Coordination", include: [{ pillar: "driver_coordination" }] },
  { id: "order-monitoring", label: "Order Monitoring", include: [{ pillar: "order_monitoring" }] },
  { id: "operational-support", label: "Operational Support", include: [{ pillar: "operational_support" }] },
];

export default function DispatcherRoleAnalyticsTabs({ data }: { data: DispatcherRoleAnalyticsPayload }) {
  return (
    <RoleAnalyticsGrid
      dashboardTitle="Dispatcher Analytics"
      categoryTabs={CATEGORY_TABS}
      featureLabels={FEATURE_LABELS}
      data={data}
    />
  );
}
