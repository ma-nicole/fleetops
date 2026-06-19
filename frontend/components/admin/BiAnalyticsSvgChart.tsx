"use client";

import {
  BarChartPhp,
  LineChartVisual,
  PieChartVisual,
  type ChartClickPayload,
} from "@/components/admin/AnalyticsCharts";
import { MentorBarChart } from "@/components/admin/MentorBarChart";
import type { PlotlyChartKind } from "@/components/admin/PlotlyAnalyticsChart";

function isCurrencyField(key: string): boolean {
  return /php|revenue|expense|profit|amount|cost|toll|fuel|total/i.test(key);
}

/** Lightweight SVG charts — no Plotly bundle; reliable on Vercel production. */
export function BiAnalyticsSvgChart({
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
  const rows = items.slice(0, 24);
  if (!rows.length) return null;

  if (kind === "pie") {
    return (
      <PieChartVisual
        items={rows}
        labelKey={labelKey}
        valueKey={valueKey}
        onItemClick={onItemClick}
        selectedLabel={selectedLabel}
      />
    );
  }

  if (kind === "line") {
    return (
      <LineChartVisual
        items={rows}
        xKey={labelKey}
        yKey={valueKey}
        onItemClick={onItemClick}
        selectedLabel={selectedLabel}
      />
    );
  }

  if (kind === "bar" && rows.length <= 6 && isCurrencyField(valueKey)) {
    return (
      <BarChartPhp
        items={rows}
        labelKey={labelKey}
        valueKey={valueKey}
        onItemClick={onItemClick}
        selectedLabel={selectedLabel}
      />
    );
  }

  return (
    <MentorBarChart
      items={rows}
      labelKey={labelKey}
      valueKey={valueKey}
      yAxisLabel={yAxisLabel}
      legendLabel={legendLabel}
      onItemClick={onItemClick}
      selectedLabel={selectedLabel}
      isCurrency={isCurrencyField(valueKey)}
    />
  );
}
