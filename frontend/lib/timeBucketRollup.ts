import type { TimeGranularity } from "@/components/admin/TimeGranularityPicker";
import type { InferredChartMeta } from "@/lib/chartDrilldownUtils";
const DATE_FIELDS = [
  "date",
  "scheduled_date",
  "delivery_date",
  "completed_at",
  "assigned_at",
  "expense_date",
  "period",
  "month",
] as const;

const SERIES_CATEGORY_FIELDS = [
  "fulfillment_status",
  "delivery_status",
  "status",
  "trip_status",
  "activity_type",
  "category",
  "record_type",
  "confirmation_status",
  "delay_cause",
  "dispatch_event",
  "cause",
] as const;

/** Charts that stay categorical (region/route/scatter) — no time rollup picker. */
const ROLLUP_EXCLUDED_FEATURES = new Set([
  "route_history",
  "distance_records",
  "past_delivery_routes",
  "fuel_usage_prediction",
  "travel_time_estimation",
  "optimal_route_prediction",
]);

function parseDateToken(raw: unknown): Date | null {
  if (raw == null || raw === "" || raw === "—") return null;
  const token = String(raw).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(token)) {
    const monthMatch = String(raw).trim().match(/^(\d{4})-(\d{2})$/);
    if (monthMatch) return new Date(Date.UTC(Number(monthMatch[1]), Number(monthMatch[2]) - 1, 1));
    const yearMatch = String(raw).trim().match(/^(\d{4})$/);
    if (yearMatch) return new Date(Date.UTC(Number(yearMatch[1]), 0, 1));
    return null;
  }
  const d = new Date(`${token}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function periodKeyFromDate(d: Date, granularity: TimeGranularity): string {
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  if (granularity === "daily") {
    return d.toISOString().slice(0, 10);
  }
  if (granularity === "yearly") {
    return String(year);
  }
  if (granularity === "quarterly") {
    return `${year}-Q${Math.floor((month - 1) / 3) + 1}`;
  }
  if (granularity === "monthly") {
    return `${year}-${String(month).padStart(2, "0")}`;
  }
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1);
  const diffDays = Math.floor((d.getTime() - mondayWeek1.getTime()) / 86_400_000);
  const week = Math.floor(diffDays / 7) + 1;
  return `${year}-W${String(Math.max(1, week)).padStart(2, "0")}`;
}

export function sortPeriodKeys(keys: string[], granularity: TimeGranularity): string[] {
  if (granularity === "quarterly") {
    return [...keys].sort(
      (a, b) =>
        Number(a.split("-Q")[0]) - Number(b.split("-Q")[0]) ||
        Number(a.split("-Q")[1]) - Number(b.split("-Q")[1]),
    );
  }
  if (granularity === "weekly") {
    return [...keys].sort(
      (a, b) =>
        Number(a.split("-W")[0]) - Number(b.split("-W")[0]) ||
        Number(a.split("-W")[1]) - Number(b.split("-W")[1]),
    );
  }
  if (granularity === "yearly") {
    return [...keys].sort((a, b) => Number(a) - Number(b));
  }
  return [...keys].sort();
}

function periodChartRow(period: string, fields: Record<string, number>): Record<string, unknown> {
  const row: Record<string, unknown> = { period, ...fields };
  if (period.length === 7 && period[4] === "-") {
    row.month = period;
  }
  return row;
}

export function detectDrilldownDateField(rows: Record<string, unknown>[]): string | null {
  if (!rows.length) return null;
  for (const field of DATE_FIELDS) {
    if (rows.some((row) => parseDateToken(row[field]) != null)) return field;
  }
  return null;
}

function isAverageField(key: string): boolean {
  return (
    key.startsWith("avg_") ||
    key.endsWith("_rate") ||
    key.endsWith("_rate_pct") ||
    key.includes("average") ||
    key.endsWith("_hours") ||
    key === "hours"
  );
}

function shouldMaxAggregate(key: string): boolean {
  return key.includes("risk_score") || key === "maintenance_risk_score";
}

function shouldCountRows(valueKey: string): boolean {
  return valueKey === "count" || valueKey === "trip_count" || valueKey.endsWith("_count");
}

function aggregateValues(values: number[], valueKey: string): number {
  if (!values.length) return 0;
  if (shouldMaxAggregate(valueKey)) return Math.max(...values);
  if (shouldCountRows(valueKey) || isAverageField(valueKey)) {
    return shouldCountRows(valueKey) ? values.length : values.reduce((a, b) => a + b, 0) / values.length;
  }
  return values.reduce((a, b) => a + b, 0);
}

function resolveDrilldownMetric(row: Record<string, unknown>, valueKey: string): number | null {
  let val = numericDrilldownValue(row, valueKey);
  if (val != null) return val;
  if (valueKey === "avg_travel_hours") {
    val = numericDrilldownValue(row, "travel_time_hours");
    if (val != null) return val;
  }
  if (valueKey === "maintenance_risk_score") {
    val = numericDrilldownValue(row, "maintenance_risk_score");
    if (val != null) return val;
  }
  if (valueKey === "count" || valueKey === "trip_count") return 1;
  const fallback = ["amount_php", "cost_php", "revenue_php", "total_cost_php", "travel_time_hours"].find(
    (k) => numericDrilldownValue(row, k) != null,
  );
  return fallback ? numericDrilldownValue(row, fallback) : null;
}

function numericDrilldownValue(row: Record<string, unknown>, key: string): number | null {
  const raw = row[key];
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim() !== "" && raw !== "—" && !Number.isNaN(Number(raw))) {
    return Number(raw);
  }
  return null;
}

function resolveSeriesCategoryField(
  drilldown: Record<string, unknown>[],
  seriesKeys?: string[],
): string | null {
  if (!seriesKeys?.length) return null;
  for (const field of SERIES_CATEGORY_FIELDS) {
    if (!drilldown.some((row) => row[field] != null && String(row[field]).trim() !== "")) continue;
    const values = new Set(drilldown.map((row) => String(row[field] ?? "")));
    if (seriesKeys.every((key) => values.has(key))) return field;
  }
  return null;
}

function rollupDeliverySuccessRateFromDrilldown(
  drilldown: Record<string, unknown>[],
  granularity: TimeGranularity,
  limit: number,
): Record<string, unknown>[] | null {
  const dateField = detectDrilldownDateField(drilldown);
  if (!dateField) return null;
  const buckets: Record<string, { total: number; delivered: number }> = {};
  for (const row of drilldown) {
    const date = parseDateToken(row[dateField]);
    if (!date) continue;
    const period = periodKeyFromDate(date, granularity);
    buckets[period] ??= { total: 0, delivered: 0 };
    buckets[period].total += 1;
    const status = String(row.delivery_status ?? row.status ?? "").toLowerCase();
    if (status === "delivered") buckets[period].delivered += 1;
  }
  const keys = sortPeriodKeys(Object.keys(buckets), granularity).slice(-limit);
  if (!keys.length) return null;
  return keys.map((period) => {
    const bucket = buckets[period];
    const rate = bucket.total ? Math.round((bucket.delivered / bucket.total) * 1000) / 1000 : 0;
    return periodChartRow(period, {
      delivery_success_rate: rate,
      delivered: bucket.delivered,
      total: bucket.total,
    });
  });
}

function rollupChartFromExistingPeriods(
  chart: Record<string, unknown>[],
  granularity: TimeGranularity,
  meta: InferredChartMeta,
  limit: number,
): Record<string, unknown>[] | null {
  const axisKey = meta.xKey ?? meta.labelKey;
  if (!chart.length || (axisKey !== "period" && axisKey !== "month")) return null;

  const valueKey = meta.valueKey;
  const seriesKeys = meta.seriesKeys?.length ? meta.seriesKeys : [valueKey];

  if (valueKey.includes("delivery_success_rate") && chart.some((row) => row.delivered != null && row.total != null)) {
    const nested: Record<string, { delivered: number; total: number }> = {};
    for (const row of chart) {
      const label = String(row[axisKey] ?? "");
      if (!label) continue;
      let date = parseDateToken(label.length === 7 ? `${label}-01` : label.length === 4 ? `${label}-01-01` : label);
      if (!date && /^\d{4}-Q[1-4]$/.test(label)) {
        const [, y, q] = label.match(/^(\d{4})-Q([1-4])$/) ?? [];
        if (y && q) date = new Date(Date.UTC(Number(y), (Number(q) - 1) * 3, 1));
      }
      if (!date && /^\d{4}-W\d{2}$/.test(label)) {
        date = parseDateToken(`${label.slice(0, 4)}-01-04`);
      }
      if (!date) continue;
      const bucket = periodKeyFromDate(date, granularity);
      nested[bucket] ??= { delivered: 0, total: 0 };
      nested[bucket].delivered += Number(row.delivered) || 0;
      nested[bucket].total += Number(row.total) || 0;
    }
    const keys = sortPeriodKeys(Object.keys(nested), granularity).slice(-limit);
    if (!keys.length) return null;
    return keys.map((period) => {
      const bucket = nested[period];
      const rate = bucket.total ? Math.round((bucket.delivered / bucket.total) * 1000) / 1000 : 0;
      return periodChartRow(period, {
        delivery_success_rate: rate,
        delivered: bucket.delivered,
        total: bucket.total,
      });
    });
  }

  const nested: Record<string, Record<string, number[]>> = {};

  for (const row of chart) {
    const label = String(row[axisKey] ?? "");
    if (!label) continue;
    let date = parseDateToken(label.length === 7 ? `${label}-01` : label.length === 4 ? `${label}-01-01` : label);
    if (!date && /^\d{4}-Q[1-4]$/.test(label)) {
      const [, y, q] = label.match(/^(\d{4})-Q([1-4])$/) ?? [];
      if (y && q) date = new Date(Date.UTC(Number(y), (Number(q) - 1) * 3, 1));
    }
    if (!date && /^\d{4}-W\d{2}$/.test(label)) {
      date = parseDateToken(`${label.slice(0, 4)}-01-04`);
    }
    if (!date) continue;
    const bucket = periodKeyFromDate(date, granularity);
    nested[bucket] ??= {};
    for (const key of seriesKeys) {
      const val = numericDrilldownValue(row, key);
      if (val == null) continue;
      nested[bucket][key] ??= [];
      nested[bucket][key].push(val);
    }
  }

  const keys = sortPeriodKeys(Object.keys(nested), granularity).slice(-limit);
  if (!keys.length) return null;

  return keys.map((period) => {
    const bucket = nested[period];
    const fields: Record<string, number> = {};
    for (const key of seriesKeys) {
      const values = bucket[key];
      if (!values?.length) continue;
      fields[key] = Math.round(aggregateValues(values, key) * 100) / 100;
    }
    return periodChartRow(period, fields);
  });
}

export function rollupDrilldownToChart({
  drilldown,
  chart,
  granularity,
  meta,
  limit = 24,
}: {
  drilldown: Record<string, unknown>[];
  chart: Record<string, unknown>[];
  granularity: TimeGranularity;
  meta: InferredChartMeta;
  limit?: number;
}): Record<string, unknown>[] | null {
  const dateField = detectDrilldownDateField(drilldown);
  const valueKey = meta.valueKey;
  const seriesKeys = meta.seriesKeys?.length ? meta.seriesKeys : null;
  const categoryField = resolveSeriesCategoryField(drilldown, seriesKeys ?? undefined);

  if (valueKey.includes("delivery_success_rate") && drilldown.length) {
    const weighted = rollupDeliverySuccessRateFromDrilldown(drilldown, granularity, limit);
    if (weighted?.length) return weighted;
  }

  if (!dateField && chart.length) {
    return rollupChartFromExistingPeriods(chart, granularity, meta, limit);
  }
  if (!dateField) return null;

  if (seriesKeys && categoryField) {
    const nested: Record<string, Record<string, number>> = {};
    for (const row of drilldown) {
      const date = parseDateToken(row[dateField]);
      if (!date) continue;
      const period = periodKeyFromDate(date, granularity);
      const series = String(row[categoryField] ?? "");
      if (!seriesKeys.includes(series)) continue;
      nested[period] ??= {};
      nested[period][series] = (nested[period][series] ?? 0) + 1;
    }
    const keys = sortPeriodKeys(Object.keys(nested), granularity).slice(-limit);
    if (!keys.length) return null;
    return keys.map((period) => periodChartRow(period, nested[period]));
  }

  if (seriesKeys && seriesKeys.length > 1) {
    const nested: Record<string, Record<string, number>> = {};
    for (const row of drilldown) {
      const date = parseDateToken(row[dateField]);
      if (!date) continue;
      const period = periodKeyFromDate(date, granularity);
      nested[period] ??= {};
      for (const key of seriesKeys) {
        if (key.startsWith("predicted_") || key.startsWith("forecast_")) continue;
        const val = numericDrilldownValue(row, key);
        if (val == null) continue;
        nested[period][key] = (nested[period][key] ?? 0) + val;
      }
    }
    const keys = sortPeriodKeys(Object.keys(nested), granularity).slice(-limit);
    if (!keys.length) return null;
    return keys.map((period) => {
      const bucket = nested[period];
      const rounded: Record<string, number> = {};
      for (const [k, v] of Object.entries(bucket)) rounded[k] = Math.round(v * 100) / 100;
      return periodChartRow(period, rounded);
    });
  }

  const buckets: Record<string, number[]> = {};

  for (const row of drilldown) {
    const date = parseDateToken(row[dateField]);
    if (!date) continue;
    const period = periodKeyFromDate(date, granularity);
    if (shouldCountRows(valueKey)) {
      buckets[period] ??= [];
      buckets[period].push(1);
      continue;
    }
    const val = resolveDrilldownMetric(row, valueKey);
    if (val == null) continue;
    buckets[period] ??= [];
    buckets[period].push(val);
  }

  const keys = sortPeriodKeys(Object.keys(buckets), granularity).slice(-limit);
  if (!keys.length) return null;

  return keys.map((period) => {
    const value = aggregateValues(buckets[period], valueKey);
    return periodChartRow(period, { [valueKey]: Math.round(value * 100) / 100 });
  });
}

function fillYearRange(
  rows: Record<string, unknown>[],
  valueKey: string,
): Record<string, unknown>[] {
  const years = rows
    .map((row) => Number.parseInt(String(row.period ?? ""), 10))
    .filter((year) => Number.isFinite(year));
  if (!years.length) return rows;
  const min = Math.min(...years);
  const max = Math.max(...years);
  const byYear = new Map(rows.map((row) => [String(row.period), row]));
  const filled: Record<string, unknown>[] = [];
  for (let year = min; year <= max; year += 1) {
    const key = String(year);
    filled.push(byYear.get(key) ?? periodChartRow(key, { [valueKey]: 0 }));
  }
  return filled;
}

function countLikeValueKey(valueKey: string): boolean {
  return (
    valueKey === "count" ||
    valueKey.endsWith("_count") ||
    valueKey === "trip_count" ||
    valueKey === "frequency" ||
    valueKey === "report_count" ||
    valueKey === "deliveries"
  );
}

/** Enable per-widget time rollup when chart or drilldown supports period bucketing. */
export function augmentMetaForTimeRollup(
  meta: InferredChartMeta | null,
  chart: Record<string, unknown>[],
  drilldown: Record<string, unknown>[],
  featureKey?: string,
): InferredChartMeta | null {
  if (!meta || meta.monthFromX) return meta;
  if (featureKey && ROLLUP_EXCLUDED_FEATURES.has(featureKey)) return meta;
  if (meta.kind === "scatter") return meta;

  const axisKey = meta.xKey ?? meta.labelKey;
  if (axisKey === "period" || axisKey === "month") {
    return { ...meta, monthFromX: true, xKey: axisKey, labelKey: axisKey };
  }

  const dateField = detectDrilldownDateField(drilldown);
  if (!dateField || drilldown.length < 1) return meta;

  if (meta.kind === "pie" && meta.labelKey && meta.valueKey === "count" && chart.length >= 2) {
    const categoryKey = meta.labelKey;
    const categories = chart
      .map((row) => String(row[categoryKey] ?? ""))
      .filter((label) => label.length > 0);
    if (categories.length >= 2) {
      return {
        ...meta,
        kind: "stackedBar",
        monthFromX: true,
        xKey: "period",
        labelKey: "period",
        yKey: categories[0],
        valueKey: categories[0],
        seriesKeys: categories,
        fieldKeys: meta.fieldKeys.includes(dateField) ? meta.fieldKeys : [...meta.fieldKeys, dateField],
      };
    }
  }

  const valueKey = countLikeValueKey(meta.valueKey) ? meta.valueKey : "count";
  const rollupKind =
    meta.kind === "pie" || meta.kind === "pareto" || meta.kind === "heatmap"
      ? "bar"
      : meta.kind === "horizontalBar"
        ? "bar"
        : meta.kind;

  return {
    ...meta,
    kind: rollupKind,
    monthFromX: true,
    xKey: "period",
    labelKey: "period",
    yKey: valueKey,
    valueKey,
    fieldKeys: meta.fieldKeys.includes(dateField) ? meta.fieldKeys : [...meta.fieldKeys, dateField],
  };
}

export function applyWidgetTimeRollup(
  chart: Record<string, unknown>[],
  drilldown: Record<string, unknown>[],
  granularity: TimeGranularity,
  meta: InferredChartMeta | null,
): Record<string, unknown>[] {
  if (!meta?.monthFromX) return chart;
  const valueKey = meta.valueKey;
  const rolled = rollupDrilldownToChart({
    drilldown,
    chart,
    granularity,
    meta,
    limit: granularity === "daily" || granularity === "weekly" ? 24 : 36,
  });
  if (rolled?.length) {
    return granularity === "yearly" && valueKey ? fillYearRange(rolled, valueKey) : rolled;
  }
  return chart.length ? chart : [];
}
