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
  if (granularity === "weekly" && /^\d{4}-W\d{2}$/.test(token)) {
    const year = Number(token.slice(0, 4));
    const week = Number(token.slice(6, 8));
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const dayOfWeek = jan4.getUTCDay() || 7;
    const mondayWeek1 = new Date(jan4);
    mondayWeek1.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1);
    const monday = new Date(mondayWeek1);
    monday.setUTCDate(mondayWeek1.getUTCDate() + (week - 1) * 7);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    return { from: fmt(monday), to: fmt(sunday) };
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

/** True when a chart period token falls inside a clicked parent period (e.g. 2024-Q2 within 2024). */
export function periodWithinFocus(childPeriod: string, focusPeriod: string): boolean {
  const child = String(childPeriod ?? "").trim();
  const focus = String(focusPeriod ?? "").trim();
  if (!child || !focus) return true;
  if (child === focus) return true;
  const focusGran = detectPeriodGranularity(focus);
  if (focusGran === "yearly" && /^\d{4}$/.test(focus)) {
    return child.startsWith(`${focus}-`) || child.startsWith(focus);
  }
  if (focusGran === "quarterly") {
    const match = focus.match(/^(\d{4})-Q([1-4])$/i);
    if (match) {
      const year = match[1];
      const quarter = Number(match[2]);
      const monthMatch = child.match(/^(\d{4})-(\d{2})/);
      if (monthMatch && monthMatch[1] === year) {
        const month = Number(monthMatch[2]);
        const childQuarter = Math.floor((month - 1) / 3) + 1;
        return childQuarter === quarter;
      }
      return child.toUpperCase().startsWith(focus.toUpperCase());
    }
  }
  if (focusGran === "monthly" && /^\d{4}-\d{2}$/.test(focus)) {
    return child.startsWith(focus);
  }
  const range = dateRangeForPeriod(focus, focusGran ?? "monthly");
  const childGran = detectPeriodGranularity(child);
  const childRange = dateRangeForPeriod(child, childGran ?? "monthly");
  if (range && childRange) {
    return childRange.from >= range.from && childRange.to <= range.to;
  }
  return child.startsWith(focus);
}
