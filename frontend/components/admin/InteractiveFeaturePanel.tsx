"use client";

import { BiChartWidget } from "@/components/admin/BiChartWidget";
import type { AdminAnalyticsPayload, RoleAnalyticsFeatureBlock } from "@/lib/analyticsApi";

export function InteractiveFeaturePanel({
  title,
  block,
  filterOptions,
}: {
  title: string;
  block: RoleAnalyticsFeatureBlock;
  filterOptions?: AdminAnalyticsPayload["filter_options"];
}) {
  return <BiChartWidget title={title} block={block} filterOptions={filterOptions} />;
}
