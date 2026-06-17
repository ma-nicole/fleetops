"use client";

import { useCallback, useEffect, useState } from "react";
import CustomerRoleAnalyticsTabs from "@/components/customer/CustomerRoleAnalyticsTabs";
import PageHeader from "@/components/ui/PageHeader";
import ErrorState from "@/components/ui/ErrorState";
import LoadingMessage from "@/components/ui/LoadingMessage";
import { SkeletonDashboard } from "@/components/Skeleton";
import { ERROR_LOAD_DATA } from "@/lib/loadingMessages";
import { AnalyticsApi, type CustomerAnalyticsPayload } from "@/lib/analyticsApi";

export default function CustomerAnalyticsDashboard() {
  const [data, setData] = useState<CustomerAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
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
      const payload = await AnalyticsApi.customerAnalytics({
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        route: route || undefined,
        shipment_status: shipmentStatus || undefined,
      });
      setData(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : ERROR_LOAD_DATA);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, route, shipmentStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="bi-analytics-page">
      <PageHeader
        eyebrow="Customer Insights"
        title="Customer Analytics"
        subtitle="Account, booking, and shipment tracking analytics using your real records only."
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
            Route
            <input
              value={route}
              onChange={(e) => setRoute(e.target.value)}
              className="input"
              placeholder="e.g. Manila -> Batangas"
            />
          </label>
          <label className="filter-panel__label">
            Shipment status
            <select value={shipmentStatus} onChange={(e) => setShipmentStatus(e.target.value)} className="input">
              <option value="">All statuses</option>
              <option value="delivered">Delivered</option>
              <option value="delayed">Delayed</option>
              <option value="cancelled">Cancelled</option>
              <option value="in_transit">In transit</option>
              <option value="pending">Pending</option>
            </select>
          </label>
        </div>
      </section>

      {loading && (
        <div style={{ display: "grid", gap: "var(--space-4)" }} aria-busy="true">
          <LoadingMessage label="Loading customer analytics…" />
          <SkeletonDashboard />
        </div>
      )}
      {error && !loading && <ErrorState message={error} onRetry={() => void load()} />}
      {data && !loading && !error && <CustomerRoleAnalyticsTabs data={data.customer_role_analytics} />}
    </div>
  );
}
