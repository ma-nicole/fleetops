import type { TimeGranularity } from "@/components/admin/TimeGranularityPicker";

export const GRANULARITY_ORDER: TimeGranularity[] = ["yearly", "quarterly", "monthly", "weekly", "daily"];

export function detectPeriodGranularity(period: string): TimeGranularity | null {
  const token = String(period ?? "").trim();
  if (/^\d{4}-W\d{2}$/.test(token)) return "weekly";
  if (/^\d{4}-\d{2}-\d{2}$/.test(token)) return "daily";
  if (/^\d{4}-Q[1-4]$/.test(token)) return "quarterly";
  if (/^\d{4}-\d{2}$/.test(token)) return "monthly";
  if (/^\d{4}$/.test(token)) return "yearly";
  return null;
}

export function nextGranularity(current: TimeGranularity): TimeGranularity | null {
  const index = GRANULARITY_ORDER.indexOf(current);
  if (index < 0 || index >= GRANULARITY_ORDER.length - 1) return null;
  return GRANULARITY_ORDER[index + 1];
}

export function dateRangeForPeriod(period: string, granularity: TimeGranularity): { from: string; to: string } | null {
  const token = String(period ?? "").trim();
  if (granularity === "yearly" && /^\d{4}$/.test(token)) {
    return { from: `${token}-01-01`, to: `${token}-12-31` };
  }
  const quarterMatch = token.match(/^(\d{4})-Q([1-4])$/);
  if (granularity === "quarterly" && quarterMatch) {
    const year = Number(quarterMatch[1]);
    const quarter = Number(quarterMatch[2]);
    const startMonth = (quarter - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    const lastDay = new Date(Date.UTC(year, endMonth, 0)).getUTCDate();
    return {
      from: `${year}-${String(startMonth).padStart(2, "0")}-01`,
      to: `${year}-${String(endMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
    };
  }
  const monthMatch = token.match(/^(\d{4})-(\d{2})$/);
  if (granularity === "monthly" && monthMatch) {
    const year = Number(monthMatch[1]);
    const month = Number(monthMatch[2]);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return {
      from: `${year}-${String(month).padStart(2, "0")}-01`,
      to: `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
    };
  }
  if (granularity === "daily" && token.length >= 10) {
    return { from: token.slice(0, 10), to: token.slice(0, 10) };
  }
  return null;
}

/** Drill from current rollup into the next finer level using a clicked period label. */
export function drillDownFromPeriod(
  period: string,
  currentGranularity: TimeGranularity,
): { granularity: TimeGranularity; dateFrom: string; dateTo: string } | null {
  const next = nextGranularity(currentGranularity);
  if (!next) return null;
  const periodGranularity = detectPeriodGranularity(period);
  const rangeGranularity = periodGranularity ?? currentGranularity;
  const range = dateRangeForPeriod(period, rangeGranularity);
  if (!range) return null;
  return { granularity: next, dateFrom: range.from, dateTo: range.to };
}

export function granularityLabel(granularity: TimeGranularity): string {
  if (granularity === "yearly") return "Year";
  if (granularity === "quarterly") return "Quarter";
  if (granularity === "monthly") return "Month";
  if (granularity === "weekly") return "Week";
  return "Day";
}
