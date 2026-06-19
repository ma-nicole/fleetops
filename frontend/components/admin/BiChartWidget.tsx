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
  if (!meta) return { label: payload.label, displayLabel: payload.label, fieldKeys: [] };
  const label = String(payload.raw[meta.labelKey] ?? payload.label);
  let displayLabel = label;
  if (meta.labelKey === "status") displayLabel = formatStatusLabel(label);
  else if (meta.monthFromX) displayLabel = `Records for ${label}`;
  return { label, displayLabel, fieldKeys: meta.fieldKeys, monthKey: meta.monthFromX ? label : undefined };
}

function synthesizeFromDrilldown(drilldown: Record<string, unknown>[]): SynthesizedChart | null {
  return synthesizeChartFromCategoryCounts(drilldown) ?? synthesizeChartFromDrilldownNumeric(drilldown);
}

function toChartKind(kind: InferredChartMeta["kind"]): AnalyticsChartKind {
  if (kind === "pie") return "pie";
  if (kind === "line") return "line";
  if (kind === "area") return "area";
  if (kind === "stackedBar") return "stackedBar";
  if (kind === "combo") return "combo";
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
  analyticsType = "Descriptive",
  analyticsMethod = "Comparative aggregation",
  riskLegend,
  preferredChartKind,
  loading = false,
}: {
  title: string;
  block: RoleAnalyticsFeatureBlock;
  filterOptions?: AdminAnalyticsPayload["filter_options"];
  comparative?: ComparativeMetric | null;
  widgetId?: string;
  analyticsType?: "Descriptive" | "Diagnostic" | "Predictive" | "Prescriptive";
  analyticsMethod?: string;
  riskLegend?: Array<{ label: string; color: string }>;
  preferredChartKind?: "bar" | "line" | "pie";
  loading?: boolean;
}) {
  const [selection, setSelection] = useState<ChartSelection | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [compareMode, setCompareMode] = useState<"none" | "quarter" | "yoy">("none");
  const [aiLoading, setAiLoading] = useState(false);

  const empty = isEmptyBlock(block);
  const drilldown = empty ? [] : ((block.drilldown ?? []) as Record<string, unknown>[]);
  const chart = useMemo(() => {
    if (empty) return [];
    let rows = (block.chart ?? []) as Record<string, unknown>[];
    if (!rows.length && drilldown.length) {
      const synthesized = synthesizeFromDrilldown(drilldown);
      if (synthesized?.items.length) rows = synthesized.items;
    }
    return rows;
  }, [block, drilldown, empty]);

  const meta = useMemo(() => inferChartMeta(chart, drilldown), [chart, drilldown]);
  const resolvedMeta = useMemo<InferredChartMeta | null>(() => {
    if (!meta) return null;
    if (!preferredChartKind) return meta;
    return { ...meta, kind: preferredChartKind };
  }, [meta, preferredChartKind]);
  const items = chartRows(chart);
  const columns = inferColumns(drilldown);

  const stats = useMemo(() => {
    if (empty) return null;
    const preferFields = resolvedMeta?.valueKey ? [resolvedMeta.valueKey] : undefined;
    const blockStats = "statistics" in block ? block.statistics : null;
    if (blockStats) return blockStats;
    const chartStats = chart.length
      ? computeRowStatistics(chart as Record<string, unknown>[], preferFields)
      : null;
    if (chartStats) return chartStats;
    return computeRowStatistics(drilldown, preferFields);
  }, [block, chart, drilldown, empty, resolvedMeta?.valueKey]);
  const legendLabel = resolvedMeta?.valueKey?.replace(/_/g, " ") ?? "Value";

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
    setSelection(resolvedMeta ? buildSelection(resolvedMeta, payload) : { label: payload.label, displayLabel: payload.label, fieldKeys: [] });
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
  ) =>
    wrapChartVisual(
      <RechartsAnalyticsChart
        kind={kind}
        items={chartItems}
        labelKey={labelKey}
        valueKey={valueKey}
        seriesKeys={resolvedMeta?.seriesKeys}
        secondarySeriesKey={resolvedMeta?.secondarySeriesKey}
        xAxisLabel={labelKey.replace(/_/g, " ")}
        yAxisLabel={axisLabel}
        legendLabel={axisLabel}
        onItemClick={openDrill}
        selectedLabel={selection?.label ?? null}
        loading={loading}
      />,
      chartItems.length,
    );

  const buildChartVisual = () => {
    if (loading) {
      return wrapChartVisual(
        <RechartsAnalyticsChart kind="bar" items={[]} labelKey="label" valueKey="value" loading />,
        0,
      );
    }

    if (resolvedMeta && items.length) {
      return renderChart(
        items,
        resolvedMeta.xKey ?? resolvedMeta.labelKey,
        resolvedMeta.yKey ?? resolvedMeta.valueKey,
        toChartKind(resolvedMeta.kind),
        legendLabel,
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

    return wrapChartVisual(<EmptyChart message="No data available." />, 0);
  };

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
        <p className="bi-chart-widget__hint">
          <span className="bi-chart-widget__hint-icon" aria-hidden>
            ⚡
          </span>
          Click any data element (bar, line, slice) to drill down into disaggregated record sheets.
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
        allRows={drilldown}
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
