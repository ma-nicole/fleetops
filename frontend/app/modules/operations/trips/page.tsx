"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";
import { getDashboardPath, getEffectiveRole, type UserRole } from "@/lib/auth";
import { APP_LOCALE, APP_TIMEZONE, formatPhpWhole } from "@/lib/appLocale";
import { useRoleGuard } from "@/lib/useRoleGuard";
import { WorkflowApi, type Booking, type BookingStatus } from "@/lib/workflowApi";

const TERMINAL: BookingStatus[] = ["completed", "cancelled", "rejected"];

function statusLabel(status: BookingStatus): string {
  const map: Record<BookingStatus, string> = {
    pending_approval: "Pending approval",
    approved: "Approved",
    assigned: "Assigned",
    accepted: "Accepted",
    enroute: "En route",
    loading: "Loading",
    out_for_delivery: "Out for delivery",
    completed: "Completed",
    cancelled: "Cancelled",
    rejected: "Rejected",
  };
  return map[status] ?? status;
}

function StatusBadge({ status }: { status: BookingStatus }) {
  const label = statusLabel(status);
  const s = status.toLowerCase();
  const base = { padding: "0.25rem 0.5rem", borderRadius: 6, fontSize: "0.75rem", fontWeight: 700 as const };
  if (s === "completed") return <span style={{ ...base, background: "rgba(5,150,105,0.12)", color: "#047857" }}>{label}</span>;
  if (s === "cancelled" || s === "rejected")
    return <span style={{ ...base, background: "#FEE2E2", color: "#991B1B" }}>{label}</span>;
  if (["enroute", "loading", "out_for_delivery", "accepted"].includes(s))
    return <span style={{ ...base, background: "rgba(37,99,235,0.12)", color: "#1d4ed8" }}>{label}</span>;
  if (s === "pending_approval" || s === "approved" || s === "assigned")
    return <span style={{ ...base, background: "rgba(251,191,36,0.35)", color: "#92400e" }}>{label}</span>;
  return <span style={{ ...base, background: "#F3F4F6", color: "#475569" }}>{label}</span>;
}

type FilterMode = "active" | "all" | BookingStatus;

const OPERATIONAL_STATUSES: BookingStatus[] = [
  "pending_approval",
  "approved",
  "assigned",
  "accepted",
  "enroute",
  "loading",
  "out_for_delivery",
];

export default function TripRecordsPage() {
  useRoleGuard(["customer", "dispatcher", "manager", "admin"]);

  const [role, setRole] = useState<UserRole | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("active");
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const list = await WorkflowApi.listBookings();
      setBookings(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load bookings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const r = typeof window !== "undefined" ? getEffectiveRole() : null;
    setRole(r);
    if (r === "customer") setFilter("active");
    else setFilter("all");
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isCustomer = role === "customer";

  const filtered = useMemo(() => {
    let rows = bookings;

    if (isCustomer) {
      rows = rows.filter((b) => !TERMINAL.includes(b.status));
    }

    if (filter === "active") {
      if (!isCustomer) {
        rows = rows.filter((b) => !TERMINAL.includes(b.status));
      }
    } else if (filter !== "all") {
      const statusOnly = filter as BookingStatus;
      rows = rows.filter((b) => b.status === statusOnly);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (b) =>
          String(b.id).includes(q) ||
          b.pickup_location.toLowerCase().includes(q) ||
          b.dropoff_location.toLowerCase().includes(q) ||
          statusLabel(b.status).toLowerCase().includes(q),
      );
    }
    return rows;
  }, [bookings, filter, search, isCustomer]);

  const dashboardHref = role ? getDashboardPath(role) : "/";

  const crumbs = [
    { label: "Dashboard", href: dashboardHref },
    ...(isCustomer ? [] : [{ label: "Trip processing" as const }]),
    { label: isCustomer ? "Current bookings" : "Bookings list" },
  ];

  const onCancel = async (id: number) => {
    if (!window.confirm(`Cancel booking #${id}? This cannot be undone.`)) return;
    setCancellingId(id);
    try {
      await WorkflowApi.cancelBooking(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancel failed.");
    } finally {
      setCancellingId(null);
    }
  };

  const showStaffCols = role && !isCustomer;

  return (
    <div className="container" style={{ paddingTop: "var(--space-3)", paddingBottom: "2rem" }}>
      <Breadcrumbs items={crumbs} />

      <header style={{ marginTop: "1.25rem", marginBottom: "1rem" }}>
        <h1 style={{ color: "#1A1A1A", margin: "0 0 0.35rem 0" }}>
          {isCustomer ? "Current bookings" : "Bookings"}
        </h1>
        <p style={{ color: "#6B7280", margin: 0, fontSize: "0.95rem" }}>
          {isCustomer
            ? "Shipments in progress. Completed, cancelled, or rejected bookings appear under Booking history."
            : "Operations view of bookings in the system (newest first). Use filters to narrow the list."}
        </p>
      </header>

      <div
        className="card"
        style={{
          marginBottom: "1rem",
          display: "grid",
          gap: "0.75rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
          alignItems: "end",
        }}
      >
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#374151" }}>Search</span>
          <input
            className="input"
            placeholder="Booking #, pickup, dropoff, or status…"
            value={search}
      onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#374151" }}>Status</span>
          <select className="select" value={filter} onChange={(e) => setFilter(e.target.value as FilterMode)}>
            {isCustomer ? (
              <>
                <option value="active">All active bookings</option>
                {OPERATIONAL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </>
            ) : (
              <>
                <option value="all">All statuses</option>
                <option value="active">Active bookings only</option>
                {OPERATIONAL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
                {TERMINAL.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </>
            )}
          </select>
        </label>
      </div>

      {isCustomer && (
        <p style={{ margin: "0 0 1rem 0" }}>
          <Link href="/booking" className="button" style={{ display: "inline-block", textDecoration: "none" }}>
            + New booking
          </Link>
        </p>
      )}

      {error && (
        <div role="alert" style={{ background: "#FEE2E2", color: "#991B1B", padding: 12, borderRadius: 8, marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: "#6B7280" }}>Loading bookings…</p>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: "1.5rem", color: "#6B7280" }}>
          {isCustomer
            ? "No bookings match this filter yet. Create a booking or check Booking history for completed or closed shipments."
            : "No bookings match this filter."}
        </div>
      ) : (
        <div className="card" style={{ overflowX: "auto", padding: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead>
              <tr style={{ background: "#F9FAFB", textAlign: "left", borderBottom: "1px solid #E5E7EB" }}>
                {showStaffCols && (
                  <th style={{ padding: "0.75rem 1rem", fontWeight: 700 }}>Customer</th>
                )}
                <th style={{ padding: "0.75rem 1rem", fontWeight: 700 }}>Booking</th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: 700 }}>Schedule</th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: 700 }}>Route</th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: 700 }}>Status</th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: 700 }}>Est.</th>
                {isCustomer && <th style={{ padding: "0.75rem 1rem", fontWeight: 700 }}> </th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                  {showStaffCols && (
                    <td style={{ padding: "0.65rem 1rem", color: "#6B7280" }}>#{b.customer_id}</td>
                  )}
                  <td style={{ padding: "0.65rem 1rem", fontWeight: 700 }}>#{b.id}</td>
                  <td style={{ padding: "0.65rem 1rem", color: "#374151", whiteSpace: "nowrap" }}>
                    {new Intl.DateTimeFormat(APP_LOCALE, { timeZone: APP_TIMEZONE, dateStyle: "medium" }).format(
                      new Date(`${b.scheduled_date}T12:00:00`),
                    )}
                  </td>
                  <td style={{ padding: "0.65rem 1rem", maxWidth: 280 }}>
                    <span style={{ color: "#111" }}>{b.pickup_location}</span>
                    <span style={{ color: "#9CA3AF", margin: "0 0.35rem" }}>→</span>
                    <span style={{ color: "#111" }}>{b.dropoff_location}</span>
                  </td>
                  <td style={{ padding: "0.65rem 1rem" }}>
                    <StatusBadge status={b.status} />
                  </td>
                  <td style={{ padding: "0.65rem 1rem", fontWeight: 600 }}>{formatPhpWhole(Number(b.estimated_cost))}</td>
                  {isCustomer && (
                    <td style={{ padding: "0.65rem 1rem" }}>
                      {!TERMINAL.includes(b.status) && (
                        <button
                          type="button"
                          disabled={cancellingId === b.id}
                          onClick={() => onCancel(b.id)}
                          style={{
                            padding: "0.35rem 0.65rem",
                            fontSize: "0.8rem",
                            borderRadius: 6,
                            border: "1px solid #FCA5A5",
                            background: "#FFF",
                            color: "#B91C1C",
                            cursor: cancellingId === b.id ? "wait" : "pointer",
                          }}
                        >
                          {cancellingId === b.id ? "…" : "Cancel"}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ marginTop: "1rem", fontSize: "0.8rem", color: "#9CA3AF" }}>
        Times shown in {APP_TIMEZONE.replace("_", " ")} ({APP_LOCALE}).
      </p>
    </div>
  );
}
