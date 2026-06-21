"use client";

import { useMemo, useState, type ReactNode } from "react";
import { EmptyChart, type ChartClickPayload } from "@/components/admin/AnalyticsCharts";
import { RechartsAnalyticsChart, type AnalyticsChartKind } from "@/components/admin/RechartsAnalyticsChart";
import { DrillDownAnalyticsModal } from "@/components/admin/BiAnalyticsComponents";
import type { AdminAnalyticsPayload, ComparativeMetric, RoleAnalyticsFeatureBlock, StatisticsSummary } from "@/lib/analyticsApi";
import { AnalyticsApi } from "@/lib/analyticsApi";
import { computeRowStatistics } from "@/lib/analyticsStatistics";
import { compareFromChartSeries, findComparative, type PeriodComparisonResult } from "@/lib/periodComparison";
import {
  formatStatusLabel,
  inferChartMeta,
  resolveChartKeys,
  synthesizeChartFromCategoryCounts,
  synthesizeChartFromDrilldownNumeric,
  type ChartSelection,
  type InferredChartMeta,
  type SynthesizedChart,
} from "@/lib/chartDrilldownUtils";
import { mergeChartKind } from "@/lib/analyticsChartConfig";
import { TimeGranularityPicker, type TimeGranularity } from "@/components/admin/TimeGranularityPicker";
import { applyWidgetTimeRollup, augmentMetaForTimeRollup } from "@/lib/timeBucketRollup";
import { dateRangeForPeriod, detectPeriodGranularity, nextGranularity } from "@/lib/timePeriodDrilldown";
import { filterChartRowsByFocusedPeriod, filterDrilldownByFocusedPeriod } from "@/lib/chartPeriodFocus";

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
  const preferred = ["booking_id", "trip_id", "truck", "driver", "route", "date", "customer", "status", "cost_php", "amount_php"];
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
  const raw = payload.raw;
  if (raw.day != null && raw.hour != null) {
    const day = String(raw.day);
    const hour = Number(raw.hour);
    const count = raw.count != null ? Number(raw.count) : 0;
    return {
      label: `${day}|${hour}`,
      displayLabel: `${day} · ${String(hour).padStart(2, "0")}:00 (${count} events)`,
      fieldKeys: ["day_of_week", "hour"],
    };
  }
  if (!meta) return { label: payload.label, displayLabel: payload.label, fieldKeys: [] };
  const label = String(
    payload.raw[meta.labelKey] ?? (payload.raw as Record<string, unknown>).name ?? payload.label,
  );
  let displayLabel = label;
  if (meta.labelKey === "status") displayLabel = formatStatusLabel(label);
  else if (meta.monthFromX) displayLabel = `Records for ${label}`;
  const periodToken = String(
    payload.raw[meta.xKey ?? ""] ??
      payload.raw[meta.labelKey] ??
      payload.raw.period ??
      payload.raw.month ??
      label,
  );
  const monthKey = meta.monthFromX
    ? periodToken.length >= 7
      ? periodToken.slice(0, 7)
      : periodToken.length === 4
        ? periodToken
        : String((payload.raw.month_cohort as string | undefined) ?? periodToken)
    : undefined;
  return { label: periodToken || label, displayLabel, fieldKeys: meta.fieldKeys, monthKey };
}

function synthesizeFromDrilldown(drilldown: Record<string, unknown>[]): SynthesizedChart | null {
  return synthesizeChartFromCategoryCounts(drilldown) ?? synthesizeChartFromDrilldownNumeric(drilldown);
}

function toChartKind(kind: InferredChartMeta["kind"]): AnalyticsChartKind {
  if (kind === "pareto") return "pareto";
  if (kind === "heatmap") return "heatmap";
  if (kind === "groupedBar") return "groupedBar";
  if (kind === "pie") return "pie";
  if (kind === "line") return "line";
  if (kind === "area") return "area";
  if (kind === "stackedBar") return "stackedBar";
  if (kind === "combo") return "combo";
  if (kind === "horizontalBar") return "horizontalBar";
  if (kind === "scatter") return "scatter";
  return "bar";
}

function wrapChartVisual(node: ReactNode, pointCount: number) {
  return (
    <div className="bi-chart-visual-root" data-chart-points={pointCount}>
      {node}
    </div>
  );
}

function CompactStatistics({ stats }: { stats: StatisticsSummary | null }) {
  if (!stats) return <p className="bi-widget-stats__empty">Insufficient data</p>;
  const cells: [string, string | number][] = [
    ["Min", stats.minimum],
    ["Max", stats.maximum],
    ["Avg", stats.average],
    ["Median", stats.median],
    ["Subtotal", stats.subtotal],
    ["Std Dev", stats.standard_deviation ?? "—"],
  ];
  return (
    <div className="bi-widget-stats">
      {cells.map(([label, val]) => (
        <div key={label} className="bi-widget-stats__cell">
          <span className="bi-widget-stats__label">{label}</span>
          <strong className="bi-widget-stats__value">{val}</strong>
        </div>
      ))}
    </div>
  );
}

function ComparisonBanner({ result }: { result: PeriodComparisonResult }) {
  if (result.insufficient) {
    return <p className="bi-widget-compare bi-widget-compare--muted">Insufficient data for comparison.</p>;
  }
  const sign = result.changePct != null && result.changePct > 0 ? "+" : "";
  return (
    <div className="bi-widget-compare">
      <strong>
        {result.label}: {sign}
        {result.changePct}%
      </strong>
      <span>
        {result.previousLabel} → {result.currentLabel}
      </span>
    </div>
  );
}

export function BiChartWidget({
  title,
  block,
  filterOptions,
  comparative,
  widgetId,
  featureKey,
  analyticsType = "Descriptive",
  analyticsMethod = "Comparative aggregation",
  riskLegend,
  preferredChartKind,
  valueUnit,
  resolveFeatureChartMeta,
  normalizeFeatureChart,
  resolveFeatureNote,
  loading = false,
  onPeriodDrillDown,
}: {
  title: string;
  block: RoleAnalyticsFeatureBlock;
  filterOptions?: AdminAnalyticsPayload["filter_options"];
  comparative?: ComparativeMetric | null;
  widgetId?: string;
  featureKey?: string;
  analyticsType?: "Descriptive" | "Diagnostic" | "Predictive" | "Prescriptive";
  analyticsMethod?: string;
  riskLegend?: Array<{ label: string; color: string }>;
  preferredChartKind?: AnalyticsChartKind;
  valueUnit?: string;
  resolveFeatureChartMeta?: (
    featureKey: string,
    chart: Record<string, unknown>[],
  ) => InferredChartMeta | null;
  normalizeFeatureChart?: (
    featureKey: string,
    chart: Record<string, unknown>[],
    drilldown: Record<string, unknown>[],
  ) => Record<string, unknown>[];
  resolveFeatureNote?: (featureKey: string, blockNote?: string | null) => string | undefined;
  loading?: boolean;
  onPeriodDrillDown?: (next: { dateFrom: string; dateTo: string }) => void;
}) {
  const [selection, setSelection] = useState<ChartSelection | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [compareMode, setCompareMode] = useState<"none" | "quarter" | "yoy">("none");
  const [aiLoading, setAiLoading] = useState(false);
  const [widgetGranularity, setWidgetGranularity] = useState<TimeGranularity>(() =>
    featureKey === "login_history"
      ? "quarterly"
      : featureKey === "trip_logs" ||
          featureKey === "completed_deliveries" ||
          featureKey === "shipment_records" ||
          featureKey === "performance_reports" ||
          featureKey === "delivery_success" ||
          featureKey === "completion_time_prediction" ||
          featureKey === "delay_likelihood_prediction" ||
          featureKey === "historical_trip_costs"
        ? "yearly"
        : "monthly",
  );
  const [focusedPeriod, setFocusedPeriod] = useState<string | null>(null);

  const empty = isEmptyBlock(block);
  const drilldown = empty ? [] : ((block.drilldown ?? []) as Record<string, unknown>[]);
  const baseChart = useMemo(() => {
    if (empty) return [];
    let rows = (block.chart ?? []) as Record<string, unknown>[];
    if (featureKey && normalizeFeatureChart) {
      rows = normalizeFeatureChart(featureKey, rows, drilldown);
    }
    const skipSynthesis =
      featureKey === "booking_history" ||
      featureKey === "account_activity_logs" ||
      featureKey === "login_history" ||
      featureKey === "truck_preference_records" ||
      featureKey === "delivery_success" ||
      featureKey === "performance_reports" ||
      featureKey === "fuel_efficiency" ||
      featureKey === "maintenance_frequency" ||
      featureKey === "fleet_performance_trend" ||
      featureKey === "maintenance_issue_logs" ||
      featureKey === "efficiency_improvement" ||
      featureKey === "breakdown_reports" ||
      featureKey === "cost_fluctuation" ||
      featureKey === "maintenance_failure" ||
      featureKey === "operational_disruption" ||
      featureKey === "cost_overrun" ||
      featureKey === "trip_schedules" ||
      featureKey === "dispatch_logs" ||
      featureKey === "delivery_records" ||
      featureKey === "trip_logs" ||
      featureKey === "completed_deliveries" ||
      featureKey === "travel_time_reports" ||
      featureKey === "delivery_confirmation_logs" ||
      featureKey === "completion_time_prediction" ||
      featureKey === "fuel_usage_prediction" ||
      featureKey === "travel_time_estimation" ||
      featureKey === "maintenance_records" ||
      featureKey === "delay_records" ||
      featureKey === "trip_progress_updates" ||
      featureKey === "delay_likelihood_prediction" ||
      featureKey === "vehicle_usage_logs" ||
      featureKey === "maintenance_need_prediction" ||
      featureKey === "breakdown_risk_prediction" ||
      featureKey === "shipment_records" ||
      featureKey === "schedule_conflict_prediction" ||
      featureKey === "workload_forecasting";
    if (!rows.length && drilldown.length && !skipSynthesis) {
      const synthesized = synthesizeFromDrilldown(drilldown);
      if (synthesized?.items.length) rows = synthesized.items;
    }
    return rows;
  }, [block, drilldown, empty, featureKey, normalizeFeatureChart]);

  const baseMeta = useMemo(() => {
    const featureMeta = featureKey && resolveFeatureChartMeta ? resolveFeatureChartMeta(featureKey, baseChart) : null;
    const inferred = featureMeta ?? inferChartMeta(baseChart, drilldown);
    return augmentMetaForTimeRollup(inferred, baseChart, drilldown, featureKey);
  }, [baseChart, drilldown, featureKey, resolveFeatureChartMeta]);

  const scopedChartInput = useMemo(() => {
    if (!focusedPeriod || !baseMeta?.monthFromX) return baseChart;
    return filterChartRowsByFocusedPeriod(baseChart, focusedPeriod, baseMeta);
  }, [baseChart, baseMeta, focusedPeriod]);

  const scopedDrilldown = useMemo(() => {
    if (!focusedPeriod || !baseMeta?.monthFromX) return drilldown;
    return filterDrilldownByFocusedPeriod(drilldown, focusedPeriod);
  }, [baseMeta?.monthFromX, drilldown, focusedPeriod]);

  const chart = useMemo(() => {
    if (!baseMeta?.monthFromX) return scopedChartInput;
    return applyWidgetTimeRollup(scopedChartInput, scopedDrilldown, widgetGranularity, baseMeta);
  }, [baseMeta, scopedChartInput, scopedDrilldown, widgetGranularity]);
  const explicitFeatureMeta = useMemo(
    () => (featureKey && resolveFeatureChartMeta ? resolveFeatureChartMeta(featureKey, chart) : null),
    [chart, featureKey, resolveFeatureChartMeta],
  );
  const resolvedMeta = useMemo<InferredChartMeta | null>(() => {
    const meta = explicitFeatureMeta ?? baseMeta;
    if (!meta) return null;
    const truckSeries = ["Cold Chain", "Express Delivery", "Standard Delivery", "Heavy Cargo"].filter(
      (key) => chart.length > 0 && key in chart[0],
    );
    const mergedKind = explicitFeatureMeta
      ? (preferredChartKind ?? explicitFeatureMeta.kind)
      : mergeChartKind(meta.kind, preferredChartKind);
    const groupedTruck =
      mergedKind === "groupedBar" &&
      chart.length > 0 &&
      chart[0].truck_type != null &&
      truckSeries.length >= 2;
    if (!groupedTruck) {
      return { ...meta, kind: mergedKind };
    }
    const { monthFromX: _omitPeriodRollup, ...metaWithoutPeriodRollup } = meta;
    return {
      ...metaWithoutPeriodRollup,
      kind: "groupedBar" as const,
      labelKey: "truck_type",
      valueKey: truckSeries[0],
      xKey: "truck_type",
      yKey: truckSeries[0],
      seriesKeys: truckSeries,
      fieldKeys: meta.fieldKeys.includes("truck_type") ? meta.fieldKeys : ["truck_type", "service_sector"],
    };
  }, [baseMeta, preferredChartKind, chart, explicitFeatureMeta]);
  const items = chartRows(chart);
  const columns = inferColumns(drilldown);

  const stats = useMemo(() => {
    if (empty) return null;
    const preferFields =
      resolvedMeta?.seriesKeys?.length && resolvedMeta.seriesKeys.length > 1
        ? resolvedMeta.seriesKeys
        : resolvedMeta?.valueKey
          ? [resolvedMeta.valueKey]
          : undefined;
    const blockStats = "statistics" in block ? block.statistics : null;
    if (blockStats) return blockStats;
    const chartStats = chart.length
      ? computeRowStatistics(chart as Record<string, unknown>[], preferFields)
      : null;
    if (chartStats) return chartStats;
    if (chart.length && preferFields && preferFields.length > 1) {
      const totalStats = computeRowStatistics(chart as Record<string, unknown>[], ["total"]);
      if (totalStats) return totalStats;
    }
    return computeRowStatistics(drilldown, preferFields);
  }, [block, chart, drilldown, empty, resolvedMeta?.seriesKeys, resolvedMeta?.valueKey]);
  const legendLabel = valueUnit ?? resolvedMeta?.valueKey?.replace(/_/g, " ") ?? "Value";
  const timelineAxisLabel = useMemo(() => {
    if (!resolvedMeta?.monthFromX) return undefined;
    const labels: Record<TimeGranularity, string> = {
      yearly: "Year",
      quarterly: "Quarter",
      monthly: "Month",
      weekly: "Week",
      daily: "Day",
    };
    return `Timeline (${labels[widgetGranularity]})`;
  }, [resolvedMeta?.monthFromX, widgetGranularity]);
  const isLoginActivityStack =
    resolvedMeta?.seriesKeys?.includes("login") && resolvedMeta?.seriesKeys?.includes("logout");

  const quarterCompare = useMemo(() => {
    if (comparative?.comparisons?.quarterly?.length) {
      return findComparative(comparative.comparisons.quarterly, "quarter");
    }
    if (resolvedMeta?.monthFromX && resolvedMeta.valueKey) {
      return compareFromChartSeries(chart, resolvedMeta.valueKey, resolvedMeta.xKey ?? "month", "quarter");
    }
    return null;
  }, [chart, comparative, resolvedMeta]);

  const yoyCompare = useMemo(() => {
    if (comparative?.comparisons?.yearly?.length) {
      return findComparative(comparative.comparisons.yearly, "year");
    }
    if (resolvedMeta?.monthFromX && resolvedMeta.valueKey) {
      return compareFromChartSeries(chart, resolvedMeta.valueKey, resolvedMeta.xKey ?? "month", "year");
    }
    return null;
  }, [chart, comparative, resolvedMeta]);

  const openDrill = (payload: ChartClickPayload) => {
    if (resolvedMeta?.monthFromX) {
      const periodLabel = String(
        payload.raw[resolvedMeta.xKey ?? ""] ??
          payload.raw[resolvedMeta.labelKey ?? ""] ??
          payload.raw.period ??
          payload.raw.month ??
          payload.label,
      );
      if (widgetGranularity !== "daily") {
        const finer = nextGranularity(widgetGranularity);
        if (finer) {
          setFocusedPeriod(periodLabel);
          setWidgetGranularity(finer);
          setSelection(
            resolvedMeta
              ? buildSelection(resolvedMeta, { ...payload, label: periodLabel })
              : { label: periodLabel, displayLabel: periodLabel, fieldKeys: [] },
          );
          return;
        }
      }
      setSelection(
        resolvedMeta
          ? buildSelection(resolvedMeta, { ...payload, label: periodLabel })
          : { label: periodLabel, displayLabel: periodLabel, fieldKeys: [] },
      );
      setModalOpen(true);
      return;
    }
    setSelection(resolvedMeta ? buildSelection(resolvedMeta, payload) : { label: payload.label, displayLabel: payload.label, fieldKeys: [] });
    setModalOpen(true);
  };

  const openLegendDrill = (label: string) => {
    const labelKey = resolvedMeta?.labelKey ?? "label";
    const match = items.find((item) => String(item[labelKey] ?? "") === label);
    if (match) {
      openDrill({ label, raw: match });
      return;
    }
    setSelection({ label, displayLabel: label, fieldKeys: resolvedMeta?.fieldKeys ?? [] });
    setModalOpen(true);
  };

  const openDetails = () => {
    setSelection({ label: title, displayLabel: `${title} · Full details`, fieldKeys: [] });
    setModalOpen(true);
  };

  const explainChart = async () => {
    setAiLoading(true);
    try {
      await AnalyticsApi.chartInterpretation({
        section_title: title,
        selection_label: title,
        chart_type: resolvedMeta?.kind ?? "bar",
        items: items.map((item) => ({
          label: String(item[resolvedMeta?.labelKey ?? "label"] ?? ""),
          count: item.count != null ? Number(item.count) : undefined,
          value: item[resolvedMeta?.valueKey ?? "value"] != null ? Number(item[resolvedMeta?.valueKey ?? "value"]) : undefined,
        })),
        record_count: drilldown.length,
        statistics: stats ?? undefined,
      });
      setModalOpen(true);
    } finally {
      setAiLoading(false);
    }
  };

  const renderChart = (
    chartItems: Array<Record<string, string | number>>,
    labelKey: string,
    valueKey: string,
    kind: AnalyticsChartKind = "bar",
    axisLabel = valueKey.replace(/_/g, " "),
    xCategoryOverride?: string,
  ) => {
    const categoryLabel = xCategoryOverride ?? labelKey.replace(/_/g, " ");
    const isHorizontal = kind === "horizontalBar";
    return wrapChartVisual(
      <RechartsAnalyticsChart
        kind={kind}
        items={chartItems}
        labelKey={labelKey}
        valueKey={valueKey}
        seriesKeys={resolvedMeta?.seriesKeys}
        secondarySeriesKey={resolvedMeta?.secondarySeriesKey}
        xAxisLabel={isHorizontal ? axisLabel : categoryLabel}
        yAxisLabel={isHorizontal ? categoryLabel : axisLabel}
        legendLabel={axisLabel}
        onItemClick={openDrill}
        onLegendClick={openLegendDrill}
        selectedLabel={selection?.label ?? null}
        loading={loading}
      />,
      chartItems.length,
    );
  };

  const buildChartVisual = () => {
    if (loading) {
      return wrapChartVisual(
        <RechartsAnalyticsChart kind="bar" items={[]} labelKey="label" valueKey="value" loading />,
        0,
      );
    }

    if (resolvedMeta && items.length) {
      const yAxis = legendLabel;
      const xAxis = isLoginActivityStack && timelineAxisLabel ? timelineAxisLabel : undefined;
      return renderChart(
        items,
        resolvedMeta.xKey ?? resolvedMeta.labelKey,
        resolvedMeta.yKey ?? resolvedMeta.valueKey,
        toChartKind(resolvedMeta.kind),
        yAxis,
        xAxis,
      );
    }

    const genericKeys = resolveChartKeys(items);
    if (items.length && genericKeys) {
      const kind: AnalyticsChartKind = preferredChartKind ?? "bar";
      return renderChart(items, genericKeys.labelKey, genericKeys.valueKey, kind);
    }

    const categorySynth = synthesizeChartFromCategoryCounts(drilldown);
    if (categorySynth?.items.length) {
      const synthItems = chartRows(categorySynth.items).slice(0, 24);
      return renderChart(synthItems, categorySynth.labelKey, categorySynth.valueKey, "bar", "Records");
    }

    const numericSynth = synthesizeChartFromDrilldownNumeric(drilldown);
    if (numericSynth?.items.length) {
      const synthItems = chartRows(numericSynth.items).slice(0, 24);
      return renderChart(
        synthItems,
        numericSynth.labelKey,
        numericSynth.valueKey,
        "bar",
        numericSynth.valueKey.replace(/_/g, " "),
      );
    }

    return wrapChartVisual(<EmptyChart message="No data available for the selected filters." />, 0);
  };

  const widgetNote =
    featureKey && resolveFeatureNote
      ? resolveFeatureNote(featureKey, "note" in block ? block.note : undefined)
      : "note" in block
        ? block.note
        : undefined;

  if (empty) {
    return (
      <article className="bi-chart-widget" data-widget-id={widgetId}>
        <header className="bi-chart-widget__header">
          <h3 className="bi-chart-widget__title">{title}</h3>
        </header>
        <EmptyChart message={block.message} />
      </article>
    );
  }

  return (
    <article className="bi-chart-widget" data-widget-id={widgetId}>
      <header className="bi-chart-widget__header">
        <h3 className="bi-chart-widget__title">{title}</h3>
        <div className="bi-badge-row">
          <span className="bi-badge bi-badge--type">{analyticsType}</span>
          <span className="bi-badge bi-badge--method">{analyticsMethod}</span>
        </div>
        {widgetNote ? (
          <p className="bi-chart-widget__subtitle">{widgetNote}</p>
        ) : null}
        {resolvedMeta?.monthFromX ? (
          <TimeGranularityPicker
            variant="compact"
            value={widgetGranularity}
            onChange={(granularity) => {
              setFocusedPeriod(null);
              setWidgetGranularity(granularity);
            }}
          />
        ) : null}
        {focusedPeriod ? (
          <button
            type="button"
            className="bi-chart-widget__btn bi-chart-widget__btn--active"
            onClick={() => setFocusedPeriod(null)}
          >
            Clear period focus ({focusedPeriod})
          </button>
        ) : null}
        <p className="bi-chart-widget__hint">
          <span className="bi-chart-widget__hint-icon" aria-hidden>
            ⚡
          </span>
          Click any data element to drill down records, or on time-series points to zoom Year → Quarter → Month → Week → Day.
        </p>
      </header>

      <div
        className="bi-chart-widget__chart"
        data-chart-renderer="recharts"
        data-chart-items={items.length}
      >
        {buildChartVisual()}
      </div>
      {riskLegend?.length ? (
        <div className="bi-risk-legend" role="note" aria-label="Risk legend">
          {riskLegend.map((r) => (
            <span key={r.label} className="bi-risk-legend__item">
              <span className="bi-risk-legend__swatch" style={{ backgroundColor: r.color }} aria-hidden />
              {r.label}
            </span>
          ))}
        </div>
      ) : null}
      <CompactStatistics stats={stats} />

      {compareMode === "quarter" && quarterCompare ? <ComparisonBanner result={quarterCompare} /> : null}
      {compareMode === "yoy" && yoyCompare ? <ComparisonBanner result={yoyCompare} /> : null}
      {compareMode === "quarter" && !quarterCompare ? (
        <p className="bi-widget-compare bi-widget-compare--muted">Insufficient data for previous quarter comparison.</p>
      ) : null}
      {compareMode === "yoy" && !yoyCompare ? (
        <p className="bi-widget-compare bi-widget-compare--muted">Insufficient data for year-over-year comparison.</p>
      ) : null}

      <footer className="bi-chart-widget__actions">
        <button type="button" className="bi-chart-widget__btn bi-chart-widget__btn--ai" onClick={() => void explainChart()} disabled={aiLoading}>
          {aiLoading ? "Generating…" : "Explain this Chart with AI"}
        </button>
        <button type="button" className="bi-chart-widget__btn" onClick={openDetails}>
          Open Details
        </button>
        <button
          type="button"
          className={`bi-chart-widget__btn${compareMode === "quarter" ? " bi-chart-widget__btn--active" : ""}`}
          onClick={() => setCompareMode((m) => (m === "quarter" ? "none" : "quarter"))}
        >
          Compare Previous Quarter
        </button>
        <button
          type="button"
          className={`bi-chart-widget__btn${compareMode === "yoy" ? " bi-chart-widget__btn--active" : ""}`}
          onClick={() => setCompareMode((m) => (m === "yoy" ? "none" : "yoy"))}
        >
          Compare Year-over-Year
        </button>
      </footer>

      <DrillDownAnalyticsModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        selection={selection ?? { label: title, displayLabel: title, fieldKeys: [] }}
        allRows={scopedDrilldown.length ? scopedDrilldown : drilldown}
        columns={columns}
        filterOptions={filterOptions}
        context={{
          sectionTitle: title,
          chartType: resolvedMeta?.kind ?? "bar",
          chartItems: items,
          valueField: resolvedMeta?.valueKey,
          analyticsType,
          analyticsMethod,
          xAxisLabel: resolvedMeta?.labelKey?.replace(/_/g, " "),
          yAxisLabel: legendLabel,
        }}
      />
    </article>
  );
}
