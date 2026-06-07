"use client";

import { useMemo, useState } from "react";
import { InteractiveFeaturePanel } from "@/components/admin/InteractiveFeaturePanel";
import { SectionCard } from "@/components/admin/AnalyticsCharts";
import type { DispatcherRoleAnalyticsPayload } from "@/lib/analyticsApi";

type PillarKey = keyof DispatcherRoleAnalyticsPayload;

const PILLAR_TABS: { id: PillarKey; label: string }[] = [
  { id: "trip_scheduling", label: "Trip Scheduling" },
  { id: "route_coordination", label: "Route Coordination" },
  { id: "truck_assignment", label: "Truck Assignment" },
  { id: "driver_coordination", label: "Driver Coordination" },
  { id: "order_monitoring", label: "Order Monitoring" },
  { id: "operational_support", label: "Operational Support" },
];

const FEATURE_LABELS: Record<PillarKey, { descriptive: Record<string, string>; predictive: Record<string, string> }> = {
  trip_scheduling: {
    descriptive: {
      trip_schedules: "Trip schedules",
      dispatch_logs: "Dispatch logs",
      delivery_records: "Delivery records",
    },
    predictive: {
      optimal_scheduling: "Optimal scheduling prediction",
      workload_forecasting: "Workload forecasting",
    },
  },
  route_coordination: {
    descriptive: {
      route_history: "Route history",
      travel_time_records: "Travel time records",
      delivery_performance_logs: "Delivery performance logs",
    },
    predictive: {
      optimal_route_prediction: "Optimal route prediction",
      traffic_delay_prediction: "Traffic delay prediction",
    },
  },
  truck_assignment: {
    descriptive: {
      truck_availability: "Truck availability records",
      vehicle_utilization: "Vehicle utilization reports",
    },
    predictive: {
      vehicle_allocation: "Vehicle allocation prediction",
      truck_demand_forecasting: "Truck demand forecasting",
    },
  },
  driver_coordination: {
    descriptive: {
      driver_schedules: "Driver schedules",
      assignment_history: "Assignment history",
      trip_completion_logs: "Trip completion logs",
    },
    predictive: {
      driver_workload_prediction: "Driver workload prediction",
      staffing_demand_forecasting: "Staffing demand forecasting",
    },
  },
  order_monitoring: {
    descriptive: {
      order_details: "Order details",
      shipment_status_logs: "Shipment status logs",
      delivery_progress: "Delivery progress records",
    },
    predictive: {
      delivery_delay_prediction: "Delivery delay prediction",
      order_completion_forecasting: "Order completion forecasting",
    },
  },
  operational_support: {
    descriptive: {
      dispatch_records: "Dispatch records",
      trip_summaries: "Trip summaries",
      operational_performance_logs: "Operational performance logs",
    },
    predictive: {
      schedule_conflict_prediction: "Schedule conflict prediction",
      truck_shortage_prediction: "Truck shortage prediction",
      operational_issue_forecasting: "Operational issue forecasting",
    },
  },
};

export default function DispatcherRoleAnalyticsTabs({ data }: { data: DispatcherRoleAnalyticsPayload }) {
  const [pillar, setPillar] = useState<PillarKey>("trip_scheduling");

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
    <SectionCard title="Dispatcher Analytics" sectionId="dispatcher-role-analytics">
      <p style={{ margin: "0 0 1rem", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
        Descriptive and predictive analytics for dispatch operations — all figures trace to live bookings, trips,
        assignments, and operational logs.
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
