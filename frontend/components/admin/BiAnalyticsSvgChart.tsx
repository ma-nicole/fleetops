"use client";

import { RechartsAnalyticsChart, type AnalyticsChartKind } from "@/components/admin/RechartsAnalyticsChart";
import type { ChartClickPayload } from "@/components/admin/AnalyticsCharts";

/** Recharts-based analytics chart — SSR-safe and reliable on Vercel production. */
export function BiAnalyticsSvgChart({
  kind,
  items,
  labelKey,
  valueKey,
  yAxisLabel,
  legendLabel,
  onItemClick,
  selectedLabel,
  loading,
}: {
  kind: AnalyticsChartKind;
  items: Array<Record<string, string | number>>;
  labelKey: string;
  valueKey: string;
  yAxisLabel?: string;
  legendLabel?: string;
  onItemClick?: (payload: ChartClickPayload) => void;
  selectedLabel?: string | null;
  loading?: boolean;
}) {
  return (
    <RechartsAnalyticsChart
      kind={kind}
      items={items.slice(0, 24)}
      labelKey={labelKey}
      valueKey={valueKey}
      yAxisLabel={yAxisLabel}
      legendLabel={legendLabel ?? labelKey.replace(/_/g, " ")}
      onItemClick={onItemClick}
      selectedLabel={selectedLabel}
      loading={loading}
    />
  );
}
