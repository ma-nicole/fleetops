"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminOperationalBiGrid } from "@/components/admin/AdminOperationalBiGrid";
import { ExecutiveOverviewSection } from "@/components/admin/BiAnalyticsComponents";
import ManagerRoleAnalyticsTabs from "@/components/admin/ManagerRoleAnalyticsTabs";
import PageHeader from "@/components/ui/PageHeader";
import ErrorState from "@/components/ui/ErrorState";
import LoadingMessage from "@/components/ui/LoadingMessage";
import { SkeletonChart, SkeletonDashboard } from "@/components/Skeleton";
import { EMPTY_ANALYTICS } from "@/lib/loadingMessages";
import { useHashScrollWhenReady } from "@/lib/useHashScrollWhenReady";
import {
  AnalyticsApi,
  analyticsLoadErrorMessage,
  isAnalyticsPayloadEmpty,
  logAnalyticsLoadError,
  type AdminAnalyticsPayload,
} from "@/lib/analyticsApi";
import { ApiError } from "@/lib/api";
import { TimeGranularityPicker } from "@/components/admin/TimeGranularityPicker";
import { useAnalyticsPageFilters } from "@/lib/useAnalyticsPageFilters";

type CategoryTab = "revenue" | "operations" | "fleet" | "expenses" | "routes" | "customers";

const CATEGORY_TABS: { id: CategoryTab; label: string }[] = [
  { id: "revenue", label: "Revenue" },
  { id: "operations", label: "Operations" },
  { id: "fleet", label: "Fleet" },
  { id: "expenses", label: "Expenses" },
  { id: "routes", label: "Routes" },
  { id: "customers", label: "Customers" },
];

export default function AdminAnalyticsDashboard({ showFinancial = true }: { showFinancial?: boolean }) {
  const router = useRouter();
  const loadSeqRef = useRef(0);
  const [data, setData] = useState<AdminAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<CategoryTab>("revenue");
  const {
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    driverId,
    setDriverId,
    truckId,
    setTruckId,
    route,
    setRoute,
    shipmentStatus,
    setShipmentStatus,
    granularity,
    setGranularity,
    dateRangeError,
    buildAdminQuery,
  } = useAnalyticsPageFilters();

  const load = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    setError(null);
    if (dateRangeError) {
      setError(dateRangeError);
      setLoading(false);
      return;
    }
    try {
      const payload = await AnalyticsApi.adminAnalytics(buildAdminQuery());
      if (seq !== loadSeqRef.current) return;
      setData(payload);
    } catch (e) {
      if (seq !== loadSeqRef.current) return;
      logAnalyticsLoadError(e);
      if (e instanceof ApiError && e.status === 401) {
        router.push("/sign-in");
        return;
      }
      setError(analyticsLoadErrorMessage(e));
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, [dateRangeError, buildAdminQuery, router]);

  const handlePeriodDrillDown = useCallback(
    (next: { granularity: typeof granularity; dateFrom: string; dateTo: string }) => {
      setGranularity(next.granularity);
      setDateFrom(next.dateFrom);
      setDateTo(next.dateTo);
    },
    [setGranularity, setDateFrom, setDateTo],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useHashScrollWhenReady(Boolean(data && !loading));

  const visibleTabs = showFinancial
    ? CATEGORY_TABS
    : CATEGORY_TABS.filter((t) => t.id !== "revenue" && t.id !== "customers");

  const gridCategory: CategoryTab =
    !showFinancial && (category === "revenue" || category === "customers") ? "operations" : category;

  return (
    <div className="bi-analytics-page">
      <PageHeader
        eyebrow="Operations Intelligence"
        title="Analytics Center"
        subtitle="Executive BI dashboard — multiple charts, drill-down records, statistics, and comparisons from live data."
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

      <section id="analytics-filters" className="filter-panel">
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
        <TimeGranularityPicker value={granularity} onChange={setGranularity} />
        <div className="tab-pills bi-category-tabs">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCategory(tab.id)}
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
          <div className="bi-chart-grid">
            <SkeletonChart />
            <SkeletonChart />
            <SkeletonChart />
            <SkeletonChart />
          </div>
        </div>
      )}
      {error && !loading && <ErrorState message={error} onRetry={() => void load()} />}

      {data && !loading && !error && (
        <>
          {isAnalyticsPayloadEmpty(data, showFinancial) && (
            <div className="alert-banner" role="status">
              <p style={{ margin: 0 }}>{EMPTY_ANALYTICS}</p>
            </div>
          )}

          {data.validation && !data.validation.valid && (
            <div className="alert-banner alert-banner--warning" role="alert">
              <strong>Analytics validation warning:</strong> Some computed totals do not match source records.
            </div>
          )}

          {data.executive_overview && <ExecutiveOverviewSection overview={data.executive_overview} />}

          <section className="bi-dashboard" id="analytics-operational-grid">
            <header className="bi-dashboard__head">
              <div>
                <h2 className="bi-dashboard__title">Operational Analytics</h2>
                <p className="bi-dashboard__subtitle">
                  {CATEGORY_TABS.find((t) => t.id === gridCategory)?.label ?? "Analytics"} — click any chart element to
                  drill down into source records.
                </p>
              </div>
            </header>
            <AdminOperationalBiGrid
              data={data}
              category={gridCategory}
              timeGranularity={granularity}
              onPeriodDrillDown={handlePeriodDrillDown}
            />
          </section>

          {data.role_analytics && (
            <ManagerRoleAnalyticsTabs
              data={data.role_analytics}
              filterOptions={data.filter_options}
              timeGranularity={granularity}
              onPeriodDrillDown={handlePeriodDrillDown}
            />
          )}
        </>
      )}
    </div>
  );
}
