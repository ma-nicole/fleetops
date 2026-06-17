"use client";

import { useMemo, useState } from "react";
import { BiChartWidget } from "@/components/admin/BiChartWidget";
import { EmptyChart } from "@/components/admin/AnalyticsCharts";
import type { AdminAnalyticsPayload, RoleAnalyticsFeatureBlock, RoleAnalyticsPillar } from "@/lib/analyticsApi";

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
  block: RoleAnalyticsFeatureBlock;
};

function flattenCategory(
  data: Record<string, RoleAnalyticsPillar>,
  category: AnalyticsCategoryTab,
  featureLabels: Record<string, Record<string, string>>,
): WidgetDef[] {
  const out: WidgetDef[] = [];
  for (const inc of category.include) {
    const pillar = data[inc.pillar];
    if (!pillar) continue;
    const labels = featureLabels[inc.pillar] ?? {};
    const addBlock = (type: "descriptive" | "predictive", key: string, block: RoleAnalyticsFeatureBlock) => {
      if (inc.features && !inc.features.includes(key)) return;
      out.push({ id: `${inc.pillar}-${type}-${key}`, title: labels[key] ?? key, block });
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

function flattenPillar(pillarKey: string, pillar: RoleAnalyticsPillar, labels: Record<string, string>): WidgetDef[] {
  const out: WidgetDef[] = [];
  for (const [key, block] of Object.entries(pillar.descriptive)) {
    out.push({ id: `${pillarKey}-desc-${key}`, title: labels[key] ?? key, block });
  }
  for (const [key, block] of Object.entries(pillar.predictive)) {
    out.push({ id: `${pillarKey}-pred-${key}`, title: labels[key] ?? key, block });
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
}: {
  categoryTabs?: AnalyticsCategoryTab[];
  pillarTabs?: { id: string; label: string }[];
  featureLabels: Record<string, Record<string, string>>;
  data: Record<string, RoleAnalyticsPillar>;
  filterOptions?: AdminAnalyticsPayload["filter_options"];
  dashboardTitle: string;
}) {
  const tabs = categoryTabs ?? pillarTabs ?? [];
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? "");

  const widgets = useMemo(() => {
    if (categoryTabs) {
      const category = categoryTabs.find((t) => t.id === activeTab);
      if (!category) return [];
      return flattenCategory(data, category, featureLabels);
    }
    const pillarData = data[activeTab];
    if (!pillarData) return [];
    const labels = featureLabels[activeTab] ?? {};
    return flattenPillar(activeTab, pillarData, labels);
  }, [activeTab, categoryTabs, data, featureLabels]);

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
        <div className="bi-chart-grid">
          {widgets.map((w) => (
            <BiChartWidget key={w.id} widgetId={w.id} title={w.title} block={w.block} filterOptions={filterOptions} />
          ))}
        </div>
      ) : (
        <EmptyChart message="No data available yet." />
      )}
    </section>
  );
}
