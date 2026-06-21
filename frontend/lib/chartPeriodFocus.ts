import type { InferredChartMeta } from "@/lib/chartDrilldownUtils";
import { detectDrilldownDateField, parseDateToken } from "@/lib/timeBucketRollup";
import { dateRangeForPeriod, detectPeriodGranularity, periodWithinFocus } from "@/lib/timePeriodDrilldown";

export function filterChartRowsByFocusedPeriod(
  chart: Record<string, unknown>[],
  focusPeriod: string,
  meta: InferredChartMeta | null,
): Record<string, unknown>[] {
  if (!focusPeriod || !chart.length) return chart;
  const axisKey = meta?.xKey ?? meta?.labelKey ?? "period";
  return chart.filter((row) => {
    const token = String(row[axisKey] ?? row.period ?? row.month ?? "");
    if (!token) return false;
    return periodWithinFocus(token, focusPeriod);
  });
}

export function filterDrilldownByFocusedPeriod(
  drilldown: Record<string, unknown>[],
  focusPeriod: string,
): Record<string, unknown>[] {
  if (!focusPeriod || !drilldown.length) return drilldown;
  const dateField = detectDrilldownDateField(drilldown);
  const focusGran = detectPeriodGranularity(focusPeriod);
  const range = dateRangeForPeriod(focusPeriod, focusGran ?? "monthly");
  if (!dateField || !range) return drilldown;
  return drilldown.filter((row) => {
    const date = parseDateToken(row[dateField]);
    if (!date) return false;
    const iso = date.toISOString().slice(0, 10);
    return iso >= range.from && iso <= range.to;
  });
}
