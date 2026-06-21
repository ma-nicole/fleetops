export type ChartSelection = {
  label: string;
  displayLabel: string;
  fieldKeys: string[];
  monthKey?: string;
  recordType?: string;
};

export function normalizeChartKey(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

export function formatStatusLabel(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function filterDrilldownRows(
  rows: Record<string, unknown>[],
  selection: ChartSelection | null,
): Record<string, unknown>[] {
  if (!selection) return rows;

  return rows.filter((row) => {
    if (selection.recordType) {
      const rowType = String(row.record_type ?? row.category ?? "").toLowerCase();
      if (rowType !== String(selection.recordType).toLowerCase()) return false;
    }

    if (selection.monthKey) {
      const monthFields = ["month_cohort", "period", "month", "scheduled_month", "expense_date", "paid_at", "delivery_date", "date"];
      const monthMatch = monthFields.some((field) => {
        const raw = row[field];
        if (raw == null) return false;
        const text = String(raw);
        return text.startsWith(selection.monthKey!) || text.slice(0, 7) === selection.monthKey;
      });
      if (!monthMatch) return false;
    }

    if (selection.fieldKeys.includes("truck_type") && row.truck_type != null) {
      const matchesTruck =
        String(row.truck_type) === selection.label ||
        String(row.truck_type_chart ?? "") === selection.label ||
        String(row.truck_type_full ?? "") === selection.label;
      if (!matchesTruck) return false;
      if (selection.recordType && row.service_sector != null) {
        return String(row.service_sector) === selection.recordType;
      }
      return true;
    }

    if (selection.fieldKeys.includes("truck") && (row.truck != null || row.truck_code != null)) {
      const rowTruck = String(row.truck ?? row.truck_code ?? "");
      const normalizedSelected = normalizeChartKey(selection.label);
      return (
        rowTruck === selection.label ||
        normalizeChartKey(rowTruck) === normalizedSelected
      );
    }

    if (selection.fieldKeys.includes("region") && row.region != null) {
      return String(row.region) === selection.label;
    }

    if (selection.fieldKeys.includes("cargo_classification") && row.cargo_classification != null) {
      return String(row.cargo_classification) === selection.label;
    }

    if (selection.fieldKeys.includes("service_sector") && row.service_sector != null) {
      return String(row.service_sector) === selection.label;
    }

    if (selection.fieldKeys.includes("settlement_status") && row.settlement_status != null) {
      return String(row.settlement_status) === selection.label;
    }

    if (selection.fieldKeys.includes("confirmation_status") && row.confirmation_status != null) {
      return String(row.confirmation_status) === selection.label;
    }

    if (selection.fieldKeys.includes("profile_updated") && row.profile_updated != null) {
      return String(row.profile_updated) === selection.label;
    }

    if (selection.fieldKeys.includes("period") && row.period != null) {
      return String(row.period) === selection.label;
    }

    if (selection.fieldKeys.includes("day_of_week") && selection.fieldKeys.includes("hour")) {
      const [day, hourPart] = selection.label.split("|");
      const hour = Number(hourPart);
      const dayFields = ["day_of_week", "day"];
      if (dayFields.some((field) => row[field] != null && String(row[field]) !== day)) return false;
      if (row.hour != null && Number(row.hour) !== hour) return false;
      return true;
    }

    if (selection.fieldKeys.length === 0) {
      return true;
    }

    const normalizedSelected = normalizeChartKey(selection.label);
    return selection.fieldKeys.some((field) => {
      const raw = row[field];
      if (raw == null) return false;
      const text = String(raw);
      if (normalizeChartKey(text) === normalizedSelected) return true;
      if (text === selection.label) return true;
      if (field === "route" && (text.startsWith(selection.label) || selection.label.startsWith(text.slice(0, 48)))) {
        return true;
      }
      return false;
    });
  });
}

export function inferDrilldownFieldKeys(
  _chartRows: Record<string, unknown>[],
  drilldownRows: Record<string, unknown>[],
  labelKey: string,
): string[] {
  const drillKeys = drilldownRows.length ? Object.keys(drilldownRows[0]) : [];
  const candidates = [
    labelKey,
    labelKey.replace(/_name$/, ""),
    labelKey.replace(/_code$/, ""),
    "delivery_status",
    "status",
    "truck_code",
    "truck",
    "driver_name",
    "driver",
    "route",
    "region",
    "client_name",
    "category",
    "record_type",
    "issue_type",
    "severity",
    "cause",
  ];
  const unique = new Set<string>();
  for (const key of candidates) {
    if (drillKeys.includes(key)) unique.add(key);
  }
  if (unique.size === 0 && drillKeys.length) unique.add(drillKeys[0]);
  void _chartRows;
  return [...unique];
}

export type InferredChartMeta = {
  kind: "pie" | "line" | "bar" | "horizontalBar" | "area" | "stackedBar" | "combo" | "heatmap" | "groupedBar" | "pareto" | "scatter";
  labelKey: string;
  valueKey: string;
  xKey?: string;
  yKey?: string;
  seriesKeys?: string[];
  secondarySeriesKey?: string;
  fieldKeys: string[];
  monthFromX?: boolean;
};

export type SynthesizedChart = {
  items: Record<string, unknown>[];
  labelKey: string;
  valueKey: string;
};

export function isNumericChartValue(value: unknown): boolean {
  if (typeof value === "number" && Number.isFinite(value)) return true;
  if (typeof value === "string" && value.trim() !== "" && value !== "—" && !Number.isNaN(Number(value))) {
    return true;
  }
  return false;
}

function isNumericField(row: Record<string, unknown>, key: string): boolean {
  return isNumericChartValue(row[key]);
}

export function resolveChartKeys(
  items: Array<Record<string, string | number>>,
): { labelKey: string; valueKey: string } | null {
  if (!items.length) return null;
  const row = items[0] as Record<string, unknown>;
  const keys = Object.keys(row);
  const labelKey =
    keys.find((k) => typeof row[k] === "string") ??
    keys.find((k) => row[k] != null && !isNumericField(row, k)) ??
    keys[0];
  const valueKey =
    keys.find((k) => k !== labelKey && isNumericField(row, k)) ??
    keys.find((k) => k !== labelKey && (k.endsWith("_php") || k.endsWith("_count") || k === "count")) ??
    keys.find((k) => k !== labelKey);
  if (!labelKey || !valueKey) return null;
  return { labelKey, valueKey };
}

export function synthesizeChartFromCategoryCounts(
  drilldown: Record<string, unknown>[],
): SynthesizedChart | null {
  if (!drilldown.length) return null;
  const groupField = ["delivery_status", "status", "category"].find((field) =>
    drilldown.some((row) => field in row),
  );
  if (!groupField) return null;
  const counts: Record<string, number> = {};
  for (const row of drilldown) {
    const label = String(row[groupField] ?? "unknown");
    counts[label] = (counts[label] ?? 0) + 1;
  }
  const labelKey = groupField === "delivery_status" ? "delivery_status" : groupField;
  return {
    items: Object.entries(counts).map(([label, count]) => ({ [labelKey]: label, count })),
    labelKey,
    valueKey: "count",
  };
}

export function synthesizeChartFromDrilldownNumeric(
  drilldown: Record<string, unknown>[],
): SynthesizedChart | null {
  if (!drilldown.length) return null;
  const groupField = ["month", "record_type", "category", "client_name", "route"].find((field) =>
    drilldown.some((row) => row[field] != null && String(row[field]).trim() !== ""),
  );
  if (!groupField) return null;
  const valueField = ["revenue_php", "amount_php", "expense_php", "profit_php", "total_cost_php", "count"].find(
    (field) => drilldown.some((row) => isNumericField(row, field)),
  );
  if (!valueField) return null;
  const sums: Record<string, number> = {};
  for (const row of drilldown) {
    const label = String(row[groupField] ?? "unknown");
    sums[label] = (sums[label] ?? 0) + (Number(row[valueField]) || 0);
  }
  return {
    items: Object.entries(sums).map(([label, value]) => ({ [groupField]: label, [valueField]: value })),
    labelKey: groupField,
    valueKey: valueField,
  };
}

export function inferChartMeta(
  chart: Record<string, unknown>[],
  drilldown: Record<string, unknown>[],
): InferredChartMeta | null {
  if (!chart.length) return null;
  const row = chart[0];
  const keys = Object.keys(row);

  if (keys.includes("day") && keys.includes("hour") && keys.includes("count")) {
    return {
      kind: "heatmap",
      labelKey: "day",
      valueKey: "count",
      xKey: "hour",
      yKey: "day",
      fieldKeys: ["day_of_week", "hour"],
    };
  }

  if (
    keys.includes("truck_type") &&
    (keys.includes("Cold Chain") || keys.includes("Express Delivery")) &&
    (keys.includes("Standard Delivery") || keys.includes("Heavy Cargo"))
  ) {
    const seriesKeys = ["Cold Chain", "Express Delivery", "Standard Delivery", "Heavy Cargo"].filter((key) =>
      keys.includes(key),
    );
    return {
      kind: "groupedBar",
      labelKey: "truck_type",
      valueKey: seriesKeys[0] ?? "Cold Chain",
      xKey: "truck_type",
      yKey: seriesKeys[0] ?? "Cold Chain",
      seriesKeys,
      fieldKeys: ["truck_type", "service_sector"],
    };
  }

  if (keys.includes("cargo_classification") && keys.includes("booking_count")) {
    return {
      kind: "horizontalBar",
      labelKey: "cargo_classification",
      valueKey: "booking_count",
      fieldKeys: ["cargo_classification"],
    };
  }

  if (keys.includes("service_category") && keys.includes("order_count")) {
    return {
      kind: "horizontalBar",
      labelKey: "service_category",
      valueKey: "order_count",
      fieldKeys: ["service_sector"],
    };
  }

  if (keys.includes("period") && keys.includes("Approved") && keys.includes("Cancelled") && keys.includes("Completed") && keys.includes("Pending")) {
    return {
      kind: "stackedBar",
      labelKey: "period",
      valueKey: "Approved",
      xKey: "period",
      yKey: "Approved",
      seriesKeys: ["Approved", "Cancelled", "Completed", "Pending"],
      fieldKeys: ["period", "month_cohort", "fulfillment_status"],
      monthFromX: true,
    };
  }

  if (keys.includes("login") && keys.includes("logout") && keys.includes("password_reset") && keys.includes("profile_update")) {
    return {
      kind: "stackedBar",
      labelKey: "period",
      valueKey: "login",
      xKey: "period",
      yKey: "login",
      seriesKeys: ["login", "logout", "password_reset", "profile_update"],
      fieldKeys: ["period", "activity_type"],
      monthFromX: true,
    };
  }

  if (keys.includes("period") && keys.includes("avg_km_per_liter")) {
    return {
      kind: "line",
      labelKey: "period",
      valueKey: "avg_km_per_liter",
      xKey: "period",
      yKey: "avg_km_per_liter",
      seriesKeys: ["avg_km_per_liter"],
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "period"),
      monthFromX: true,
    };
  }

  if (keys.includes("period") && keys.includes("actual_daily_cost_php") && keys.includes("predicted_daily_cost_php")) {
    return {
      kind: "line",
      labelKey: "period",
      valueKey: "actual_daily_cost_php",
      xKey: "period",
      yKey: "actual_daily_cost_php",
      seriesKeys: ["actual_daily_cost_php", "predicted_daily_cost_php"],
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "period"),
      monthFromX: true,
    };
  }

  if (keys.includes("period") && keys.includes("maintenance_risk_score")) {
    return {
      kind: "line",
      labelKey: "period",
      valueKey: "maintenance_risk_score",
      xKey: "period",
      yKey: "maintenance_risk_score",
      seriesKeys: ["maintenance_risk_score"],
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "period"),
      monthFromX: true,
    };
  }

  if (keys.includes("category") && keys.includes("total_operational_cost_php")) {
    return {
      kind: "bar",
      labelKey: "category",
      valueKey: "total_operational_cost_php",
      xKey: "category",
      yKey: "total_operational_cost_php",
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "category"),
    };
  }

  if (keys.includes("period") && keys.includes("delivery_success_rate")) {
    return {
      kind: "line",
      labelKey: "period",
      valueKey: "delivery_success_rate",
      xKey: "period",
      yKey: "delivery_success_rate",
      seriesKeys: ["delivery_success_rate"],
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "period"),
      monthFromX: true,
    };
  }

  if (keys.includes("period") && keys.includes("count")) {
    const monthCohortDrill = drilldown.some((row) => row.month_cohort != null);
    return {
      kind: "line",
      labelKey: "period",
      valueKey: "count",
      xKey: "period",
      yKey: "count",
      seriesKeys: ["count"],
      fieldKeys: monthCohortDrill
        ? ["period", "month_cohort"]
        : inferDrilldownFieldKeys(chart, drilldown, "period"),
      monthFromX: true,
    };
  }
  if (keys.includes("period") && keys.includes("actual_completion_hours") && keys.includes("predicted_completion_hours")) {
    return {
      kind: "line",
      labelKey: "period",
      valueKey: "actual_completion_hours",
      xKey: "period",
      yKey: "actual_completion_hours",
      seriesKeys: ["actual_completion_hours", "predicted_completion_hours"],
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "period"),
      monthFromX: true,
    };
  }
  if (keys.includes("period") && keys.includes("confirmed_delivery_count")) {
    return {
      kind: "line",
      labelKey: "period",
      valueKey: "confirmed_delivery_count",
      xKey: "period",
      yKey: "confirmed_delivery_count",
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "period"),
      monthFromX: true,
    };
  }
  if (keys.includes("period") && keys.includes("avg_travel_hours")) {
    return {
      kind: "line",
      labelKey: "period",
      valueKey: "avg_travel_hours",
      xKey: "period",
      yKey: "avg_travel_hours",
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "period"),
      monthFromX: true,
    };
  }
  if (keys.includes("period") && keys.includes("avg_hours")) {
    return {
      kind: "line",
      labelKey: "period",
      valueKey: "avg_hours",
      xKey: "period",
      yKey: "avg_hours",
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "period"),
      monthFromX: true,
    };
  }
  if (keys.includes("period") && keys.includes("completed") && keys.includes("active")) {
    return {
      kind: "stackedBar",
      labelKey: "period",
      valueKey: "completed",
      xKey: "period",
      yKey: "completed",
      seriesKeys: ["completed", "active"],
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "period"),
      monthFromX: true,
    };
  }
  if (keys.includes("period") && keys.some((k) => k.startsWith("actual_")) && keys.some((k) => k.startsWith("forecast_"))) {
    const actualKey = keys.find((k) => k.startsWith("actual_"))!;
    const forecastKey = keys.find((k) => k.startsWith("forecast_"))!;
    return {
      kind: "line",
      labelKey: "period",
      valueKey: actualKey,
      xKey: "period",
      yKey: actualKey,
      seriesKeys: [actualKey, forecastKey],
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "period"),
      monthFromX: true,
    };
  }
  if (keys.includes("period") && keys.includes("revenue_php") && !keys.includes("expense_php")) {
    return {
      kind: "area",
      labelKey: "period",
      valueKey: "revenue_php",
      xKey: "period",
      yKey: "revenue_php",
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "period"),
      monthFromX: true,
    };
  }
  if (keys.includes("period") && keys.includes("revenue_php") && keys.includes("expense_php") && keys.includes("profit_php")) {
    return {
      kind: "combo",
      labelKey: "period",
      valueKey: "revenue_php",
      xKey: "period",
      yKey: "revenue_php",
      seriesKeys: ["revenue_php", "expense_php"],
      secondarySeriesKey: "profit_php",
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "period"),
      monthFromX: true,
    };
  }
  if (keys.includes("period") && keys.includes("estimated_toll_php") && keys.includes("actual_toll_php")) {
    return {
      kind: "line",
      labelKey: "period",
      valueKey: "actual_toll_php",
      xKey: "period",
      yKey: "actual_toll_php",
      seriesKeys: ["estimated_toll_php", "actual_toll_php"],
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "period"),
      monthFromX: true,
    };
  }
  if (keys.includes("period") && keys.includes("fuel") && keys.includes("toll") && keys.includes("maintenance")) {
    return {
      kind: "stackedBar",
      labelKey: "period",
      valueKey: "total",
      xKey: "period",
      yKey: "total",
      seriesKeys: ["fuel", "toll", "maintenance", "allowance"],
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "period"),
      monthFromX: true,
    };
  }
  if (keys.includes("confirmation_status") && keys.includes("count")) {
    return {
      kind: "pie",
      labelKey: "confirmation_status",
      valueKey: "count",
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "confirmation_status"),
    };
  }
  if (keys.includes("settlement_status") && keys.includes("count")) {
    return {
      kind: "pie",
      labelKey: "settlement_status",
      valueKey: "count",
      fieldKeys: ["settlement_status"],
    };
  }

  if (keys.includes("profile_updated") && keys.includes("count")) {
    return {
      kind: "pie",
      labelKey: "profile_updated",
      valueKey: "count",
      fieldKeys: ["profile_updated", "field"],
    };
  }

  if (keys.includes("status") && keys.includes("count")) {
    return {
      kind: "pie",
      labelKey: "status",
      valueKey: "count",
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "status"),
    };
  }
  if (keys.includes("delay_hours") && keys.includes("trip_count")) {
    return {
      kind: "bar",
      labelKey: "delay_hours",
      valueKey: "trip_count",
      secondarySeriesKey: "density_curve",
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "delay_hours"),
    };
  }
  if (keys.includes("distance_km") && keys.includes("travel_duration_minutes")) {
    return {
      kind: "scatter",
      labelKey: "distance_km",
      valueKey: "travel_duration_minutes",
      xKey: "distance_km",
      yKey: "travel_duration_minutes",
      secondarySeriesKey: "predicted_travel_minutes",
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "distance_km"),
    };
  }
  if (keys.includes("distance_km") && (keys.includes("fuel_liters") || keys.includes("predicted_fuel_liters"))) {
    return {
      kind: "scatter",
      labelKey: "distance_km",
      valueKey: "fuel_liters",
      xKey: "distance_km",
      yKey: "fuel_liters",
      secondarySeriesKey: "predicted_fuel_liters",
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "distance_km"),
    };
  }
  if (keys.includes("dispatch_event") && keys.includes("count")) {
    return {
      kind: "pie",
      labelKey: "dispatch_event",
      valueKey: "count",
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "dispatch_event"),
    };
  }
  if (keys.includes("availability") && keys.includes("count")) {
    return {
      kind: "pie",
      labelKey: "availability",
      valueKey: "count",
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "availability"),
    };
  }
  if (keys.includes("cause") && keys.includes("count")) {
    return {
      kind: "pie",
      labelKey: "cause",
      valueKey: "count",
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "cause"),
    };
  }
  if (keys.includes("category") && keys.includes("count")) {
    return {
      kind: "bar",
      labelKey: "category",
      valueKey: "count",
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "category"),
    };
  }
  if (keys.includes("month") && keys.includes("count")) {
    return {
      kind: "line",
      labelKey: "month",
      valueKey: "count",
      xKey: "month",
      yKey: "count",
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "month"),
      monthFromX: true,
    };
  }
  if (keys.includes("month") && keys.includes("revenue_php") && !keys.includes("expense_php")) {
    return {
      kind: "area",
      labelKey: "month",
      valueKey: "revenue_php",
      xKey: "month",
      yKey: "revenue_php",
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "month"),
      monthFromX: true,
    };
  }
  if (keys.includes("month") && keys.includes("revenue_php") && keys.includes("expense_php") && keys.includes("profit_php")) {
    return {
      kind: "combo",
      labelKey: "month",
      valueKey: "revenue_php",
      xKey: "month",
      yKey: "revenue_php",
      seriesKeys: ["revenue_php", "expense_php"],
      secondarySeriesKey: "profit_php",
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "month"),
      monthFromX: true,
    };
  }
  if (keys.includes("month") && keys.includes("estimated_toll_php") && keys.includes("actual_toll_php")) {
    return {
      kind: "line",
      labelKey: "month",
      valueKey: "actual_toll_php",
      xKey: "month",
      yKey: "actual_toll_php",
      seriesKeys: ["estimated_toll_php", "actual_toll_php"],
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "month"),
      monthFromX: true,
    };
  }
  if (keys.includes("month") && keys.includes("fuel") && keys.includes("toll") && keys.includes("maintenance")) {
    return {
      kind: "stackedBar",
      labelKey: "month",
      valueKey: "total",
      xKey: "month",
      yKey: "total",
      seriesKeys: ["fuel", "toll", "maintenance", "allowance"],
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "month"),
      monthFromX: true,
    };
  }
  if (keys.includes("month") && (keys.includes("total_cost_php") || keys.includes("total") || keys.includes("avg_km_per_liter"))) {
    const yKey = keys.includes("total_cost_php") ? "total_cost_php" : keys.includes("avg_km_per_liter") ? "avg_km_per_liter" : "total";
    return {
      kind: "line",
      labelKey: "month",
      valueKey: yKey,
      xKey: "month",
      yKey,
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "month"),
      monthFromX: true,
    };
  }
  if (keys.includes("period") && keys.some((k) => k.startsWith("forecast_"))) {
    const yKey = keys.find((k) => k.startsWith("forecast_")) ?? keys[1];
    return {
      kind: "line",
      labelKey: "period",
      valueKey: yKey,
      xKey: "period",
      yKey,
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "period"),
      monthFromX: true,
    };
  }
  if (keys.includes("category") && keys.includes("amount_php")) {
    return {
      kind: "pie",
      labelKey: "category",
      valueKey: "amount_php",
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "category"),
    };
  }
  if (keys.includes("client_name") && keys.includes("bookings")) {
    return {
      kind: "horizontalBar",
      labelKey: "client_name",
      valueKey: "bookings",
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "client_name"),
    };
  }
  if (keys.includes("client_name") && keys.includes("revenue_php")) {
    return {
      kind: "horizontalBar",
      labelKey: "client_name",
      valueKey: "revenue_php",
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "client_name"),
    };
  }
  if (keys.includes("truck_code") && keys.includes("trip_count")) {
    return {
      kind: "horizontalBar",
      labelKey: "truck_code",
      valueKey: "trip_count",
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "truck_code"),
    };
  }
  if (keys.includes("truck_code") && keys.includes("fuel_php")) {
    return {
      kind: "horizontalBar",
      labelKey: "truck_code",
      valueKey: "fuel_php",
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "truck_code"),
    };
  }
  if (keys.includes("truck") && keys.includes("report_count")) {
    return {
      kind: "horizontalBar",
      labelKey: "truck",
      valueKey: "report_count",
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "truck"),
    };
  }
  if (keys.includes("truck") && keys.includes("trip_count")) {
    return {
      kind: "horizontalBar",
      labelKey: "truck",
      valueKey: "trip_count",
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "truck"),
    };
  }
  if (keys.includes("truck") && (keys.includes("liters") || keys.includes("risk_score"))) {
    const valueKey = keys.includes("liters") ? "liters" : "risk_score";
    return {
      kind: "bar",
      labelKey: "truck",
      valueKey,
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "truck"),
    };
  }
  if (keys.includes("route") && keys.includes("on_time") && keys.includes("delayed")) {
    return {
      kind: "stackedBar",
      labelKey: "route",
      valueKey: "on_time",
      seriesKeys: ["on_time", "delayed"],
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "route"),
    };
  }
  if (keys.includes("route")) {
    const valueKey =
      keys.find((k) => k !== "route" && isNumericField(row, k)) ??
      keys.find((k) => k.endsWith("_php") || k.endsWith("_score") || k === "count" || k === "deliveries");
    if (valueKey) {
      return {
        kind: "horizontalBar",
        labelKey: "route",
        valueKey,
        fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "route"),
      };
    }
  }
  if (keys.includes("region") && keys.includes("trip_count")) {
    return {
      kind: "horizontalBar",
      labelKey: "region",
      valueKey: "trip_count",
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "region"),
    };
  }
  if (keys.includes("period") && keys.includes("trip_count")) {
    return {
      kind: "horizontalBar",
      labelKey: "period",
      valueKey: "trip_count",
      xKey: "period",
      yKey: "trip_count",
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "period"),
      monthFromX: true,
    };
  }
  if (keys.includes("region") && keys.includes("distance_km")) {
    return {
      kind: "horizontalBar",
      labelKey: "region",
      valueKey: "distance_km",
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "region"),
    };
  }
  if (keys.includes("trip_status") && keys.includes("trip_count")) {
    return {
      kind: "horizontalBar",
      labelKey: "trip_status",
      valueKey: "trip_count",
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "trip_status"),
    };
  }
  if (keys.includes("driver") && keys.includes("trip_count")) {
    return {
      kind: "horizontalBar",
      labelKey: "driver",
      valueKey: "trip_count",
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "driver"),
    };
  }
  if (keys.includes("driver") && keys.includes("active_trips")) {
    return {
      kind: "horizontalBar",
      labelKey: "driver",
      valueKey: "active_trips",
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "driver"),
    };
  }
  if (keys.includes("driver_name") && keys.includes("completed") && keys.includes("delayed")) {
    return {
      kind: "stackedBar",
      labelKey: "driver_name",
      valueKey: "completed",
      seriesKeys: ["completed", "delayed"],
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "driver_name"),
    };
  }
  if (keys.includes("driver_name") && keys.includes("completed")) {
    return {
      kind: "bar",
      labelKey: "driver_name",
      valueKey: "completed",
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "driver_name"),
    };
  }
  if (keys.includes("truck") && keys.includes("risk_rank")) {
    return {
      kind: "horizontalBar",
      labelKey: "truck",
      valueKey: "risk_rank",
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "truck"),
    };
  }
  if (keys.includes("truck") && keys.includes("severity_rank")) {
    return {
      kind: "bar",
      labelKey: "truck",
      valueKey: "severity_rank",
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "truck"),
    };
  }
  if (keys.includes("severity") && keys.includes("count")) {
    return {
      kind: "bar",
      labelKey: "severity",
      valueKey: "count",
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "severity"),
    };
  }
  if (keys.includes("issue_type") && keys.includes("count")) {
    return {
      kind: "bar",
      labelKey: "issue_type",
      valueKey: "count",
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "issue_type"),
    };
  }

  const labelKey =
    keys.find((k) => typeof row[k] === "string") ??
    keys.find((k) => row[k] != null && !isNumericField(row, k)) ??
    keys[0];
  const valueKey =
    keys.find((k) => k !== labelKey && isNumericField(row, k)) ??
    keys.find((k) => k !== labelKey && (k.endsWith("_php") || k.endsWith("_count") || k === "count")) ??
    keys[1];
  if (!labelKey || !valueKey) return null;
  return {
    kind: "bar",
    labelKey,
    valueKey,
    fieldKeys: inferDrilldownFieldKeys(chart, drilldown, labelKey),
  };
}
