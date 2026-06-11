"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import DispatcherRoleAnalyticsTabs from "@/components/dispatcher/DispatcherRoleAnalyticsTabs";
import PageHeader from "@/components/ui/PageHeader";
import ErrorState from "@/components/ui/ErrorState";
import LoadingMessage from "@/components/ui/LoadingMessage";
import { SkeletonDashboard } from "@/components/Skeleton";
import {
  AnalyticsApi,
  analyticsLoadErrorMessage,
  logAnalyticsLoadError,
  type AdminAnalyticsPayload,
} from "@/lib/analyticsApi";
import { ApiError } from "@/lib/api";

export default function DispatcherAnalyticsDashboard() {
  const router = useRouter();
  const loadSeqRef = useRef(0);
  const [data, setData] = useState<AdminAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [driverId, setDriverId] = useState("");
  const [truckId, setTruckId] = useState("");
  const [route, setRoute] = useState("");
  const [shipmentStatus, setShipmentStatus] = useState("");

  const load = useCallback(async () => {
    const seq = ++loadSeqRef.current;
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
      if (seq === loadSeqRef.current) {
        setLoading(false);
      }
    }
  }, [dateFrom, dateTo, driverId, truckId, route, shipmentStatus, router]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div style={{ display: "grid", gap: "var(--space-5)" }}>
      <PageHeader
        eyebrow="Dispatch Intelligence"
        title="Dispatcher Analytics"
        subtitle="Trip scheduling, route coordination, assignments, and order monitoring from live operational records."
      />

      <section id="dispatcher-analytics-filters" className="filter-panel scroll-section">
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
      </section>

      {loading && (
        <div style={{ display: "grid", gap: "var(--space-4)" }} aria-busy="true">
          <LoadingMessage label="Loading dispatcher analytics…" />
          <SkeletonDashboard />
        </div>
      )}
      {error && !loading && <ErrorState message={error} onRetry={() => void load()} />}

      {data && !loading && !error && data.dispatcher_role_analytics && (
        <DispatcherRoleAnalyticsTabs data={data.dispatcher_role_analytics} />
      )}

      {data && !loading && !error && !data.dispatcher_role_analytics && (
        <p className="empty-state">No dispatcher analytics available yet.</p>
      )}
    </div>
  );
}
