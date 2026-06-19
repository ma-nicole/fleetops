"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  analyticsType?: "Descriptive" | "Diagnostic" | "Predictive" | "Prescriptive";
  analyticsMethod?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
};

type FilterOptions = AdminAnalyticsPayload["filter_options"];

type DrillIndicator = {
  label: string;
  value: string | number;
  interpretation?: string;
};

function toMonthName(monthIso: string): string {
  const [year, month] = monthIso.split("-");
  if (!year || !month) return monthIso;
  const date = new Date(`${year}-${month}-01T00:00:00Z`);
  return `${date.toLocaleString("en-US", { month: "short", timeZone: "UTC" })} ${year}`;
}

function computeTimeHierarchyOptions(rows: Record<string, unknown>[]) {
  const daySet = new Set<string>();
  const monthSet = new Set<string>();
  const quarterSet = new Set<string>();
  const yearSet = new Set<string>();
  const weekSet = new Set<string>();
  const dateFields = ["delivery_date", "expense_date", "paid_at", "date", "scheduled_date", "completed_at"];

  const toIsoWeek = (dateIso: string): string => {
    const d = new Date(`${dateIso}T00:00:00Z`);
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
  };

  for (const row of rows) {
    const rawDate = dateFields.map((f) => row[f]).find((v) => v != null);
    if (!rawDate) continue;
    const iso = String(rawDate).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) continue;
    const year = iso.slice(0, 4);
    const month = iso.slice(0, 7);
    const monthNum = Number(iso.slice(5, 7));
    daySet.add(iso);
    monthSet.add(month);
    yearSet.add(year);
    quarterSet.add(`${year}-Q${Math.ceil(monthNum / 3)}`);
    weekSet.add(toIsoWeek(iso));
  }

  return {
    years: [...yearSet].sort(),
    quarters: [...quarterSet].sort(),
    months: [...monthSet].sort(),
    weeks: [...weekSet].sort(),
    days: [...daySet].sort(),
  };
}

function computeGrowthIndicator(rows: Record<string, unknown>[], valueField?: string): string | null {
  if (!valueField) return null;
  const dateFields = ["delivery_date", "expense_date", "paid_at", "date", "scheduled_date", "completed_at", "month"];
  const series: Array<{ date: string; value: number }> = [];
  for (const row of rows) {
    const rawDate = dateFields.map((f) => row[f]).find((v) => v != null);
    const rawValue = row[valueField];
    if (rawDate == null || rawValue == null) continue;
    const n = Number(rawValue);
    if (!Number.isFinite(n)) continue;
    series.push({ date: String(rawDate).slice(0, 10), value: n });
  }
  if (series.length < 2) return null;
  series.sort((a, b) => a.date.localeCompare(b.date));
  const first = series[0].value;
  const last = series[series.length - 1].value;
  if (first === 0) return null;
  const pct = ((last - first) / Math.abs(first)) * 100;
  return `${pct > 0 ? "+" : ""}${pct.toFixed(2)}%`;
}

function indicatorSummary(
  rows: Record<string, unknown>[],
  context: DrillDownModalContext,
): DrillIndicator[] {
  const indicators: DrillIndicator[] = [
    { label: "Analytics Type", value: context.analyticsType ?? "Descriptive" },
    { label: "Method", value: context.analyticsMethod ?? "Comparative aggregation" },
    { label: "Chart Type", value: context.chartType.toUpperCase() },
    { label: "Total Records", value: rows.length },
  ];
  if (context.xAxisLabel) indicators.push({ label: "X-axis", value: context.xAxisLabel });
  if (context.yAxisLabel) indicators.push({ label: "Y-axis", value: context.yAxisLabel });
  const growth = computeGrowthIndicator(rows, context.valueField);
  if (growth) {
    indicators.push({
      label: "Growth Rate",
      value: growth,
      interpretation: "Compares earliest and latest points in the current filtered view.",
    });
  }
  return indicators;
}

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
  const aiSectionRef = useRef<HTMLElement | null>(null);

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

  useEffect(() => {
    if (interpretation && aiSectionRef.current) {
      aiSectionRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [interpretation]);

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
  const hierarchy = useMemo(() => computeTimeHierarchyOptions(chartFiltered), [chartFiltered]);
  const indicators = useMemo(
    () => indicatorSummary(panelFiltered, context),
    [context, panelFiltered],
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

  const exportCsv = () => {
    if (!panelFiltered.length) return;
    const header = columns.map((c) => c.label).join(",");
    const body = panelFiltered.map((row) =>
      columns
        .map((c) => {
          const raw = row[c.key] ?? "";
          const cell = String(raw).replace(/"/g, "\"\"");
          return `"${cell}"`;
        })
        .join(","),
    );
    const csv = [header, ...body].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${context.sectionTitle.replace(/\s+/g, "_").toLowerCase()}_drilldown.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
          <section className="bi-drilldown-section bi-drilldown-section--filters">
            <h3 className="bi-drilldown-section__title">Section 1 — Filters</h3>
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
                Year
                <select
                  className="input"
                  value={panelFilters.year}
                  onChange={(e) =>
                    setPanelFilters((f) => ({
                      ...f,
                      year: e.target.value,
                      quarter: "",
                      month: "",
                      week: "",
                      day: "",
                    }))
                  }
                >
                  <option value="">All years</option>
                  {hierarchy.years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </label>
              <label className="filter-panel__label">
                Quarter
                <select
                  className="input"
                  value={panelFilters.quarter}
                  onChange={(e) =>
                    setPanelFilters((f) => ({
                      ...f,
                      quarter: e.target.value,
                      month: "",
                      week: "",
                      day: "",
                    }))
                  }
                >
                  <option value="">All quarters</option>
                  {hierarchy.quarters.map((q) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                </select>
              </label>
              <label className="filter-panel__label">
                Month
                <select
                  className="input"
                  value={panelFilters.month}
                  onChange={(e) =>
                    setPanelFilters((f) => ({
                      ...f,
                      month: e.target.value,
                      week: "",
                      day: "",
                    }))
                  }
                >
                  <option value="">All months</option>
                  {hierarchy.months.map((m) => (
                    <option key={m} value={m}>
                      {toMonthName(m)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="filter-panel__label">
                Week
                <select
                  className="input"
                  value={panelFilters.week}
                  onChange={(e) => setPanelFilters((f) => ({ ...f, week: e.target.value, day: "" }))}
                >
                  <option value="">All weeks</option>
                  {hierarchy.weeks.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </label>
              <label className="filter-panel__label">
                Day
                <select
                  className="input"
                  value={panelFilters.day}
                  onChange={(e) => setPanelFilters((f) => ({ ...f, day: e.target.value }))}
                >
                  <option value="">All days</option>
                  {hierarchy.days.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
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
            <div className="quick-actions">
              <button type="button" className="quick-action-btn" onClick={() => setPanelFilters(EMPTY_PANEL_FILTERS)}>
                Reset panel filters
              </button>
              <button type="button" className="quick-action-btn" onClick={exportCsv} disabled={!panelFiltered.length}>
                Export filtered data (CSV)
              </button>
            </div>
          </section>

          <section className="bi-drilldown-section bi-drilldown-section--table">
            <h3 className="bi-drilldown-section__title">Section 2 — Data Table</h3>
            <p className="bi-drilldown-meta">
              {panelFiltered.length} source record{panelFiltered.length === 1 ? "" : "s"}
              {panelFiltered.length !== chartFiltered.length
                ? ` (${chartFiltered.length} from chart selection)`
                : ""}
              {" · "}
              Scroll inside the table to see all columns and rows.
            </p>
            {panelFiltered.length ? (
              <DrilldownTable columns={columns} rows={panelFiltered} />
            ) : (
              <p className="bi-drilldown-empty">No records found for this selection.</p>
            )}
          </section>

          <section ref={aiSectionRef} className="bi-drilldown-section bi-drilldown-section--ai">
            <h3 className="bi-drilldown-section__title">Section 3 — AI Interpretation</h3>
            <button type="button" className="quick-action-btn" onClick={() => void explainChart()} disabled={aiLoading}>
              {aiLoading ? "Generating…" : "Explain this Chart with AI"}
            </button>
            {aiError ? <p className="bi-drilldown-empty">{aiError}</p> : null}
            {interpretation ? (
              <div className="bi-interpretation-block">
                <h4 className="bi-interpretation-block__title">Interpretation</h4>
                <p className="bi-drilldown-interpretation">{interpretation}</p>
              </div>
            ) : !aiLoading && !aiError ? (
              <p className="bi-drilldown-meta">Click the button to generate an interpretation from actual chart values.</p>
            ) : null}
          </section>

          <section className="bi-drilldown-section">
            <h3 className="bi-drilldown-section__title">Section 4 — Summary / Indicators</h3>
            <div className="bi-indicator-grid">
              {indicators.map((item) => (
                <div key={item.label} className="bi-indicator-card">
                  <p className="bi-indicator-card__label">{item.label}</p>
                  <p className="bi-indicator-card__value">{item.value}</p>
                  {item.interpretation ? (
                    <p className="bi-indicator-card__note">{item.interpretation}</p>
                  ) : null}
                </div>
              ))}
            </div>
            <p className="bi-drilldown-meta" style={{ marginTop: "0.75rem" }}>
              Numeric statistics
            </p>
            {statistics ? (
              <StatisticsTable stats={statistics} />
            ) : (
              <p className="bi-drilldown-empty">Insufficient numeric data for statistics on this selection.</p>
            )}
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
