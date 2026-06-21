import type { AnalyticsChartKind } from "@/lib/analyticsChartConfig";
import type { InferredChartMeta } from "@/lib/chartDrilldownUtils";
import type { TimeGranularity } from "@/components/admin/TimeGranularityPicker";
import { periodKeyFromDate } from "@/lib/timeBucketRollup";

export const MANAGER_FEATURE_CHART_KINDS: Record<string, AnalyticsChartKind> = {
  performance_reports: "line",
  delivery_success: "line",
  efficiency_improvement: "line",
  operational_costs: "horizontalBar",
  maintenance_risk: "line",
  cost_overrun: "line",
  fuel_efficiency: "line",
  maintenance_frequency: "bar",
  fleet_performance_trend: "line",
  maintenance_issue_logs: "pareto",
  breakdown_reports: "bar",
  cost_fluctuation: "line",
  maintenance_failure: "line",
  operational_disruption: "line",
};

export function managerPreferredChartKind(featureKey: string): AnalyticsChartKind | undefined {
  return MANAGER_FEATURE_CHART_KINDS[featureKey];
}

function isDeliverySuccessChartRow(row: Record<string, unknown>): boolean {
  return row.period != null && row.delivery_success_rate != null && row.status == null;
}

function parseDrilldownDateForSuccess(raw: unknown): Date | null {
  if (raw == null || raw === "" || raw === "—") return null;
  const token = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(token)) {
    const d = new Date(`${token.slice(0, 10)}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (/^\d{4}-\d{2}$/.test(token)) {
    const [y, m] = token.split("-");
    return new Date(Date.UTC(Number(y), Number(m) - 1, 1));
  }
  if (/^\d{4}$/.test(token)) {
    return new Date(Date.UTC(Number(token), 0, 1));
  }
  return null;
}

export function buildDeliverySuccessRateChart(
  chart: Record<string, unknown>[],
  drilldown: Record<string, unknown>[],
  granularity: TimeGranularity = "yearly",
): Record<string, unknown>[] {
  const fromChart = chart.filter(isDeliverySuccessChartRow);
  if (fromChart.length) return fromChart;

  const buckets: Record<string, { total: number; delivered: number }> = {};
  for (const row of drilldown) {
    const raw = row.date ?? row.delivery_date ?? row.scheduled_month;
    const parsed = parseDrilldownDateForSuccess(raw);
    if (!parsed) continue;
    const period = periodKeyFromDate(parsed, granularity);
    if (!buckets[period]) buckets[period] = { total: 0, delivered: 0 };
    buckets[period].total += 1;
    const status = String(row.delivery_status ?? row.status ?? "").toLowerCase();
    if (status === "delivered") buckets[period].delivered += 1;
  }
  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, bucket]) => ({
      period,
      delivery_success_rate: bucket.total ? Math.round((bucket.delivered / bucket.total) * 1000) / 1000 : 0,
      delivered: bucket.delivered,
      total: bucket.total,
    }));
}

export function buildFuelEfficiencyChart(
  chart: Record<string, unknown>[],
  drilldown: Record<string, unknown>[],
): Record<string, unknown>[] {
  const fromChart = chart.filter((row) => row.period != null && row.avg_km_per_liter != null);
  if (fromChart.length) return fromChart;

  const buckets: Record<string, number[]> = {};
  for (const row of drilldown) {
    const raw = String(row.date ?? "").slice(0, 10);
    if (raw.length < 10) continue;
    const period = raw.slice(0, 7);
    const kmpl = Number(row.km_per_liter);
    if (!Number.isFinite(kmpl)) continue;
    if (!buckets[period]) buckets[period] = [];
    buckets[period].push(kmpl);
  }
  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, values]) => ({
      period,
      avg_km_per_liter: Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100,
      sample_count: values.length,
    }));
}

function normalizeMaintenanceIssueLabel(raw: string): string {
  const text = raw.trim().toLowerCase().replace(/_/g, " ");
  const rules: Array<[string, string]> = [
    ["engine", "Engine Malfunction"],
    ["malfunction", "Engine Malfunction"],
    ["misfire", "Engine Malfunction"],
    ["overheat", "Engine Malfunction"],
    ["stall", "Engine Malfunction"],
    ["knock", "Engine Malfunction"],
    ["oil", "Engine Malfunction"],
    ["mechanical", "Engine Malfunction"],
    ["tire", "Tire Puncture"],
    ["puncture", "Tire Puncture"],
    ["blowout", "Tire Puncture"],
    ["flat", "Tire Puncture"],
    ["brake", "Brake Failure"],
    ["electrical", "Electrical Issue"],
    ["battery", "Electrical Issue"],
    ["wiring", "Electrical Issue"],
    ["suspension", "Suspension Problem"],
    ["fluid", "Fluid Leak"],
    ["leak", "Fluid Leak"],
    ["coolant", "Fluid Leak"],
    ["hydraulic", "Fluid Leak"],
  ];
  for (const [token, label] of rules) {
    if (text.includes(token)) return label;
  }
  return raw.trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function buildMaintenanceIssueParetoChart(
  chart: Record<string, unknown>[],
  drilldown: Record<string, unknown>[],
): Record<string, unknown>[] {
  const fromChart = chart.filter((row) => row.issue_type != null && row.frequency != null);
  if (fromChart.length) return fromChart;

  const counts: Record<string, number> = {};
  for (const row of drilldown) {
    const label = normalizeMaintenanceIssueLabel(String(row.reported_issue ?? row.issue_type ?? ""));
    if (!label) continue;
    counts[label] = (counts[label] ?? 0) + 1;
  }
  const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a);
  const total = sorted.reduce((sum, [, freq]) => sum + freq, 0);
  if (!total) return [];
  let running = 0;
  return sorted.map(([issue_type, frequency]) => {
    running += frequency;
    return {
      issue_type,
      frequency,
      cumulative_percent: Math.round((running / total) * 1000) / 10,
    };
  });
}

function resolveVehicleRiskSeries(chart: Record<string, unknown>[]): string[] {
  if (!chart.length) return [];
  return Object.keys(chart[0]).filter(
    (key) =>
      !["period", "month", "series_type"].includes(key) &&
      chart.some((row) => row[key] != null && row[key] !== ""),
  );
}

export function buildBreakdownPerVehicleChart(
  chart: Record<string, unknown>[],
  drilldown: Record<string, unknown>[],
): Record<string, unknown>[] {
  const fromChart = chart.filter((row) => row.vehicle_id != null && row.total_breakdowns != null);
  if (fromChart.length) return fromChart;

  const counts: Record<string, number> = {};
  for (const row of drilldown) {
    const truck = String(row.truck ?? row.vehicle_id ?? "").trim();
    if (!truck || truck === "—") continue;
    counts[truck] = (counts[truck] ?? 0) + 1;
  }
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([vehicle_id, total_breakdowns]) => ({ vehicle_id, total_breakdowns }));
}

export function normalizeManagerFeatureChart(
  featureKey: string,
  chart: Record<string, unknown>[],
  drilldown: Record<string, unknown>[],
): Record<string, unknown>[] {
  if (featureKey === "delivery_success" || featureKey === "performance_reports") {
    return buildDeliverySuccessRateChart(chart, drilldown);
  }
  if (featureKey === "fuel_efficiency") {
    return buildFuelEfficiencyChart(chart, drilldown);
  }
  if (featureKey === "efficiency_improvement") {
    return chart.filter(
      (row) =>
        row.period != null &&
        (row.actual_avg_km_per_liter != null || row.forecast_avg_km_per_liter != null),
    );
  }
  if (featureKey === "maintenance_issue_logs") {
    return buildMaintenanceIssueParetoChart(chart, drilldown);
  }
  if (featureKey === "breakdown_reports") {
    return buildBreakdownPerVehicleChart(chart, drilldown);
  }
  if (featureKey === "cost_fluctuation") {
    return chart.filter(
      (row) => row.period != null && row.daily_operational_cost_php != null,
    );
  }
  if (featureKey === "maintenance_failure") {
    return chart.filter((row) => row.period != null && resolveVehicleRiskSeries(chart).some((key) => row[key] != null));
  }
  if (featureKey === "operational_disruption") {
    return chart.filter(
      (row) =>
        row.period != null &&
        (row.historical_disruption_risk != null || row.forecast_disruption_risk != null),
    );
  }
  if (featureKey === "operational_costs") {
    const fromChart = chart.filter((row) => row.category != null && row.amount_php != null);
    if (fromChart.length) return fromChart;
    const totals: Record<string, number> = {};
    for (const row of drilldown) {
      const label = String(row.category ?? row.label ?? "Other").replace(/_/g, " ");
      const amt = Number(row.amount_php ?? 0);
      if (!Number.isFinite(amt) || amt <= 0) continue;
      totals[label] = (totals[label] ?? 0) + amt;
    }
    return Object.entries(totals)
      .sort(([, a], [, b]) => b - a)
      .map(([category, amount_php]) => ({ category, amount_php: Math.round(amount_php * 100) / 100 }));
  }
  return chart;
}

export function managerChartUnit(featureKey: string): string | undefined {
  const units: Record<string, string> = {
    performance_reports: "Delivery Success Rate",
    delivery_success: "Delivery Success Rate",
    efficiency_improvement: "KM per Liter",
    operational_costs: "Cost (PHP)",
    maintenance_risk: "Maintenance Risk Score",
    cost_overrun: "Daily Operational Cost (PHP)",
    fuel_efficiency: "Km per Liter",
    maintenance_frequency: "Frequency",
    fleet_performance_trend: "Delivery Success Rate",
    maintenance_issue_logs: "Frequency (Count)",
    breakdown_reports: "Total Breakdowns",
    cost_fluctuation: "Operational Cost (PHP)",
    maintenance_failure: "Maintenance Risk Score",
    operational_disruption: "Disruption Risk Score",
  };
  return units[featureKey];
}

export function managerResolveChartMeta(
  featureKey: string,
  chart: Record<string, unknown>[],
): InferredChartMeta | null {
  if (
    (featureKey === "performance_reports" || featureKey === "delivery_success") &&
    chart.length
  ) {
    return {
      kind: "line",
      labelKey: "period",
      valueKey: "delivery_success_rate",
      xKey: "period",
      yKey: "delivery_success_rate",
      seriesKeys: ["delivery_success_rate"],
      fieldKeys: ["period", "delivery_success_rate", "delivered", "total", "delivery_status", "date"],
      monthFromX: true,
    };
  }
  if (
    featureKey === "operational_costs" &&
    chart.some((row) => row.category != null && row.amount_php != null)
  ) {
    return {
      kind: "horizontalBar",
      labelKey: "category",
      valueKey: "amount_php",
      xKey: "category",
      yKey: "amount_php",
      fieldKeys: ["category", "amount_php", "expense_date"],
    };
  }
  if (
    featureKey === "operational_costs" &&
    chart.some((row) => row.category != null && row.total_operational_cost_php != null)
  ) {
    return {
      kind: "bar",
      labelKey: "category",
      valueKey: "total_operational_cost_php",
      xKey: "category",
      yKey: "total_operational_cost_php",
      fieldKeys: ["category", "amount_php", "expense_date"],
    };
  }
  if (
    featureKey === "maintenance_risk" &&
    chart.some((row) => row.period != null && row.maintenance_risk_score != null)
  ) {
    return {
      kind: "line",
      labelKey: "period",
      valueKey: "maintenance_risk_score",
      xKey: "period",
      yKey: "maintenance_risk_score",
      seriesKeys: ["maintenance_risk_score"],
      fieldKeys: ["period", "severity", "date", "reported_issue"],
      monthFromX: true,
    };
  }
  if (
    featureKey === "cost_overrun" &&
    chart.some((row) => row.actual_daily_cost_php != null || row.predicted_daily_cost_php != null)
  ) {
    return {
      kind: "line",
      labelKey: "period",
      valueKey: "actual_daily_cost_php",
      xKey: "period",
      yKey: "actual_daily_cost_php",
      seriesKeys: ["actual_daily_cost_php", "predicted_daily_cost_php"],
      fieldKeys: ["period", "amount_php", "expense_date", "variance_php"],
      monthFromX: true,
    };
  }
  if (featureKey === "fuel_efficiency" && chart.length) {
    return {
      kind: "line",
      labelKey: "period",
      valueKey: "avg_km_per_liter",
      xKey: "period",
      yKey: "avg_km_per_liter",
      seriesKeys: ["avg_km_per_liter"],
      fieldKeys: ["period", "date", "km_per_liter", "truck"],
      monthFromX: true,
    };
  }
  if (
    featureKey === "efficiency_improvement" &&
    chart.some((row) => row.actual_avg_km_per_liter != null || row.forecast_avg_km_per_liter != null)
  ) {
    return {
      kind: "line",
      labelKey: "period",
      valueKey: "actual_avg_km_per_liter",
      xKey: "period",
      yKey: "actual_avg_km_per_liter",
      seriesKeys: ["actual_avg_km_per_liter", "forecast_avg_km_per_liter"],
      fieldKeys: ["period", "date", "km_per_liter", "truck"],
      monthFromX: true,
    };
  }
  if (
    featureKey === "maintenance_frequency" &&
    chart.some((row) => row.breakdown_count != null && row.frequency != null)
  ) {
    return {
      kind: "bar",
      labelKey: "breakdown_count",
      valueKey: "frequency",
      xKey: "breakdown_count",
      yKey: "frequency",
      fieldKeys: ["breakdown_count", "frequency", "truck"],
    };
  }
  if (
    featureKey === "fleet_performance_trend" &&
    chart.some((row) => row.actual_delivery_success_rate != null || row.forecast_delivery_success_rate != null)
  ) {
    return {
      kind: "line",
      labelKey: "period",
      valueKey: "actual_delivery_success_rate",
      xKey: "period",
      yKey: "actual_delivery_success_rate",
      seriesKeys: ["actual_delivery_success_rate", "forecast_delivery_success_rate"],
      fieldKeys: ["period", "delivery_status", "date"],
      monthFromX: true,
    };
  }
  if (
    featureKey === "maintenance_issue_logs" &&
    chart.some((row) => row.issue_type != null && row.frequency != null)
  ) {
    return {
      kind: "pareto",
      labelKey: "issue_type",
      valueKey: "frequency",
      secondarySeriesKey: "cumulative_percent",
      xKey: "issue_type",
      yKey: "frequency",
      fieldKeys: ["issue_type", "reported_issue", "severity", "date", "truck"],
    };
  }
  if (
    featureKey === "breakdown_reports" &&
    chart.some((row) => row.vehicle_id != null && row.total_breakdowns != null)
  ) {
    return {
      kind: "bar",
      labelKey: "vehicle_id",
      valueKey: "total_breakdowns",
      xKey: "vehicle_id",
      yKey: "total_breakdowns",
      fieldKeys: ["vehicle_id", "truck", "issue_type", "date", "route"],
    };
  }
  if (
    featureKey === "cost_fluctuation" &&
    chart.some((row) => row.daily_operational_cost_php != null && row.rolling_mean_7d_php != null)
  ) {
    return {
      kind: "line",
      labelKey: "period",
      valueKey: "daily_operational_cost_php",
      xKey: "period",
      yKey: "daily_operational_cost_php",
      seriesKeys: ["daily_operational_cost_php", "rolling_mean_7d_php"],
      fieldKeys: ["period", "date", "cost_php", "category", "amount_php"],
      monthFromX: true,
    };
  }
  if (featureKey === "maintenance_failure" && chart.length) {
    const truckSeries = resolveVehicleRiskSeries(chart);
    if (truckSeries.length) {
      return {
        kind: "line",
        labelKey: "period",
        valueKey: truckSeries[0],
        xKey: "period",
        yKey: truckSeries[0],
        seriesKeys: truckSeries,
        fieldKeys: ["period", "truck", "date", "reported_issue", "severity"],
        monthFromX: true,
      };
    }
  }
  if (
    featureKey === "operational_disruption" &&
    chart.some((row) => row.historical_disruption_risk != null || row.forecast_disruption_risk != null)
  ) {
    return {
      kind: "line",
      labelKey: "period",
      valueKey: "historical_disruption_risk",
      xKey: "period",
      yKey: "historical_disruption_risk",
      seriesKeys: ["historical_disruption_risk", "forecast_disruption_risk"],
      fieldKeys: ["period", "date", "status", "cause", "route", "truck"],
      monthFromX: true,
    };
  }
  return null;
}

export function managerFeatureNote(featureKey: string, blockNote?: string | null): string | undefined {
  if (featureKey === "performance_reports" || featureKey === "delivery_success") {
    return (
      "Delivery Success Rate Over Time. Tracks daily or bucketed delivery performance on a 0–1.0 scale " +
      "(e.g. 0.800 = 80%), highlighting volatility between operational floor and peak efficiency."
    );
  }
  if (featureKey === "operational_costs") {
    return (
      "Operational cost breakdown by category (fuel, toll, maintenance, allowances). " +
      "Shows how total operational spend is distributed in Philippine Peso (PHP)."
    );
  }
  if (featureKey === "maintenance_risk") {
    return (
      "Maintenance Risk Score Over Time. Tracks fleet maintenance risk on a 1–10 scale with daily or " +
      "bucketed assessments that can surge during high-severity events and drop when issues are resolved."
    );
  }
  if (featureKey === "cost_overrun") {
    return (
      "Daily Operational Cost Prediction with Overrun (PHP). Historical actual spend appears as a volatile blue " +
      "series; the red dashed line forecasts upcoming periods with a 95% confidence band."
    );
  }
  if (featureKey === "fuel_efficiency") {
    return (
      "Average Daily Fuel Efficiency (Km per Liter) Over Time. Fleet km/L can be highly volatile day to day, " +
      "with sharp swings between operational floor and peak efficiency. Hover the nearest point for " +
      "period, avg_km_per_liter, and sample_count."
    );
  }
  if (featureKey === "efficiency_improvement") {
    return (
      "Efficiency Improvement Forecasting (Average Fuel Efficiency in Km per Liter). Blue solid line shows " +
      "volatile historical km/L; the green dashed line forecasts a flat stabilized fleet baseline."
    );
  }
  if (featureKey === "maintenance_frequency") {
    return (
      "Distribution of Breakdown Count. Histogram of fleet vehicles grouped by how many breakdown events " +
      "each logged (0, 1, 2, …). Hover any bar to see the exact frequency count."
    );
  }
  if (featureKey === "fleet_performance_trend") {
    return (
      "Fleet Performance Trend Prediction (Delivery Success Rate). Blue solid line shows volatile historical " +
      "performance on a 0–1.0 scale; the red dashed line forecasts a stabilized trend for upcoming periods."
    );
  }
  if (featureKey === "maintenance_issue_logs") {
    return (
      "Pareto Chart of Maintenance Issues. Frequency bars (blue to green gradient) are ordered highest to " +
      "lowest; the red dashed cumulative line shows running percentage to prioritize vital-few issues."
    );
  }
  if (featureKey === "breakdown_reports") {
    return (
      "Total Breakdown Count per Vehicle. Each bar shows how many breakdown events a truck logged in the " +
      "selected period. Hover any bar for the exact total (e.g. TRK-001 = 28)."
    );
  }
  if (featureKey === "cost_fluctuation") {
    return (
      "Operational Cost Fluctuation Analysis (PHP). Blue line shows daily operational spend volatility; " +
      "red dashed line is the 7-period rolling mean; pink band is rolling standard deviation."
    );
  }
  if (featureKey === "maintenance_failure") {
    return (
      "Maintenance Risk Score Trends by Vehicle. Each colored line tracks an individual truck on a 1–10 " +
      "risk scale, highlighting staggered spikes that indicate asset-specific failure patterns."
    );
  }
  if (featureKey === "operational_disruption") {
    return (
      "Operational Disruption Risk Forecast. Blue solid line tracks volatile historical disruption risk on a " +
      "0–1.0 scale; the red dashed line forecasts a stabilized baseline with a narrow pink confidence band."
    );
  }
  return blockNote ?? undefined;
}
