"use client";

import { useEffect, useMemo, useState } from "react";
import { DrilldownTable, StatisticsTable } from "@/components/admin/AnalyticsCharts";
import { formatPhp } from "@/lib/appLocale";
import {
  AnalyticsApi,
  type AdminAnalyticsPayload,
  type ComparativeMetric,
} from "@/lib/analyticsApi";
import {
  applyPanelFilters,
  computeRowStatistics,
  EMPTY_PANEL_FILTERS,
  type PanelFilters,
} from "@/lib/analyticsStatistics";
import type { ChartSelection } from "@/lib/chartDrilldownUtils";
import { filterDrilldownRows } from "@/lib/chartDrilldownUtils";

export type DrillDownModalContext = {
  sectionTitle: string;
  chartType: string;
  chartItems: Array<Record<string, string | number>>;
  valueField?: string;
};

type FilterOptions = AdminAnalyticsPayload["filter_options"];

export function DrillDownAnalyticsModal({
  open,
  onClose,
  selection,
  allRows,
  columns,
  context,
  filterOptions,
}: {
  open: boolean;
  onClose: () => void;
  selection: ChartSelection | null;
  allRows: Record<string, unknown>[];
  columns: { key: string; label: string }[];
  context: DrillDownModalContext;
  filterOptions?: FilterOptions;
}) {
  const [panelFilters, setPanelFilters] = useState<PanelFilters>(EMPTY_PANEL_FILTERS);
  const [interpretation, setInterpretation] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setPanelFilters(EMPTY_PANEL_FILTERS);
      setInterpretation(null);
      setAiError(null);
      return;
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open, selection?.label]);

  const chartFiltered = useMemo(
    () => filterDrilldownRows(allRows, selection),
    [allRows, selection],
  );
  const panelFiltered = useMemo(
    () => applyPanelFilters(chartFiltered, panelFilters, filterOptions),
    [chartFiltered, panelFilters, filterOptions],
  );

  const statistics = useMemo(
    () => computeRowStatistics(panelFiltered, context.valueField ? [context.valueField] : undefined),
    [panelFiltered, context.valueField],
  );

  if (!open || !selection) return null;

  const explainChart = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await AnalyticsApi.chartInterpretation({
        section_title: context.sectionTitle,
        selection_label: selection.displayLabel,
        chart_type: context.chartType,
        items: context.chartItems.map((item) => ({
          label: String(item.label ?? item.status ?? item.client_name ?? ""),
          status: item.status != null ? String(item.status) : undefined,
          count: item.count != null ? Number(item.count) : undefined,
          value: item.value != null ? Number(item.value) : undefined,
          amount_php: item.amount_php != null ? Number(item.amount_php) : undefined,
          client_name: item.client_name != null ? String(item.client_name) : undefined,
          truck_code: item.truck_code != null ? String(item.truck_code) : undefined,
          driver_name: item.driver_name != null ? String(item.driver_name) : undefined,
          route: item.route != null ? String(item.route) : undefined,
          month: item.month != null ? String(item.month) : undefined,
        })),
        record_count: panelFiltered.length,
        statistics: statistics ?? undefined,
      });
      setInterpretation(res.interpretation);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Interpretation unavailable.");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal
      aria-labelledby="drilldown-analytics-title"
      className="bi-drilldown-overlay"
      onClick={onClose}
    >
      <div className="bi-drilldown-modal" onClick={(e) => e.stopPropagation()}>
        <header className="bi-drilldown-modal__header">
          <div>
            <p className="bi-drilldown-modal__eyebrow">Level 3 · Drill-Down Analytics</p>
            <h2 id="drilldown-analytics-title" className="bi-drilldown-modal__title">
              {selection.displayLabel}
            </h2>
            <p className="bi-drilldown-modal__subtitle">{context.sectionTitle}</p>
          </div>
          <button type="button" className="quick-action-btn" onClick={onClose} aria-label="Close panel">
            Close
          </button>
        </header>

        <div className="bi-drilldown-modal__body">
          <section className="bi-drilldown-section">
            <h3 className="bi-drilldown-section__title">Section 1 — Descriptive Statistical Analytics</h3>
            {statistics ? (
              <StatisticsTable stats={statistics} />
            ) : (
              <p className="bi-drilldown-empty">Insufficient numeric data for statistics on this selection.</p>
            )}
          </section>

          <section className="bi-drilldown-section">
            <h3 className="bi-drilldown-section__title">Section 2 — Filtered Dataset</h3>
            <p className="bi-drilldown-meta">
              {panelFiltered.length} source record{panelFiltered.length === 1 ? "" : "s"}
              {panelFiltered.length !== chartFiltered.length
                ? ` (${chartFiltered.length} from chart selection)`
                : ""}
            </p>
            {panelFiltered.length ? (
              <DrilldownTable columns={columns} rows={panelFiltered} />
            ) : (
              <p className="bi-drilldown-empty">No records found for this selection.</p>
            )}
          </section>

          <section className="bi-drilldown-section">
            <h3 className="bi-drilldown-section__title">Section 3 — Filters</h3>
            <div className="bi-drilldown-filters">
              <label className="filter-panel__label">
                Date from
                <input
                  type="date"
                  className="input"
                  value={panelFilters.dateFrom}
                  onChange={(e) => setPanelFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                />
              </label>
              <label className="filter-panel__label">
                Date to
                <input
                  type="date"
                  className="input"
                  value={panelFilters.dateTo}
                  onChange={(e) => setPanelFilters((f) => ({ ...f, dateTo: e.target.value }))}
                />
              </label>
              <label className="filter-panel__label">
                Route
                <select
                  className="input"
                  value={panelFilters.route}
                  onChange={(e) => setPanelFilters((f) => ({ ...f, route: e.target.value }))}
                >
                  <option value="">All routes</option>
                  {(filterOptions?.routes ?? []).map((r) => (
                    <option key={r} value={r}>
                      {r.length > 48 ? `${r.slice(0, 48)}…` : r}
                    </option>
                  ))}
                </select>
              </label>
              <label className="filter-panel__label">
                Driver
                <select
                  className="input"
                  value={panelFilters.driverId}
                  onChange={(e) => setPanelFilters((f) => ({ ...f, driverId: e.target.value }))}
                >
                  <option value="">All drivers</option>
                  {(filterOptions?.drivers ?? []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="filter-panel__label">
                Truck
                <select
                  className="input"
                  value={panelFilters.truckId}
                  onChange={(e) => setPanelFilters((f) => ({ ...f, truckId: e.target.value }))}
                >
                  <option value="">All trucks</option>
                  {(filterOptions?.trucks ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.code}
                    </option>
                  ))}
                </select>
              </label>
              <label className="filter-panel__label">
                Client
                <select
                  className="input"
                  value={panelFilters.clientId}
                  onChange={(e) => setPanelFilters((f) => ({ ...f, clientId: e.target.value }))}
                >
                  <option value="">All clients</option>
                  {(filterOptions?.clients ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="filter-panel__label">
                Status
                <select
                  className="input"
                  value={panelFilters.status}
                  onChange={(e) => setPanelFilters((f) => ({ ...f, status: e.target.value }))}
                >
                  <option value="">All statuses</option>
                  {(filterOptions?.shipment_statuses ?? []).map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button type="button" className="quick-action-btn" onClick={() => setPanelFilters(EMPTY_PANEL_FILTERS)}>
              Reset panel filters
            </button>
          </section>

          <section className="bi-drilldown-section">
            <h3 className="bi-drilldown-section__title">Section 4 — AI Interpretation</h3>
            <button type="button" className="quick-action-btn" onClick={() => void explainChart()} disabled={aiLoading}>
              {aiLoading ? "Generating…" : "Explain this Chart with AI"}
            </button>
            {aiError ? <p className="bi-drilldown-empty">{aiError}</p> : null}
            {interpretation ? (
              <p className="bi-drilldown-interpretation">{interpretation}</p>
            ) : !aiLoading && !aiError ? (
              <p className="bi-drilldown-meta">Click the button to generate an interpretation from actual chart values.</p>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}

export function TrendIndicator({ trend }: { trend?: string | null }) {
  if (trend === "up") return <span className="bi-trend bi-trend--up" aria-label="Trend up">▲</span>;
  if (trend === "down") return <span className="bi-trend bi-trend--down" aria-label="Trend down">▼</span>;
  return <span className="bi-trend bi-trend--flat" aria-label="Trend flat">●</span>;
}

export function formatKpiValue(value: string | number | null | undefined, format: string): string {
  if (value === null || value === undefined) return "Insufficient data";
  if (format === "php") return formatPhp(Number(value));
  if (format === "percent") return `${value}%`;
  return String(value);
}

export function ComparativeAnalyticsBlock({
  title,
  metric,
  defaultGranularity = "yearly",
}: {
  title: string;
  metric: ComparativeMetric | null | undefined;
  defaultGranularity?: "weekly" | "monthly" | "quarterly" | "yearly";
}) {
  const [granularity, setGranularity] = useState(defaultGranularity);

  if (!metric?.series?.[granularity]?.length) {
    return null;
  }

  const series = metric.series[granularity] ?? [];
  const comparisons = metric.comparisons?.[granularity] ?? [];
  const isPhp = metric.value_format === "php";

  return (
    <div className="bi-comparative-block">
      <div className="bi-comparative-block__head">
        <h4 className="bi-comparative-block__title">{title}</h4>
        <div className="tab-pills">
          {(["weekly", "monthly", "quarterly", "yearly"] as const).map((g) =>
            metric.series?.[g]?.length ? (
              <button
                key={g}
                type="button"
                className={`tab-pill${granularity === g ? " tab-pill--active" : ""}`}
                onClick={() => setGranularity(g)}
              >
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </button>
            ) : null,
          )}
        </div>
      </div>

      {comparisons.length > 0 ? (
        <div className="bi-comparison-cards">
          {comparisons.map((c) => (
            <div key={`${c.type}-${c.label}`} className="bi-comparison-card">
              <p className="bi-comparison-card__label">{c.label}</p>
              <div className="bi-comparison-card__values">
                <span>
                  {c.previous_period}: {isPhp ? formatPhp(Number(c.previous_value)) : c.previous_value}
                </span>
                <span>→</span>
                <span>
                  {c.current_period}: {isPhp ? formatPhp(Number(c.current_value)) : c.current_value}
                </span>
              </div>
              <p className="bi-comparison-card__change">
                <TrendIndicator trend={c.trend} />
                {c.change_pct != null ? `${c.change_pct > 0 ? "+" : ""}${c.change_pct}%` : "Insufficient data"}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="bi-series-strip">
        {series.slice(-8).map((point) => (
          <div key={point.period} className="bi-series-strip__item">
            <span className="bi-series-strip__period">{point.period}</span>
            <strong>{isPhp ? formatPhp(Number(point.value)) : point.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PercentageBreakdown({
  items,
  title,
}: {
  items: { label: string; value: number; percentage: number | null }[];
  title: string;
}) {
  if (!items.length) return null;
  return (
    <div className="bi-percentage-block">
      <h4 className="bi-comparative-block__title">{title}</h4>
      <div className="bi-percentage-list">
        {items.map((item) => (
          <div key={item.label} className="bi-percentage-row">
            <span>{item.label}</span>
            <span>
              {item.percentage != null ? `${item.percentage}%` : "—"}
              <span className="bi-percentage-row__value">
                {typeof item.value === "number" && item.value > 1000 ? formatPhp(item.value) : item.value}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ExecutiveOverviewSection({
  overview,
}: {
  overview: AdminAnalyticsPayload["executive_overview"];
}) {
  if (!overview?.kpis?.length) return null;

  return (
    <section className="panel-card bi-executive-overview scroll-section" id="analytics-executive-overview">
      <div>
        <h3 className="panel-card__title">Executive Overview</h3>
        <p className="panel-card__subtitle">Level 1 — KPI cards, percentages, and growth indicators from live data</p>
      </div>
      <div className="bi-kpi-grid">
        {overview.kpis.map((kpi) => (
          <div key={kpi.key} className="bi-kpi-card">
            <p className="bi-kpi-card__label">{kpi.label}</p>
            <p className="bi-kpi-card__value">{formatKpiValue(kpi.value, kpi.format)}</p>
            {kpi.growth_pct != null ? (
              <p className="bi-kpi-card__growth">
                <TrendIndicator trend={kpi.trend} />
                {kpi.growth_pct > 0 ? "+" : ""}
                {kpi.growth_pct}% growth
              </p>
            ) : null}
            {kpi.subtitle ? <p className="bi-kpi-card__subtitle">{kpi.subtitle}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

export function BiDrillHint() {
  return (
    <p className="bi-drill-hint" role="note">
      Click any chart segment to open the Level 3 drill-down analytics panel with statistics, source records, filters,
      and on-demand interpretation.
    </p>
  );
}
