import type { InferredChartMeta } from "@/lib/chartDrilldownUtils";

export type AnalyticsChartKind = InferredChartMeta["kind"];

const RICH_KINDS: AnalyticsChartKind[] = ["combo", "stackedBar", "area"];

export function inferPreferredChartKind(featureKey: string): AnalyticsChartKind | undefined {
  const key = featureKey.toLowerCase();

  if (key.includes("forecast") || key.includes("prediction") || key.includes("predict")) {
    return "line";
  }
  if (
    key.includes("trend") ||
    key.includes("history") ||
    key.includes("over_time") ||
    key.includes("monthly") ||
    key.includes("timeline")
  ) {
    return "line";
  }
  if (
    key.includes("expense") &&
    (key.includes("composition") || key.includes("breakdown") || key.includes("stack"))
  ) {
    return "stackedBar";
  }
  if (key.includes("utilization") || key.includes("volume") || key.includes("cumulative")) {
    return "area";
  }
  if (
    key.includes("distribution") ||
    key.includes("share") ||
    key.includes("composition") ||
    key.includes("status")
  ) {
    return "pie";
  }
  if (key.includes("ranking") || key.includes("comparison") || key.includes("compare")) {
    return "bar";
  }
  return undefined;
}

export function inferAnalyticsMethod(featureKey: string, analyticsType: string): string {
  const key = featureKey.toLowerCase();
  if (analyticsType === "Predictive") return "Time-series / predictive modeling";
  if (analyticsType === "Prescriptive") return "Optimization / recommendation modeling";
  if (key.includes("forecast") || key.includes("prediction")) return "Forecast extrapolation";
  if (key.includes("trend") || key.includes("history") || key.includes("over_time")) {
    return "Trend and historical analysis";
  }
  if (key.includes("distribution") || key.includes("share")) return "Distribution analysis";
  if (key.includes("ranking")) return "Ranking analysis";
  if (key.includes("variance") || key.includes("overrun")) return "Variance analysis";
  if (key.includes("risk") || key.includes("issue") || key.includes("breakdown")) {
    return "Risk pattern analysis";
  }
  if (key.includes("utilization")) return "Utilization ratio analysis";
  if (key.includes("workload") || key.includes("staffing")) return "Workload aggregation";
  if (key.includes("delay") || key.includes("traffic")) return "Delay pattern analysis";
  if (key.includes("fuel") || key.includes("toll") || key.includes("cost")) {
    return "Cost concentration analysis";
  }
  return "Period aggregation";
}

export function inferAnalyticsType(
  source: "descriptive" | "predictive",
  featureKey: string,
): "Descriptive" | "Diagnostic" | "Predictive" | "Prescriptive" {
  const key = featureKey.toLowerCase();
  if (source === "predictive") {
    if (key.includes("optimal") || key.includes("allocation") || key.includes("recommend")) {
      return "Prescriptive";
    }
    return "Predictive";
  }
  if (
    key.includes("risk") ||
    key.includes("variance") ||
    key.includes("overrun") ||
    key.includes("fluctuation") ||
    key.includes("issue") ||
    key.includes("breakdown") ||
    key.includes("delay")
  ) {
    return "Diagnostic";
  }
  return "Descriptive";
}

/** Apply preferred kind without downgrading richer inferred kinds (combo/area/stackedBar). */
export function mergeChartKind(
  inferred: AnalyticsChartKind,
  preferred?: AnalyticsChartKind,
): AnalyticsChartKind {
  if (!preferred) return inferred;
  if (RICH_KINDS.includes(inferred) && !RICH_KINDS.includes(preferred)) {
    return inferred;
  }
  return preferred;
}

export function isForecastChartRow(row: Record<string, unknown>): boolean {
  return row.series_type === "forecast";
}
