import type { ComparativeComparison } from "@/lib/analyticsApi";

export type PeriodComparisonResult = {
  label: string;
  currentLabel: string;
  previousLabel: string;
  currentValue: number;
  previousValue: number;
  changePct: number | null;
  trend: "up" | "down" | "flat";
  insufficient: boolean;
};

function trendFromChange(pct: number | null): "up" | "down" | "flat" {
  if (pct == null || Math.abs(pct) < 0.5) return "flat";
  return pct > 0 ? "up" : "down";
}

export function findComparative(
  comparisons: ComparativeComparison[] | undefined,
  mode: "quarter" | "year",
): PeriodComparisonResult | null {
  const type = mode === "year" ? "year_over_year" : "period_over_period";
  const match = comparisons?.find((c) => c.type === type);
  if (!match) return null;
  return {
    label: match.label,
    currentLabel: match.current_period,
    previousLabel: match.previous_period,
    currentValue: match.current_value,
    previousValue: match.previous_value,
    changePct: match.change_pct,
    trend: match.trend,
    insufficient: match.change_pct == null,
  };
}

/** Sum chart points whose period key falls in current vs previous quarter/year buckets. */
export function compareFromChartSeries(
  chart: Record<string, unknown>[],
  valueKey: string,
  periodKey: string,
  mode: "quarter" | "year",
): PeriodComparisonResult | null {
  const points: { period: string; value: number }[] = [];
  for (const row of chart) {
    const period = String(row[periodKey] ?? row.month ?? row.period ?? "");
    const value = Number(row[valueKey]);
    if (!period || !Number.isFinite(value)) continue;
    points.push({ period, value });
  }
  if (points.length < 2) return null;

  const sorted = [...points].sort((a, b) => a.period.localeCompare(b.period));
  const latest = sorted[sorted.length - 1];
  const latestDate = parsePeriod(latest.period);
  if (!latestDate) return null;

  let prev: typeof latest | undefined;
  if (mode === "year") {
    const target = `${latestDate.year - 1}-${String(latestDate.month).padStart(2, "0")}`;
    prev = sorted.find((p) => p.period.startsWith(target) || p.period === `${latestDate.year - 1}`);
    if (!prev) {
      const idx = sorted.length - 13;
      prev = idx >= 0 ? sorted[idx] : sorted[0];
    }
  } else {
    prev = sorted.length >= 2 ? sorted[sorted.length - 2] : sorted[0];
  }

  const changePct =
    prev.value > 0 ? Math.round(((latest.value - prev.value) / prev.value) * 1000) / 10 : null;

  return {
    label: mode === "year" ? "Year-over-year" : "Previous quarter",
    currentLabel: latest.period,
    previousLabel: prev.period,
    currentValue: latest.value,
    previousValue: prev.value,
    changePct,
    trend: trendFromChange(changePct),
    insufficient: changePct == null,
  };
}

function parsePeriod(period: string): { year: number; month: number } | null {
  const m = period.match(/^(\d{4})-(\d{2})/);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]) };
}
