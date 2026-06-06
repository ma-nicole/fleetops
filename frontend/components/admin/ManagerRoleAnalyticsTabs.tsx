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
import type { ManagerRoleAnalyticsPayload, RoleAnalyticsFeatureBlock } from "@/lib/analyticsApi";

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

  if (keys.includes("month") && keys.includes("total_cost_php") && keys.includes("change_pct")) {
    return <LineChartVisual items={items} xKey="month" yKey="change_pct" />;
  }
  if (keys.includes("month") && keys.includes("total_cost_php")) {
    return <LineChartVisual items={items} xKey="month" yKey="total_cost_php" />;
  }
  if (keys.includes("period") && keys.some((k) => k.startsWith("forecast_"))) {
    const yKey = keys.find((k) => k.startsWith("forecast_")) ?? keys[1];
    return <LineChartVisual items={items} xKey="period" yKey={yKey} />;
  }
  if (keys.includes("month") && keys.includes("avg_km_per_liter")) {
    return <LineChartVisual items={items} xKey="month" yKey="avg_km_per_liter" />;
  }
  if (keys.includes("month") && keys.includes("count")) {
    return <LineChartVisual items={items} xKey="month" yKey="count" />;
  }
  if (keys.includes("status") && keys.includes("count")) {
    return <PieChartVisual items={items} labelKey="status" valueKey="count" />;
  }
  if (keys.includes("truck") && keys.includes("liters")) {
    return <BarChartPhp items={items} labelKey="truck" valueKey="liters" />;
  }
  if (keys.includes("truck_code") && keys.includes("trip_count")) {
    return <BarChartPhp items={items} labelKey="truck_code" valueKey="trip_count" />;
  }
  if (keys.includes("route") && keys.includes("total_cost_php")) {
    return <BarChartPhp items={items} labelKey="route" valueKey="total_cost_php" />;
  }
  if (keys.includes("route") && keys.includes("cost_per_km")) {
    return <BarChartPhp items={items} labelKey="route" valueKey="cost_per_km" />;
  }
  if (keys.includes("month") && keys.includes("total")) {
    return <LineChartVisual items={items} xKey="month" yKey="total" />;
  }
  if (keys.includes("severity") && keys.includes("count")) {
    return <BarChartPhp items={items} labelKey="severity" valueKey="count" />;
  }
  if (keys.includes("issue_type") && keys.includes("count")) {
    return <BarChartPhp items={items} labelKey="issue_type" valueKey="count" />;
  }
  if (keys.includes("truck") && keys.includes("risk_score")) {
    return <BarChartPhp items={items} labelKey="truck" valueKey="risk_score" />;
  }
  if (keys.includes("route") && keys.includes("disruption_score")) {
    return <BarChartPhp items={items} labelKey="route" valueKey="disruption_score" />;
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
    "maintenance_id",
    "report_id",
    "source",
    "booking_id",
    "trip_id",
    "truck",
    "driver",
    "route",
    "date",
    "reported_issue",
    "issue_type",
    "cause",
    "cost_php",
    "risk_score",
    "priority",
    "disruption_score",
    "predicted_php",
    "actual_php",
    "variance_php",
    "status",
    "report_type",
    "details",
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

export default function ManagerRoleAnalyticsTabs({ data }: { data: ManagerRoleAnalyticsPayload }) {
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
