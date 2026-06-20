"use client";

import { memo, useCallback, useMemo, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyChart, type ChartClickPayload } from "@/components/admin/AnalyticsCharts";
import { SkeletonChart } from "@/components/Skeleton";

export type AnalyticsChartKind = "bar" | "line" | "pie" | "area" | "stackedBar" | "combo";

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

const AXIS_TICK = { fontSize: 10, fill: "#64748b" };
const GRID_STROKE = "#e2e8f0";

type ChartRow = Record<string, string | number> & { name: string };

function isSelected(label: string, selectedLabel?: string | null): boolean {
  if (!selectedLabel) return false;
  return String(label ?? "").trim().toLowerCase() === String(selectedLabel ?? "").trim().toLowerCase();
}

function formatTooltipValue(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? "");
  return n.toLocaleString();
}

function seriesLabel(key: string): string {
  return key.replace(/_/g, " ");
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
      [valueKey]: Number(item[valueKey]) || 0,
    };
    for (const key of seriesKeys ?? []) {
      row[key] = Number(item[key]) || 0;
    }
    if (secondarySeriesKey) {
      row[secondarySeriesKey] = Number(item[secondarySeriesKey]) || 0;
    }
    return row;
  });
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="recharts-analytics-tooltip">
      {label ? <p className="recharts-analytics-tooltip__label">{label}</p> : null}
      {payload.map((entry) => (
        <p key={String(entry.name)} className="recharts-analytics-tooltip__row">
          <span className="recharts-analytics-tooltip__swatch" style={{ backgroundColor: entry.color }} />
          <span>{entry.name}: {formatTooltipValue(entry.value)}</span>
        </p>
      ))}
    </div>
  );
}

function PieTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; payload?: ChartRow }>;
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div className="recharts-analytics-tooltip">
      <p className="recharts-analytics-tooltip__label">{entry.name}</p>
      <p className="recharts-analytics-tooltip__row">{formatTooltipValue(entry.value)}</p>
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
  const rows = useMemo(
    () => buildChartRows(items, labelKey, valueKey, seriesKeys, secondarySeriesKey),
    [items, labelKey, valueKey, seriesKeys, secondarySeriesKey],
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
  const showLegend = Boolean(legendLabel) || kind === "stackedBar" || kind === "area" || kind === "combo";

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

  const xAxisProps = {
    dataKey: "name" as const,
    tick: AXIS_TICK,
    angle: -35,
    textAnchor: "end" as const,
    height: 72,
    interval: 0,
    label: xAxisLabel
      ? { value: xAxisLabel, position: "insideBottom" as const, offset: -48, style: { fontSize: 10, fill: "#64748b" } }
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
    chartNode = (
      <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <Pie
          data={rows}
          dataKey={valueKey}
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius="28%"
          outerRadius="72%"
          paddingAngle={1}
          label={({ percent }: { percent: number }) => `${(percent * 100).toFixed(0)}%`}
          labelLine={false}
          onClick={handlePieClick}
          style={{ cursor: onItemClick ? "pointer" : "default" }}
        >
          {rows.map((entry, i) => (
            <Cell
              key={entry.name}
              fill={BAR_COLORS[i % BAR_COLORS.length]}
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
    chartNode = (
      <LineChart data={rows} margin={commonMargin}>
        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
        <XAxis {...xAxisProps} />
        <YAxis {...yAxisProps} />
        <Tooltip content={<ChartTooltip />} />
        {showLegend || lineKeys.length > 1 ? <Legend formatter={renderLegendText} verticalAlign="top" /> : null}
        {lineKeys.map((key, idx) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            name={legendLabel && lineKeys.length === 1 ? legendLabel : seriesLabel(key)}
            stroke={idx === 0 ? ENTERPRISE_LINE : "#E76F51"}
            strokeWidth={2.5}
            strokeDasharray={key.startsWith("forecast_") ? "6 4" : undefined}
            connectNulls
            dot={(props: { cx?: number; cy?: number; index?: number }) => {
              const { cx, cy, index = 0 } = props;
              const name = rows[index]?.name ?? "";
              const active = isSelected(name, selectedLabel);
              const stroke = idx === 0 ? ENTERPRISE_LINE : "#E76F51";
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
            }}
            activeDot={{ r: 6, stroke: SELECTED_STROKE, strokeWidth: 2 }}
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
  } else if (kind === "stackedBar") {
    const keys = (seriesKeys?.length ? seriesKeys : [valueKey]).slice(0, 4);
    chartNode = (
      <BarChart data={rows} margin={commonMargin}>
        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
        <XAxis {...xAxisProps} />
        <YAxis {...yAxisProps} />
        <Tooltip content={<ChartTooltip />} />
        <Legend formatter={renderLegendText} verticalAlign="top" />
        {keys.map((key, idx) => (
          <Bar
            key={key}
            dataKey={key}
            name={seriesLabel(key)}
            stackId="stack"
            fill={BAR_COLORS[idx % BAR_COLORS.length]}
            onClick={(_event: unknown, index: number) => handleBarClick(index)}
            style={{ cursor: onItemClick ? "pointer" : "default" }}
          />
        ))}
      </BarChart>
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
        <Tooltip content={<ChartTooltip />} />
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
    <div className="recharts-analytics-chart" role="img" aria-label={`${kind} analytics chart`}>
      <ResponsiveContainer width="100%" height="100%">
        {chartNode}
      </ResponsiveContainer>
    </div>
  );
}

export const RechartsAnalyticsChart = memo(RechartsAnalyticsChartInner);
