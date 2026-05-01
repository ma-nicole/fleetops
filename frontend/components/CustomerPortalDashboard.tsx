"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import DashboardRoleTabs from "@/components/DashboardRoleTabs";
import KpiCard from "@/components/KpiCard";
import { WorkflowApi, type Booking, type Payment } from "@/lib/workflowApi";

function bookingProgress(status: Booking["status"]): number {
  switch (status) {
    case "pending_approval":
      return 15;
    case "approved":
      return 28;
    case "assigned":
    case "accepted":
      return 45;
    case "enroute":
    case "loading":
      return 72;
    case "out_for_delivery":
      return 85;
    case "completed":
      return 100;
    case "cancelled":
    case "rejected":
      return 0;
    default:
      return 35;
  }
}

function bookingLabel(status: Booking["status"]): string {
  switch (status) {
    case "pending_approval":
      return "Pending approval";
    case "approved":
      return "Approved";
    case "assigned":
      return "Assigned";
    case "accepted":
      return "Accepted";
    case "enroute":
      return "En route";
    case "loading":
      return "Loading";
    case "out_for_delivery":
      return "Out for delivery";
    case "completed":
      return "Delivered";
    case "cancelled":
      return "Cancelled";
    case "rejected":
      return "Rejected";
    default:
      return status;
  }
}

function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

export default function CustomerPortalDashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [b, p] = await Promise.all([WorkflowApi.listBookings(), WorkflowApi.listPayments()]);
        if (!cancelled) {
          setBookings(b);
          setPayments(p);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load portal data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeBookings = useMemo(
    () => bookings.filter((b) => !["completed", "cancelled", "rejected"].includes(b.status)),
    [bookings],
  );

  const kpis = useMemo(() => {
    const totalOrders = bookings.length;
    const paid = payments.filter((p) => p.status === "paid");
    const spent = paid.reduce((s, p) => s + p.amount, 0);
    const done = bookings.filter((b) => b.status === "completed").length;
    const rate = totalOrders ? Math.round((done / totalOrders) * 1000) / 10 : 0;
    return {
      activeCount: activeBookings.length,
      inTransit: bookings.filter((b) => ["enroute", "loading", "out_for_delivery"].includes(b.status)).length,
      pendingPickup: bookings.filter((b) => b.status === "approved" || b.status === "assigned").length,
      totalOrders,
      spent,
      spentLabel: spent >= 1000 ? `₱${(spent / 1000).toFixed(1)}K` : `₱${Math.round(spent).toLocaleString()}`,
      rate,
      thisMonth: bookings.filter((b) => {
        const t = new Date(b.created_at).getTime();
        const now = new Date();
        return t > now.getTime() - 31 * 86400000;
      }).length,
    };
  }, [bookings, payments, activeBookings.length]);

  const activeShow = useMemo(() => {
    const prioritized = [...activeBookings].sort((a, b) => {
      const rank = (s: Booking["status"]) =>
        ["out_for_delivery", "enroute", "loading", "assigned", "accepted", "approved", "pending_approval"].indexOf(
          s,
        );
      return rank(a.status) - rank(b.status);
    });
    return prioritized.slice(0, 4);
  }, [activeBookings]);

  const historyRows = useMemo(() => bookings.slice(0, 8), [bookings]);

  const txRows = useMemo(
    () =>
      payments
        .filter((p) => p.status === "paid")
        .slice(0, 5)
        .map((p) => ({
          id: p.id,
          when: formatShortDate(p.paid_at || p.created_at),
          amt: `₱${p.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
          state: "Paid" as const,
        })),
    [payments],
  );

  return (
    <main style={{ display: "grid", gap: "1.5rem", padding: "1.5rem 1.25rem 2.5rem", background: "#F3F4F6", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", width: "100%", display: "grid", gap: "1.5rem" }}>
        <section style={{ display: "grid", gap: "0.85rem" }}>
          <div>
            <p style={{ margin: 0, fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)", letterSpacing: "0.06em" }}>FleetOpt Analytics</p>
            <h1 style={{ margin: "0.15rem 0 0", fontSize: "1.35rem", fontWeight: 800 }}>Logistics Management System</h1>
          </div>
          <DashboardRoleTabs active="customer" />

          <div>
            <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800 }}>Customer portal</h2>
            <p style={{ margin: "0.35rem 0 0", color: "var(--text-secondary)", fontSize: "0.95rem" }}>
              Your bookings, shipments, and payments in one place.
            </p>
          </div>
        </section>

        {loading && <p style={{ color: "var(--text-secondary)" }}>Loading your data…</p>}
        {error && (
          <div role="alert" style={{ background: "var(--bg-error)", color: "var(--text-error)", padding: 12, borderRadius: 8 }}>
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            <section
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "1rem",
              }}
            >
              <KpiCard
                label="Active bookings"
                value={kpis.activeCount}
                delta={`${kpis.inTransit} in motion · ${kpis.pendingPickup} pre-dispatch`}
                tone="neutral"
              />
              <KpiCard label="Total orders" value={kpis.totalOrders} delta={`${kpis.thisMonth} in last ~31 days`} tone="neutral" />
              <KpiCard
                label="Total paid"
                value={kpis.totalOrders ? kpis.spentLabel : "—"}
                delta={payments.length ? `${payments.length} payment row(s)` : "No payments yet"}
                tone="neutral"
              />
              <KpiCard label="Fulfillment snapshot" value={`${kpis.rate}%`} delta="Completed vs all bookings" trend={kpis.rate >= 90 ? "up" : "flat"} tone={kpis.rate >= 90 ? "success" : "neutral"} />
            </section>

            <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: "1.5rem" }}>
              <div className="card" style={{ display: "grid", gap: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                  <h2 style={{ margin: 0 }}>Shipment tracking</h2>
                  <a href="/modules/operations/trips" style={{ color: "var(--brand-text-strong)", textDecoration: "none", fontSize: "0.9rem", fontWeight: 600 }}>
                    Trips overview
                  </a>
                </div>

                {activeShow.length === 0 ? (
                  <p style={{ margin: 0, color: "var(--text-secondary)" }}>No active bookings — create one from Quick booking.</p>
                ) : (
                  <div style={{ display: "grid", gap: "1rem" }}>
                    {activeShow.map((order) => {
                      const progress = bookingProgress(order.status);
                      const lbl = bookingLabel(order.status);
                      return (
                        <div
                          key={order.id}
                          style={{
                            border: "1px solid var(--border)",
                            borderRadius: "12px",
                            padding: "1rem",
                            display: "grid",
                            gap: "0.75rem",
                            background: "#FAFAFA",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "0.75rem", flexWrap: "wrap" }}>
                            <div>
                              <div style={{ fontWeight: "700", marginBottom: "0.25rem" }}>Booking #{order.id}</div>
                              <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Pickup {formatShortDate(`${order.scheduled_date}`)}</div>
                            </div>
                            <ShipmentBadge status={lbl} />
                          </div>
                          <div style={{ fontSize: "0.9rem", display: "grid", gap: "0.35rem" }}>
                            <div><span style={{ color: "var(--text-secondary)" }}>From:</span> {order.pickup_location}</div>
                            <div><span style={{ color: "var(--text-secondary)" }}>To:</span> {order.dropoff_location}</div>
                          </div>
                          <div style={{ display: "grid", gap: "0.35rem" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                              <span style={{ color: "var(--text-secondary)" }}>Progress</span>
                              <span style={{ fontWeight: "600" }}>{progress}%</span>
                            </div>
                            <div style={{ height: "6px", background: "rgba(255, 152, 0, 0.15)", borderRadius: "999px", overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${progress}%`, background: "var(--brand-text-strong)", transition: "width 0.3s ease" }} />
                            </div>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.88rem", flexWrap: "wrap", gap: "0.35rem" }}>
                            <span style={{ color: "var(--text-secondary)" }}>
                              Estimate <strong>₱{Number(order.estimated_cost).toLocaleString()}</strong>
                            </span>
                            <a href="/modules/customer/booking-history" style={{ color: "var(--brand-text-strong)", textDecoration: "none", fontWeight: 600 }}>
                              Details
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ display: "grid", gap: "1.25rem" }}>
                <div className="card" style={{ display: "grid", gap: "0.85rem" }}>
                  <h2 style={{ margin: 0 }}>Quick booking</h2>
                  <CustomerCtaPrimary href="/modules/customer/booking/trucks">+ New booking</CustomerCtaPrimary>
                  <CustomerCtaGhost href="/modules/customer/profile">Your profile</CustomerCtaGhost>
                  <CustomerCtaGhost href="/modules/customer/booking-history">Booking history</CustomerCtaGhost>
                  <div style={{ padding: "0.75rem", borderRadius: 10, border: "1px dashed var(--border)", fontSize: "0.85rem", background: "#fff" }}>
                    <strong>Reminder:</strong> Standard vs customized pricing is configured on checkout. Trucks and cargo details are editable before you pay.
                  </div>
                </div>

                <div className="card" style={{ display: "grid", gap: "1rem" }}>
                  <h2 style={{ margin: 0 }}>Account</h2>
                  <RowKv label="Member reference" value={`Customer ID (session)`} />
                  <RowKv label="Support" value={<a href="/modules/customer/support" style={{ color: "var(--brand-text-strong)", fontWeight: 600 }}>Contact support</a>} />
                  <CustomerCtaGhost href="/modules/customer/profile">View profile</CustomerCtaGhost>
                </div>

                <div className="card" style={{ display: "grid", gap: "0.75rem" }}>
                  <h2 style={{ margin: 0 }}>Recent payments</h2>
                  {txRows.length === 0 ? (
                    <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-secondary)" }}>No paid transactions yet.</p>
                  ) : (
                    txRows.map((tx) => (
                      <div key={tx.id} style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", fontSize: "0.88rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.55rem" }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{tx.amt}</div>
                          <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>{tx.when}</div>
                        </div>
                        <span style={{ fontWeight: 700, color: "var(--text-success)", fontSize: "0.8rem", alignSelf: "center" }}>{tx.state}</span>
                      </div>
                    ))
                  )}
                  <a href="/modules/customer/payment" style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--brand-text-strong)" }}>
                    Payments &amp; receipts
                  </a>
                </div>
              </div>
            </section>

            <section className="card" style={{ display: "grid", gap: "1rem", overflowX: "auto" }}>
              <h2 style={{ margin: 0 }}>Booking history</h2>
              {historyRows.length === 0 ? (
                <p style={{ margin: 0, color: "var(--text-secondary)" }}>No bookings yet — start with New booking.</p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520, fontSize: "0.88rem" }}>
                  <thead>
                    <tr style={{ background: "#F3F4F6", textAlign: "left" }}>
                      <th style={{ padding: "0.65rem", fontWeight: 700 }}>ID</th>
                      <th style={{ padding: "0.65rem", fontWeight: 700 }}>Date</th>
                      <th style={{ padding: "0.65rem", fontWeight: 700 }}>Route</th>
                      <th style={{ padding: "0.65rem", fontWeight: 700 }}>Service</th>
                      <th style={{ padding: "0.65rem", fontWeight: 700 }}>Amount</th>
                      <th style={{ padding: "0.65rem", fontWeight: 700 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyRows.map((row) => (
                      <tr key={row.id} style={{ borderBottom: "1px solid #eef2ff" }}>
                        <td style={{ padding: "0.65rem", fontWeight: 600 }}>#{row.id}</td>
                        <td style={{ padding: "0.65rem", color: "var(--text-secondary)" }}>{formatShortDate(row.created_at)}</td>
                        <td style={{ padding: "0.65rem" }}>
                          {(row.pickup_location || "").slice(0, 24)}
                          {row.pickup_location && row.pickup_location.length > 24 ? "…" : ""} → {(row.dropoff_location || "").slice(0, 24)}
                          {row.dropoff_location && row.dropoff_location.length > 24 ? "…" : ""}
                        </td>
                        <td style={{ padding: "0.65rem", color: "var(--text-secondary)", textTransform: "capitalize" }}>{row.service_type}</td>
                        <td style={{ padding: "0.65rem" }}>₱{Number(row.estimated_cost).toLocaleString()}</td>
                        <td style={{ padding: "0.65rem" }}>
                          <ShipmentBadgeTiny label={bookingLabel(row.status)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

const badgeBase: CSSProperties = {
  padding: "0.3rem 0.65rem",
  borderRadius: 6,
  fontSize: "0.78rem",
  fontWeight: 700,
  whiteSpace: "nowrap",
};

function ShipmentBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s.includes("transit") || s.includes("route") || s.includes("delivery") || s.includes("en route")) return <span style={{ ...badgeBase, background: "rgba(37,99,235,0.12)", color: "#1d4ed8" }}>{status}</span>;
  if (s.includes("deliver") || s.includes("complet")) return <span style={{ ...badgeBase, background: "rgba(5,150,105,0.12)", color: "#047857" }}>{status}</span>;
  if (s.includes("pending") || s.includes("approv")) return <span style={{ ...badgeBase, background: "rgba(251,191,36,0.35)", color: "#92400e" }}>{status}</span>;
  return <span style={{ ...badgeBase, background: "#F3F4F6", color: "#475569" }}>{status}</span>;
}

function ShipmentBadgeTiny({ label }: { label: string }) {
  return <ShipmentBadge status={label} />;
}

function RowKv({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", alignItems: "center" }}>
      <span style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span style={{ fontWeight: 600, textAlign: "right", fontSize: "0.9rem" }}>{value}</span>
    </div>
  );
}

function CustomerCtaPrimary({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      style={{
        padding: "0.85rem",
        borderRadius: 10,
        textAlign: "center",
        fontWeight: 700,
        textDecoration: "none",
        background: "linear-gradient(135deg, #F57C00, #FF9800)",
        color: "#fff",
      }}
    >
      {children}
    </a>
  );
}

function CustomerCtaGhost({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      style={{
        padding: "0.65rem",
        borderRadius: 8,
        textAlign: "center",
        border: "1px solid var(--border)",
        fontWeight: 600,
        textDecoration: "none",
        color: "var(--brand-text-strong)",
        background: "#fff",
      }}
    >
      {children}
    </a>
  );
}
