"use client";

import { useMemo, useState } from "react";
import { BiChartWidget } from "@/components/admin/BiChartWidget";
import { EmptyChart } from "@/components/admin/AnalyticsCharts";
import type { AdminAnalyticsPayload, RoleAnalyticsFeatureBlock, RoleAnalyticsPillar } from "@/lib/analyticsApi";
import {
  inferAnalyticsMethod,
  inferAnalyticsType,
  inferPreferredChartKind,
  type AnalyticsChartKind,
} from "@/lib/analyticsChartConfig";

export type CategoryInclude = {
  pillar: string;
  features?: string[];
};

export type AnalyticsCategoryTab = {
  id: string;
  label: string;
  include: CategoryInclude[];
};

type WidgetDef = {
  id: string;
  title: string;
  featureKey: string;
  block: RoleAnalyticsFeatureBlock;
  analyticsType: "Descriptive" | "Diagnostic" | "Predictive" | "Prescriptive";
  analyticsMethod: string;
  preferredChartKind?: AnalyticsChartKind;
};

function buildWidget(
  id: string,
  title: string,
  source: "descriptive" | "predictive",
  featureKey: string,
  block: RoleAnalyticsFeatureBlock,
  resolvePreferredChartKind?: (featureKey: string) => AnalyticsChartKind | undefined,
): WidgetDef {
  const analyticsType = inferAnalyticsType(source, featureKey);
  return {
    id,
    title,
    featureKey,
    block,
    analyticsType,
    analyticsMethod: inferAnalyticsMethod(featureKey, analyticsType),
    preferredChartKind:
      resolvePreferredChartKind?.(featureKey) ?? inferPreferredChartKind(featureKey),
  };
}

function flattenCategory(
  data: Record<string, RoleAnalyticsPillar>,
  category: AnalyticsCategoryTab,
  featureLabels: Record<string, Record<string, string>>,
  resolvePreferredChartKind?: (featureKey: string) => AnalyticsChartKind | undefined,
): WidgetDef[] {
  const out: WidgetDef[] = [];
  for (const inc of category.include) {
    const pillar = data[inc.pillar];
    if (!pillar) continue;
    const labels = featureLabels[inc.pillar] ?? {};
    const addBlock = (type: "descriptive" | "predictive", key: string, block: RoleAnalyticsFeatureBlock) => {
      if (inc.features && !inc.features.includes(key)) return;
      out.push(
        buildWidget(`${inc.pillar}-${type}-${key}`, labels[key] ?? key, type, key, block, resolvePreferredChartKind),
      );
    };
    for (const [key, block] of Object.entries(pillar.descriptive)) {
      addBlock("descriptive", key, block);
    }
    for (const [key, block] of Object.entries(pillar.predictive)) {
      addBlock("predictive", key, block);
    }
  }
  return out;
}

function flattenPillar(
  pillarKey: string,
  pillar: RoleAnalyticsPillar,
  labels: Record<string, string>,
  resolvePreferredChartKind?: (featureKey: string) => AnalyticsChartKind | undefined,
): WidgetDef[] {
  const out: WidgetDef[] = [];
  for (const [key, block] of Object.entries(pillar.descriptive)) {
    out.push(buildWidget(`${pillarKey}-desc-${key}`, labels[key] ?? key, "descriptive", key, block, resolvePreferredChartKind));
  }
  for (const [key, block] of Object.entries(pillar.predictive)) {
    out.push(buildWidget(`${pillarKey}-pred-${key}`, labels[key] ?? key, "predictive", key, block, resolvePreferredChartKind));
  }
  return out;
}

export function RoleAnalyticsGrid({
  categoryTabs,
  pillarTabs,
  featureLabels,
  data,
  filterOptions,
  dashboardTitle,
  onPeriodDrillDown,
  resolvePreferredChartKind,
  resolveChartUnit,
  resolveFeatureChartMeta,
  normalizeFeatureChart,
  resolveFeatureNote,
}: {
  categoryTabs?: AnalyticsCategoryTab[];
  pillarTabs?: { id: string; label: string }[];
  featureLabels: Record<string, Record<string, string>>;
  data: Record<string, RoleAnalyticsPillar>;
  filterOptions?: AdminAnalyticsPayload["filter_options"];
  dashboardTitle: string;
  onPeriodDrillDown?: (next: { dateFrom: string; dateTo: string }) => void;
  resolvePreferredChartKind?: (featureKey: string) => AnalyticsChartKind | undefined;
  resolveChartUnit?: (featureKey: string) => string | undefined;
  resolveFeatureChartMeta?: (
    featureKey: string,
    chart: Record<string, unknown>[],
  ) => import("@/lib/chartDrilldownUtils").InferredChartMeta | null;
  normalizeFeatureChart?: (
    featureKey: string,
    chart: Record<string, unknown>[],
    drilldown: Record<string, unknown>[],
  ) => Record<string, unknown>[];
  resolveFeatureNote?: (featureKey: string, blockNote?: string | null) => string | undefined;
}) {
  const tabs = categoryTabs ?? pillarTabs ?? [];
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? "");

  const widgets = useMemo(() => {
    if (categoryTabs) {
      const category = categoryTabs.find((t) => t.id === activeTab);
      if (!category) return [];
      return flattenCategory(data, category, featureLabels, resolvePreferredChartKind);
    }
    const pillarData = data[activeTab];
    if (!pillarData) return [];
    const labels = featureLabels[activeTab] ?? {};
    return flattenPillar(activeTab, pillarData, labels, resolvePreferredChartKind);
  }, [activeTab, categoryTabs, data, featureLabels, resolvePreferredChartKind]);

  const groupedWidgets = useMemo(() => {
    const buckets: Record<Exclude<WidgetDef["analyticsType"], "Diagnostic">, WidgetDef[]> = {
      Descriptive: [],
      Predictive: [],
      Prescriptive: [],
    };
    for (const w of widgets) {
      const bucket = w.analyticsType === "Diagnostic" ? "Descriptive" : w.analyticsType;
      buckets[bucket].push(w);
    }
    return buckets;
  }, [widgets]);

  return (
    <section className="bi-dashboard" id={`${activeTab}-role-analytics`}>
      <header className="bi-dashboard__head">
        <div>
          <h2 className="bi-dashboard__title">{dashboardTitle}</h2>
          <p className="bi-dashboard__subtitle">Executive BI dashboard — click charts to drill down into source records.</p>
        </div>
        <div className="tab-pills bi-category-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`tab-pill${activeTab === tab.id ? " tab-pill--active" : ""}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {widgets.length ? (
        <div className="analytics-structure">
          {(
            [
              ["Descriptive", "Descriptive Analytics"],
              ["Predictive", "Predictive Analytics"],
              ["Prescriptive", "Prescriptive Analytics"],
            ] as const
          ).map(([key, title]) => (
            <section key={key} className="analytics-structure__section">
              <h3 className="analytics-structure__section-title">{title}</h3>
              {groupedWidgets[key].length ? (
                <div className="bi-chart-grid">
                  {groupedWidgets[key].map((w) => (
                    <BiChartWidget
                      key={w.id}
                      widgetId={w.id}
                      title={w.title}
                      featureKey={w.featureKey}
                      block={w.block}
                      filterOptions={filterOptions}
                      analyticsType={w.analyticsType}
                      analyticsMethod={w.analyticsMethod}
                      preferredChartKind={w.preferredChartKind}
                      valueUnit={resolveChartUnit?.(w.featureKey)}
                      resolveFeatureChartMeta={resolveFeatureChartMeta}
                      normalizeFeatureChart={normalizeFeatureChart}
                      resolveFeatureNote={resolveFeatureNote}
                      onPeriodDrillDown={onPeriodDrillDown}
                    />
                  ))}
                </div>
              ) : (
                <EmptyChart message={`No ${title.toLowerCase()} data for this category yet.`} />
              )}
            </section>
          ))}
        </div>
      ) : (
        <EmptyChart message="No data available yet." />
      )}
    </section>
  );
}
