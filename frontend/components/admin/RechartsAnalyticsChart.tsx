"use client";

import { memo, useCallback, useMemo, Fragment, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatNumber } from "@/lib/appLocale";
import { EmptyChart, type ChartClickPayload } from "@/components/admin/AnalyticsCharts";
import { SkeletonChart } from "@/components/Skeleton";

export type AnalyticsChartKind = "bar" | "horizontalBar" | "line" | "pie" | "area" | "stackedBar" | "groupedBar" | "combo" | "heatmap" | "pareto" | "scatter";

const BAR_COLORS = ["#2D6A4F", "#E76F51", "#277DA1", "#40916C", "#F4A261", "#52B788", "#1B4332", "#6366F1"];
const ENTERPRISE_GREEN = "#2D6A4F";
const ENTERPRISE_LINE = "#277DA1";
const SELECTED_STROKE = "#1B4332";

const SERIES_COLORS = {
  revenue: "#2D6A4F",
  expense: "#E76F51",
  toll: "#F4A261",
  maintenance: "#9C6644",
  allowance: "#6D597A",
  profit: "#277DA1",
  estimated: "#7C3AED",
  actual: "#0EA5E9",
} as const;

const AXIS_TICK = { fontSize: 11, fill: "#64748b" };
const GRID_STROKE = "#e2e8f0";
const HORIZONTAL_COUNT_AXIS_MIN = 10;

function horizontalCountAxisMax(dataMax: number): number {
  return Math.max(HORIZONTAL_COUNT_AXIS_MIN, Math.ceil((dataMax || 0) * 1.1));
}
const LABEL_TRUNCATE = 36;
const HORIZONTAL_BAR_ROW_HEIGHT = 34;
const HEATMAP_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const HEATMAP_HOURS = Array.from({ length: 14 }, (_, i) => i + 7);
const HEATMAP_COLORS = ["#FFFDE7", "#F0F4C3", "#AED581", "#4DB6AC", "#42A5F5", "#1A237E"];
const TRUCK_PREFERENCE_SERIES = ["Cold Chain", "Express Delivery", "Standard Delivery", "Heavy Cargo"] as const;
const GROUPED_BAR_SKIP_KEYS = new Set([
  "total",
  "name",
  "period",
  "month",
  "month_cohort",
  "day_index",
  "series_type",
]);

function deriveGroupedSeriesKeys(
  items: Array<Record<string, string | number>>,
  labelKey: string,
  explicit?: string[],
): string[] {
  if (explicit?.length) return explicit;
  if (!items.length) return [];
  const row = items[0];
  const truckSeries = TRUCK_PREFERENCE_SERIES.filter((key) => key in row);
  if (truckSeries.length >= 2) return [...truckSeries];
  return Object.keys(row).filter(
    (key) =>
      key !== labelKey &&
      !GROUPED_BAR_SKIP_KEYS.has(key) &&
      typeof row[key] === "number" &&
      Number.isFinite(row[key]),
  );
}

function heatmapFill(count: number, max: number): string {
  if (count <= 0 || max <= 0) return HEATMAP_COLORS[0];
  const ratio = count / max;
  const idx = Math.min(HEATMAP_COLORS.length - 1, Math.max(1, Math.ceil(ratio * (HEATMAP_COLORS.length - 1))));
  return HEATMAP_COLORS[idx];
}

type HeatmapGridProps = {
  items: Array<Record<string, string | number>>;
  onItemClick?: (payload: ChartClickPayload) => void;
  selectedLabel?: string | null;
};

function ActivityHeatmapGrid({ items, onItemClick, selectedLabel }: HeatmapGridProps) {
  const lookup = useMemo(() => {
    const map = new Map<string, Record<string, string | number>>();
    for (const item of items) {
      const day = String(item.day ?? item.day_of_week ?? "").trim();
      const hour = Number(item.hour);
      if (!day || !Number.isFinite(hour)) continue;
      map.set(`${day}|${hour}`, item);
    }
    return map;
  }, [items]);

  const maxCount = useMemo(
    () => items.reduce((max, item) => Math.max(max, Number(item.count) || 0), 0),
    [items],
  );

  return (
    <div className="activity-heatmap" role="img" aria-label="Account activity density heatmap">
      <div className="activity-heatmap__legend" aria-hidden>
        <span>Low</span>
        <div className="activity-heatmap__legend-bar">
          {HEATMAP_COLORS.map((color) => (
            <span key={color} style={{ backgroundColor: color }} />
          ))}
        </div>
        <span>High</span>
      </div>
      <div className="activity-heatmap__body">
        <div className="activity-heatmap__y-title" aria-hidden>
          Day of week
        </div>
        <div className="activity-heatmap__matrix">
          <span className="activity-heatmap__corner" aria-hidden />
          {HEATMAP_HOURS.map((hour) => (
            <span key={`head-${hour}`} className="activity-heatmap__hour-label">
              {hour}
            </span>
          ))}
          {HEATMAP_DAYS.map((day) => (
            <Fragment key={day}>
              <span className="activity-heatmap__day-label">{day.slice(0, 3)}</span>
              {HEATMAP_HOURS.map((hour) => {
                const cell = lookup.get(`${day}|${hour}`);
                const count = cell ? Number(cell.count) || 0 : 0;
                const cellKey = `${day}|${hour}`;
                const active = selectedLabel === cellKey;
                return (
                  <button
                    key={`${day}-${hour}`}
                    type="button"
                    className={`activity-heatmap__cell${active ? " activity-heatmap__cell--selected" : ""}`}
                    style={{ backgroundColor: heatmapFill(count, maxCount) }}
                    title={`${day} · ${String(hour).padStart(2, "0")}:00: ${count} event${count === 1 ? "" : "s"}`}
                    aria-label={`${day} · ${String(hour).padStart(2, "0")}:00, ${count} events`}
                    onClick={() =>
                      onItemClick?.({
                        label: `${day} · ${String(hour).padStart(2, "0")}:00`,
                        raw: cell ?? { day, hour, count },
                      })
                    }
                  />
                );
              })}
            </Fragment>
          ))}
          <span className="activity-heatmap__corner" aria-hidden />
          <div className="activity-heatmap__x-title">Hour of day</div>
        </div>
      </div>
    </div>
  );
}

type ChartRow = Record<string, string | number> & { name: string };

const LINE_TOOLTIP_META_KEYS = [
  "sample_count",
  "delivered",
  "total",
  "confidence_lower_php",
  "confidence_upper_php",
] as const;

function truncateLabel(text: unknown, maxLen = LABEL_TRUNCATE): string {
  const value = String(text ?? "").trim();
  if (value.length <= maxLen) return value;
  return `${value.slice(0, maxLen - 1)}…`;
}

function formatPeriodAxisLabel(text: unknown): string {
  const value = String(text ?? "").trim();
  if (!value) return "";
  const daily = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (daily) {
    const month = Number(daily[2]) - 1;
    const day = Number(daily[3]);
    const date = new Date(Number(daily[1]), month, day);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }
  }
  const monthly = value.match(/^(\d{4})-(\d{2})$/);
  if (monthly) {
    const month = Number(monthly[2]) - 1;
    const date = new Date(Number(monthly[1]), month, 1);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
    }
  }
  const quarterly = value.match(/^(\d{4})-Q([1-4])$/i);
  if (quarterly) return `Q${quarterly[2]} '${quarterly[1].slice(-2)}`;
  const weekly = value.match(/^(\d{4})-W(\d{1,2})$/i);
  if (weekly) return `W${weekly[2]}`;
  if (/^\d{4}$/.test(value)) return value;
  return truncateLabel(value, 14);
}

function lineChartTickInterval(pointCount: number): number | "preserveStartEnd" {
  if (pointCount <= 10) return 0;
  if (pointCount <= 16) return 1;
  return Math.max(1, Math.ceil(pointCount / 10) - 1);
}

function longestLabel(items: Array<Record<string, string | number>>, labelKey: string): number {
  return items.reduce((max, item) => Math.max(max, String(item[labelKey] ?? "").length), 0);
}

function horizontalChartHeight(rowCount: number): number {
  return Math.max(260, rowCount * HORIZONTAL_BAR_ROW_HEIGHT + 72);
}

function CategoryAxisTick({
  x,
  y,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string };
}) {
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fill="#64748b" fontSize={11}>
      {truncateLabel(payload?.value)}
    </text>
  );
}

function RotatedCategoryAxisTick({
  x,
  y,
  payload,
  formatPeriod = false,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string };
  formatPeriod?: boolean;
}) {
  const label = formatPeriod ? formatPeriodAxisLabel(payload?.value) : truncateLabel(payload?.value, 18);
  return (
    <text
      x={x}
      y={y}
      dy={12}
      dx={-4}
      transform={`rotate(-35, ${x ?? 0}, ${y ?? 0})`}
      textAnchor="end"
      fill="#64748b"
      fontSize={10}
    >
      {label}
    </text>
  );
}

function isSelected(label: string, selectedLabel?: string | null): boolean {
  if (!selectedLabel) return false;
  return String(label ?? "").trim().toLowerCase() === String(selectedLabel ?? "").trim().toLowerCase();
}

function formatTooltipValue(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? "");
  return n.toLocaleString();
}

function formatPesoTooltipLabel(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? "");
  return `${formatNumber(Math.round(n), { maximumFractionDigits: 0 })} Pesos`;
}

const OPERATIONAL_COST_BAR = "#64B5F6";
const BREAKDOWN_HISTOGRAM_BAR = "#E76F51";
const TRAVEL_DELAY_HISTOGRAM_BAR = "#93C5FD";
const TRAVEL_DELAY_DENSITY_LINE = "#1D4ED8";
const FUEL_SCATTER_ACTUAL = "#1E88E5";
const FUEL_REGRESSION_LINE = "#E53935";
const MAINTENANCE_SEVERITY_COLORS: Record<string, string> = {
  Low: "#52B788",
  Medium: "#F4A261",
  High: "#E53935",
};

function severityLabelFromRank(rank: number): string {
  if (rank >= 3) return "High";
  if (rank >= 2) return "Medium";
  return "Low";
}
const BREAKDOWN_VEHICLE_BAR_COLORS = ["#5E35B1", "#D81B60", "#EF5350", "#FF9800", "#7E57C2", "#AB47BC"];
const VEHICLE_RISK_COLORS: Record<string, string> = {
  "TRK-001": "#277DA1",
  "TRK-002": "#E53935",
  "TRK-003": "#FF9800",
  "TRK-004": "#4CAF50",
};
const PARETO_BAR_COLORS = ["#1B4F72", "#21618C", "#148F77", "#52BE80", "#A9DFBF", "#D5F5E3"];
const PARETO_CUMULATIVE_LINE = "#E53935";
const COST_OVERRUN_ACTUAL = "#277DA1";
const COST_OVERRUN_FORECAST = "#E53935";
const COST_OVERRUN_BAND = "#F8BBD0";

const LOGIN_ACTIVITY_COLORS: Record<string, string> = {
  login: "#4CAF50",
  logout: "#E53935",
  password_reset: "#1E88E5",
  profile_update: "#FBC02D",
};

const BOOKING_FULFILLMENT_COLORS: Record<string, string> = {
  Approved: "#1E88E5",
  Cancelled: "#E53935",
  Completed: "#4CAF50",
  Pending: "#FBC02D",
};

function scatterYAxisLabel(valueKey: string, yAxisLabel?: string): string {
  if (valueKey === "fuel_liters") return "Fuel Usage (liters)";
  if (valueKey === "travel_duration_minutes") return "Travel Duration (minutes)";
  return yAxisLabel || valueKey.replace(/_/g, " ");
}

function scatterActualLabel(valueKey: string): string {
  if (valueKey === "fuel_liters") return "Actual fuel";
  if (valueKey === "travel_duration_minutes") return "Actual duration";
  return seriesLabel(valueKey);
}

function scatterPredictedLabel(regressionKey: string): string {
  if (regressionKey === "predicted_fuel_liters") return "Predicted fuel";
  if (regressionKey === "predicted_travel_minutes") return "Predicted duration";
  return seriesLabel(regressionKey);
}

function seriesLabel(key: string): string {
  const labels: Record<string, string> = {
    login: "Login",
    logout: "Logout",
    password_reset: "Password Reset",
    profile_update: "Profile Update",
    actual_avg_km_per_liter: "Historical Average Fuel Efficiency",
    forecast_avg_km_per_liter: "Forecasted Average Fuel Efficiency",
    actual_delivery_success_rate: "Historical Delivery Success Rate",
    forecast_delivery_success_rate: "Forecasted Delivery Success Rate",
    historical_disruption_risk: "Historical Average Disruption Risk",
    forecast_disruption_risk: "Forecasted Disruption Risk",
    avg_km_per_liter: "Avg fuel efficiency",
    avg_travel_hours: "Avg travel time",
    delivery_success_rate: "Delivery Success Rate",
    maintenance_risk_score: "Maintenance Risk",
    actual_daily_cost_php: "Historical Actual Daily Cost",
    predicted_daily_cost_php: "Predicted Daily Cost",
    actual_completion_hours: "Actual Completion Time",
    predicted_completion_hours: "Predicted Completion Time",
    actual_delay_rate_pct: "Historical Delay Rate",
    forecast_delay_rate_pct: "Forecast Delay Rate",
    actual_trips: "Actual Trips",
    forecast_trips: "Forecast Trips",
    daily_operational_cost_php: "Daily Operational Cost",
    rolling_mean_7d_php: "Rolling Mean (7-day)",
    total_operational_cost_php: "Total Operational Cost",
    frequency: "Frequency",
    cumulative_percent: "Cumulative %",
    trip_count: "Number of Trips",
    report_count: "Number of Reports",
    fuel_liters: "Actual Fuel Usage",
    predicted_fuel_liters: "Predicted Fuel Usage (Regression Line)",
    travel_duration_minutes: "Actual Travel Duration",
    predicted_travel_minutes: "Predicted Travel Duration (Regression Line)",
  };
  return labels[key] ?? (String(key).toUpperCase().startsWith("TRK-") ? `Vehicle ${key}` : key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));
}

function lineSeriesStroke(key: string, idx: number): string {
  if (VEHICLE_RISK_COLORS[key]) return VEHICLE_RISK_COLORS[key];
  if (key === "maintenance_risk_score") return "#E53935";
  if (key === "actual_delivery_success_rate") return COST_OVERRUN_ACTUAL;
  if (key === "forecast_delivery_success_rate") return COST_OVERRUN_FORECAST;
  if (key === "historical_disruption_risk") return COST_OVERRUN_ACTUAL;
  if (key === "forecast_disruption_risk") return COST_OVERRUN_FORECAST;
  if (key === "daily_operational_cost_php") return COST_OVERRUN_ACTUAL;
  if (key === "rolling_mean_7d_php") return COST_OVERRUN_FORECAST;
  if (key === "actual_avg_km_per_liter") return COST_OVERRUN_ACTUAL;
  if (key === "forecast_avg_km_per_liter") return "#4CAF50";
  if (key === "actual_completion_hours") return ENTERPRISE_LINE;
  if (key === "predicted_completion_hours") return "#E76F51";
  if (key === "actual_delay_rate_pct") return COST_OVERRUN_ACTUAL;
  if (key === "forecast_delay_rate_pct") return COST_OVERRUN_FORECAST;
  if (key === "actual_trips") return COST_OVERRUN_ACTUAL;
  if (key === "forecast_trips") return COST_OVERRUN_FORECAST;
  if (key.startsWith("forecast_")) return "#4CAF50";
  if (key.startsWith("actual_")) return ENTERPRISE_LINE;
  return idx === 0 ? ENTERPRISE_LINE : "#E76F51";
}

function seriesFill(key: string, idx: number): string {
  return (
    BOOKING_FULFILLMENT_COLORS[key] ??
    SERVICE_SECTOR_COLORS[key] ??
    LOGIN_ACTIVITY_COLORS[key] ??
    BAR_COLORS[idx % BAR_COLORS.length]
  );
}

const PROFILE_STATUS_COLORS: Record<string, string> = {
  Yes: "#26A69A",
  No: "#455A64",
};

const RECEIPT_SETTLEMENT_COLORS: Record<string, string> = {
  Paid: "#4CAF50",
  Pending: "#FBC02D",
  Refunded: "#E53935",
};

const DELIVERY_CONFIRMATION_COLORS: Record<string, string> = {
  Delivered: "#2D6A4F",
  "For Pick Up": "#42A5F5",
  "En Route": "#7E57C2",
  Delayed: "#FF7043",
  Failed: "#E53935",
};

const SERVICE_SECTOR_COLORS: Record<string, string> = {
  "Cold Chain": "#26A69A",
  "Express Delivery": "#FF9800",
  "Standard Delivery": "#7986CB",
  "Heavy Cargo": "#E91E63",
};

const SERVICE_VOLUME_BAR = "#37474F";

const CARGO_CLASSIFICATION_COLORS: Record<string, string> = {
  Clothing: "#795548",
  "Medical Supplies": "#8E24AA",
  "Construction Materials": "#E91E63",
  Electronics: "#4CAF50",
  Food: "#FF9800",
  Furniture: "#1E88E5",
  Other: "#607D8B",
};

const TRIP_STATUS_COLORS: Record<string, string> = {
  Completed: "#4CAF50",
  Delayed: "#FF7043",
  Ongoing: "#42A5F5",
};

const DISPATCH_EVENT_COLORS: Record<string, string> = {
  Pickup: "#F4A6A6",
  Dropoff: "#A5D6A7",
  Refuel: "#FFCC80",
  Break: "#D7CCC8",
  Maintenance: "#E0E0E0",
};

function pieSliceFill(name: string, idx: number): string {
  return (
    DISPATCH_EVENT_COLORS[name] ??
    DELIVERY_CONFIRMATION_COLORS[name] ??
    RECEIPT_SETTLEMENT_COLORS[name] ??
    PROFILE_STATUS_COLORS[name] ??
    BAR_COLORS[idx % BAR_COLORS.length]
  );
}

function buildChartRows(
  items: Array<Record<string, string | number>>,
  labelKey: string,
  valueKey: string,
  seriesKeys?: string[],
  secondarySeriesKey?: string,
): ChartRow[] {
  return items.map((item) => {
    const row: ChartRow = {
      name: String(item[labelKey] ?? ""),
    };
    if (item[valueKey] != null && item[valueKey] !== "") {
      row[valueKey] = Number(item[valueKey]) || 0;
    }
    if (item.share_pct != null && item.share_pct !== "") {
      row.share_pct = Number(item.share_pct);
    }
    if (item.density_curve != null && item.density_curve !== "") {
      row.density_curve = Number(item.density_curve);
    }
    if (item.predicted_severity != null && item.predicted_severity !== "") {
      row.predicted_severity = String(item.predicted_severity);
    }
    if (item.risk_score != null && item.risk_score !== "") {
      row.risk_score = Number(item.risk_score);
    }
    if (item.breakdown_risk != null && item.breakdown_risk !== "") {
      row.breakdown_risk = String(item.breakdown_risk);
    }
    if (item.breakdown_count != null && item.breakdown_count !== "") {
      row.breakdown_count = Number(item.breakdown_count);
    }
    for (const key of seriesKeys ?? []) {
      if (item[key] != null && item[key] !== "") {
        row[key] = Number(item[key]) || 0;
      }
    }
    if (secondarySeriesKey && item[secondarySeriesKey] != null && item[secondarySeriesKey] !== "") {
      row[secondarySeriesKey] = Number(item[secondarySeriesKey]) || 0;
    }
    for (const key of LINE_TOOLTIP_META_KEYS) {
      if (item[key] != null && item[key] !== "") {
        row[key] = typeof item[key] === "number" ? item[key] : Number(item[key]) || item[key];
      }
    }
    return row;
  });
}

function formatLineTooltipValue(value: unknown, dataKey?: string, name?: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? "—");
  const key = String(dataKey ?? name ?? "").toLowerCase();
  if (key.includes("delivery_success_rate")) return `${(n * 100).toFixed(1)}% (${n.toFixed(3)})`;
  if (key.includes("disruption_risk") || key.includes("confidence_lower_risk") || key.includes("confidence_upper_risk"))
    return n.toFixed(3);
  if (key.includes("maintenance_risk_score")) return n.toFixed(1);
  if (key.includes("km_per_liter") || key.includes("avg_km_per_liter")) return `${n.toFixed(2)} km/L`;
  if (key.includes("travel_hours") || key.includes("avg_hours") || key.includes("completion_hours")) return `${n.toFixed(2)} hrs`;
  if (key.includes("fuel_liters") || key.includes("predicted_fuel_liters")) return `${n.toFixed(2)} L`;
  if (key.includes("travel_duration_minutes") || key.includes("predicted_travel_minutes")) return `${n.toFixed(1)} min`;
  if (key.includes("_php") || key.includes("cost")) return formatPesoTooltipLabel(n);
  if (key.includes("cumulative_percent")) return `${n.toFixed(1)}%`;
  if (key === "frequency") return String(Math.round(n));
  if (key === "count") return `${Math.round(n).toLocaleString()} bookings`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function LineChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number;
    color?: string;
    dataKey?: string | number;
    payload?: ChartRow;
  }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  const period = String(label ?? row?.name ?? "");
  const lines: Array<{ key: string; value: string }> = [];
  if (period) lines.push({ key: "period", value: period });
  for (const entry of payload) {
    if (entry.value == null || !Number.isFinite(Number(entry.value))) continue;
    const key = String(entry.dataKey ?? entry.name ?? "value");
    lines.push({
      key,
      value: formatLineTooltipValue(entry.value, key, String(entry.name ?? "")),
    });
  }
  if (row?.sample_count != null) {
    lines.push({ key: "sample_count", value: String(row.sample_count) });
  }
  if (row?.delivered != null && row?.total != null) {
    lines.push({ key: "delivered", value: String(row.delivered) });
    lines.push({ key: "total", value: String(row.total) });
  }
  return (
    <div className="recharts-analytics-tooltip recharts-analytics-tooltip--line">
      {lines.map((line) => (
        <p key={line.key} className="recharts-analytics-tooltip__row recharts-analytics-tooltip__row--plain">
          {line.key}={line.value}
        </p>
      ))}
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string; dataKey?: string | number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="recharts-analytics-tooltip">
      {label ? <p className="recharts-analytics-tooltip__label">{label}</p> : null}
      {payload.map((entry) => (
        <p key={String(entry.name)} className="recharts-analytics-tooltip__row">
          <span className="recharts-analytics-tooltip__swatch" style={{ backgroundColor: entry.color }} />
          <span>
            {entry.name}: {formatLineTooltipValue(entry.value, String(entry.dataKey ?? ""), String(entry.name ?? ""))}
          </span>
        </p>
      ))}
    </div>
  );
}

const LINE_CHART_CURSOR = { stroke: "#94a3b8", strokeWidth: 1, strokeDasharray: "4 4" };
const LINE_CHART_TOOLTIP_PROPS = {
  content: <LineChartTooltip />,
  cursor: LINE_CHART_CURSOR,
  shared: false as const,
  isAnimationActive: false,
};

function PieTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; payload?: ChartRow }>;
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  const sharePct = entry.payload?.share_pct;
  return (
    <div className="recharts-analytics-tooltip">
      <p className="recharts-analytics-tooltip__label">{entry.name}</p>
      <p className="recharts-analytics-tooltip__row">{formatTooltipValue(entry.value)} events</p>
      {sharePct != null && Number.isFinite(Number(sharePct)) ? (
        <p className="recharts-analytics-tooltip__row">{Number(sharePct).toFixed(1)}%</p>
      ) : null}
    </div>
  );
}

function renderLegendText(value: string) {
  return <span style={{ color: "#475569", fontSize: 10 }}>{value}</span>;
}

export type RechartsAnalyticsChartProps = {
  kind: AnalyticsChartKind;
  items: Array<Record<string, string | number>>;
  labelKey: string;
  valueKey: string;
  seriesKeys?: string[];
  secondarySeriesKey?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  legendLabel?: string;
  onItemClick?: (payload: ChartClickPayload) => void;
  selectedLabel?: string | null;
  loading?: boolean;
};

function RechartsAnalyticsChartInner({
  kind,
  items,
  labelKey,
  valueKey,
  seriesKeys,
  secondarySeriesKey,
  xAxisLabel,
  yAxisLabel,
  legendLabel,
  onItemClick,
  selectedLabel,
  loading = false,
}: RechartsAnalyticsChartProps) {
  const groupedSeriesKeys = useMemo(
    () => (kind === "groupedBar" ? deriveGroupedSeriesKeys(items, labelKey, seriesKeys) : seriesKeys),
    [items, kind, labelKey, seriesKeys],
  );

  const rows = useMemo(
    () => buildChartRows(items, labelKey, valueKey, groupedSeriesKeys, secondarySeriesKey),
    [items, labelKey, valueKey, groupedSeriesKeys, secondarySeriesKey],
  );

  const handleBarClick = useCallback(
    (index: number) => {
      if (!onItemClick) return;
      const item = items[index];
      if (!item) return;
      const label = String(item[labelKey] ?? "");
      onItemClick({ label, raw: item });
    },
    [items, labelKey, onItemClick],
  );

  const handlePieClick = useCallback(
    (_: unknown, index: number) => {
      handleBarClick(index);
    },
    [handleBarClick],
  );

  const commonMargin = { top: 28, right: 12, left: 4, bottom: 56 };
  const horizontalLeftMargin = Math.min(240, Math.max(108, longestLabel(items, labelKey) * 6.2));
  const showLegend =
    kind === "stackedBar" ||
    kind === "combo" ||
    kind === "pareto" ||
    kind === "scatter" ||
    (kind === "line" && Boolean(seriesKeys && seriesKeys.length > 1)) ||
    (kind === "area" && Boolean(seriesKeys && seriesKeys.length > 1));
  const chartHeight = kind === "horizontalBar" ? horizontalChartHeight(rows.length) : undefined;

  if (loading) {
    return (
      <div className="recharts-analytics-chart recharts-analytics-chart--loading" aria-busy="true">
        <SkeletonChart />
      </div>
    );
  }

  if (!items.length) {
    return <EmptyChart message="No data available." />;
  }

  if (kind === "heatmap") {
    return (
      <div className="recharts-analytics-chart recharts-analytics-chart--heatmap" aria-label="Activity density heatmap">
        <ActivityHeatmapGrid items={items} onItemClick={onItemClick} selectedLabel={selectedLabel} />
      </div>
    );
  }

  const xAxisProps = {
    dataKey: "name" as const,
    tick: RotatedCategoryAxisTick,
    height: 88,
    interval: 0,
    label: xAxisLabel
      ? { value: xAxisLabel, position: "insideBottom" as const, offset: -52, style: { fontSize: 10, fill: "#64748b" } }
      : undefined,
  };

  const yAxisProps = {
    tick: AXIS_TICK,
    tickFormatter: (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : String(v)),
    label: yAxisLabel
      ? { value: yAxisLabel, angle: -90, position: "insideLeft" as const, style: { fontSize: 10, fill: "#64748b" } }
      : undefined,
  };

  let chartNode: ReactNode;

  if (kind === "pie") {
    const profileStatusPie =
      rows.length <= 2 && rows.every((entry) => entry.name === "Yes" || entry.name === "No");
    const receiptSettlementPie =
      rows.length <= 3 &&
      rows.every((entry) => entry.name === "Paid" || entry.name === "Pending" || entry.name === "Refunded");
    const deliveryConfirmationPie =
      labelKey === "confirmation_status" &&
      valueKey === "count" &&
      rows.every((entry) => entry.name === "Delivered" || entry.name === "Pending" || entry.name === "Failed");
    const dispatchEventPie = labelKey === "dispatch_event" && valueKey === "count";
    const labeledDonut = profileStatusPie || receiptSettlementPie || deliveryConfirmationPie || dispatchEventPie;
    chartNode = (
      <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <Pie
          data={rows}
          dataKey={valueKey}
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={dispatchEventPie ? "0%" : "28%"}
          outerRadius="72%"
          paddingAngle={1}
          label={({ percent }: { percent?: number }) =>
            percent != null && percent >= 0.03 ? `${(percent * 100).toFixed(labeledDonut ? 1 : 0)}%` : ""
          }
          labelLine={profileStatusPie || receiptSettlementPie || deliveryConfirmationPie}
          onClick={handlePieClick}
          style={{ cursor: onItemClick ? "pointer" : "default" }}
        >
          {rows.map((entry, i) => (
            <Cell
              key={entry.name}
              fill={pieSliceFill(entry.name, i)}
              stroke={isSelected(entry.name, selectedLabel) ? SELECTED_STROKE : "#fff"}
              strokeWidth={isSelected(entry.name, selectedLabel) ? 2 : 1}
            />
          ))}
        </Pie>
        <Tooltip content={<PieTooltip />} />
        <Legend formatter={renderLegendText} wrapperStyle={{ fontSize: 10 }} />
      </PieChart>
    );
  } else if (kind === "line") {
    const lineKeys =
      seriesKeys?.length && seriesKeys.length > 1
        ? seriesKeys
        : items.some((item) => Object.keys(item).some((k) => k.startsWith("forecast_")))
          ? [
              ...new Set(
                items.flatMap((item) =>
                  Object.keys(item).filter((k) => k.startsWith("actual_") || k.startsWith("forecast_")),
                ),
              ),
            ]
          : [valueKey];
    const bookingVolumeTrend =
      valueKey === "count" && rows.some((row) => /^\d{4}-\d{2}$/.test(String(row.name ?? "")));
    const efficiencyForecastChart =
      lineKeys.includes("actual_avg_km_per_liter") && lineKeys.includes("forecast_avg_km_per_liter");
    const fleetPerformanceTrend =
      lineKeys.includes("actual_delivery_success_rate") && lineKeys.includes("forecast_delivery_success_rate");
    const delayLikelihoodTrend =
      lineKeys.includes("actual_delay_rate_pct") || lineKeys.includes("forecast_delay_rate_pct");
    const disruptionRiskForecast =
      lineKeys.includes("historical_disruption_risk") && lineKeys.includes("forecast_disruption_risk");
    const deliverySuccessRateTrend = valueKey === "delivery_success_rate" || fleetPerformanceTrend;
    const zeroOneRateTrend = deliverySuccessRateTrend || disruptionRiskForecast;
    const maintenanceRiskTrend = valueKey === "maintenance_risk_score";
    const maintenanceFailureByVehicle =
      lineKeys.length >= 2 && lineKeys.every((key) => String(key).toUpperCase().startsWith("TRK-"));
    const fuelEfficiencyTrend = valueKey === "avg_km_per_liter";
    const travelTimeTrend = valueKey === "avg_travel_hours" || valueKey === "avg_hours";
    const completionTimeTrend =
      lineKeys.includes("actual_completion_hours") && lineKeys.includes("predicted_completion_hours");
    const tripVolumeForecast =
      lineKeys.includes("actual_trips") && lineKeys.includes("forecast_trips");
    const periodLineChart =
      labelKey === "period" ||
      items.some((item) => Object.prototype.hasOwnProperty.call(item, "period"));
    const densePeriodLine = periodLineChart && rows.length > 10;
    const costOverrunForecast =
      lineKeys.includes("actual_daily_cost_php") && lineKeys.includes("predicted_daily_cost_php");
    const costFluctuationChart = items.some(
      (item) =>
        Object.prototype.hasOwnProperty.call(item, "daily_operational_cost_php") &&
        Object.prototype.hasOwnProperty.call(item, "rolling_mean_7d_php"),
    );
    const costOverrunRows: ChartRow[] = costOverrunForecast
      ? items.map((item) => {
          const row: ChartRow = { name: String(item[labelKey] ?? "") };
          for (const key of [
            "actual_daily_cost_php",
            "predicted_daily_cost_php",
            "confidence_lower_php",
            "confidence_upper_php",
          ] as const) {
            if (item[key] != null && item[key] !== "") {
              row[key] = Number(item[key]);
            }
          }
          return row;
        })
      : rows;
    const disruptionRiskRows: ChartRow[] = disruptionRiskForecast
      ? items.map((item) => {
          const row: ChartRow = { name: String(item[labelKey] ?? "") };
          for (const key of [
            "historical_disruption_risk",
            "forecast_disruption_risk",
            "confidence_lower_risk",
            "confidence_upper_risk",
          ] as const) {
            if (item[key] != null && item[key] !== "") {
              row[key] = Number(item[key]);
            }
          }
          return row;
        })
      : rows;
    const costFluctuationRows: ChartRow[] = costFluctuationChart
      ? items.map((item) => {
          const row: ChartRow = { name: String(item[labelKey] ?? "") };
          for (const key of [
            "daily_operational_cost_php",
            "rolling_mean_7d_php",
            "rolling_std_upper_php",
            "rolling_std_lower_php",
          ] as const) {
            if (item[key] != null && item[key] !== "") {
              row[key] = Number(item[key]);
            }
          }
          return row;
        })
      : rows;
    const lineMargin =
      bookingVolumeTrend ||
      efficiencyForecastChart ||
      fleetPerformanceTrend ||
      deliverySuccessRateTrend ||
      maintenanceRiskTrend ||
      maintenanceFailureByVehicle ||
      fuelEfficiencyTrend ||
      travelTimeTrend ||
      completionTimeTrend ||
      tripVolumeForecast ||
      costOverrunForecast ||
      disruptionRiskForecast ||
      costFluctuationChart
        ? { top: 36, right: 16, left: 12, bottom: 56 }
        : commonMargin;
    const lineXAxisProps = {
      ...xAxisProps,
      interval: densePeriodLine ? lineChartTickInterval(rows.length) : xAxisProps.interval,
      tick: periodLineChart
        ? (props: { x?: number; y?: number; payload?: { value?: string } }) => (
            <RotatedCategoryAxisTick {...props} formatPeriod />
          )
        : xAxisProps.tick,
      height: densePeriodLine ? 72 : xAxisProps.height,
      label: bookingVolumeTrend
        ? {
            value: "Timeline / Operational Period",
            position: "insideBottom" as const,
            offset: -52,
            style: { fontSize: 10, fill: "#64748b" },
          }
        : tripVolumeForecast || periodLineChart
          ? {
              value: xAxisLabel || "Period",
              position: "insideBottom" as const,
              offset: -52,
              style: { fontSize: 10, fill: "#64748b" },
            }
        : efficiencyForecastChart ||
            fleetPerformanceTrend ||
            deliverySuccessRateTrend ||
            maintenanceRiskTrend ||
            maintenanceFailureByVehicle ||
            fuelEfficiencyTrend ||
            travelTimeTrend ||
            costOverrunForecast ||
            disruptionRiskForecast ||
            costFluctuationChart
          ? {
              value: "Date",
              position: "insideBottom" as const,
              offset: -52,
              style: { fontSize: 10, fill: "#64748b" },
            }
          : xAxisProps.label,
    };
    const lineYAxisProps = zeroOneRateTrend
      ? {
          ...yAxisProps,
          tickFormatter: (v: number) => Number(v).toFixed(3),
          domain: [
            (dataMin: number) => Math.max(0, Math.floor((dataMin - 0.05) * 20) / 20),
            (dataMax: number) => Math.min(1, Math.ceil((dataMax + 0.025) * 40) / 40),
          ] as [(v: number) => number, (v: number) => number],
        }
      : delayLikelihoodTrend
        ? {
            ...yAxisProps,
            tickFormatter: (v: number) => `${Math.round(v)}%`,
            domain: [0, (dataMax: number) => Math.min(100, Math.ceil((dataMax + 5) / 5) * 5)] as [
              number,
              (v: number) => number,
            ],
          }
      : maintenanceRiskTrend || maintenanceFailureByVehicle
        ? {
            ...yAxisProps,
            domain: [0, 10] as [number, number],
            tickFormatter: (v: number) => Number(v).toFixed(1),
          }
        : costOverrunForecast || costFluctuationChart
          ? {
              ...yAxisProps,
              tickFormatter: (v: number) => formatNumber(v, { maximumFractionDigits: 0 }),
            }
          : efficiencyForecastChart || fuelEfficiencyTrend || travelTimeTrend || completionTimeTrend || tripVolumeForecast
            ? {
                ...yAxisProps,
                allowDecimals: tripVolumeForecast ? false : true,
                domain: completionTimeTrend
                  ? ([
                      (dataMin: number) => Math.max(0, Math.floor((dataMin - 0.5) * 2) / 2),
                      (dataMax: number) => Math.ceil((dataMax + 0.5) * 2) / 2,
                    ] as [(v: number) => number, (v: number) => number])
                  : tripVolumeForecast
                  ? ([0, (dataMax: number) => Math.max(4, Math.ceil(dataMax * 1.2))] as [
                      number,
                      (v: number) => number,
                    ])
                  : undefined,
                tickFormatter: (v: number) =>
                  completionTimeTrend
                    ? `${Number(v).toFixed(1)}h`
                    : tripVolumeForecast
                      ? String(Math.round(v))
                      : Number(v).toFixed(2),
              }
            : yAxisProps;
    chartNode = disruptionRiskForecast ? (
      <ComposedChart data={disruptionRiskRows} margin={lineMargin}>
        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
        <XAxis {...lineXAxisProps} />
        <YAxis
          {...lineYAxisProps}
          label={{
            value: yAxisLabel || "Disruption Risk Score",
            angle: -90,
            position: "insideLeft",
            style: { fontSize: 10, fill: "#64748b" },
          }}
        />
        <Tooltip
          cursor={LINE_CHART_CURSOR}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <div className="recharts-analytics-tooltip">
                <p className="recharts-analytics-tooltip__label">{String(label ?? "")}</p>
                {payload.map((entry) => (
                  <p key={String(entry.name)} className="recharts-analytics-tooltip__row">
                    <span className="recharts-analytics-tooltip__swatch" style={{ backgroundColor: entry.color }} />
                    <span>
                      {entry.name}:{" "}
                      {formatLineTooltipValue(entry.value, String(entry.dataKey ?? ""), String(entry.name ?? ""))}
                    </span>
                  </p>
                ))}
              </div>
            );
          }}
        />
        <Legend formatter={renderLegendText} verticalAlign="top" />
        <Area
          type="monotone"
          dataKey="confidence_upper_risk"
          name="Forecast Confidence Interval"
          stroke="none"
          fill={COST_OVERRUN_BAND}
          fillOpacity={0.45}
          connectNulls
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="confidence_lower_risk"
          stroke="none"
          fill="#ffffff"
          connectNulls
          isAnimationActive={false}
          legendType="none"
        />
        <Line
          type="monotone"
          dataKey="historical_disruption_risk"
          name={seriesLabel("historical_disruption_risk")}
          stroke={COST_OVERRUN_ACTUAL}
          strokeWidth={2.5}
          connectNulls
          dot={(props: { cx?: number; cy?: number; index?: number }) => {
            const { cx, cy, index = 0 } = props;
            if (cx == null || cy == null) return <g />;
            const name = disruptionRiskRows[index]?.name ?? "";
            const active = isSelected(name, selectedLabel);
            return (
              <circle
                key={`hist-disruption-dot-${index}`}
                cx={cx}
                cy={cy}
                r={active ? 5 : 3.5}
                fill={active ? SELECTED_STROKE : COST_OVERRUN_ACTUAL}
                stroke="#fff"
                strokeWidth={1}
                style={{ cursor: onItemClick ? "pointer" : "default" }}
                onClick={() => handleBarClick(index)}
              />
            );
          }}
          activeDot={{ r: 6, stroke: SELECTED_STROKE, strokeWidth: 2 }}
        />
        <Line
          type="monotone"
          dataKey="forecast_disruption_risk"
          name={seriesLabel("forecast_disruption_risk")}
          stroke={COST_OVERRUN_FORECAST}
          strokeWidth={2.5}
          strokeDasharray="6 4"
          connectNulls
          dot={(props: { cx?: number; cy?: number; index?: number }) => {
            const { cx, cy, index = 0 } = props;
            if (cx == null || cy == null) return <g />;
            const name = disruptionRiskRows[index]?.name ?? "";
            const active = isSelected(name, selectedLabel);
            return (
              <circle
                key={`forecast-disruption-dot-${index}`}
                cx={cx}
                cy={cy}
                r={active ? 5 : 3.5}
                fill={active ? SELECTED_STROKE : COST_OVERRUN_FORECAST}
                stroke="#fff"
                strokeWidth={1}
                style={{ cursor: onItemClick ? "pointer" : "default" }}
                onClick={() => handleBarClick(index)}
              />
            );
          }}
          activeDot={{ r: 6, stroke: SELECTED_STROKE, strokeWidth: 2 }}
        />
      </ComposedChart>
    ) : costOverrunForecast ? (
      <ComposedChart data={costOverrunRows} margin={lineMargin}>
        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
        <XAxis {...lineXAxisProps} />
        <YAxis
          {...lineYAxisProps}
          label={{
            value: yAxisLabel || "Daily Operational Cost (PHP)",
            angle: -90,
            position: "insideLeft",
            style: { fontSize: 10, fill: "#64748b" },
          }}
        />
        <Tooltip
          cursor={LINE_CHART_CURSOR}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <div className="recharts-analytics-tooltip">
                <p className="recharts-analytics-tooltip__label">{String(label ?? "")}</p>
                {payload.map((entry) => (
                  <p key={String(entry.name)} className="recharts-analytics-tooltip__row">
                    <span className="recharts-analytics-tooltip__swatch" style={{ backgroundColor: entry.color }} />
                    <span>
                      {entry.name}:{" "}
                      {formatLineTooltipValue(entry.value, String(entry.dataKey ?? ""), String(entry.name ?? ""))}
                    </span>
                  </p>
                ))}
              </div>
            );
          }}
        />
        <Legend formatter={renderLegendText} verticalAlign="top" />
        <Area
          type="monotone"
          dataKey="confidence_upper_php"
          name="95% Confidence Interval"
          stroke="none"
          fill={COST_OVERRUN_BAND}
          fillOpacity={0.45}
          connectNulls
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="confidence_lower_php"
          stroke="none"
          fill="#ffffff"
          connectNulls
          isAnimationActive={false}
          legendType="none"
        />
        <Line
          type="monotone"
          dataKey="actual_daily_cost_php"
          name={seriesLabel("actual_daily_cost_php")}
          stroke={COST_OVERRUN_ACTUAL}
          strokeWidth={2.5}
          connectNulls
          dot={(props: { cx?: number; cy?: number; index?: number }) => {
            const { cx, cy, index = 0 } = props;
            if (cx == null || cy == null) return <g />;
            const name = costOverrunRows[index]?.name ?? "";
            const active = isSelected(name, selectedLabel);
            return (
              <circle
                key={`actual-dot-${index}`}
                cx={cx}
                cy={cy}
                r={active ? 5 : 3.5}
                fill={active ? SELECTED_STROKE : COST_OVERRUN_ACTUAL}
                stroke="#fff"
                strokeWidth={1}
                style={{ cursor: onItemClick ? "pointer" : "default" }}
                onClick={() => handleBarClick(index)}
              />
            );
          }}
          activeDot={{ r: 6, stroke: SELECTED_STROKE, strokeWidth: 2 }}
        />
        <Line
          type="monotone"
          dataKey="predicted_daily_cost_php"
          name={seriesLabel("predicted_daily_cost_php")}
          stroke={COST_OVERRUN_FORECAST}
          strokeWidth={2.5}
          strokeDasharray="6 4"
          connectNulls
          dot={(props: { cx?: number; cy?: number; index?: number }) => {
            const { cx, cy, index = 0 } = props;
            if (cx == null || cy == null) return <g />;
            const name = costOverrunRows[index]?.name ?? "";
            const active = isSelected(name, selectedLabel);
            return (
              <circle
                key={`predict-dot-${index}`}
                cx={cx}
                cy={cy}
                r={active ? 5 : 3.5}
                fill={active ? SELECTED_STROKE : COST_OVERRUN_FORECAST}
                stroke="#fff"
                strokeWidth={1}
                style={{ cursor: onItemClick ? "pointer" : "default" }}
                onClick={() => handleBarClick(index)}
              />
            );
          }}
          activeDot={{ r: 6, stroke: SELECTED_STROKE, strokeWidth: 2 }}
        />
      </ComposedChart>
    ) : costFluctuationChart ? (
      <ComposedChart data={costFluctuationRows} margin={lineMargin}>
        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
        <XAxis {...lineXAxisProps} />
        <YAxis
          {...lineYAxisProps}
          label={{
            value: yAxisLabel || "Operational Cost (PHP)",
            angle: -90,
            position: "insideLeft",
            style: { fontSize: 10, fill: "#64748b" },
          }}
        />
        <Tooltip
          cursor={LINE_CHART_CURSOR}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <div className="recharts-analytics-tooltip">
                <p className="recharts-analytics-tooltip__label">{String(label ?? "")}</p>
                {payload.map((entry) => (
                  <p key={String(entry.name)} className="recharts-analytics-tooltip__row">
                    <span className="recharts-analytics-tooltip__swatch" style={{ backgroundColor: entry.color }} />
                    <span>
                      {entry.name}:{" "}
                      {formatLineTooltipValue(entry.value, String(entry.dataKey ?? ""), String(entry.name ?? ""))}
                    </span>
                  </p>
                ))}
              </div>
            );
          }}
        />
        <Legend formatter={renderLegendText} verticalAlign="top" />
        <Area
          type="monotone"
          dataKey="rolling_std_upper_php"
          name="Rolling Std. Dev (7-day)"
          stroke="none"
          fill={COST_OVERRUN_BAND}
          fillOpacity={0.45}
          connectNulls
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="rolling_std_lower_php"
          stroke="none"
          fill="#ffffff"
          connectNulls
          isAnimationActive={false}
          legendType="none"
        />
        <Line
          type="monotone"
          dataKey="daily_operational_cost_php"
          name={seriesLabel("daily_operational_cost_php")}
          stroke={COST_OVERRUN_ACTUAL}
          strokeWidth={2.5}
          connectNulls
          dot={(props: { cx?: number; cy?: number; index?: number }) => {
            const { cx, cy, index = 0 } = props;
            if (cx == null || cy == null) return <g />;
            const name = costFluctuationRows[index]?.name ?? "";
            const active = isSelected(name, selectedLabel);
            return (
              <circle
                key={`daily-cost-dot-${index}`}
                cx={cx}
                cy={cy}
                r={active ? 5 : 3.5}
                fill={active ? SELECTED_STROKE : COST_OVERRUN_ACTUAL}
                stroke="#fff"
                strokeWidth={1}
                style={{ cursor: onItemClick ? "pointer" : "default" }}
                onClick={() => handleBarClick(index)}
              />
            );
          }}
          activeDot={{ r: 6, stroke: SELECTED_STROKE, strokeWidth: 2 }}
        />
        <Line
          type="monotone"
          dataKey="rolling_mean_7d_php"
          name={seriesLabel("rolling_mean_7d_php")}
          stroke={COST_OVERRUN_FORECAST}
          strokeWidth={2.5}
          strokeDasharray="6 4"
          connectNulls
          dot={false}
          activeDot={{ r: 6, stroke: SELECTED_STROKE, strokeWidth: 2 }}
        />
      </ComposedChart>
    ) : (
      <LineChart data={rows} margin={lineMargin}>
        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
        <XAxis {...lineXAxisProps} />
        <YAxis
          {...lineYAxisProps}
          label={
            bookingVolumeTrend
              ? {
                  value: yAxisLabel || "Total Bookings Logged",
                  angle: -90,
                  position: "insideLeft",
                  style: { fontSize: 10, fill: "#64748b" },
                }
              : deliverySuccessRateTrend
                ? {
                    value: yAxisLabel || "Delivery Success Rate",
                    angle: -90,
                    position: "insideLeft",
                    style: { fontSize: 10, fill: "#64748b" },
                  }
                : disruptionRiskForecast
                  ? {
                      value: yAxisLabel || "Disruption Risk Score",
                      angle: -90,
                      position: "insideLeft",
                      style: { fontSize: 10, fill: "#64748b" },
                    }
                  : delayLikelihoodTrend
                    ? {
                        value: yAxisLabel || "Delay Likelihood (%)",
                        angle: -90,
                        position: "insideLeft",
                        style: { fontSize: 10, fill: "#64748b" },
                      }
                  : maintenanceRiskTrend || maintenanceFailureByVehicle
                  ? {
                      value: yAxisLabel || "Maintenance Risk Score",
                      angle: -90,
                      position: "insideLeft",
                      style: { fontSize: 10, fill: "#64748b" },
                    }
                  : fuelEfficiencyTrend
                    ? {
                        value: yAxisLabel || "Average Fuel Efficiency (Km per Liter)",
                        angle: -90,
                        position: "insideLeft",
                        style: { fontSize: 10, fill: "#64748b" },
                      }
                    : travelTimeTrend
                      ? {
                          value: yAxisLabel || "hours",
                          angle: -90,
                          position: "insideLeft",
                          style: { fontSize: 10, fill: "#64748b" },
                        }
                      : completionTimeTrend
                        ? {
                            value: yAxisLabel || "Completion Time (hours)",
                            angle: -90,
                            position: "insideLeft",
                            style: { fontSize: 10, fill: "#64748b" },
                          }
                      : efficiencyForecastChart
                  ? {
                      value: yAxisLabel || "Average Fuel Efficiency (KM per Liter)",
                      angle: -90,
                      position: "insideLeft",
                      style: { fontSize: 10, fill: "#64748b" },
                    }
                  : lineYAxisProps.label
          }
        />
        <Tooltip {...LINE_CHART_TOOLTIP_PROPS} />
        {showLegend || lineKeys.length > 1 || maintenanceRiskTrend || maintenanceFailureByVehicle || deliverySuccessRateTrend || fuelEfficiencyTrend || travelTimeTrend || completionTimeTrend || fleetPerformanceTrend || delayLikelihoodTrend || tripVolumeForecast || efficiencyForecastChart ? (
          <Legend formatter={renderLegendText} verticalAlign="top" />
        ) : null}
        {lineKeys.map((key, idx) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            name={legendLabel && lineKeys.length === 1 ? legendLabel : seriesLabel(key)}
            stroke={lineSeriesStroke(key, idx)}
            strokeWidth={2.5}
            strokeDasharray={key.startsWith("forecast_") ? "6 4" : undefined}
            connectNulls
            dot={
              key.startsWith("forecast_")
                ? false
                : (props: { cx?: number; cy?: number; index?: number }) => {
                    const { cx, cy, index = 0 } = props;
                    const name = rows[index]?.name ?? "";
                    const active = isSelected(name, selectedLabel);
                    const stroke = lineSeriesStroke(key, idx);
                    return (
                      <circle
                        key={`dot-${key}-${index}`}
                        cx={cx}
                        cy={cy}
                        r={active ? 5 : 3.5}
                        fill={active ? SELECTED_STROKE : stroke}
                        stroke="#fff"
                        strokeWidth={1}
                        style={{ cursor: onItemClick ? "pointer" : "default" }}
                        onClick={() => handleBarClick(index)}
                      />
                    );
                  }
            }
            activeDot={key.startsWith("forecast_") ? false : { r: 6, stroke: SELECTED_STROKE, strokeWidth: 2 }}
          />
        ))}
      </LineChart>
    );
  } else if (kind === "area") {
    const keys = (seriesKeys?.length ? seriesKeys : [valueKey]).slice(0, 3);
    chartNode = (
      <AreaChart data={rows} margin={commonMargin}>
        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
        <XAxis {...xAxisProps} />
        <YAxis {...yAxisProps} />
        <Tooltip content={<ChartTooltip />} />
        <Legend formatter={renderLegendText} verticalAlign="top" />
        {keys.map((key, idx) => {
          const color =
            idx === 0 ? SERIES_COLORS.estimated : idx === 1 ? SERIES_COLORS.actual : BAR_COLORS[idx % BAR_COLORS.length];
          return (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              name={seriesLabel(key)}
              stackId="area-stack"
              stroke={color}
              fill={color}
              fillOpacity={idx === 0 ? 0.35 : 0.25}
              strokeWidth={2}
            />
          );
        })}
      </AreaChart>
    );
  } else if (kind === "groupedBar") {
    const keys = deriveGroupedSeriesKeys(items, labelKey, groupedSeriesKeys).slice(0, 4);
    const truckPrefChart = items.some((item) => Object.prototype.hasOwnProperty.call(item, "truck_type"));
    const groupedMargin = truckPrefChart
      ? { top: 36, right: 12, left: 12, bottom: 72 }
      : commonMargin;
    const groupedXAxisProps = {
      ...xAxisProps,
      interval: 0,
      label: truckPrefChart
        ? {
            value: "Truck Type / Category",
            position: "insideBottom" as const,
            offset: -52,
            style: { fontSize: 10, fill: "#64748b" },
          }
        : xAxisProps.label,
    };
    chartNode = (
      <BarChart data={rows} margin={groupedMargin} barGap={4} barCategoryGap="22%">
        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
        <XAxis {...groupedXAxisProps} />
        <YAxis
          {...yAxisProps}
          allowDecimals={false}
          domain={[0, (dataMax: number) => Math.max(4, Math.ceil(dataMax * 1.15))]}
          label={
            truckPrefChart
              ? {
                  value: "Selection Count / Volume",
                  angle: -90,
                  position: "insideLeft",
                  style: { fontSize: 10, fill: "#64748b" },
                }
              : yAxisProps.label
          }
        />
        <Tooltip content={<ChartTooltip />} />
        <Legend formatter={renderLegendText} verticalAlign="top" />
        {keys.map((key, idx) => (
          <Bar
            key={key}
            dataKey={key}
            name={seriesLabel(key)}
            fill={seriesFill(key, idx)}
            maxBarSize={36}
            onClick={(_event: unknown, index: number) => handleBarClick(index)}
            style={{ cursor: onItemClick ? "pointer" : "default" }}
          />
        ))}
      </BarChart>
    );
  } else if (kind === "stackedBar") {
    const keys = (seriesKeys?.length ? seriesKeys : [valueKey]).slice(0, 4);
    const loginActivityStack = keys.includes("login") && keys.includes("logout");
    const bookingFulfillmentStack =
      keys.includes("Approved") && keys.includes("Completed") && keys.includes("Pending");
    const stackMargin = loginActivityStack
      ? { top: 28, right: 96, left: 8, bottom: 56 }
      : bookingFulfillmentStack
        ? { top: 36, right: 16, left: 8, bottom: 56 }
        : commonMargin;
    const stackXAxisProps = {
      ...xAxisProps,
      label: loginActivityStack
        ? { value: "Timeline (Quarters)", position: "insideBottom" as const, offset: -52, style: { fontSize: 10, fill: "#64748b" } }
        : bookingFulfillmentStack
          ? {
              value: "Billing Cycle / Monthly Cohorts",
              position: "insideBottom" as const,
              offset: -52,
              style: { fontSize: 10, fill: "#64748b" },
            }
          : xAxisProps.label,
    };
    chartNode = (
      <BarChart data={rows} margin={stackMargin}>
        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
        <XAxis {...stackXAxisProps} />
        <YAxis
          {...yAxisProps}
          label={
            loginActivityStack
              ? {
                  value: yAxisLabel || "Number of Logged Activities",
                  angle: -90,
                  position: "insideLeft",
                  style: { fontSize: 10, fill: "#64748b" },
                }
              : bookingFulfillmentStack
                ? {
                    value: yAxisLabel || "Number of Logged Orders",
                    angle: -90,
                    position: "insideLeft",
                    style: { fontSize: 10, fill: "#64748b" },
                  }
                : yAxisProps.label
          }
        />
        <Tooltip content={<ChartTooltip />} />
        <Legend
          formatter={renderLegendText}
          verticalAlign={loginActivityStack ? "middle" : "top"}
          align={loginActivityStack ? "right" : "center"}
          layout={loginActivityStack ? "vertical" : "horizontal"}
        />
        {keys.map((key, idx) => (
          <Bar
            key={key}
            dataKey={key}
            name={seriesLabel(key)}
            stackId="stack"
            fill={seriesFill(key, idx)}
            onClick={(_event: unknown, index: number) => handleBarClick(index)}
            style={{ cursor: onItemClick ? "pointer" : "default" }}
          />
        ))}
      </BarChart>
    );
  } else if (kind === "pareto") {
    const cumulativeKey = secondarySeriesKey ?? "cumulative_percent";
    chartNode = (
      <ComposedChart data={rows} margin={{ top: 36, right: 48, left: 12, bottom: 72 }}>
        <CartesianGrid stroke={GRID_STROKE} />
        <XAxis
          {...xAxisProps}
          label={{
            value: xAxisLabel || "Maintenance Issue",
            position: "insideBottom",
            offset: -52,
            style: { fontSize: 10, fill: "#64748b" },
          }}
        />
        <YAxis
          yAxisId="left"
          allowDecimals={false}
          tick={AXIS_TICK}
          domain={[0, (dataMax: number) => Math.max(dataMax + 1, 5)]}
          label={{
            value: yAxisLabel || "Frequency (Count)",
            angle: -90,
            position: "insideLeft",
            style: { fontSize: 10, fill: "#64748b" },
          }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          domain={[0, 100]}
          tick={AXIS_TICK}
          tickFormatter={(v: number) => `${Math.round(v)}%`}
          label={{
            value: "Cumulative Percentage",
            angle: 90,
            position: "insideRight",
            style: { fontSize: 10, fill: "#64748b" },
          }}
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <div className="recharts-analytics-tooltip">
                <p className="recharts-analytics-tooltip__label">{String(label ?? "")}</p>
                {payload.map((entry) => (
                  <p key={String(entry.name)} className="recharts-analytics-tooltip__row">
                    <span className="recharts-analytics-tooltip__swatch" style={{ backgroundColor: entry.color }} />
                    <span>
                      {entry.name}:{" "}
                      {formatLineTooltipValue(entry.value, String(entry.dataKey ?? ""), String(entry.name ?? ""))}
                    </span>
                  </p>
                ))}
              </div>
            );
          }}
        />
        <Legend formatter={renderLegendText} verticalAlign="top" />
        <Bar
          yAxisId="left"
          dataKey={valueKey}
          name="Frequency (Count)"
          barSize={42}
          onClick={(_event: unknown, index: number) => handleBarClick(index)}
          style={{ cursor: onItemClick ? "pointer" : "default" }}
        >
          {rows.map((entry, i) => (
            <Cell
              key={entry.name}
              fill={PARETO_BAR_COLORS[i % PARETO_BAR_COLORS.length]}
              stroke={isSelected(entry.name, selectedLabel) ? SELECTED_STROKE : "none"}
              strokeWidth={isSelected(entry.name, selectedLabel) ? 2 : 0}
            />
          ))}
        </Bar>
        <Line
          yAxisId="right"
          type="monotone"
          dataKey={cumulativeKey}
          name="Cumulative Percentage"
          stroke={PARETO_CUMULATIVE_LINE}
          strokeWidth={2.5}
          strokeDasharray="6 4"
          dot={{ r: 4, fill: PARETO_CUMULATIVE_LINE, stroke: "#fff", strokeWidth: 1 }}
          activeDot={{ r: 6, stroke: SELECTED_STROKE, strokeWidth: 2 }}
        >
          <LabelList
            dataKey={cumulativeKey}
            position="top"
            formatter={(value: number) => `${Number(value).toFixed(1)}%`}
            style={{ fill: PARETO_CUMULATIVE_LINE, fontSize: 10, fontWeight: 600 }}
          />
        </Line>
      </ComposedChart>
    );
  } else if (kind === "scatter") {
    const regressionKey = secondarySeriesKey ?? "predicted_fuel_liters";
    const actualData = items
      .filter(
        (item) => item.series_type === "actual" || (item[valueKey] != null && item[regressionKey] == null),
      )
      .map((item) => ({
        distance_km: Number(item.distance_km ?? item[labelKey] ?? 0),
        [valueKey]: Number(item[valueKey] ?? 0),
        trip_id: item.trip_id,
      }))
      .filter(
        (item) =>
          Number.isFinite(item.distance_km) &&
          Number.isFinite(Number(item[valueKey])) &&
          Number(item[valueKey]) > 0,
      );
    const regressionData = items
      .filter((item) => item.series_type === "regression")
      .map((item) => ({
        distance_km: Number(item.distance_km ?? item[labelKey] ?? 0),
        [regressionKey]: Number(item[regressionKey] ?? 0),
      }))
      .filter((item) => Number.isFinite(item.distance_km) && Number.isFinite(Number(item[regressionKey])));
    const xValues = [...actualData, ...regressionData].map((item) => item.distance_km);
    const yValues = [
      ...actualData.map((item) => Number(item[valueKey])),
      ...regressionData.map((item) => Number(item[regressionKey])),
    ];
    const xMax = xValues.length ? Math.max(...xValues) : 100;
    const yMax = yValues.length ? Math.max(...yValues) : 45;
    const handleScatterClick = (point: {
      payload?: { distance_km?: number; trip_id?: number } & Record<string, number | undefined>;
    }) => {
      if (!onItemClick || !point.payload) return;
      const raw = point.payload;
      onItemClick({
        label: `${raw.distance_km ?? ""} km`,
        raw: raw as Record<string, string | number>,
      });
    };
    chartNode = (
      <ComposedChart margin={{ top: 36, right: 16, left: 12, bottom: 56 }}>
        <CartesianGrid stroke={GRID_STROKE} />
        <XAxis
          type="number"
          dataKey="distance_km"
          domain={[0, Math.ceil(xMax * 1.05) || 100]}
          tick={AXIS_TICK}
          tickFormatter={(v: number) => formatNumber(v, { maximumFractionDigits: 0 })}
          label={{
            value:
              labelKey === "distance_km" ? "Distance Traveled (km)" : xAxisLabel || "Distance Traveled (km)",
            position: "insideBottom",
            offset: -52,
            style: { fontSize: 10, fill: "#64748b" },
          }}
        />
        <YAxis
          type="number"
          dataKey={valueKey}
          domain={[0, Math.ceil(yMax * 1.1) || 45]}
          tick={AXIS_TICK}
          tickFormatter={(v: number) => formatNumber(v, { maximumFractionDigits: 1 })}
          label={{
            value: scatterYAxisLabel(valueKey, yAxisLabel),
            angle: -90,
            position: "insideLeft",
            style: { fontSize: 10, fill: "#64748b" },
          }}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const row = payload[0]?.payload as Record<string, unknown> | undefined;
            if (!row) return null;
            return (
              <div className="recharts-analytics-tooltip recharts-analytics-tooltip--line">
                <p className="recharts-analytics-tooltip__label">
                  Distance: {formatLineTooltipValue(row.distance_km, "distance_km")} km
                </p>
                {row[valueKey] != null ? (
                  <p className="recharts-analytics-tooltip__row recharts-analytics-tooltip__row--plain">
                    {scatterActualLabel(valueKey)}: {formatLineTooltipValue(row[valueKey], valueKey)}
                  </p>
                ) : null}
                {row[regressionKey] != null ? (
                  <p className="recharts-analytics-tooltip__row recharts-analytics-tooltip__row--plain">
                    {scatterPredictedLabel(regressionKey)}:{" "}
                    {formatLineTooltipValue(row[regressionKey], regressionKey)}
                  </p>
                ) : null}
              </div>
            );
          }}
        />
        {showLegend ? <Legend formatter={renderLegendText} verticalAlign="top" /> : null}
        <Scatter
          name={seriesLabel(valueKey)}
          data={actualData}
          fill={FUEL_SCATTER_ACTUAL}
          onClick={handleScatterClick}
          style={{ cursor: onItemClick ? "pointer" : "default" }}
        />
        <Line
          data={regressionData}
          type="linear"
          dataKey={regressionKey}
          name={seriesLabel(regressionKey)}
          stroke={FUEL_REGRESSION_LINE}
          strokeWidth={2.5}
          dot={false}
          activeDot={false}
          legendType="line"
        />
      </ComposedChart>
    );
  } else if (kind === "combo") {
    const primary = (seriesKeys?.length ? seriesKeys : [valueKey]).slice(0, 2);
    const lineKey = secondarySeriesKey ?? valueKey;
    chartNode = (
      <ComposedChart data={rows} margin={{ ...commonMargin, right: 48 }}>
        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
        <XAxis {...xAxisProps} />
        <YAxis yAxisId="left" {...yAxisProps} />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={AXIS_TICK}
          tickFormatter={yAxisProps.tickFormatter}
          label={{ value: "profit php", angle: 90, position: "insideRight", style: { fontSize: 10, fill: "#334155" } }}
        />
        <Tooltip content={<ChartTooltip />} cursor={LINE_CHART_CURSOR} />
        <Legend formatter={renderLegendText} verticalAlign="top" />
        {primary.map((key, idx) => (
          <Bar
            key={key}
            yAxisId="left"
            dataKey={key}
            name={seriesLabel(key)}
            fill={idx === 0 ? SERIES_COLORS.revenue : SERIES_COLORS.expense}
            barSize={24}
            onClick={(_event: unknown, index: number) => handleBarClick(index)}
            style={{ cursor: onItemClick ? "pointer" : "default" }}
          />
        ))}
        <Line
          yAxisId="right"
          type="monotone"
          dataKey={lineKey}
          name={seriesLabel(lineKey)}
          stroke={SERIES_COLORS.profit}
          strokeWidth={2.5}
          dot={{ r: 3.5, fill: SERIES_COLORS.profit }}
        />
      </ComposedChart>
    );
  } else if (kind === "horizontalBar") {
    if (valueKey === "risk_rank" && labelKey === "truck") {
      chartNode = (
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 16, right: 16, left: 8, bottom: 48 }}
          barCategoryGap="18%"
        >
          <CartesianGrid stroke={GRID_STROKE} horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 3]}
            ticks={[1, 2, 3]}
            tick={AXIS_TICK}
            tickFormatter={(v: number) => severityLabelFromRank(Number(v))}
            label={{
              value: xAxisLabel || "Breakdown Risk (Low / Medium / High)",
              position: "insideBottom",
              offset: -8,
              style: { fontSize: 10, fill: "#64748b" },
            }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={horizontalLeftMargin}
            interval={0}
            tick={CategoryAxisTick}
            label={{
              value: yAxisLabel || "Truck",
              angle: -90,
              position: "insideLeft",
              style: { fontSize: 10, fill: "#64748b" },
            }}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0]?.payload as ChartRow | undefined;
              const risk = String(row?.breakdown_risk ?? severityLabelFromRank(Number(payload[0]?.value ?? 0)));
              return (
                <div className="recharts-analytics-tooltip recharts-analytics-tooltip--line">
                  <p className="recharts-analytics-tooltip__label">{String(label ?? row?.name ?? "—")}</p>
                  <p className="recharts-analytics-tooltip__row recharts-analytics-tooltip__row--plain">
                    Breakdown risk: {risk}
                  </p>
                  {row?.breakdown_count != null ? (
                    <p className="recharts-analytics-tooltip__row recharts-analytics-tooltip__row--plain">
                      Breakdown reports: {formatTooltipValue(row.breakdown_count)}
                    </p>
                  ) : null}
                </div>
              );
            }}
          />
          <Bar
            dataKey={valueKey}
            name="Breakdown Risk"
            barSize={18}
            onClick={(_event: unknown, index: number) => handleBarClick(index)}
            style={{ cursor: onItemClick ? "pointer" : "default" }}
          >
            {rows.map((entry) => {
              const risk = String(entry.breakdown_risk ?? severityLabelFromRank(Number(entry.risk_rank ?? 0)));
              const active = isSelected(entry.name, selectedLabel);
              return (
                <Cell
                  key={entry.name}
                  fill={MAINTENANCE_SEVERITY_COLORS[risk] ?? ENTERPRISE_GREEN}
                  stroke={active ? SELECTED_STROKE : "none"}
                  strokeWidth={active ? 2 : 0}
                />
              );
            })}
          </Bar>
        </BarChart>
      );
    } else {
    const serviceVolumeChart = items.some((item) => Object.prototype.hasOwnProperty.call(item, "service_category"));
    const cargoOrderChart = items.some((item) => Object.prototype.hasOwnProperty.call(item, "cargo_classification"));
    const tripsPerDriverChart = labelKey === "driver" && valueKey === "trip_count";
    const reportsPerTruckChart = labelKey === "truck" && valueKey === "report_count";
    const tripStatusChart = labelKey === "trip_status" && valueKey === "trip_count";
    const tripPeriodChart = labelKey === "period" && valueKey === "trip_count";
    const truckTripChart = labelKey === "truck" && valueKey === "trip_count";
    const shipmentRegionChart = labelKey === "region" && valueKey === "trip_count";
    const regionDistanceChart = labelKey === "region" && valueKey === "distance_km";
    const delayCauseChart = labelKey === "delay_cause" && valueKey === "delay_count";
    const countHorizontalBar =
      reportsPerTruckChart ||
      tripsPerDriverChart ||
      truckTripChart ||
      tripStatusChart ||
      tripPeriodChart ||
      shipmentRegionChart ||
      delayCauseChart;
    const horizontalAxisChart =
      serviceVolumeChart ||
      cargoOrderChart ||
      countHorizontalBar ||
      regionDistanceChart;
    chartNode = (
      <BarChart
        data={rows}
        layout="vertical"
        margin={{
          top: 16,
          right: cargoOrderChart ? 120 : 16,
          left: 8,
          bottom: horizontalAxisChart ? 48 : 16,
        }}
        barCategoryGap="18%"
      >
        <CartesianGrid stroke={GRID_STROKE} horizontal={false} />
        <XAxis
          type="number"
          tick={AXIS_TICK}
          tickFormatter={yAxisProps.tickFormatter}
          allowDecimals={countHorizontalBar ? false : undefined}
          domain={
            countHorizontalBar
              ? ([0, horizontalCountAxisMax] as [number, (dataMax: number) => number])
              : undefined
          }
          label={
            serviceVolumeChart || cargoOrderChart
              ? {
                  value: cargoOrderChart ? "Total Bookings Logged" : "Total Orders Logged",
                  position: "insideBottom",
                  offset: -8,
                  style: { fontSize: 10, fill: "#64748b" },
                }
              : tripsPerDriverChart || truckTripChart
                ? {
                    value: xAxisLabel || "Number of Trips",
                    position: "insideBottom",
                    offset: -8,
                    style: { fontSize: 10, fill: "#64748b" },
                  }
                : reportsPerTruckChart
                  ? {
                      value: xAxisLabel || "Number of Reports",
                      position: "insideBottom",
                      offset: -8,
                      style: { fontSize: 10, fill: "#64748b" },
                    }
                : delayCauseChart
                  ? {
                      value: xAxisLabel || "Number of Delay Records",
                      position: "insideBottom",
                      offset: -8,
                      style: { fontSize: 10, fill: "#64748b" },
                    }
                : regionDistanceChart
                  ? {
                      value: xAxisLabel || "Distance (km)",
                      position: "insideBottom",
                      offset: -8,
                      style: { fontSize: 10, fill: "#64748b" },
                    }
                : tripStatusChart || tripPeriodChart || shipmentRegionChart
                  ? {
                      value: xAxisLabel || "Number of Trips",
                      position: "insideBottom",
                      offset: -8,
                      style: { fontSize: 10, fill: "#64748b" },
                    }
                  : undefined
          }
        />
        <YAxis
          type="category"
          dataKey="name"
          width={horizontalLeftMargin}
          interval={0}
          tick={CategoryAxisTick}
          label={
            serviceVolumeChart
              ? {
                  value: "Service Type / Category",
                  angle: -90,
                  position: "insideLeft",
                  style: { fontSize: 10, fill: "#64748b" },
                }
              : cargoOrderChart
                ? {
                    value: "Cargo Classification",
                    angle: -90,
                    position: "insideLeft",
                    style: { fontSize: 10, fill: "#64748b" },
                  }
                : tripsPerDriverChart
                  ? {
                      value: yAxisLabel || "Driver",
                      angle: -90,
                      position: "insideLeft",
                      style: { fontSize: 10, fill: "#64748b" },
                    }
                  : delayCauseChart
                    ? {
                        value: yAxisLabel || "Delay Cause",
                        angle: -90,
                        position: "insideLeft",
                        style: { fontSize: 10, fill: "#64748b" },
                      }
                  : reportsPerTruckChart || truckTripChart
                    ? {
                        value: yAxisLabel || "Truck",
                        angle: -90,
                        position: "insideLeft",
                        style: { fontSize: 10, fill: "#64748b" },
                      }
                  : tripStatusChart
                    ? {
                        value: yAxisLabel || "Delivery Status",
                        angle: -90,
                        position: "insideLeft",
                        style: { fontSize: 10, fill: "#64748b" },
                      }
                    : shipmentRegionChart || regionDistanceChart
                      ? {
                          value: yAxisLabel || "Region",
                          angle: -90,
                          position: "insideLeft",
                          style: { fontSize: 10, fill: "#64748b" },
                        }
                    : tripPeriodChart
                      ? {
                          value: yAxisLabel || "Period",
                          angle: -90,
                          position: "insideLeft",
                          style: { fontSize: 10, fill: "#64748b" },
                        }
                      : undefined
          }
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const fullLabel = String(label ?? payload[0]?.payload?.name ?? "");
            return (
              <div className="recharts-analytics-tooltip">
                <p className="recharts-analytics-tooltip__label">{fullLabel}</p>
                {payload.map((entry) => (
                  <p key={String(entry.name)} className="recharts-analytics-tooltip__row">
                    <span className="recharts-analytics-tooltip__swatch" style={{ backgroundColor: entry.color }} />
                    <span>
                      {entry.name}: {formatTooltipValue(entry.value)}
                    </span>
                  </p>
                ))}
              </div>
            );
          }}
        />
        {cargoOrderChart ? (
          <Legend
            formatter={renderLegendText}
            verticalAlign="middle"
            align="right"
            layout="vertical"
            payload={rows.map((entry) => ({
              value: entry.name,
              type: "square" as const,
              color: CARGO_CLASSIFICATION_COLORS[String(entry.name)] ?? SERVICE_VOLUME_BAR,
            }))}
          />
        ) : null}
        <Bar
          dataKey={valueKey}
          name={legendLabel ?? seriesLabel(valueKey)}
          fill={serviceVolumeChart ? SERVICE_VOLUME_BAR : ENTERPRISE_GREEN}
          barSize={18}
          onClick={(_event: unknown, index: number) => handleBarClick(index)}
          style={{ cursor: onItemClick ? "pointer" : "default" }}
        >
          {rows.map((entry, i) => {
            const active = isSelected(entry.name, selectedLabel);
            const fill = cargoOrderChart
              ? CARGO_CLASSIFICATION_COLORS[String(entry.name)] ?? BAR_COLORS[i % BAR_COLORS.length]
              : serviceVolumeChart
                ? SERVICE_VOLUME_BAR
                : tripStatusChart
                  ? TRIP_STATUS_COLORS[String(entry.name)] ?? BAR_COLORS[i % BAR_COLORS.length]
                  : BAR_COLORS[i % BAR_COLORS.length];
            return (
              <Cell
                key={`${entry.name}-${i}`}
                fill={fill}
                stroke={active ? SELECTED_STROKE : "none"}
                strokeWidth={active ? 2 : 0}
              />
            );
          })}
        </Bar>
      </BarChart>
    );
    }
  } else if (valueKey === "total_operational_cost_php") {
    const operationalCostYAxis = {
      ...yAxisProps,
      tickFormatter: (v: number) => formatNumber(v, { maximumFractionDigits: 0 }),
      label: {
        value: yAxisLabel || "Cost (PHP)",
        angle: -90,
        position: "insideLeft" as const,
        style: { fontSize: 10, fill: "#64748b" },
      },
    };
    chartNode = (
      <BarChart data={rows} margin={{ top: 28, right: 16, left: 12, bottom: 56 }} barCategoryGap="40%">
        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
        <XAxis
          {...xAxisProps}
          label={{
            value: xAxisLabel || "Total Operational Cost",
            position: "insideBottom",
            offset: -52,
            style: { fontSize: 10, fill: "#64748b" },
          }}
        />
        <YAxis {...operationalCostYAxis} />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            return (
              <div className="recharts-analytics-tooltip">
                <p className="recharts-analytics-tooltip__label">Overall Total Operational Cost</p>
                <p className="recharts-analytics-tooltip__row">{formatPesoTooltipLabel(payload[0]?.value)}</p>
              </div>
            );
          }}
        />
        <Bar
          dataKey={valueKey}
          name={legendLabel ?? "Total Operational Cost"}
          fill={OPERATIONAL_COST_BAR}
          maxBarSize={220}
          onClick={(_event: unknown, index: number) => handleBarClick(index)}
          style={{ cursor: onItemClick ? "pointer" : "default" }}
        >
          {rows.map((entry) => {
            const active = isSelected(entry.name, selectedLabel);
            return (
              <Cell
                key={entry.name}
                fill={OPERATIONAL_COST_BAR}
                stroke={active ? SELECTED_STROKE : "none"}
                strokeWidth={active ? 2 : 0}
              />
            );
          })}
        </Bar>
      </BarChart>
    );
  } else if (
    valueKey === "total_breakdowns" &&
    items.some((item) => Object.prototype.hasOwnProperty.call(item, "vehicle_id"))
  ) {
    chartNode = (
      <BarChart data={rows} margin={{ top: 28, right: 16, left: 12, bottom: 56 }} barCategoryGap="28%">
        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
        <XAxis
          {...xAxisProps}
          label={{
            value: xAxisLabel || "Vehicle ID",
            position: "insideBottom",
            offset: -52,
            style: { fontSize: 10, fill: "#64748b" },
          }}
        />
        <YAxis
          {...yAxisProps}
          allowDecimals={false}
          tickFormatter={(v: number) => formatNumber(v, { maximumFractionDigits: 0 })}
          domain={[0, (dataMax: number) => Math.max(dataMax + 2, 5)]}
          label={{
            value: yAxisLabel || "Total Breakdowns",
            angle: -90,
            position: "insideLeft",
            style: { fontSize: 10, fill: "#64748b" },
          }}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const row = payload[0]?.payload as ChartRow | undefined;
            const vehicleId = row?.name ?? "—";
            return (
              <div className="recharts-analytics-tooltip recharts-analytics-tooltip--line">
                <p className="recharts-analytics-tooltip__row recharts-analytics-tooltip__row--plain">
                  vehicle_id={vehicleId}
                </p>
                <p className="recharts-analytics-tooltip__row recharts-analytics-tooltip__row--plain">
                  total_breakdowns={formatTooltipValue(payload[0]?.value)}
                </p>
              </div>
            );
          }}
        />
        <Bar
          dataKey={valueKey}
          name="Total Breakdowns"
          maxBarSize={88}
          onClick={(_event: unknown, index: number) => handleBarClick(index)}
          style={{ cursor: onItemClick ? "pointer" : "default" }}
        >
          {rows.map((entry, i) => {
            const active = isSelected(entry.name, selectedLabel);
            return (
              <Cell
                key={entry.name}
                fill={BREAKDOWN_VEHICLE_BAR_COLORS[i % BREAKDOWN_VEHICLE_BAR_COLORS.length]}
                stroke={active ? SELECTED_STROKE : "none"}
                strokeWidth={active ? 2 : 0}
              />
            );
          })}
        </Bar>
      </BarChart>
    );
  } else if (
    valueKey === "trip_count" &&
    items.some((item) => Object.prototype.hasOwnProperty.call(item, "delay_hours")) &&
    items.some((item) => Object.prototype.hasOwnProperty.call(item, "density_curve"))
  ) {
    const densityKey = secondarySeriesKey ?? "density_curve";
    chartNode = (
      <ComposedChart data={rows} margin={{ top: 36, right: 16, left: 12, bottom: 56 }}>
        <CartesianGrid stroke={GRID_STROKE} />
        <XAxis
          {...xAxisProps}
          tickFormatter={(v: string | number) => {
            const n = Number(v);
            return Number.isFinite(n) ? `${n}` : String(v);
          }}
          label={{
            value: xAxisLabel || "Delay in Hours",
            position: "insideBottom",
            offset: -52,
            style: { fontSize: 10, fill: "#64748b" },
          }}
        />
        <YAxis
          {...yAxisProps}
          allowDecimals={false}
          tickFormatter={(v: number) => formatNumber(v, { maximumFractionDigits: 0 })}
          domain={[0, (dataMax: number) => Math.max(dataMax + 1, 4)]}
          label={{
            value: yAxisLabel || "Number of Trips",
            angle: -90,
            position: "insideLeft",
            style: { fontSize: 10, fill: "#64748b" },
          }}
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <div className="recharts-analytics-tooltip recharts-analytics-tooltip--line">
                <p className="recharts-analytics-tooltip__label">Delay {String(label ?? "")} hrs</p>
                {payload.map((entry) => (
                  <p key={String(entry.name)} className="recharts-analytics-tooltip__row">
                    <span className="recharts-analytics-tooltip__swatch" style={{ backgroundColor: entry.color }} />
                    <span>
                      {entry.name}: {formatTooltipValue(entry.value)}
                    </span>
                  </p>
                ))}
              </div>
            );
          }}
        />
        <Legend formatter={renderLegendText} verticalAlign="top" />
        <Bar
          dataKey={valueKey}
          name="Number of Trips"
          fill={TRAVEL_DELAY_HISTOGRAM_BAR}
          maxBarSize={56}
          onClick={(_event: unknown, index: number) => handleBarClick(index)}
          style={{ cursor: onItemClick ? "pointer" : "default" }}
        >
          {rows.map((entry) => {
            const active = isSelected(entry.name, selectedLabel);
            return (
              <Cell
                key={entry.name}
                fill={TRAVEL_DELAY_HISTOGRAM_BAR}
                stroke={active ? SELECTED_STROKE : "none"}
                strokeWidth={active ? 2 : 0}
              />
            );
          })}
        </Bar>
        <Line
          type="monotone"
          dataKey={densityKey}
          name="Density Curve"
          stroke={TRAVEL_DELAY_DENSITY_LINE}
          strokeWidth={2.25}
          connectNulls
          dot={false}
          activeDot={{ r: 4, stroke: SELECTED_STROKE, strokeWidth: 2 }}
        />
      </ComposedChart>
    );
  } else if (
    valueKey === "frequency" &&
    items.some((item) => Object.prototype.hasOwnProperty.call(item, "breakdown_count"))
  ) {
    chartNode = (
      <BarChart data={rows} margin={{ top: 28, right: 16, left: 12, bottom: 56 }} barCategoryGap="12%">
        <CartesianGrid stroke={GRID_STROKE} />
        <XAxis
          {...xAxisProps}
          label={{
            value: xAxisLabel || "Number of Breakdowns",
            position: "insideBottom",
            offset: -52,
            style: { fontSize: 10, fill: "#64748b" },
          }}
        />
        <YAxis
          {...yAxisProps}
          allowDecimals={false}
          tickFormatter={(v: number) => formatNumber(v, { maximumFractionDigits: 0 })}
          label={{
            value: yAxisLabel || "Frequency",
            angle: -90,
            position: "insideLeft",
            style: { fontSize: 10, fill: "#64748b" },
          }}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const row = payload[0]?.payload as ChartRow | undefined;
            const breakdownCount = row?.name ?? "—";
            return (
              <div className="recharts-analytics-tooltip recharts-analytics-tooltip--line">
                <p className="recharts-analytics-tooltip__row recharts-analytics-tooltip__row--plain">
                  breakdown_count={breakdownCount}
                </p>
                <p className="recharts-analytics-tooltip__row recharts-analytics-tooltip__row--plain">
                  frequency={formatTooltipValue(payload[0]?.value)}
                </p>
              </div>
            );
          }}
        />
        <Bar
          dataKey={valueKey}
          name={legendLabel ?? "Frequency"}
          fill={BREAKDOWN_HISTOGRAM_BAR}
          maxBarSize={72}
          onClick={(_event: unknown, index: number) => handleBarClick(index)}
          style={{ cursor: onItemClick ? "pointer" : "default" }}
        >
          {rows.map((entry) => {
            const active = isSelected(entry.name, selectedLabel);
            return (
              <Cell
                key={entry.name}
                fill={BREAKDOWN_HISTOGRAM_BAR}
                stroke={active ? SELECTED_STROKE : "none"}
                strokeWidth={active ? 2 : 0}
              />
            );
          })}
        </Bar>
      </BarChart>
    );
  } else if (valueKey === "severity_rank" && labelKey === "truck") {
    chartNode = (
      <BarChart data={rows} margin={{ top: 28, right: 16, left: 12, bottom: 56 }} barCategoryGap="28%">
        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
        <XAxis
          {...xAxisProps}
          label={{
            value: xAxisLabel || "Truck",
            position: "insideBottom",
            offset: -52,
            style: { fontSize: 10, fill: "#64748b" },
          }}
        />
        <YAxis
          tick={AXIS_TICK}
          allowDecimals={false}
          domain={[0, 3]}
          ticks={[1, 2, 3]}
          tickFormatter={(v: number) => severityLabelFromRank(Number(v))}
          label={{
            value: yAxisLabel || "Predicted Severity",
            angle: -90,
            position: "insideLeft",
            style: { fontSize: 10, fill: "#64748b" },
          }}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const row = payload[0]?.payload as ChartRow | undefined;
            const severity = String(row?.predicted_severity ?? severityLabelFromRank(Number(payload[0]?.value ?? 0)));
            return (
              <div className="recharts-analytics-tooltip recharts-analytics-tooltip--line">
                <p className="recharts-analytics-tooltip__label">{String(row?.name ?? "—")}</p>
                <p className="recharts-analytics-tooltip__row recharts-analytics-tooltip__row--plain">
                  Predicted severity: {severity}
                </p>
                {row?.risk_score != null ? (
                  <p className="recharts-analytics-tooltip__row recharts-analytics-tooltip__row--plain">
                    Risk score: {Number(row.risk_score).toFixed(3)}
                  </p>
                ) : null}
              </div>
            );
          }}
        />
        <Bar
          dataKey={valueKey}
          name="Predicted Severity"
          maxBarSize={72}
          onClick={(_event: unknown, index: number) => handleBarClick(index)}
          style={{ cursor: onItemClick ? "pointer" : "default" }}
        >
          {rows.map((entry) => {
            const severity = String(entry.predicted_severity ?? severityLabelFromRank(Number(entry.severity_rank ?? 0)));
            const active = isSelected(entry.name, selectedLabel);
            return (
              <Cell
                key={entry.name}
                fill={MAINTENANCE_SEVERITY_COLORS[severity] ?? ENTERPRISE_GREEN}
                stroke={active ? SELECTED_STROKE : "none"}
                strokeWidth={active ? 2 : 0}
              />
            );
          })}
        </Bar>
      </BarChart>
    );
  } else if (valueKey === "trip_count" && labelKey === "trip_status" && kind === "bar") {
    chartNode = (
      <BarChart data={rows} margin={{ top: 28, right: 16, left: 12, bottom: 72 }} barCategoryGap="28%">
        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
        <XAxis
          {...xAxisProps}
          interval={0}
          label={{
            value: xAxisLabel || "Trip Status",
            position: "insideBottom",
            offset: -52,
            style: { fontSize: 10, fill: "#64748b" },
          }}
        />
        <YAxis
          {...yAxisProps}
          allowDecimals={false}
          domain={[0, (dataMax: number) => Math.max(4, Math.ceil(dataMax * 1.15))]}
          label={{
            value: yAxisLabel || "Number of Trips",
            angle: -90,
            position: "insideLeft",
            style: { fontSize: 10, fill: "#64748b" },
          }}
        />
        <Tooltip content={<ChartTooltip />} />
        <Bar
          dataKey={valueKey}
          name={legendLabel ?? "Trips"}
          maxBarSize={56}
          onClick={(_event: unknown, index: number) => handleBarClick(index)}
          style={{ cursor: onItemClick ? "pointer" : "default" }}
        >
          {rows.map((entry, i) => {
            const fill = BAR_COLORS[i % BAR_COLORS.length];
            const active = isSelected(entry.name, selectedLabel);
            return (
              <Cell
                key={entry.name}
                fill={fill}
                stroke={active ? SELECTED_STROKE : "none"}
                strokeWidth={active ? 2 : 0}
              />
            );
          })}
        </Bar>
      </BarChart>
    );
  } else {
    chartNode = (
      <BarChart data={rows} margin={commonMargin} barCategoryGap="28%">
        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
        <XAxis {...xAxisProps} />
        <YAxis {...yAxisProps} />
        <Tooltip content={<ChartTooltip />} />
        {showLegend ? <Legend formatter={renderLegendText} verticalAlign="top" /> : null}
        <Bar
          dataKey={valueKey}
          name={legendLabel ?? seriesLabel(valueKey)}
          onClick={(_event: unknown, index: number) => handleBarClick(index)}
          style={{ cursor: onItemClick ? "pointer" : "default" }}
        >
          {rows.map((entry, i) => {
            const multi = items.length <= 8;
            const fill = multi ? BAR_COLORS[i % BAR_COLORS.length] : ENTERPRISE_GREEN;
            const active = isSelected(entry.name, selectedLabel);
            return (
              <Cell
                key={entry.name}
                fill={fill}
                stroke={active ? SELECTED_STROKE : "none"}
                strokeWidth={active ? 2 : 0}
              />
            );
          })}
        </Bar>
      </BarChart>
    );
  }

  return (
    <div
      className={`recharts-analytics-chart${
        kind === "horizontalBar"
          ? " recharts-analytics-chart--horizontal"
          : kind === "groupedBar"
            ? " recharts-analytics-chart--grouped"
            : kind === "pareto"
              ? " recharts-analytics-chart--pareto"
              : valueKey === "total_breakdowns" &&
                  items.some((item) => Object.prototype.hasOwnProperty.call(item, "vehicle_id"))
                ? " recharts-analytics-chart--breakdown-vehicle"
                : valueKey === "total_operational_cost_php"
              ? " recharts-analytics-chart--operational-cost"
              : valueKey === "frequency" &&
                  items.some((item) => Object.prototype.hasOwnProperty.call(item, "breakdown_count"))
                ? " recharts-analytics-chart--breakdown-histogram"
                : valueKey === "trip_count" &&
                    items.some((item) => Object.prototype.hasOwnProperty.call(item, "density_curve"))
                  ? " recharts-analytics-chart--travel-delay-histogram"
                  : ""
      }`}
      style={
        chartHeight
          ? { minHeight: chartHeight, height: chartHeight, aspectRatio: "unset" }
          : valueKey === "total_operational_cost_php" || (valueKey === "amount_php" && kind === "horizontalBar")
            ? { minHeight: 320, height: 320, aspectRatio: "unset" }
            : undefined
      }
      role="img"
      aria-label={`${kind} analytics chart`}
    >
      <ResponsiveContainer width="100%" height="100%">
        {chartNode}
      </ResponsiveContainer>
    </div>
  );
}

export const RechartsAnalyticsChart = memo(RechartsAnalyticsChartInner);
