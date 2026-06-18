export type ChartSelection = {
  label: string;
  displayLabel: string;
  fieldKeys: string[];
  monthKey?: string;
  recordType?: string;
};

export function normalizeChartKey(value: string): string {
  return value
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
      if (rowType !== selection.recordType.toLowerCase()) return false;
    }

    if (selection.monthKey) {
      const monthFields = ["month", "scheduled_month", "expense_date", "paid_at", "delivery_date"];
      const monthMatch = monthFields.some((field) => {
        const raw = row[field];
        if (raw == null) return false;
        const text = String(raw);
        return text.startsWith(selection.monthKey!) || text.slice(0, 7) === selection.monthKey;
      });
      if (!monthMatch) return false;
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
    "client_name",
    "category",
    "record_type",
    "issue_type",
    "severity",
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
  kind: "pie" | "line" | "bar" | "area" | "stackedBar" | "combo";
  labelKey: string;
  valueKey: string;
  xKey?: string;
  yKey?: string;
  seriesKeys?: string[];
  secondarySeriesKey?: string;
  fieldKeys: string[];
  monthFromX?: boolean;
};

export function inferChartMeta(
  chart: Record<string, unknown>[],
  drilldown: Record<string, unknown>[],
): InferredChartMeta | null {
  if (!chart.length) return null;
  const row = chart[0];
  const keys = Object.keys(row);

  if (keys.includes("status") && keys.includes("count")) {
    return {
      kind: "pie",
      labelKey: "status",
      valueKey: "count",
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "status"),
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
      kind: "area",
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
    };
  }
  if (keys.includes("client_name") && keys.includes("revenue_php")) {
    return {
      kind: "bar",
      labelKey: "client_name",
      valueKey: "revenue_php",
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "client_name"),
    };
  }
  if (keys.includes("category") && keys.includes("amount_php")) {
    return {
      kind: "bar",
      labelKey: "category",
      valueKey: "amount_php",
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "category"),
    };
  }
  if (keys.includes("truck_code") && keys.includes("trip_count")) {
    return {
      kind: "bar",
      labelKey: "truck_code",
      valueKey: "trip_count",
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "truck_code"),
    };
  }
  if (keys.includes("truck_code") && keys.includes("fuel_php")) {
    return {
      kind: "bar",
      labelKey: "truck_code",
      valueKey: "fuel_php",
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "truck_code"),
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
  if (keys.includes("route")) {
    const valueKey =
      keys.find((k) => typeof row[k] === "number" && k !== "route") ??
      keys.find((k) => k.endsWith("_php") || k.endsWith("_score") || k === "count");
    if (valueKey) {
      return {
        kind: "bar",
        labelKey: "route",
        valueKey,
        fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "route"),
      };
    }
  }
  if (keys.includes("driver_name") && keys.includes("completed")) {
    return {
      kind: "bar",
      labelKey: "driver_name",
      valueKey: "completed",
      fieldKeys: inferDrilldownFieldKeys(chart, drilldown, "driver_name"),
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

  const labelKey = keys.find((k) => typeof row[k] === "string") ?? keys[0];
  const valueKey = keys.find((k) => typeof row[k] === "number" && k !== labelKey) ?? keys[1];
  if (!labelKey || !valueKey) return null;
  return {
    kind: "bar",
    labelKey,
    valueKey,
    fieldKeys: inferDrilldownFieldKeys(chart, drilldown, labelKey),
  };
}
