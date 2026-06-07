"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  EmptyChart,
  SectionCard,
  StatGrid,
  StatisticsTable,
} from "@/components/admin/AnalyticsCharts";
import ExpenseDrilldownAnalytics from "@/components/admin/ExpenseDrilldownAnalytics";
import {
  ClientAnalyticsInteractive,
  DriverAnalyticsInteractive,
  FinancialAnalyticsInteractive,
  FleetAnalyticsInteractive,
  RouteAnalyticsInteractive,
  ShipmentAnalyticsInteractive,
} from "@/components/admin/InteractiveAnalyticsSections";
import { ComparativeAnalyticsBlock, ExecutiveOverviewSection, PercentageBreakdown } from "@/components/admin/BiAnalyticsComponents";
import TollAnalyticsSection from "@/components/admin/TollAnalyticsSection";
import ManagerRoleAnalyticsTabs from "@/components/admin/ManagerRoleAnalyticsTabs";
import PageHeader from "@/components/ui/PageHeader";
import ErrorState from "@/components/ui/ErrorState";
import LoadingMessage from "@/components/ui/LoadingMessage";
import { SkeletonChart, SkeletonDashboard } from "@/components/Skeleton";
import { ERROR_LOAD_DATA } from "@/lib/loadingMessages";
import { formatPhp } from "@/lib/appLocale";
import { scrollToSectionById } from "@/lib/scrollToSection";
import { useHashScrollWhenReady } from "@/lib/useHashScrollWhenReady";
import { AnalyticsApi, type AdminAnalyticsPayload } from "@/lib/analyticsApi";

type CategoryTab =
  | "all"
  | "shipments"
  | "expenses"
  | "fleet"
  | "drivers"
  | "routes"
  | "financial"
  | "clients"
  | "tolls";

const CATEGORY_TABS: { id: CategoryTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "shipments", label: "Shipments" },
  { id: "expenses", label: "Expenses" },
  { id: "fleet", label: "Fleet" },
  { id: "drivers", label: "Drivers" },
  { id: "routes", label: "Routes" },
  { id: "financial", label: "Financial" },
  { id: "clients", label: "Clients" },
  { id: "tolls", label: "Tolls" },
];

function isEmpty(mod: unknown): mod is { empty: true; message: string } {
  return !!mod && typeof mod === "object" && "empty" in mod && (mod as { empty?: boolean }).empty === true;
}

function statVal(v: string | number | null | undefined): string | number {
  if (v === null || v === undefined) return "Insufficient data";
  return v;
}

const ANALYTICS_SECTION_ID: Record<Exclude<CategoryTab, "all">, string> = {
  shipments: "analytics-shipments",
  expenses: "analytics-expenses",
  fleet: "analytics-fleet",
  drivers: "analytics-drivers",
  routes: "analytics-routes",
  financial: "analytics-financial",
  clients: "analytics-clients",
  tolls: "analytics-tolls",
};

function handleCategoryTab(tab: CategoryTab, setCategory: (tab: CategoryTab) => void) {
  setCategory(tab);
  if (tab === "all") return;
  requestAnimationFrame(() => {
    window.setTimeout(() => {
      const id = ANALYTICS_SECTION_ID[tab];
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${id}`);
      }
      scrollToSectionById(id, { maxAttempts: 12, attemptDelay: 100 });
    }, 120);
  });
}

function metricNote(
  value: string | number | null | undefined,
  note?: string | null,
): string | number {
  if (value === null || value === undefined) return note ?? "Insufficient data";
  return value;
}

export default function AdminAnalyticsDashboard({ showFinancial = true }: { showFinancial?: boolean }) {
  const [data, setData] = useState<AdminAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<CategoryTab>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [driverId, setDriverId] = useState("");
  const [truckId, setTruckId] = useState("");
  const [route, setRoute] = useState("");
  const [shipmentStatus, setShipmentStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setError("Start date cannot be after end date.");
      setLoading(false);
      return;
    }
    try {
      const payload = await AnalyticsApi.adminAnalytics({
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        driver_id: driverId ? Number(driverId) : undefined,
        truck_id: truckId ? Number(truckId) : undefined,
        route: route || undefined,
        shipment_status: shipmentStatus || undefined,
      });
      setData(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : ERROR_LOAD_DATA);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, driverId, truckId, route, shipmentStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  useHashScrollWhenReady(Boolean(data && !loading));

  const show = useMemo(
    () => (key: CategoryTab) => category === "all" || category === key,
    [category],
  );

  return (
    <div style={{ display: "grid", gap: "var(--space-5)" }}>
      <PageHeader
        eyebrow="Operations Intelligence"
        title="Analytics Center"
        subtitle="Company-wide reporting from live bookings, trips, payments, and operational records."
        actions={
          <>
            <Link href="/admin/payment-approval" className="quick-action-btn">
              Payment approval
            </Link>
            <Link href="/admin/trip-monitoring" className="quick-action-btn">
              Trip monitoring
            </Link>
          </>
        }
      />

      <section id="analytics-filters" className="filter-panel scroll-section">
        <h3 className="filter-panel__title">Filters & modules</h3>
        <div className="filter-panel__grid">
          <label className="filter-panel__label">
            Date from
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input" />
          </label>
          <label className="filter-panel__label">
            Date to
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input" />
          </label>
          <label className="filter-panel__label">
            Driver
            <select value={driverId} onChange={(e) => setDriverId(e.target.value)} className="input">
              <option value="">All drivers</option>
              {(data?.filter_options.drivers ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-panel__label">
            Truck
            <select value={truckId} onChange={(e) => setTruckId(e.target.value)} className="input">
              <option value="">All trucks</option>
              {(data?.filter_options.trucks ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-panel__label">
            Route
            <select value={route} onChange={(e) => setRoute(e.target.value)} className="input">
              <option value="">All routes</option>
              {(data?.filter_options.routes ?? []).map((r) => (
                <option key={r} value={r}>
                  {r.length > 48 ? `${r.slice(0, 48)}…` : r}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-panel__label">
            Shipment status
            <select value={shipmentStatus} onChange={(e) => setShipmentStatus(e.target.value)} className="input">
              <option value="">All statuses</option>
              {(data?.filter_options.shipment_statuses ?? []).map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="tab-pills">
          {CATEGORY_TABS.filter((t) => showFinancial || (t.id !== "financial" && t.id !== "clients")).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleCategoryTab(tab.id, setCategory)}
              className={`tab-pill${category === tab.id ? " tab-pill--active" : ""}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {loading && (
        <div style={{ display: "grid", gap: "var(--space-4)" }} aria-busy="true">
          <LoadingMessage label="Loading analytics…" />
          <SkeletonDashboard />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem" }}>
            <SkeletonChart />
            <SkeletonChart />
          </div>
        </div>
      )}
      {error && !loading && <ErrorState message={error} onRetry={() => void load()} />}

      {data && !loading && !error && (
        <>
          {data.validation && !data.validation.valid && (
            <div className="alert-banner alert-banner--warning" role="alert">
              <strong>Analytics validation warning:</strong> Some computed totals do not match source
              records. Review the backend validation report before relying on these figures.
              <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.25rem" }}>
                {data.validation.checks
                  .filter((c) => !c.passed)
                  .map((c) => (
                    <li key={c.check}>
                      {c.detail} (expected {String(c.expected)}, got {String(c.actual)})
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {data.executive_overview && <ExecutiveOverviewSection overview={data.executive_overview} />}

          {data.comparative_analytics && (
            <section className="panel-card scroll-section" id="analytics-comparative">
              <div>
                <h3 className="panel-card__title">Comparative Analytics</h3>
                <p className="panel-card__subtitle">
                  Level 2 — Weekly, monthly, quarterly, and yearly period comparisons with growth rates
                </p>
              </div>
              <div style={{ display: "grid", gap: "1.25rem" }}>
                <ComparativeAnalyticsBlock title="Revenue" metric={data.comparative_analytics.revenue} />
                <ComparativeAnalyticsBlock title="Operational expenses" metric={data.comparative_analytics.expenses} />
                <ComparativeAnalyticsBlock title="Deliveries" metric={data.comparative_analytics.deliveries} defaultGranularity="monthly" />
              </div>
            </section>
          )}

          {data.role_analytics && <ManagerRoleAnalyticsTabs data={data.role_analytics} filterOptions={data.filter_options} />}

          {show("shipments") && (
            <SectionCard title="1. Shipment / Delivery Analytics" sectionId="analytics-shipments">
              {isEmpty(data.shipments) ? (
                <EmptyChart message={data.shipments.message} />
              ) : (
                <>
                  <StatGrid
                    items={[
                      { label: "Total shipments", value: statVal(data.shipments.summary.total_shipments) },
                      { label: "Delivered", value: statVal(data.shipments.summary.delivered) },
                      { label: "Delayed", value: statVal(data.shipments.summary.delayed) },
                      { label: "Cancelled", value: statVal(data.shipments.summary.cancelled) },
                      { label: "In transit", value: statVal(data.shipments.summary.in_transit) },
                      { label: "Pending", value: statVal(data.shipments.summary.pending) },
                      {
                        label: "Success rate",
                        value:
                          data.shipments.summary.delivery_success_rate_pct != null
                            ? `${data.shipments.summary.delivery_success_rate_pct}%`
                            : "Insufficient data",
                      },
                      {
                        label: "Avg delivery (hrs)",
                        value: metricNote(
                          data.shipments.summary.average_delivery_hours,
                          data.shipments.summary.average_delivery_hours_note as string | null,
                        ),
                      },
                    ]}
                  />
                  <ShipmentAnalyticsInteractive
                    data={data.shipments}
                    filterOptions={data.filter_options}
                    comparative={data.comparative_analytics?.deliveries}
                    percentages={data.section_percentages?.shipments ?? null}
                  />
                  <StatisticsTable stats={data.shipments.statistics} />
                </>
              )}
            </SectionCard>
          )}

          {show("expenses") && (
            <SectionCard title="2. Fuel & Operational Expense Analytics" sectionId="analytics-expenses">
              {isEmpty(data.expenses) ? (
                <EmptyChart message={data.expenses.message} />
              ) : data.expenses.drilldown?.records ? (
                <>
                  <ComparativeAnalyticsBlock
                    title="Expense comparison"
                    metric={data.comparative_analytics?.expenses}
                    defaultGranularity="quarterly"
                  />
                  {data.section_percentages?.expenses ? (
                    <PercentageBreakdown title="Expense category share (%)" items={data.section_percentages.expenses} />
                  ) : null}
                  <ExpenseDrilldownAnalytics drilldown={data.expenses.drilldown} />
                </>
              ) : (
                <EmptyChart message="No expense data available for this quarter." />
              )}
            </SectionCard>
          )}

          {show("fleet") && (
            <SectionCard title="3. Fleet Utilization Analytics" sectionId="analytics-fleet">
              {isEmpty(data.fleet) ? (
                <EmptyChart message={data.fleet.message} />
              ) : (
                <>
                  <StatGrid
                    items={[
                      { label: "Fleet size", value: statVal(data.fleet.summary.fleet_size) },
                      { label: "Active trucks", value: statVal(data.fleet.summary.active_trucks) },
                      { label: "Most used", value: statVal(data.fleet.summary.most_used_truck as string | null) },
                      { label: "Least used", value: statVal(data.fleet.summary.least_used_truck as string | null) },
                      { label: "Utilization", value: `${data.fleet.summary.fleet_utilization_rate_pct}%` },
                      { label: "Total trips", value: statVal(data.fleet.summary.total_trips) },
                    ]}
                  />
                  <FleetAnalyticsInteractive data={data.fleet} filterOptions={data.filter_options} />
                  <StatisticsTable stats={data.fleet.statistics} />
                </>
              )}
            </SectionCard>
          )}

          {show("drivers") && (
            <SectionCard title="4. Driver Performance Analytics" sectionId="analytics-drivers">
              {isEmpty(data.drivers) ? (
                <EmptyChart message={data.drivers.message} />
              ) : (
                <>
                  <StatGrid
                    items={[
                      { label: "Drivers tracked", value: data.drivers.summary.driver_count },
                      { label: "Completed deliveries", value: data.drivers.summary.total_completed },
                      { label: "Delayed deliveries", value: data.drivers.summary.total_delayed },
                    ]}
                  />
                  <DriverAnalyticsInteractive data={data.drivers} filterOptions={data.filter_options} />
                  <StatisticsTable stats={data.drivers.statistics} />
                </>
              )}
            </SectionCard>
          )}

          {show("routes") && (
            <SectionCard title="5. Route Analytics" sectionId="analytics-routes">
              {isEmpty(data.routes) ? (
                <EmptyChart message={data.routes.message} />
              ) : (
                <>
                  <StatGrid
                    items={[
                      { label: "Routes", value: statVal(data.routes.summary.route_count) },
                      { label: "Most used", value: statVal(data.routes.summary.most_used_route as string | null) },
                      { label: "Fastest", value: statVal(data.routes.summary.fastest_route as string | null) },
                      { label: "Most delayed", value: statVal(data.routes.summary.most_delayed_route as string | null) },
                      { label: "Most expensive", value: statVal(data.routes.summary.most_expensive_route as string | null) },
                    ]}
                  />
                  <RouteAnalyticsInteractive data={data.routes} filterOptions={data.filter_options} />
                  <StatisticsTable stats={data.routes.statistics} />
                </>
              )}
            </SectionCard>
          )}

          {showFinancial && show("financial") && data.financial && (
            <SectionCard title="6. Financial Analytics" sectionId="analytics-financial">
              {isEmpty(data.financial) ? (
                <EmptyChart message={data.financial.message} />
              ) : (
                <>
                  <StatGrid
                    items={[
                      { label: "Total revenue", value: formatPhp(Number(data.financial.summary.total_revenue_php) || 0) },
                      { label: "Total expenses", value: formatPhp(Number(data.financial.summary.total_expenses_php) || 0) },
                      { label: "Profit estimate", value: formatPhp(Number(data.financial.summary.profit_estimate_php) || 0) },
                      { label: "Top route", value: statVal(data.financial.summary.most_profitable_route as string | null) },
                    ]}
                  />
                  <FinancialAnalyticsInteractive
                    data={{
                      category_summary: data.financial.category_summary ?? [],
                      revenue_trend: data.financial.revenue_trend,
                      drilldown: data.financial.drilldown ?? [],
                    }}
                    filterOptions={data.filter_options}
                    comparative={data.comparative_analytics?.revenue}
                    percentages={data.section_percentages?.financial ?? null}
                  />
                  <StatisticsTable stats={data.financial.statistics} />
                </>
              )}
            </SectionCard>
          )}

          {showFinancial && show("clients") && data.clients && (
            <SectionCard title="7. Client Analytics" sectionId="analytics-clients">
              {isEmpty(data.clients) ? (
                <EmptyChart message={data.clients.message} />
              ) : (
                <>
                  <StatGrid
                    items={[
                      { label: "Active clients", value: data.clients.summary.active_clients },
                      { label: "Total bookings", value: data.clients.summary.total_bookings },
                      { label: "Revenue", value: formatPhp(data.clients.summary.total_revenue_php) },
                    ]}
                  />
                  <ClientAnalyticsInteractive data={data.clients} filterOptions={data.filter_options} />
                  <StatisticsTable stats={data.clients.statistics} />
                </>
              )}
            </SectionCard>
          )}

          {show("tolls") && data.toll_analytics && (
            <SectionCard title="8. Toll Analytics" sectionId="analytics-tolls">
              <TollAnalyticsSection data={data.toll_analytics} />
            </SectionCard>
          )}
        </>
      )}

      <section className="panel-card">
        <h3 className="panel-card__title">Quick actions</h3>
        <div className="quick-actions">
          <Link href="/admin/payment-approval" className="quick-action-btn">
            Payment approval
          </Link>
          <Link href="/admin/trip-monitoring" className="quick-action-btn">
            Trip monitoring
          </Link>
          <Link href="/modules/analytics/expenses" className="quick-action-btn">
            Detailed expense module
          </Link>
        </div>
      </section>
    </div>
  );
}
