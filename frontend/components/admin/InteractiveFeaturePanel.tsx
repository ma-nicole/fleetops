"use client";

import { useState } from "react";
import {
  BarChartPhp,
  EmptyChart,
  LineChartVisual,
  PieChartVisual,
  StatGrid,
  StatisticsTable,
  type ChartClickPayload,
} from "@/components/admin/AnalyticsCharts";
import { BiDrillHint, DrillDownAnalyticsModal } from "@/components/admin/BiAnalyticsComponents";
import type { AdminAnalyticsPayload, RoleAnalyticsFeatureBlock } from "@/lib/analyticsApi";
import {
  formatStatusLabel,
  inferChartMeta,
  type ChartSelection,
} from "@/lib/chartDrilldownUtils";

function isEmptyBlock(block: RoleAnalyticsFeatureBlock): block is { empty: true; message: string } {
  return "empty" in block && block.empty === true;
}

function chartRows(rows: Record<string, unknown>[]): Array<Record<string, string | number>> {
  return rows as Array<Record<string, string | number>>;
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

function buildSelection(meta: ReturnType<typeof inferChartMeta>, payload: ChartClickPayload): ChartSelection {
  if (!meta) {
    return { label: payload.label, displayLabel: payload.label, fieldKeys: [] };
  }
  const label = String(payload.raw[meta.labelKey] ?? payload.label);
  let displayLabel = label;
  if (meta.labelKey === "status") {
    displayLabel = formatStatusLabel(label);
  } else if (meta.monthFromX) {
    displayLabel = `Records for ${label}`;
  } else if (meta.labelKey === "driver_name") {
    displayLabel = `Driver ${label}`;
  } else if (meta.labelKey === "truck_code" || meta.labelKey === "truck") {
    displayLabel = `Truck ${label}`;
  } else if (meta.labelKey === "route") {
    displayLabel = `Route ${label.length > 40 ? `${label.slice(0, 40)}…` : label}`;
  }

  return {
    label,
    displayLabel,
    fieldKeys: meta.fieldKeys,
    monthKey: meta.monthFromX ? label : undefined,
  };
}

function renderInteractiveChart(
  meta: NonNullable<ReturnType<typeof inferChartMeta>>,
  items: Array<Record<string, string | number>>,
  onItemClick: (payload: ChartClickPayload) => void,
  selectedLabel: string | null,
) {
  if (meta.kind === "pie") {
    return (
      <PieChartVisual
        items={items}
        labelKey={meta.labelKey}
        valueKey={meta.valueKey}
        onItemClick={onItemClick}
        selectedLabel={selectedLabel}
      />
    );
  }
  if (meta.kind === "line" && meta.xKey && meta.yKey) {
    return (
      <LineChartVisual
        items={items}
        xKey={meta.xKey}
        yKey={meta.yKey}
        onItemClick={onItemClick}
        selectedLabel={selectedLabel}
      />
    );
  }
  return (
    <BarChartPhp
      items={items}
      labelKey={meta.labelKey}
      valueKey={meta.valueKey}
      formatValue={meta.valueKey.includes("php") ? undefined : (v) => String(v)}
      onItemClick={onItemClick}
      selectedLabel={selectedLabel}
    />
  );
}

export function InteractiveFeaturePanel({
  title,
  block,
  filterOptions,
}: {
  title: string;
  block: RoleAnalyticsFeatureBlock;
  filterOptions?: AdminAnalyticsPayload["filter_options"];
}) {
  const [selection, setSelection] = useState<ChartSelection | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

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

  const drilldown = (block.drilldown ?? []) as Record<string, unknown>[];
  const chart = (block.chart ?? []) as Record<string, unknown>[];
  const meta = inferChartMeta(chart, drilldown);
  const items = chartRows(chart);
  const columns = inferColumns(drilldown);

  const chartVisual =
    meta && items.length
      ? renderInteractiveChart(
          meta,
          items,
          (payload) => {
            setSelection(buildSelection(meta, payload));
            setModalOpen(true);
          },
          selection?.label ?? null,
        )
      : null;

  return (
    <div className="analytics-tier-card">
      <h4 className="panel-card__title" style={{ margin: 0 }}>
        {title}
      </h4>
      <div className="analytics-structure">
        <section className="analytics-structure__section">
          <h5 className="analytics-structure__section-title">Level 1 — Overview</h5>
          {block.kpis?.length ? <StatGrid items={block.kpis} /> : <EmptyChart message="No data available yet." />}
        </section>

        <section className="analytics-structure__section">
          <h5 className="analytics-structure__section-title">Level 2 — Breakdown</h5>
          <BiDrillHint />
          <div className="analytics-chart-surface">{chartVisual ?? <EmptyChart message="No data available yet." />}</div>
        </section>

        <section className="analytics-structure__section">
          <h5 className="analytics-structure__section-title">Module statistics</h5>
          {block.statistics ? <StatisticsTable stats={block.statistics} /> : <EmptyChart message="Insufficient data" />}
        </section>
      </div>
      {block.note ? (
        <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>{block.note}</p>
      ) : null}

      <DrillDownAnalyticsModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        selection={selection}
        allRows={drilldown}
        columns={columns}
        filterOptions={filterOptions}
        context={{
          sectionTitle: title,
          chartType: meta?.kind ?? "bar",
          chartItems: items,
          valueField: meta?.valueKey,
        }}
      />
    </div>
  );
}
