"use client";

import { useMemo, useState } from "react";
import { InteractiveFeaturePanel } from "@/components/admin/InteractiveFeaturePanel";
import { SectionCard } from "@/components/admin/AnalyticsCharts";
import type { AdminAnalyticsPayload, ManagerRoleAnalyticsPayload } from "@/lib/analyticsApi";

type PillarKey = keyof ManagerRoleAnalyticsPayload;

const PILLAR_TABS: { id: PillarKey; label: string }[] = [
  { id: "planning", label: "Planning" },
  { id: "organizing", label: "Organizing" },
  { id: "execution", label: "Execution" },
  { id: "controlling", label: "Controlling" },
  { id: "performance_monitoring", label: "Performance Monitoring" },
  { id: "risk_management", label: "Risk Management" },
];

const FEATURE_LABELS: Record<PillarKey, { descriptive: Record<string, string>; predictive: Record<string, string> }> = {
  planning: {
    descriptive: {
      historical_trip_costs: "Historical trip costs",
      fuel_consumption: "Fuel consumption reports",
      fleet_usage: "Fleet usage summaries",
    },
    predictive: {
      cost_forecasting: "Cost forecasting",
      fuel_prediction: "Fuel consumption prediction",
      fleet_demand_forecasting: "Fleet demand forecasting",
    },
  },
  organizing: {
    descriptive: {
      driver_assignments: "Driver assignment records",
      truck_utilization: "Truck utilization reports",
      route_histories: "Route histories",
    },
    predictive: {
      fleet_allocation: "Optimal fleet allocation prediction",
      workforce_demand: "Workforce demand forecasting",
    },
  },
  execution: {
    descriptive: {
      active_trips: "Active trip monitoring",
      delivery_status: "Delivery status dashboards",
      operational_logs: "Operational logs",
    },
    predictive: {
      delay_prediction: "Delay prediction",
      route_efficiency: "Route efficiency prediction",
    },
  },
  controlling: {
    descriptive: {
      performance_reports: "Performance reports",
      maintenance_records: "Maintenance records",
      operational_costs: "Operational cost summaries",
    },
    predictive: {
      maintenance_risk: "Maintenance risk prediction",
      cost_overrun: "Cost overrun prediction",
    },
  },
  performance_monitoring: {
    descriptive: {
      delivery_success: "Delivery success rate reports",
      fuel_efficiency: "Fuel efficiency analysis",
      maintenance_frequency: "Maintenance frequency reports",
    },
    predictive: {
      fleet_performance_trend: "Fleet performance trend prediction",
      efficiency_improvement: "Efficiency improvement forecasting",
    },
  },
  risk_management: {
    descriptive: {
      maintenance_issue_logs: "Maintenance issue logs",
      breakdown_reports: "Breakdown reports",
      cost_fluctuation: "Cost fluctuation analysis",
    },
    predictive: {
      maintenance_failure: "Maintenance failure prediction",
      operational_disruption: "Operational disruption prediction",
    },
  },
};

export default function ManagerRoleAnalyticsTabs({
  data,
  filterOptions,
}: {
  data: ManagerRoleAnalyticsPayload;
  filterOptions?: AdminAnalyticsPayload["filter_options"];
}) {
  const [pillar, setPillar] = useState<PillarKey>("planning");

  const labels = FEATURE_LABELS[pillar];
  const pillarData = data[pillar];

  const descriptiveEntries = useMemo(
    () => Object.entries(labels.descriptive).map(([key, title]) => [key, title, pillarData.descriptive[key]] as const),
    [labels.descriptive, pillarData.descriptive],
  );
  const predictiveEntries = useMemo(
    () => Object.entries(labels.predictive).map(([key, title]) => [key, title, pillarData.predictive[key]] as const),
    [labels.predictive, pillarData.predictive],
  );

  return (
    <SectionCard title="Manager Analytics (Table 10)" sectionId="manager-role-analytics">
      <p style={{ margin: "0 0 1rem", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
        Descriptive and predictive analytics by management function — all figures trace to live bookings, trips,
        fuel logs, and operational records.
      </p>
      <div className="tab-pills" style={{ marginBottom: "1.25rem" }}>
        {PILLAR_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setPillar(tab.id)}
            className={`tab-pill${pillar === tab.id ? " tab-pill--active" : ""}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gap: "1.5rem" }}>
        <section>
          <h3 style={{ margin: "0 0 1rem", fontSize: "1rem" }}>Descriptive analytics</h3>
          <div style={{ display: "grid", gap: "1rem" }}>
            {descriptiveEntries.map(([key, title, block]) => (
              <InteractiveFeaturePanel key={key} title={title} block={block} filterOptions={filterOptions} />
            ))}
          </div>
        </section>
        <section>
          <h3 style={{ margin: "0 0 1rem", fontSize: "1rem" }}>Predictive analytics</h3>
          <div style={{ display: "grid", gap: "1rem" }}>
            {predictiveEntries.map(([key, title, block]) => (
              <InteractiveFeaturePanel key={key} title={title} block={block} filterOptions={filterOptions} />
            ))}
          </div>
        </section>
      </div>
    </SectionCard>
  );
}
