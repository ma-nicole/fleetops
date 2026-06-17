"use client";

import createPlotlyComponent from "react-plotly.js/factory";
import Plotly from "plotly.js-dist-min";
import { useCallback, useMemo } from "react";
import type { Config, Data, PlotDatum, PlotMouseEvent } from "plotly.js";
import type { ChartClickPayload } from "@/components/admin/AnalyticsCharts";
import type { PlotlyChartKind } from "@/components/admin/PlotlyAnalyticsChart";

const Plot = createPlotlyComponent(Plotly);

const BAR_COLORS = ["#2D6A4F", "#E76F51", "#277DA1", "#40916C", "#F4A261", "#52B788", "#1B4332", "#6366F1"];
const ENTERPRISE_GREEN = "#2D6A4F";
const ENTERPRISE_LINE = "#277DA1";

function isSelected(label: string, selectedLabel?: string | null): boolean {
  if (!selectedLabel) return false;
  return label.trim().toLowerCase() === selectedLabel.trim().toLowerCase();
}

function barColors(items: Array<Record<string, string | number>>, labelKey: string, selectedLabel?: string | null) {
  const multi = items.length <= 8;
  return items.map((item, i) => {
    const label = String(item[labelKey] ?? "");
    const base = multi ? BAR_COLORS[i % BAR_COLORS.length] : ENTERPRISE_GREEN;
    if (!isSelected(label, selectedLabel)) return base;
    return base;
  });
}

function barOutline(items: Array<Record<string, string | number>>, labelKey: string, selectedLabel?: string | null) {
  return items.map((item) => {
    const label = String(item[labelKey] ?? "");
    return isSelected(label, selectedLabel) ? { color: "#1B4332", width: 2 } : { width: 0 };
  });
}

export default function PlotlyAnalyticsChartInner({
  kind,
  items,
  labelKey,
  valueKey,
  yAxisLabel,
  legendLabel,
  onItemClick,
  selectedLabel,
}: {
  kind: PlotlyChartKind;
  items: Array<Record<string, string | number>>;
  labelKey: string;
  valueKey: string;
  yAxisLabel?: string;
  legendLabel?: string;
  onItemClick?: (payload: ChartClickPayload) => void;
  selectedLabel?: string | null;
}) {
  const labels = useMemo(() => items.map((item) => String(item[labelKey] ?? "")), [items, labelKey]);
  const values = useMemo(() => items.map((item) => Number(item[valueKey]) || 0), [items, valueKey]);

  const data = useMemo(() => {
    if (kind === "pie") {
      return [
        {
          type: "pie" as const,
          labels,
          values,
          marker: {
            colors: BAR_COLORS.slice(0, items.length),
            line: { color: "#fff", width: 1 },
          },
          textinfo: "percent" as const,
          textposition: "inside" as const,
          hovertemplate: "%{label}<br>%{value:,}<extra></extra>",
          name: legendLabel ?? valueKey.replace(/_/g, " "),
        },
      ];
    }

    if (kind === "line") {
      return [
        {
          type: "scatter" as const,
          mode: "lines+markers" as const,
          x: labels,
          y: values,
          name: legendLabel ?? valueKey.replace(/_/g, " "),
          line: { color: ENTERPRISE_LINE, width: 2.5 },
          marker: {
            color: labels.map((label) => (isSelected(label, selectedLabel) ? "#1B4332" : ENTERPRISE_LINE)),
            size: labels.map((label) => (isSelected(label, selectedLabel) ? 10 : 7)),
            line: { color: "#fff", width: 1 },
          },
          hovertemplate: "%{x}<br>%{y:,}<extra></extra>",
        },
      ];
    }

    return [
      {
        type: "bar" as const,
        x: labels,
        y: values,
        name: legendLabel ?? valueKey.replace(/_/g, " "),
        marker: {
          color: barColors(items, labelKey, selectedLabel),
          line: barOutline(items, labelKey, selectedLabel),
        },
        hovertemplate: "%{x}<br>%{y:,}<extra></extra>",
      },
    ];
  }, [items, kind, labelKey, labels, legendLabel, selectedLabel, valueKey, values]);

  const layout = useMemo(
    () => ({
      autosize: true,
      height: 240,
      margin: kind === "pie" ? { t: 24, r: 16, b: 16, l: 16 } : { t: 36, r: 12, b: 88, l: 58 },
      paper_bgcolor: "transparent",
      plot_bgcolor: "#f8faf9",
      font: { family: "inherit", size: 11, color: "#4b5563" },
      showlegend: kind === "pie" ? false : Boolean(legendLabel),
      legend: {
        orientation: "h" as const,
        y: 1.12,
        x: 0.5,
        xanchor: "center" as const,
        font: { size: 10 },
      },
      xaxis:
        kind === "pie"
          ? undefined
          : {
              tickangle: -35,
              automargin: true,
              gridcolor: "#e2e8f0",
              linecolor: "#cbd5e1",
              tickfont: { size: 10 },
              title: { text: "", standoff: 8 },
            },
      yaxis:
        kind === "pie"
          ? undefined
          : {
              title: yAxisLabel ? { text: yAxisLabel, font: { size: 10 } } : undefined,
              gridcolor: "#e2e8f0",
              linecolor: "#cbd5e1",
              zeroline: true,
              zerolinecolor: "#e2e8f0",
              tickfont: { size: 10 },
            },
      bargap: kind === "bar" ? 0.28 : undefined,
    }),
    [kind, legendLabel, yAxisLabel],
  );

  const config = useMemo(
    () => ({
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      scrollZoom: false,
      modeBarButtonsToRemove: ["lasso2d", "select2d", "autoScale2d"],
    }),
    [],
  );

  const handleClick = useCallback(
    (event: Readonly<PlotMouseEvent>) => {
      if (!onItemClick || !event.points?.length) return;
      const point = event.points[0];
      const idx = point.pointNumber ?? 0;
      const item = items[idx];
      if (!item) return;
      const plotPoint = point as PlotDatum & { label?: string | number };
      const label = String(item[labelKey] ?? plotPoint.label ?? plotPoint.x ?? "");
      onItemClick({ label, raw: item as Record<string, string | number> });
    },
    [items, labelKey, onItemClick],
  );

  if (!items.length) return null;

  return (
    <div className="plotly-analytics-chart">
      <Plot
        data={data as Data[]}
        layout={layout}
        config={config as Partial<Config>}
        style={{ width: "100%", height: "100%" }}
        useResizeHandler
        onClick={handleClick}
      />
    </div>
  );
}
