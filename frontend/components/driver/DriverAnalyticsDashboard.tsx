"use client";

import { useCallback, useEffect, useState } from "react";
import DriverRoleAnalyticsTabs from "@/components/driver/DriverRoleAnalyticsTabs";
import PageHeader from "@/components/ui/PageHeader";
import ErrorState from "@/components/ui/ErrorState";
import LoadingMessage from "@/components/ui/LoadingMessage";
import { SkeletonDashboard } from "@/components/Skeleton";
import { ERROR_LOAD_DATA } from "@/lib/loadingMessages";
import { AnalyticsApi, type DriverAnalyticsPayload } from "@/lib/analyticsApi";
import { TimeGranularityPicker } from "@/components/admin/TimeGranularityPicker";
import { useAnalyticsPageFilters } from "@/lib/useAnalyticsPageFilters";

export default function DriverAnalyticsDashboard() {
  const [data, setData] = useState<DriverAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const {
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    truckId,
    setTruckId,
    route,
    setRoute,
    shipmentStatus,
    setShipmentStatus,
    granularity,
    setGranularity,
    dateRangeError,
    buildRoleQuery,
  } = useAnalyticsPageFilters();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (dateRangeError) {
      setError(dateRangeError);
      setLoading(false);
      return;
    }
    try {
      const payload = await AnalyticsApi.driverAnalytics(buildRoleQuery());
      setData(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : ERROR_LOAD_DATA);
    } finally {
      setLoading(false);
    }
  }, [dateRangeError, buildRoleQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="bi-analytics-page">
      <PageHeader
        eyebrow="Performance"
        title="Driver Analytics"
        subtitle="Trip execution, routes, deliveries, and vehicle insights from your real trip records."
      />

      <section className="filter-panel scroll-section">
        <h3 className="filter-panel__title">Filters</h3>
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
      </section>

      {loading && (
        <div style={{ display: "grid", gap: "var(--space-4)" }} aria-busy="true">
          <LoadingMessage label="Loading driver analytics…" />
          <SkeletonDashboard />
        </div>
      )}
      {error && !loading && <ErrorState message={error} onRetry={() => void load()} />}

      {data && !loading && !error && data.driver_role_analytics && (
        <DriverRoleAnalyticsTabs data={data.driver_role_analytics} />
      )}

      {data && !loading && !error && !data.driver_role_analytics && (
        <p className="empty-state">No data available yet.</p>
      )}
    </div>
  );
}
