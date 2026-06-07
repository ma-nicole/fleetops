"use client";

import { useMemo, useState } from "react";
import { InteractiveFeaturePanel } from "@/components/admin/InteractiveFeaturePanel";
import { SectionCard } from "@/components/admin/AnalyticsCharts";
import type { DriverRoleAnalyticsPayload } from "@/lib/analyticsApi";

type PillarKey = keyof DriverRoleAnalyticsPayload;

const PILLAR_TABS: { id: PillarKey; label: string }[] = [
  { id: "trip_execution", label: "Trip Execution" },
  { id: "route_navigation", label: "Route Navigation" },
  { id: "delivery_reporting", label: "Delivery Reporting" },
  { id: "vehicle_monitoring", label: "Vehicle Monitoring" },
  { id: "trip_status", label: "Trip Status" },
];

const FEATURE_LABELS: Record<PillarKey, { descriptive: Record<string, string>; predictive: Record<string, string> }> = {
  trip_execution: {
    descriptive: {
      trip_logs: "Trip logs",
      completed_deliveries: "Completed delivery records",
      travel_time_reports: "Travel time reports",
    },
    predictive: {
      trip_duration_prediction: "Trip duration prediction",
      fuel_usage_prediction: "Fuel usage prediction",
    },
  },
  route_navigation: {
    descriptive: {
      route_history: "Route history",
      distance_records: "Distance records",
      past_delivery_routes: "Past delivery routes",
    },
    predictive: {
      optimal_route_prediction: "Optimal route prediction",
      travel_time_estimation: "Travel time estimation",
    },
  },
  delivery_reporting: {
    descriptive: {
      delivery_confirmation_logs: "Delivery confirmation logs",
      shipment_records: "Shipment records",
    },
    predictive: {
      completion_time_prediction: "Delivery completion time prediction",
    },
  },
  vehicle_monitoring: {
    descriptive: {
      vehicle_usage_logs: "Vehicle usage logs",
      maintenance_records: "Maintenance records",
    },
    predictive: {
      maintenance_need_prediction: "Maintenance need prediction",
      breakdown_risk_prediction: "Breakdown risk prediction",
    },
  },
  trip_status: {
    descriptive: {
      trip_progress_updates: "Trip progress updates",
      delay_records: "Delay records",
    },
    predictive: {
      delay_likelihood_prediction: "Delay likelihood prediction",
    },
  },
};

export default function DriverRoleAnalyticsTabs({ data }: { data: DriverRoleAnalyticsPayload }) {
  const [pillar, setPillar] = useState<PillarKey>("trip_execution");

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
    <SectionCard title="Driver Analytics" sectionId="driver-role-analytics">
      <p style={{ margin: "0 0 1rem", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
        Your trip execution, routes, deliveries, vehicle usage, and status history — all from your assigned trips
        only.
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
              <InteractiveFeaturePanel key={key} title={title} block={block} />
            ))}
          </div>
        </section>
        <section>
          <h3 style={{ margin: "0 0 1rem", fontSize: "1rem" }}>Predictive analytics</h3>
          <div style={{ display: "grid", gap: "1rem" }}>
            {predictiveEntries.map(([key, title, block]) => (
              <InteractiveFeaturePanel key={key} title={title} block={block} />
            ))}
          </div>
        </section>
      </div>
    </SectionCard>
  );
}
