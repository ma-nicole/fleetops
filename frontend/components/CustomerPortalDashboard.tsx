"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import CustomerBookingAssignmentsList from "@/components/CustomerBookingAssignmentsList";
import KpiCard from "@/components/KpiCard";
import SectionJumpLink from "@/components/ui/SectionJumpLink";
import AsyncDataView from "@/components/ui/AsyncDataView";
import { EMPTY_BOOKINGS, EMPTY_SHIPMENTS, ERROR_LOAD_DATA } from "@/lib/loadingMessages";
import { APP_LOCALE, APP_TIMEZONE, formatNumber, formatPhpWhole } from "@/lib/appLocale";
import {
  MIN_BOOKING_SITES,
  addCustomerSite,
  loadCustomerSites,
  removeCustomerSite,
  subscribeSitesChanged,
  type CustomerSite,
} from "@/lib/customerSites";
import { WorkflowApi, type CustomerBookingRow, type Payment } from "@/lib/workflowApi";
import { useHashScrollWhenReady } from "@/lib/useHashScrollWhenReady";


function formatShortDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(APP_LOCALE, {
      timeZone: APP_TIMEZONE,
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function CustomerPortalDashboard() {
  const [activeShipments, setActiveShipments] = useState<CustomerBookingRow[]>([]);
  const [historyCount, setHistoryCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sites, setSites] = useState<CustomerSite[]>([]);
  const [newSiteLabel, setNewSiteLabel] = useState("");
  const [newSiteStreet, setNewSiteStreet] = useState("");
  const [newSiteBrgy, setNewSiteBrgy] = useState("");
  const [newSiteCity, setNewSiteCity] = useState("");
  const [newSiteProvince, setNewSiteProvince] = useState("");
  const [newSitePostal, setNewSitePostal] = useState("");
  const [siteFormError, setSiteFormError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [shipRes, hist, p] = await Promise.all([
          WorkflowApi.customerShipmentTracking(),
          WorkflowApi.customerBookingHistory(),
          WorkflowApi.listPayments(),
        ]);
        if (!cancelled) {
          setActiveShipments(shipRes.shipments);
          setHistoryCount(hist.length);
          setCompletedCount(hist.filter((x) => x.display_status === "completed").length);
          setPayments(p);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : ERROR_LOAD_DATA);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      loadCustomerSites()
        .then((list) => {
          if (!cancelled) setSites(list);
        })
        .catch((e) => {
          console.error(e);
        });
    };
    refresh();
    return subscribeSitesChanged(refresh);
  }, []);

  const kpis = useMemo(() => {
    const totalOrders = activeShipments.length + historyCount;
    const paid = payments.filter((p) => p.status === "verified");
    const spent = paid.reduce((s, p) => s + p.amount, 0);
    const done = completedCount;
    const rate = totalOrders ? Math.round((done / totalOrders) * 1000) / 10 : 0;
    const inTransit = activeShipments.filter((b) =>
      ["en_route", "out_for_delivery", "picked_up", "dropped_off", "for_pickup"].includes(b.display_status),
    ).length;
    const pendingPickup = activeShipments.filter((b) =>
      ["assigned", "approved", "payment_verified", "ready_for_assignment", "for_pickup"].includes(b.display_status),
    ).length;
    return {
      activeCount: activeShipments.length,
      inTransit,
      pendingPickup,
      totalOrders,
      spent,
      spentLabel: spent >= 1000 ? `₱${formatNumber(spent / 1000, { maximumFractionDigits: 1 })}K` : formatPhpWhole(Math.round(spent)),
      rate,
      thisMonth: activeShipments.filter((b) => {
        const t = new Date(b.created_at).getTime();
        const now = new Date();
        return t > now.getTime() - 31 * 86400000;
      }).length,
    };
  }, [activeShipments.length, historyCount, completedCount, payments]);

  const activeShow = useMemo(() => {
    const prioritized = [...activeShipments].sort((a, b) => {
      const rank = (s: string) =>
        [
          "dropped_off",
          "en_route",
          "out_for_delivery",
          "picked_up",
          "for_pickup",
          "assigned",
          "approved",
          "payment_verified",
          "ready_for_assignment",
          "payment_verification",
          "pending_payment",
        ].indexOf(s);
      return rank(a.display_status) - rank(b.display_status);
    });
    return prioritized.slice(0, 4);
  }, [activeShipments]);

  const txRows = useMemo(
    () =>
      payments
        .filter((p) => p.status === "verified")
        .slice(0, 5)
        .map((p) => ({
          id: p.id,
          when: formatShortDate(p.paid_at || p.created_at),
          amt: formatPhpWhole(p.amount),
          state: "Paid" as const,
        })),
    [payments],
  );

  useHashScrollWhenReady(!loading && !error);

  return (
    <main className="dashboard-standard-main">
      <div className="dashboard-standard-inner" style={{ maxWidth: 1280 }}>
        <AsyncDataView
          loading={loading}
          error={error}
          loadingLabel="Loading your data…"
          variant="dashboard"
          onRetry={() => window.location.reload()}
        >
        {!loading && !error && (
          <>
            <nav className="tab-pills" aria-label="Jump to portal section">
              <SectionJumpLink targetId="customer-kpis">Overview</SectionJumpLink>
              <SectionJumpLink targetId="customer-tracking">Tracking</SectionJumpLink>
              <SectionJumpLink targetId="customer-sites">Sites</SectionJumpLink>
              <SectionJumpLink targetId="customer-bookings">Bookings</SectionJumpLink>
            </nav>

            <section
              id="customer-kpis"
              className="scroll-section"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "1rem",
              }}
            >
              <KpiCard label="Active bookings" value={kpis.activeCount} delta={`${kpis.inTransit} in motion · ${kpis.pendingPickup} pre-dispatch`} tone="neutral" scrollTargetId="customer-tracking" />
              <KpiCard label="Total orders" value={kpis.totalOrders} delta={`${kpis.thisMonth} in last ~31 days`} tone="neutral" />
              <KpiCard
                label="Total paid"
                value={kpis.totalOrders ? kpis.spentLabel : "—"}
                delta={payments.length ? `${payments.length} payment row(s)` : "No payments yet"}
                tone="neutral"
              />
              <KpiCard label="Fulfillment snapshot" value={`${kpis.rate}%`} delta="Completed vs all bookings" trend={kpis.rate >= 90 ? "up" : "flat"} tone={kpis.rate >= 90 ? "success" : "neutral"} />
            </section>

            <section className="dashboard-standard-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))" }}>
              <div id="customer-tracking" className="card scroll-section" style={{ display: "grid", gap: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                  <h2 style={{ margin: 0 }}>Shipment tracking</h2>
                  <a href="/modules/operations/trips" style={{ color: "var(--brand-text-strong)", textDecoration: "none", fontSize: "0.9rem", fontWeight: 600 }}>
                    Trips overview
                  </a>
                </div>

                {activeShow.length === 0 ? (
                  <p style={{ margin: 0, color: "var(--text-secondary)" }} role="status">
                    {EMPTY_SHIPMENTS}
                  </p>
                ) : (
                  <div style={{ display: "grid", gap: "1rem" }}>
                    {activeShow.map((order) => {
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
                            <ShipmentBadge status="On going" />
                          </div>
                          <div style={{ fontSize: "0.9rem", display: "grid", gap: "0.35rem" }}>
                            <div><span style={{ color: "var(--text-secondary)" }}>From:</span> {order.pickup_location}</div>
                            <div><span style={{ color: "var(--text-secondary)" }}>To:</span> {order.dropoff_location}</div>
                            <div style={{ marginTop: "0.25rem" }}>
                              <CustomerBookingAssignmentsList assignments={order.assignments} dropoffAddress={order.dropoff_location} />
                            </div>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.88rem", flexWrap: "wrap", gap: "0.35rem" }}>
                            <span style={{ color: "var(--text-secondary)" }}>
                              Payment total <strong>{formatPhpWhole(Number(order.estimated_cost))}</strong>
                            </span>
                            <Link href="/modules/customer/booking-history" style={{ color: "var(--brand-text-strong)", textDecoration: "none", fontWeight: 600 }}>
                              Details
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ display: "grid", gap: "1.25rem" }}>
                <div className="card" style={{ display: "grid", gap: "0.85rem" }}>
                  <h2 style={{ margin: 0 }}>Sites</h2>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                    Use separate fields: street, district or village, city or municipality, province, and zip code —
                    the full line is built automatically for bookings and pricing. You need at least {MIN_BOOKING_SITES} sites
                    before you can book.
                  </p>
                  <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700 }}>
                    {sites.length} saved · minimum {MIN_BOOKING_SITES} to book
                  </p>
                  {sites.length === 0 ? (
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>No sites yet — add your first address below.</p>
                  ) : (
                    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.5rem" }}>
                      {sites.map((s) => (
                        <li
                          key={s.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "0.5rem",
                            alignItems: "start",
                            fontSize: "0.85rem",
                            padding: "0.5rem 0",
                            borderBottom: "1px solid var(--border)",
                          }}
                        >
                          <span>
                            {s.label ? (
                              <>
                                <strong>{s.label}</strong>
                                <br />
                              </>
                            ) : null}
                            {s.street ? (
                              <span style={{ color: "var(--text-secondary)", lineHeight: 1.55, display: "block" }}>
                                <span>
                                  <strong>Street:</strong> {s.street}
                                </span>
                                <br />
                                <span>
                                  <strong>District / village:</strong> {s.barangay ?? "—"}
                                </span>
                                <br />
                                <span>
                                  <strong>City / municipality:</strong> {s.cityMunicipality ?? "—"}
                                </span>
                                <br />
                                <span>
                                  <strong>Province:</strong> {s.province ?? "—"} ·{" "}
                                  <strong>Zip:</strong> {s.postalCode ?? "—"}
                                </span>
                              </span>
                            ) : (
                              <span style={{ color: "var(--text-secondary)" }}>{s.address}</span>
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const summary =
                                s.label?.trim() ||
                                (s.street ? [s.street, s.cityMunicipality].filter(Boolean).join(", ") : s.address.trim()) ||
                                "this site";
                              const ok = window.confirm(
                                `Are you sure you want to delete this saved site?\n\n${summary}`,
                              );
                              if (!ok) return;
                              void removeCustomerSite(s.id).catch(() => undefined);
                            }}
                            style={{
                              border: "1px solid var(--border)",
                              background: "#fff",
                              borderRadius: 6,
                              fontSize: "0.72rem",
                              fontWeight: 600,
                              cursor: "pointer",
                              padding: "0.25rem 0.45rem",
                              color: "#b91c1c",
                              flexShrink: 0,
                            }}
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div style={{ display: "grid", gap: "0.45rem" }}>
                    <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                      Site name (optional)
                    </label>
                    <input
                      className="input"
                      value={newSiteLabel}
                      onChange={(e) => {
                        setNewSiteLabel(e.target.value);
                        if (siteFormError) setSiteFormError(null);
                      }}
                      placeholder="e.g. Main warehouse"
                    />

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                        gap: "0.45rem",
                      }}
                    >
                      <label style={{ display: "grid", gap: "0.25rem", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)", marginTop: "0.2rem", gridColumn: "1 / -1" }}>
                        Street
                        <input
                          className="input"
                          value={newSiteStreet}
                          onChange={(e) => {
                            setNewSiteStreet(e.target.value);
                            if (siteFormError) setSiteFormError(null);
                          }}
                          placeholder="Building / house no., street name"
                          autoComplete="street-address"
                        />
                      </label>
                      <label style={{ display: "grid", gap: "0.25rem", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                        District / village
                        <input
                          className="input"
                          value={newSiteBrgy}
                          onChange={(e) => {
                            setNewSiteBrgy(e.target.value);
                            if (siteFormError) setSiteFormError(null);
                          }}
                          placeholder="e.g. Bagong Nayon"
                        />
                      </label>
                      <label style={{ display: "grid", gap: "0.25rem", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                        City / municipality
                        <input
                          className="input"
                          value={newSiteCity}
                          onChange={(e) => {
                            setNewSiteCity(e.target.value);
                            if (siteFormError) setSiteFormError(null);
                          }}
                          placeholder="e.g. Rodriguez"
                        />
                      </label>
                      <label style={{ display: "grid", gap: "0.25rem", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                        Province
                        <input
                          className="input"
                          value={newSiteProvince}
                          onChange={(e) => {
                            setNewSiteProvince(e.target.value);
                            if (siteFormError) setSiteFormError(null);
                          }}
                          placeholder="e.g. Rizal"
                        />
                      </label>
                      <label style={{ display: "grid", gap: "0.25rem", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                        Zip code
                        <input
                          className="input"
                          value={newSitePostal}
                          onChange={(e) => {
                            setNewSitePostal(e.target.value);
                            if (siteFormError) setSiteFormError(null);
                          }}
                          placeholder="e.g. 1860"
                          inputMode="numeric"
                          autoComplete="postal-code"
                        />
                      </label>
                    </div>
                    {siteFormError && (
                      <p role="alert" style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-error, #DC2626)" }}>
                        {siteFormError}
                      </p>
                    )}
                    <button
                      type="button"
                      className="button"
                      style={{ marginTop: "0.25rem" }}
                      onClick={() => {
                        void (async () => {
                          const res = await addCustomerSite(
                            {
                              street: newSiteStreet,
                              barangay: newSiteBrgy,
                              cityMunicipality: newSiteCity,
                              province: newSiteProvince,
                              postalCode: newSitePostal,
                            },
                            newSiteLabel,
                          );
                          if (!res.ok) {
                            setSiteFormError(res.message);
                            return;
                          }
                          setNewSiteStreet("");
                          setNewSiteBrgy("");
                          setNewSiteCity("");
                          setNewSiteProvince("");
                          setNewSitePostal("");
                          setNewSiteLabel("");
                          setSiteFormError(null);
                        })();
                      }}
                    >
                      Add site
                    </button>
                  </div>
                  <div id="customer-bookings" className="scroll-section">
                  {sites.length >= MIN_BOOKING_SITES ? (
                      <CustomerCtaPrimary href="/booking">+ New booking</CustomerCtaPrimary>
                  ) : (
                    <div
                      style={{
                        padding: "0.85rem",
                        borderRadius: 10,
                        textAlign: "center",
                        fontWeight: 700,
                        background: "#E5E7EB",
                        color: "#6B7280",
                        fontSize: "0.9rem",
                      }}
                    >
                      Add {MIN_BOOKING_SITES - sites.length} more site{MIN_BOOKING_SITES - sites.length === 1 ? "" : "s"} to enable booking
                    </div>
                  )}
                  </div>
                </div>

                <div className="card" style={{ display: "grid", gap: "1rem" }}>
                  <h2 style={{ margin: 0 }}>Account</h2>
                  <RowKv label="Member reference" value={`Customer ID (session)`} />
                  <RowKv
                    label="Feedback"
                    value={
                      <Link href="/modules/customer/support" style={{ color: "var(--brand-text-strong)", fontWeight: 600 }}>
                        Send feedback
                      </Link>
                    }
                  />
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
                  <Link href="/modules/customer/payment" style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--brand-text-strong)" }}>
                    Payments &amp; receipts
                  </Link>
                </div>
              </div>
            </section>
          </>
        )}
        </AsyncDataView>
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
  if (s === "on going" || s === "ongoing")
    return <span style={{ ...badgeBase, background: "rgba(37,99,235,0.12)", color: "var(--brand-text-strong)" }}>{status}</span>;
  if (s.includes("transit") || s.includes("route") || s.includes("delivery") || s.includes("en route")) return <span style={{ ...badgeBase, background: "rgba(37,99,235,0.12)", color: "var(--brand-text-strong)" }}>{status}</span>;
  if (s.includes("deliver") || s.includes("complet")) return <span style={{ ...badgeBase, background: "rgba(5,150,105,0.12)", color: "#047857" }}>{status}</span>;
  if (s.includes("pending") || s.includes("approv")) return <span style={{ ...badgeBase, background: "rgba(251,191,36,0.35)", color: "#92400e" }}>{status}</span>;
  return <span style={{ ...badgeBase, background: "#F3F4F6", color: "#475569" }}>{status}</span>;
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
    <Link
      href={href}
      style={{
        padding: "0.85rem",
        borderRadius: 10,
        textAlign: "center",
        fontWeight: 700,
        textDecoration: "none",
        background: "linear-gradient(135deg, #F57C00, #FF9800)",
        color: "#fff",
        display: "block",
      }}
    >
      {children}
    </Link>
  );
}

function CustomerCtaGhost({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
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
        display: "block",
      }}
    >
      {children}
    </Link>
  );
}
