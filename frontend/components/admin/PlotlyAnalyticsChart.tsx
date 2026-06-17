"use client";

import dynamic from "next/dynamic";
import type { ChartClickPayload } from "@/components/admin/AnalyticsCharts";

export type PlotlyChartKind = "bar" | "line" | "pie";

const PlotlyAnalyticsChartInner = dynamic(() => import("@/components/admin/PlotlyAnalyticsChartInner"), {
  ssr: false,
  loading: () => <div className="plotly-analytics-chart plotly-analytics-chart--loading">Loading chart…</div>,
});

export function PlotlyAnalyticsChart(props: {
  kind: PlotlyChartKind;
  items: Array<Record<string, string | number>>;
  labelKey: string;
  valueKey: string;
  yAxisLabel?: string;
  legendLabel?: string;
  onItemClick?: (payload: ChartClickPayload) => void;
  selectedLabel?: string | null;
}) {
  return <PlotlyAnalyticsChartInner {...props} />;
}
