"use client";

import { useMemo, useState } from "react";
import {
  BarChartPhp,
  DrilldownTable,
  EmptyChart,
  LineChartVisual,
  SectionCard,
  StatGrid,
  StatisticsTable,
} from "@/components/admin/AnalyticsCharts";
import type { DriverRoleAnalyticsPayload, RoleAnalyticsFeatureBlock } from "@/lib/analyticsApi";

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

  if (keys.includes("month") && keys.includes("avg_travel_hours")) {
    return <LineChartVisual items={items} xKey="month" yKey="avg_travel_hours" />;
  }
  if (keys.includes("month") && keys.includes("delay_count")) {
    return <LineChartVisual items={items} xKey="month" yKey="delay_count" />;
  }
  if (keys.includes("period") && keys.some((k) => k.startsWith("forecast_"))) {
    const yKey = keys.find((k) => k.startsWith("forecast_")) ?? keys[1];
    return <LineChartVisual items={items} xKey="period" yKey={yKey} />;
  }
  if (keys.includes("route") && keys.includes("trip_count")) {
    return <BarChartPhp items={items} labelKey="route" valueKey="trip_count" />;
  }
  if (keys.includes("truck") && keys.includes("trip_count")) {
    return <BarChartPhp items={items} labelKey="truck" valueKey="trip_count" />;
  }
  if (keys.includes("distance_km")) {
    const labelKey = keys.includes("route") ? "route" : keys.includes("delivery_date") ? "delivery_date" : keys[0];
    return <BarChartPhp items={items} labelKey={labelKey} valueKey="distance_km" />;
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
      { key: "trip_id", label: "Trip" },
      { key: "booking_id", label: "Booking" },
    ];
  }
  const preferred = [
    "trip_id",
    "booking_id",
    "route",
    "truck",
    "delivery_date",
    "travel_time_hours",
    "fuel_usage_liters",
    "distance_km",
    "status",
    "cause",
    "reported_issue",
    "severity",
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
