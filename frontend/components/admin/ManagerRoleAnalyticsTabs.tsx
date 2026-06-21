"use client";

import { RoleAnalyticsGrid, type AnalyticsCategoryTab } from "@/components/admin/RoleAnalyticsGrid";
import type { AdminAnalyticsPayload, ManagerRoleAnalyticsPayload } from "@/lib/analyticsApi";
import { managerChartUnit, managerFeatureNote, managerPreferredChartKind, managerResolveChartMeta, normalizeManagerFeatureChart } from "@/lib/managerAnalyticsChartConfig";

const FEATURE_LABELS: Record<string, Record<string, string>> = {
  planning: {
    historical_trip_costs: "Historical Trip Costs",
    fuel_consumption: "Fuel Consumption Reports",
    fleet_usage: "Fleet Usage Summaries",
    cost_forecasting: "Cost Forecasting",
    fuel_prediction: "Fuel Consumption Prediction",
    fleet_demand_forecasting: "Fleet Demand Forecasting",
  },
  organizing: {
    driver_assignments: "Driver Assignment Records",
    truck_utilization: "Truck Utilization Reports",
    route_histories: "Route Histories",
    fleet_allocation: "Optimal Fleet Allocation Prediction",
    workforce_demand: "Workforce Demand Forecasting",
  },
  execution: {
    active_trips: "Active Trip Monitoring",
    delivery_status: "Delivery Status Dashboards",
    operational_logs: "Operational Logs",
    delay_prediction: "Delay Prediction",
    route_efficiency: "Route Efficiency Prediction",
  },
  controlling: {
    performance_reports: "Performance Reports",
    maintenance_records: "Maintenance Records",
    operational_costs: "Operational Cost Summaries",
    maintenance_risk: "Maintenance Risk Prediction",
    cost_overrun: "Cost Overrun Prediction",
  },
  performance_monitoring: {
    delivery_success: "Delivery Success Rate Reports",
    fuel_efficiency: "Fuel Efficiency Analysis",
    maintenance_frequency: "Maintenance Frequency Records",
    fleet_performance_trend: "Fleet Performance Trend Prediction",
    efficiency_improvement: "Efficiency Improvement Forecasting",
  },
  risk_management: {
    maintenance_issue_logs: "Pareto Chart of Maintenance Issues",
    breakdown_reports: "Total Breakdown Count per Vehicle",
    cost_fluctuation: "Operational Cost Fluctuation Analysis",
    maintenance_failure: "Maintenance Risk Score Trends by Vehicle",
    operational_disruption: "Operational Disruption Risk Forecast",
  },
};

const CATEGORY_TABS: AnalyticsCategoryTab[] = [
  { id: "planning", label: "Planning", include: [{ pillar: "planning" }] },
  { id: "organizing", label: "Organizing", include: [{ pillar: "organizing" }] },
  { id: "execution", label: "Execution", include: [{ pillar: "execution" }] },
  { id: "controlling", label: "Controlling", include: [{ pillar: "controlling" }] },
  { id: "performance-monitoring", label: "Performance Monitoring", include: [{ pillar: "performance_monitoring" }] },
  { id: "risk-management", label: "Risk Management", include: [{ pillar: "risk_management" }] },
];

export default function ManagerRoleAnalyticsTabs({
  data,
  filterOptions,
  onPeriodDrillDown,
}: {
  data: ManagerRoleAnalyticsPayload;
  filterOptions?: AdminAnalyticsPayload["filter_options"];
  onPeriodDrillDown?: (next: { dateFrom: string; dateTo: string }) => void;
}) {
  return (
    <RoleAnalyticsGrid
      dashboardTitle="Manager Analytics"
      categoryTabs={CATEGORY_TABS}
      featureLabels={FEATURE_LABELS}
      data={data}
      filterOptions={filterOptions}
      onPeriodDrillDown={onPeriodDrillDown}
      resolvePreferredChartKind={managerPreferredChartKind}
      resolveChartUnit={managerChartUnit}
      resolveFeatureChartMeta={managerResolveChartMeta}
      normalizeFeatureChart={normalizeManagerFeatureChart}
      resolveFeatureNote={managerFeatureNote}
    />
  );
}
