"use client";

import { useMemo, useState } from "react";
import {
  BarChartPhp,
  DrilldownTable,
  EmptyChart,
  LineChartVisual,
  PieChartVisual,
  SectionCard,
  StatGrid,
  StatisticsTable,
} from "@/components/admin/AnalyticsCharts";
import type { DispatcherRoleAnalyticsPayload, RoleAnalyticsFeatureBlock } from "@/lib/analyticsApi";

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

function isEmptyBlock(block: RoleAnalyticsFeatureBlock): block is { empty: true; message: string } {
  return "empty" in block && block.empty === true;
}

function chartRows(rows: Record<string, unknown>[]): Array<Record<string, string | number>> {
  return rows as Array<Record<string, string | number>>;
}

function inferChart(block: RoleAnalyticsFeatureBlock) {
  if (isEmptyBlock(block) || !block.chart?.length) return null;
  const items = chartRows(block.chart);
  const row = items[0];
  const keys = Object.keys(row);

  if (keys.includes("month") && keys.includes("count")) {
    return <LineChartVisual items={items} xKey="month" yKey="count" />;
  }
  if (keys.includes("week") && keys.includes("count")) {
    return <BarChartPhp items={items} labelKey="week" valueKey="count" />;
  }
  if (keys.includes("period") && keys.some((k) => k.startsWith("forecast_"))) {
    const yKey = keys.find((k) => k.startsWith("forecast_")) ?? keys[1];
    return <LineChartVisual items={items} xKey="period" yKey={yKey} />;
  }
  if (keys.includes("status") && keys.includes("count")) {
    return <PieChartVisual items={items} labelKey="status" valueKey="count" />;
  }
  if (keys.includes("route") && keys.includes("delay_events")) {
    return <BarChartPhp items={items} labelKey="route" valueKey="delay_events" />;
  }
  if (keys.includes("route") && keys.includes("disruption_score")) {
    return <BarChartPhp items={items} labelKey="route" valueKey="disruption_score" />;
  }
  if (keys.includes("driver") && keys.includes("active_trips")) {
    return <BarChartPhp items={items} labelKey="driver" valueKey="active_trips" />;
  }
  if (keys.includes("truck") && keys.includes("trip_count")) {
    return <BarChartPhp items={items} labelKey="truck" valueKey="trip_count" />;
  }
  if (keys.includes("truck") && keys.includes("risk_score")) {
    return <BarChartPhp items={items} labelKey="truck" valueKey="risk_score" />;
  }
  if (keys.includes("route") && keys.includes("total_cost_php")) {
    return <BarChartPhp items={items} labelKey="route" valueKey="total_cost_php" />;
  }
  if (keys.includes("driver_name") && keys.includes("completed")) {
    return <BarChartPhp items={items} labelKey="driver_name" valueKey="completed" />;
  }

  const labelKey = keys.find((k) => typeof row[k] === "string") ?? keys[0];
  const valueKey = keys.find((k) => typeof row[k] === "number" && k !== labelKey) ?? keys[1];
  if (labelKey && valueKey) {
    return <BarChartPhp items={items} labelKey={labelKey} valueKey={valueKey} />;
  }
  return null;
}

function inferColumns(rows: Record<string, unknown>[]) {
  if (!rows.length) {
    return [
      { key: "booking_id", label: "Booking" },
      { key: "trip_id", label: "Trip" },
    ];
  }
  const preferred = [
    "booking_id",
    "trip_id",
    "driver",
    "truck",
    "route",
    "date",
    "scheduled_date",
    "dispatcher",
    "status",
    "cause",
    "travel_hours",
    "cost_php",
  ];
  const keys = Object.keys(rows[0]);
  const ordered = preferred.filter((k) => keys.includes(k));
  for (const k of keys) {
    if (!ordered.includes(k)) ordered.push(k);
  }
  return ordered.map((key) => ({
    key,
    label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
  }));
}

function FeaturePanel({ title, block }: { title: string; block: RoleAnalyticsFeatureBlock }) {
  if (isEmptyBlock(block)) {
    return (
      <div className="analytics-tier-card">
        <h4 className="panel-card__title" style={{ marginBottom: "0.75rem" }}>
          {title}
        </h4>
        <EmptyChart message={block.message} />
      </div>
    );
  }

  const chart = inferChart(block);
  const columns = inferColumns(block.drilldown as Record<string, unknown>[]);

  return (
    <div className="analytics-tier-card">
      <h4 className="panel-card__title" style={{ margin: 0 }}>
        {title}
      </h4>
      <div className="analytics-structure">
        <section className="analytics-structure__section">
          <h5 className="analytics-structure__section-title">Section 1 - Overview</h5>
          {block.kpis?.length ? <StatGrid items={block.kpis} /> : <EmptyChart message="No data available yet." />}
        </section>

        <section className="analytics-structure__section">
          <h5 className="analytics-structure__section-title">Section 2 - Breakdown</h5>
          <div className="analytics-chart-surface">{chart ?? <EmptyChart message="No data available yet." />}</div>
        </section>

        <section className="analytics-structure__section">
          <h5 className="analytics-structure__section-title">Section 3 - Detailed records</h5>
          {block.statistics ? <StatisticsTable stats={block.statistics} /> : <EmptyChart message="Insufficient data" />}
          <div className="analytics-table-surface">
            {block.drilldown?.length ? (
              <DrilldownTable columns={columns} rows={block.drilldown as Record<string, unknown>[]} />
            ) : (
              <EmptyChart message="No data available yet." />
            )}
          </div>
        </section>
      </div>
      {block.note ? (
        <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>{block.note}</p>
      ) : null}
    </div>
  );
}

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
              <FeaturePanel key={key} title={title} block={block} />
            ))}
          </div>
        </section>
        <section>
          <h3 style={{ margin: "0 0 1rem", fontSize: "1rem" }}>Predictive analytics</h3>
          <div style={{ display: "grid", gap: "1rem" }}>
            {predictiveEntries.map(([key, title, block]) => (
              <FeaturePanel key={key} title={title} block={block} />
            ))}
          </div>
        </section>
      </div>
    </SectionCard>
  );
}
