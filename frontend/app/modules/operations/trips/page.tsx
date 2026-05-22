"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";
import CustomerBookingAssignmentsList from "@/components/CustomerBookingAssignmentsList";
import BookingCustomsClearanceSection from "@/components/BookingCustomsClearanceSection";
import { getDashboardPath, getEffectiveRole, type UserRole } from "@/lib/auth";
import { APP_LOCALE, APP_TIMEZONE, formatPhpWhole } from "@/lib/appLocale";
import { useRoleGuard } from "@/lib/useRoleGuard";
import {
  WorkflowApi,
  type Booking,
  type BookingStatus,
  type CustomerBookingRow,
  type Payment,
} from "@/lib/workflowApi";

const TERMINAL: BookingStatus[] = ["completed", "cancelled", "rejected", "payment_rejected", "expired"];

function isCustomerRow(b: Booking | CustomerBookingRow): b is CustomerBookingRow {
  return "display_status" in b && typeof (b as CustomerBookingRow).display_status === "string";
}

/** When booking is still pending_approval, explain payment stage using latest payment row. */
function paymentSubline(bookingStatus: BookingStatus, p?: Payment | null): string | null {
  if (!["pending_approval", "pending_payment", "payment_verification"].includes(bookingStatus)) return null;
  if (!p) return "Awaiting payment and proof upload.";
  if (p.status === "for_verification") return "Payment: for verification.";
  if (p.status === "rejected") return "Payment rejected — submit a new proof from your payment flow.";
  return null;
}

function customerPaymentSubline(row: CustomerBookingRow, p?: Payment | null): string | null {
  if (row.display_status === "payment_rejected") return "Payment rejected — submit a new proof from Payment.";
  return paymentSubline(row.status, p);
}

function statusLabel(status: BookingStatus): string {
  const map: Record<BookingStatus, string> = {
    pending_payment: "Pending payment",
    payment_verification: "Payment verification",
    payment_verified: "Payment verified",
    ready_for_assignment: "Ready for assignment",
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
    payment_rejected: "Payment rejected",
    expired: "Expired",
  };
  return map[status] ?? status;
}

/** After trucks are assigned: row badge is always "On going" (per-trip detail below). */
const CUSTOMER_ROW_ON_GOING_DISPLAY: ReadonlySet<string> = new Set([
  "assigned",
  "for_pickup",
  "picked_up",
  "en_route",
  "out_for_delivery",
  "dropped_off",
]);

const CUSTOMER_DISPLAY_FILTERS: { key: string; label: string }[] = [
  { key: "pending_payment", label: "Pending payment" },
  { key: "payment_verification", label: "Payment verification" },
  { key: "payment_verified", label: "Payment verified" },
  { key: "ready_for_assignment", label: "Ready for assignment" },
  { key: "pending_approval", label: "Pending approval" },
  { key: "approved", label: "Approved" },
  { key: "assigned", label: "Booking assigned" },
  { key: "for_pickup", label: "For pickup" },
  { key: "picked_up", label: "Picked up" },
  { key: "en_route", label: "En route" },
  { key: "out_for_delivery", label: "En route" },
  { key: "dropped_off", label: "Dropped off" },
];

function StatusBadge({
  status,
  displayKey,
  displayLabel,
}: {
  status: BookingStatus;
  displayKey?: string;
  displayLabel?: string;
}) {
  const label = displayLabel || statusLabel(status);
  const s = (displayKey || status).toLowerCase();
  const base = { padding: "0.25rem 0.5rem", borderRadius: 6, fontSize: "0.75rem", fontWeight: 700 as const };
  if (s === "on going" || s === "on_going" || s === "ongoing")
    return <span style={{ ...base, background: "rgba(37,99,235,0.12)", color: "#1d4ed8" }}>{label}</span>;
  if (s === "completed") return <span style={{ ...base, background: "rgba(5,150,105,0.12)", color: "#047857" }}>{label}</span>;
  if (s === "cancelled" || s === "rejected" || s === "payment_rejected" || s === "expired")
    return <span style={{ ...base, background: "#FEE2E2", color: "#991B1B" }}>{label}</span>;
  if (["enroute", "loading", "out_for_delivery", "accepted", "en_route", "for_pickup", "picked_up", "dropped_off"].includes(s))
    return <span style={{ ...base, background: "rgba(37,99,235,0.12)", color: "#1d4ed8" }}>{label}</span>;
  if (
    s === "pending_payment" ||
    s === "payment_verification" ||
    s === "payment_verified" ||
    s === "ready_for_assignment" ||
    s === "pending_approval" ||
    s === "approved" ||
    s === "assigned"
  )
    return <span style={{ ...base, background: "rgba(251,191,36,0.35)", color: "#92400e" }}>{label}</span>;
  return <span style={{ ...base, background: "#F3F4F6", color: "#475569" }}>{label}</span>;
}

type FilterMode = "active" | "all" | BookingStatus | string;

const OPERATIONAL_STATUSES: BookingStatus[] = [
  "pending_payment",
  "payment_verification",
  "payment_verified",
  "ready_for_assignment",
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
  const [bookings, setBookings] = useState<(Booking | CustomerBookingRow)[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("active");
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const r = typeof window !== "undefined" ? getEffectiveRole() : null;
      if (r === "customer") {
        const [list, pays] = await Promise.all([
          WorkflowApi.customerCurrentBookings(),
          WorkflowApi.listPayments(),
        ]);
        setBookings(list);
        setPayments(pays);
      } else {
        setBookings(await WorkflowApi.listBookings());
        setPayments([]);
      }
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

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [load]);

  const isCustomer = role === "customer";

  const paymentByBooking = useMemo(() => {
    const m = new Map<number, Payment>();
    for (const p of payments) {
      const cur = m.get(p.booking_id);
      if (!cur || p.id > cur.id) m.set(p.booking_id, p);
    }
    return m;
  }, [payments]);

  const filtered = useMemo(() => {
    let rows = bookings;

    if (!isCustomer) {
      if (filter === "active") {
        rows = rows.filter((b) => !TERMINAL.includes(b.status));
      } else if (filter !== "all") {
        const statusOnly = filter as BookingStatus;
        rows = rows.filter((b) => b.status === statusOnly);
      }
    } else if (filter !== "active" && filter !== "all") {
      rows = rows.filter((b) => isCustomerRow(b) && b.display_status === filter);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((b) => {
        const pay = paymentByBooking.get(b.id);
        const sub = isCustomerRow(b) ? customerPaymentSubline(b, pay) : paymentSubline(b.status, pay);
        const disp = isCustomerRow(b) ? b.display_status_label.toLowerCase() : "";
        const assignmentHaystack =
          isCustomer && isCustomerRow(b)
            ? (b.assignments ?? [])
                .map((a) =>
                  [
                    a.driver?.name,
                    a.helper?.name,
                    a.truck?.plate_number,
                    a.truck?.code,
                    a.truck?.model_name,
                    String(a.trip_id),
                    a.helper_progress_status,
                    a.trip_status,
                    a.latest_location_name,
                  ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase(),
                )
                .join(" ")
            : "";
        return (
          String(b.id).includes(q) ||
          b.pickup_location.toLowerCase().includes(q) ||
          b.dropoff_location.toLowerCase().includes(q) ||
          statusLabel(b.status).toLowerCase().includes(q) ||
          disp.includes(q) ||
          assignmentHaystack.includes(q) ||
          (sub ? sub.toLowerCase().includes(q) : false)
        );
      });
    }
    return rows;
  }, [bookings, filter, search, isCustomer, paymentByBooking]);

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
      if (isCustomer) await WorkflowApi.customerCancelBooking(id);
      else await WorkflowApi.cancelBooking(id);
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
                {CUSTOMER_DISPLAY_FILTERS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
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
                <th style={{ padding: "0.75rem 1rem", fontWeight: 700 }}>{isCustomer ? "Amount paid" : "Est."}</th>
                {isCustomer && <th style={{ padding: "0.75rem 1rem", fontWeight: 700 }}> </th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => {
                const pay = isCustomer ? paymentByBooking.get(b.id) : undefined;
                const paySub =
                  isCustomer && isCustomerRow(b) ? customerPaymentSubline(b, pay) : isCustomer ? null : paymentSubline(b.status, pay);
                const detailColSpan = showStaffCols ? 6 : isCustomer ? 6 : 5;
                const summaryRow = (
                  <tr key={`${b.id}-summary`} style={{ borderBottom: isCustomer ? "none" : "1px solid #F3F4F6" }}>
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
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <StatusBadge
                          status={b.status}
                          displayKey={
                            isCustomer && isCustomerRow(b) && CUSTOMER_ROW_ON_GOING_DISPLAY.has(b.display_status)
                              ? "on_going"
                              : isCustomerRow(b)
                                ? b.display_status
                                : undefined
                          }
                          displayLabel={
                            isCustomer && isCustomerRow(b) && CUSTOMER_ROW_ON_GOING_DISPLAY.has(b.display_status)
                              ? "On going"
                              : isCustomerRow(b)
                                ? b.display_status_label
                                : undefined
                          }
                        />
                        {paySub ? (
                          <span style={{ fontSize: "0.72rem", color: "#6B7280", lineHeight: 1.35, maxWidth: 220 }}>
                            {paySub}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td style={{ padding: "0.65rem 1rem", fontWeight: 600 }}>{formatPhpWhole(Number(b.estimated_cost))}</td>
                    {isCustomer && (
                      <td style={{ padding: "0.65rem 1rem" }}>
                        {isCustomerRow(b) && b.can_cancel && (
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
                );
                if (!isCustomer || !isCustomerRow(b)) {
                  return <Fragment key={b.id}>{summaryRow}</Fragment>;
                }
                return (
                  <Fragment key={b.id}>
                    {summaryRow}
                    <tr key={`${b.id}-detail`} style={{ borderBottom: "1px solid #F3F4F6" }}>
                      <td
                        colSpan={detailColSpan}
                        style={{
                          padding: "0 1rem 1rem",
                          background: "#FAFAFA",
                          verticalAlign: "top",
                        }}
                      >
                        <div
                          style={{
                            border: "1px solid #E5E7EB",
                            borderRadius: "10px",
                            padding: "0.85rem 1rem",
                            background: "#fff",
                          }}
                        >
                          <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#374151", marginBottom: "0.5rem" }}>
                            Trip crews and live status (same as Shipment tracking)
                          </div>
                          <CustomerBookingAssignmentsList assignments={b.assignments} dropoffAddress={b.dropoff_location} />
                          <BookingCustomsClearanceSection
                            booking={b}
                            onUpdated={(updated) => {
                              setBookings((prev) =>
                                prev.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)),
                              );
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
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
