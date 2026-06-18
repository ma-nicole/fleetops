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
  analyticsType: "Descriptive" | "Diagnostic" | "Predictive" | "Prescriptive";
  analyticsMethod: string;
  preferredChartKind?: "bar" | "line" | "pie";
};

function flattenCategory(
  data: Record<string, RoleAnalyticsPillar>,
  category: AnalyticsCategoryTab,
  featureLabels: Record<string, Record<string, string>>,
): WidgetDef[] {
  const out: WidgetDef[] = [];
  const inferType = (
    source: "descriptive" | "predictive",
    featureKey: string,
  ): "Descriptive" | "Diagnostic" | "Predictive" | "Prescriptive" => {
    const key = featureKey.toLowerCase();
    if (source === "predictive") {
      if (key.includes("optimal") || key.includes("allocation") || key.includes("recommend")) return "Prescriptive";
      return "Predictive";
    }
    if (
      key.includes("risk") ||
      key.includes("variance") ||
      key.includes("overrun") ||
      key.includes("fluctuation") ||
      key.includes("issue") ||
      key.includes("breakdown")
    ) {
      return "Diagnostic";
    }
    return "Descriptive";
  };
  const inferMethod = (featureKey: string, analyticsType: WidgetDef["analyticsType"]): string => {
    const key = featureKey.toLowerCase();
    if (analyticsType === "Predictive") return "Time-series / predictive modeling";
    if (analyticsType === "Prescriptive") return "Optimization / recommendation modeling";
    if (key.includes("trend") || key.includes("history")) return "Trend and historical analysis";
    if (key.includes("distribution")) return "Distribution analysis";
    if (key.includes("ranking")) return "Ranking analysis";
    if (key.includes("risk")) return "Risk pattern analysis";
    return "Comparative aggregation";
  };
  const inferPreferredChartKind = (featureKey: string): WidgetDef["preferredChartKind"] => {
    const key = featureKey.toLowerCase();
    if (
      key.includes("trend") ||
      key.includes("history") ||
      key.includes("forecast") ||
      key.includes("over_time") ||
      key.includes("monthly") ||
      key.includes("timeline")
    ) {
      return "line";
    }
    if (key.includes("distribution") || key.includes("share") || key.includes("composition") || key.includes("status")) {
      return "pie";
    }
    return "bar";
  };
  for (const inc of category.include) {
    const pillar = data[inc.pillar];
    if (!pillar) continue;
    const labels = featureLabels[inc.pillar] ?? {};
    const addBlock = (type: "descriptive" | "predictive", key: string, block: RoleAnalyticsFeatureBlock) => {
      if (inc.features && !inc.features.includes(key)) return;
      const analyticsType = inferType(type, key);
      out.push({
        id: `${inc.pillar}-${type}-${key}`,
        title: labels[key] ?? key,
        block,
        analyticsType,
        analyticsMethod: inferMethod(key, analyticsType),
        preferredChartKind: inferPreferredChartKind(key),
      });
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
  const inferType = (
    source: "descriptive" | "predictive",
    featureKey: string,
  ): "Descriptive" | "Diagnostic" | "Predictive" | "Prescriptive" => {
    const key = featureKey.toLowerCase();
    if (source === "predictive") {
      if (key.includes("optimal") || key.includes("allocation") || key.includes("recommend")) return "Prescriptive";
      return "Predictive";
    }
    if (
      key.includes("risk") ||
      key.includes("variance") ||
      key.includes("overrun") ||
      key.includes("fluctuation") ||
      key.includes("issue") ||
      key.includes("breakdown")
    ) {
      return "Diagnostic";
    }
    return "Descriptive";
  };
  const inferMethod = (featureKey: string, analyticsType: WidgetDef["analyticsType"]): string => {
    const key = featureKey.toLowerCase();
    if (analyticsType === "Predictive") return "Time-series / predictive modeling";
    if (analyticsType === "Prescriptive") return "Optimization / recommendation modeling";
    if (key.includes("trend") || key.includes("history")) return "Trend and historical analysis";
    if (key.includes("distribution")) return "Distribution analysis";
    if (key.includes("ranking")) return "Ranking analysis";
    if (key.includes("risk")) return "Risk pattern analysis";
    return "Comparative aggregation";
  };
  const inferPreferredChartKind = (featureKey: string): WidgetDef["preferredChartKind"] => {
    const key = featureKey.toLowerCase();
    if (
      key.includes("trend") ||
      key.includes("history") ||
      key.includes("forecast") ||
      key.includes("over_time") ||
      key.includes("monthly") ||
      key.includes("timeline")
    ) {
      return "line";
    }
    if (key.includes("distribution") || key.includes("share") || key.includes("composition") || key.includes("status")) {
      return "pie";
    }
    return "bar";
  };
  for (const [key, block] of Object.entries(pillar.descriptive)) {
    const analyticsType = inferType("descriptive", key);
    out.push({
      id: `${pillarKey}-desc-${key}`,
      title: labels[key] ?? key,
      block,
      analyticsType,
      analyticsMethod: inferMethod(key, analyticsType),
      preferredChartKind: inferPreferredChartKind(key),
    });
  }
  for (const [key, block] of Object.entries(pillar.predictive)) {
    const analyticsType = inferType("predictive", key);
    out.push({
      id: `${pillarKey}-pred-${key}`,
      title: labels[key] ?? key,
      block,
      analyticsType,
      analyticsMethod: inferMethod(key, analyticsType),
      preferredChartKind: inferPreferredChartKind(key),
    });
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

  const groupedWidgets = useMemo(() => {
    const buckets: Record<WidgetDef["analyticsType"], WidgetDef[]> = {
      Descriptive: [],
      Diagnostic: [],
      Predictive: [],
      Prescriptive: [],
    };
    for (const w of widgets) buckets[w.analyticsType].push(w);
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
              ["Diagnostic", "Diagnostic Analytics"],
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
                      block={w.block}
                      filterOptions={filterOptions}
                      analyticsType={w.analyticsType}
                      analyticsMethod={w.analyticsMethod}
                      preferredChartKind={w.preferredChartKind}
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
