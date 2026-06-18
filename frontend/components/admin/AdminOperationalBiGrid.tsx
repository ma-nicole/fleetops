"use client";

import { useMemo } from "react";
import { BiChartWidget } from "@/components/admin/BiChartWidget";
import { EmptyChart } from "@/components/admin/AnalyticsCharts";
import type { AdminAnalyticsPayload, ComparativeMetric, RoleAnalyticsFeatureBlock, StatisticsSummary } from "@/lib/analyticsApi";
import { isPopulatedAnalyticsModule } from "@/lib/analyticsApi";

type WidgetSpec = {
  id: string;
  title: string;
  block: RoleAnalyticsFeatureBlock;
  comparative?: ComparativeMetric | null;
  analyticsType?: "Descriptive" | "Diagnostic" | "Predictive" | "Prescriptive";
  analyticsMethod?: string;
  riskLegend?: Array<{ label: string; color: string }>;
  preferredChartKind?: "bar" | "line" | "pie";
};

function moduleBlock(
  chart: Record<string, unknown>[],
  drilldown: Record<string, unknown>[],
  statistics?: StatisticsSummary | null,
): RoleAnalyticsFeatureBlock {
  if (!chart.length && !drilldown.length) {
    return { empty: true, message: "No data available yet." };
  }
  return {
    kpis: [],
    chart,
    drilldown,
    statistics: statistics ?? null,
  };
}

type AdminCategory = "revenue" | "operations" | "fleet" | "expenses" | "routes" | "customers";

function buildAdminWidgets(data: AdminAnalyticsPayload, category: AdminCategory): WidgetSpec[] {
  const widgets: WidgetSpec[] = [];
  const comp = data.comparative_analytics;

  const add = (
    id: string,
    title: string,
    block: RoleAnalyticsFeatureBlock,
    comparative?: ComparativeMetric | null,
    options?: Pick<WidgetSpec, "analyticsType" | "analyticsMethod" | "riskLegend" | "preferredChartKind">,
  ) => {
    widgets.push({ id, title, block, comparative, ...options });
  };

  if (category === "revenue" && isPopulatedAnalyticsModule(data.financial)) {
    const fin = data.financial;
    add(
      "revenue-tracking",
      "Revenue Tracking Performance",
      moduleBlock(
        fin.revenue_trend.map((x) => ({ month: x.month, revenue_php: x.revenue_php })),
        fin.drilldown ?? [],
        fin.statistics,
      ),
      comp?.revenue,
      { analyticsType: "Descriptive", analyticsMethod: "Time-series trend aggregation", preferredChartKind: "line" },
    );
    add(
      "revenue-vs-expense",
      "Revenue vs Expense Historical",
      moduleBlock(
        fin.revenue_vs_expense.map((x) => ({
          month: x.month,
          revenue_php: x.revenue_php,
          expense_php: x.expense_php,
        })),
        fin.drilldown ?? [],
      ),
      comp?.expenses,
      { analyticsType: "Diagnostic", analyticsMethod: "Revenue-cost variance analysis", preferredChartKind: "line" },
    );
    add(
      "profit-margin",
      "Profit & Margin Historical",
      moduleBlock(
        fin.profit_trend.map((x) => ({ month: x.month, profit_php: x.profit_php })),
        fin.drilldown ?? [],
      ),
      comp?.revenue,
      { analyticsType: "Diagnostic", analyticsMethod: "Margin trend analysis", preferredChartKind: "line" },
    );
    if (fin.revenue_per_client?.length) {
      add(
        "revenue-by-client-type",
        "Revenue by Customer Type",
        moduleBlock(
          fin.revenue_per_client.map((x) => ({
            client_name: x.client_name,
            revenue_php: x.revenue_php,
          })),
          fin.drilldown ?? [],
        ),
        comp?.revenue,
        { analyticsType: "Descriptive", analyticsMethod: "Category contribution analysis", preferredChartKind: "bar" },
      );
    }
  }

  if (category === "operations") {
    if (isPopulatedAnalyticsModule(data.shipments)) {
      const ship = data.shipments;
      add(
        "shipment-status",
        "Shipment Status Distribution",
        moduleBlock(ship.status_distribution, ship.drilldown, ship.statistics),
        comp?.deliveries,
        {
          analyticsType: "Descriptive",
          analyticsMethod: "Status frequency distribution",
          riskLegend: [
            { label: "Green · Truck Operational", color: "#059669" },
            { label: "Yellow · Needs Monitoring", color: "#D97706" },
            { label: "Orange · Preventive Due", color: "#F97316" },
            { label: "Red · Immediate Required", color: "#DC2626" },
            { label: "Blue · Scheduled", color: "#2563EB" },
            { label: "Gray · Inactive", color: "#6B7280" },
          ],
          preferredChartKind: "pie",
        },
      );
      add(
        "jobs-over-time",
        "Jobs / Trips Over Time",
        moduleBlock(ship.jobs_over_time ?? ship.monthly_deliveries, ship.drilldown, ship.statistics),
        comp?.deliveries,
        { analyticsType: "Descriptive", analyticsMethod: "Time-series throughput analysis", preferredChartKind: "line" },
      );
      add(
        "monthly-deliveries",
        "Monthly Deliveries",
        moduleBlock(ship.monthly_deliveries, ship.drilldown, ship.statistics),
        comp?.deliveries,
        { analyticsType: "Descriptive", analyticsMethod: "Monthly trend aggregation", preferredChartKind: "line" },
      );
    }
    if (isPopulatedAnalyticsModule(data.drivers)) {
      const drivers = data.drivers;
      add(
        "driver-performance",
        "Driver Performance Ranking",
        moduleBlock(
          drivers.ranking.map((x) => ({
            driver_name: String(x.driver_name),
            completed: Number(x.deliveries_completed ?? 0),
          })),
          drivers.drilldown,
          drivers.statistics,
        ),
        undefined,
        { analyticsType: "Descriptive", analyticsMethod: "Ranking analysis", preferredChartKind: "bar" },
      );
      add(
        "driver-distribution",
        "Driver Delivery Distribution",
        moduleBlock(drivers.distribution, drivers.drilldown, drivers.statistics),
        undefined,
        { analyticsType: "Descriptive", analyticsMethod: "Distribution analysis", preferredChartKind: "pie" },
      );
    }
  }

  if (category === "fleet") {
    if (isPopulatedAnalyticsModule(data.fleet)) {
      const fleet = data.fleet;
      add(
        "fleet-utilization",
        "Fleet Utilization by Truck",
        moduleBlock(
          fleet.truck_usage.map((x) => ({
            truck_code: String(x.truck_code ?? x.truck_id),
            trip_count: Number(x.trip_count ?? 0),
          })),
          fleet.drilldown,
          fleet.statistics,
        ),
        undefined,
        { analyticsType: "Descriptive", analyticsMethod: "Utilization ratio by asset", preferredChartKind: "bar" },
      );
    }
    if (isPopulatedAnalyticsModule(data.expenses) && data.expenses.fuel_by_truck?.length) {
      add(
        "fuel-by-truck",
        "Fuel Expense by Truck",
        moduleBlock(
          data.expenses.fuel_by_truck.map((x) => ({ truck_code: x.truck_code, fuel_php: x.fuel_php })),
          data.expenses.drilldown?.records ?? [],
        ),
        undefined,
        { analyticsType: "Diagnostic", analyticsMethod: "Cost concentration by truck", preferredChartKind: "bar" },
      );
    }
  }

  if (category === "expenses" && isPopulatedAnalyticsModule(data.expenses)) {
    const exp = data.expenses;
    add(
      "expense-breakdown",
      "Expense Breakdown by Category",
      moduleBlock(
        exp.expense_breakdown.map((x) => ({ category: x.label, amount_php: x.amount_php })),
        exp.drilldown?.records ?? [],
        exp.statistics,
      ),
      comp?.expenses,
      { analyticsType: "Descriptive", analyticsMethod: "Cost share breakdown", preferredChartKind: "pie" },
    );
    add(
      "expense-monthly",
      "Monthly Operational Expenses",
      moduleBlock(
        exp.monthly_totals.map((x) => ({ month: x.month, total: x.total })),
        exp.drilldown?.records ?? [],
      ),
      comp?.expenses,
      { analyticsType: "Descriptive", analyticsMethod: "Monthly trend aggregation", preferredChartKind: "line" },
    );
  }

  if (category === "routes") {
    if (isPopulatedAnalyticsModule(data.routes)) {
      const routes = data.routes;
      add(
        "route-performance",
        "Route Performance by Deliveries",
        moduleBlock(
          routes.performance.map((x) => ({
            route: String(x.route),
            deliveries: Number(x.deliveries ?? 0),
          })),
          routes.drilldown,
          routes.statistics,
        ),
        undefined,
        { analyticsType: "Descriptive", analyticsMethod: "Route throughput comparison", preferredChartKind: "bar" },
      );
      add(
        "route-cost",
        "Route Cost Comparison",
        moduleBlock(
          routes.cost_comparison.map((x) => ({
            route: String(x.route),
            total_cost_php: Number(x.total_cost_php ?? 0),
          })),
          routes.drilldown,
        ),
        undefined,
        { analyticsType: "Diagnostic", analyticsMethod: "Route cost variance analysis", preferredChartKind: "bar" },
      );
    }
    if (isPopulatedAnalyticsModule(data.toll_analytics)) {
      const tolls = data.toll_analytics;
      add(
        "toll-routes",
        "Most Expensive Toll Routes",
        moduleBlock(
          tolls.most_expensive_routes.map((x) => ({
            route: x.route,
            actual_toll_php: x.actual_toll_php,
          })),
          tolls.drilldown as unknown as Record<string, unknown>[],
          tolls.statistics,
        ),
        undefined,
        { analyticsType: "Diagnostic", analyticsMethod: "Route toll outlier ranking", preferredChartKind: "bar" },
      );
      add(
        "toll-trends",
        "Toll Trends by Month",
        moduleBlock(
          tolls.route_trends.map((x) => ({
            month: x.month,
            actual_toll_php: x.actual_toll_php,
          })),
          tolls.drilldown as unknown as Record<string, unknown>[],
        ),
        undefined,
        { analyticsType: "Descriptive", analyticsMethod: "Monthly toll trend analysis", preferredChartKind: "line" },
      );
    }
  }

  if (category === "customers" && isPopulatedAnalyticsModule(data.clients)) {
    const clients = data.clients;
    add(
      "client-bookings",
      "Bookings by Client",
      moduleBlock(clients.booking_distribution, clients.drilldown, clients.statistics),
      undefined,
      { analyticsType: "Descriptive", analyticsMethod: "Client frequency distribution", preferredChartKind: "bar" },
    );
    add(
      "client-revenue",
      "Revenue Contribution by Client",
      moduleBlock(
        clients.revenue_contribution.map((x) => ({
          client_name: x.client_name,
          revenue_php: x.revenue_php,
        })),
        clients.drilldown,
        clients.statistics,
      ),
      comp?.revenue,
      { analyticsType: "Diagnostic", analyticsMethod: "Revenue contribution analysis", preferredChartKind: "bar" },
    );
  }

  return widgets;
}

export function AdminOperationalBiGrid({
  data,
  category,
}: {
  data: AdminAnalyticsPayload;
  category: AdminCategory;
}) {
  const widgets = useMemo(() => buildAdminWidgets(data, category), [data, category]);
  const groupedWidgets = useMemo(() => {
    const buckets: Record<NonNullable<WidgetSpec["analyticsType"]>, WidgetSpec[]> = {
      Descriptive: [],
      Diagnostic: [],
      Predictive: [],
      Prescriptive: [],
    };
    for (const widget of widgets) {
      buckets[widget.analyticsType ?? "Descriptive"].push(widget);
    }
    return buckets;
  }, [widgets]);

  if (!widgets.length) {
    return <EmptyChart message="No data available yet." />;
  }

  return (
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
                  filterOptions={data.filter_options}
                  comparative={w.comparative}
                  analyticsType={w.analyticsType}
                  analyticsMethod={w.analyticsMethod}
                  riskLegend={w.riskLegend}
                  preferredChartKind={w.preferredChartKind}
                />
              ))}
            </div>
          ) : (
            <EmptyChart message={`No ${title.toLowerCase()} widgets in this category.`} />
          )}
        </section>
      ))}
    </div>
  );
}
