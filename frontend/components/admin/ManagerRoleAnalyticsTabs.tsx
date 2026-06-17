"use client";

import { RoleAnalyticsGrid, type AnalyticsCategoryTab } from "@/components/admin/RoleAnalyticsGrid";
import type { AdminAnalyticsPayload, ManagerRoleAnalyticsPayload } from "@/lib/analyticsApi";

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
    fleet_allocation: "Optimal Fleet Allocation",
    workforce_demand: "Workforce Demand Forecasting",
  },
  execution: {
    active_trips: "Active Trip Monitoring",
    delivery_status: "Delivery Status Dashboard",
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
    delivery_success: "Delivery Success Rate",
    fuel_efficiency: "Fuel Efficiency Analysis",
    maintenance_frequency: "Maintenance Frequency",
    fleet_performance_trend: "Fleet Performance Trend",
    efficiency_improvement: "Efficiency Improvement Forecast",
  },
  risk_management: {
    maintenance_issue_logs: "Maintenance Issue Logs",
    breakdown_reports: "Breakdown Reports",
    cost_fluctuation: "Cost Fluctuation Analysis",
    maintenance_failure: "Maintenance Failure Prediction",
    operational_disruption: "Operational Disruption Prediction",
  },
};

const CATEGORY_TABS: AnalyticsCategoryTab[] = [
  {
    id: "revenue",
    label: "Revenue",
    include: [
      { pillar: "planning", features: ["cost_forecasting"] },
      { pillar: "controlling", features: ["cost_overrun"] },
      { pillar: "risk_management", features: ["cost_fluctuation"] },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    include: [
      { pillar: "execution" },
      { pillar: "organizing", features: ["driver_assignments", "workforce_demand"] },
      { pillar: "controlling", features: ["performance_reports"] },
      { pillar: "performance_monitoring", features: ["delivery_success", "efficiency_improvement"] },
      { pillar: "risk_management", features: ["operational_disruption"] },
    ],
  },
  {
    id: "fleet",
    label: "Fleet",
    include: [
      { pillar: "planning", features: ["fleet_usage", "fuel_prediction", "fleet_demand_forecasting"] },
      { pillar: "organizing", features: ["truck_utilization", "fleet_allocation"] },
      { pillar: "controlling", features: ["maintenance_records", "maintenance_risk"] },
      { pillar: "performance_monitoring", features: ["fuel_efficiency", "maintenance_frequency", "fleet_performance_trend"] },
      { pillar: "risk_management", features: ["maintenance_issue_logs", "breakdown_reports", "maintenance_failure"] },
    ],
  },
  {
    id: "expenses",
    label: "Expenses",
    include: [
      { pillar: "planning", features: ["historical_trip_costs", "fuel_consumption"] },
      { pillar: "controlling", features: ["operational_costs"] },
    ],
  },
  {
    id: "routes",
    label: "Routes",
    include: [
      { pillar: "organizing", features: ["route_histories"] },
      { pillar: "execution", features: ["delay_prediction", "route_efficiency"] },
    ],
  },
  {
    id: "customers",
    label: "Customers",
    include: [],
  },
];

export default function ManagerRoleAnalyticsTabs({
  data,
  filterOptions,
}: {
  data: ManagerRoleAnalyticsPayload;
  filterOptions?: AdminAnalyticsPayload["filter_options"];
}) {
  return (
    <RoleAnalyticsGrid
      dashboardTitle="Manager Analytics"
      categoryTabs={CATEGORY_TABS}
      featureLabels={FEATURE_LABELS}
      data={data}
      filterOptions={filterOptions}
    />
  );
}
