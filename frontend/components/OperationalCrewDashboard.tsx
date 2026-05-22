"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import DashboardRoleTabs from "@/components/DashboardRoleTabs";
import KpiCard from "@/components/KpiCard";
import { getEffectiveRole } from "@/lib/auth";
import { useRoleGuard } from "@/lib/useRoleGuard";
import { WorkflowApi, type DriverDashboardSummary, type Trip } from "@/lib/workflowApi";
import CrewSchedulingPlotPanel, { schedulingPlotFromTrip } from "@/components/CrewSchedulingPlotPanel";
import DriverTripNotificationsPanel from "@/components/DriverTripNotificationsPanel";
import { formatDateTime, formatPhp, formatPhpWhole } from "@/lib/appLocale";
import { announce } from "@/lib/useAnnouncer";
import { ApiError } from "@/lib/api";

export type CrewRole = "driver" | "helper";

const card: React.CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: "1.25rem",
  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
};

const tableBase: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "0.82rem",
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "0.6rem 0.5rem",
  fontWeight: 700,
  color: "#475569",
  borderBottom: "1px solid var(--border)",
  background: "#F8FAFC",
  whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  padding: "0.55rem 0.5rem",
  borderBottom: "1px solid #F1F5F9",
  verticalAlign: "top",
  lineHeight: 1.4,
};

const ACTIVE_OPERATIONAL = new Set(["assigned", "for_pickup", "picked_up", "en_route", "dropped_off"]);

function shorten(s: string | null | undefined, max: number): string {
  const t = (s || "").trim();
  if (!t) return "—";
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

function formatRouteLabel(t: Trip): string {
  const bk = t.booking;
  const fromBooking =
    bk && ((bk.pickup_location || "").trim() || (bk.dropoff_location || "").trim())
      ? `${shorten(bk.pickup_location, 72)} → ${shorten(bk.dropoff_location, 72)}`
      : "";
  const raw = (t.route_path || "").trim();
  if (raw.startsWith("[")) {
    try {
      const arr = JSON.parse(raw) as unknown;
      if (Array.isArray(arr)) {
        const strs = arr
          .filter((x): x is string => typeof x === "string")
          .map((x) => x.trim())
          .filter(Boolean);
        if (strs.length >= 2) return `${shorten(strs[0], 72)} → ${shorten(strs[1], 72)}`;
        if (strs.length === 1) return shorten(strs[0], 140);
      }
    } catch {
      /* ignore */
    }
  }
  if (raw) return shorten(raw, 140);
  return fromBooking || `Booking #${t.booking_id}`;
}

function operationalSlug(t: Trip): string {
  return (t.operational_status || t.helper_progress_status || t.status || "").toLowerCase();
}

function tripStatusLc(t: Trip): string {
  return String(t.status || "").toLowerCase();
}

function isCompletedTrip(t: Trip): boolean {
  return tripStatusLc(t) === "completed";
}

function isCancelledTrip(t: Trip): boolean {
  return tripStatusLc(t) === "cancelled";
}

function isActiveOperationalTrip(t: Trip): boolean {
  if (isCancelledTrip(t) || isCompletedTrip(t)) return false;
  const op = operationalSlug(t);
  return ACTIVE_OPERATIONAL.has(op);
}

/** Status for display: operational slug from API, else trip.status (DB). */
function statusSlugForRow(t: Trip): string {
  const op = (t.operational_status || "").trim().toLowerCase();
  if (op) return op;
  const st = String(t.status || "").trim().toLowerCase();
  return st || "—";
}

const viewBtnStyle: React.CSSProperties = {
  padding: "0.35rem 0.6rem",
  borderRadius: 6,
  border: "1px solid #FF9800",
  background: "#fff",
  color: "#C2410C",
  fontWeight: 600,
  fontSize: "0.75rem",
  cursor: "pointer",
};

export default function OperationalCrewDashboard() {
  useRoleGuard(["driver", "helper"]);

  const [crewRole, setCrewRole] = useState<CrewRole>("driver");

  useEffect(() => {
    const r = getEffectiveRole();
    setCrewRole(r === "helper" ? "helper" : "driver");
  }, []);

  const [trips, setTrips] = useState<Trip[]>([]);
  const [summary, setSummary] = useState<DriverDashboardSummary | null>(null);
  const [detailTrip, setDetailTrip] = useState<Trip | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkInBusy, setCheckInBusy] = useState(false);
  const [checkOutBusy, setCheckOutBusy] = useState(false);
  const [checkInOk, setCheckInOk] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [t, d] = await Promise.all([WorkflowApi.myTrips(), WorkflowApi.driverDashboardSummary().catch(() => null)]);
      setTrips(t);
      setSummary(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const checkIn = async () => {
    setError(null);
    setCheckInOk(null);
    setCheckInBusy(true);
    try {
      await WorkflowApi.driverCheckIn();
      await refresh();
      const msg = "Check-in recorded for this shift.";
      setCheckInOk(msg);
      announce(msg, "polite");
      window.setTimeout(() => setCheckInOk(null), 6000);
    } catch (err) {
      let msg = "Check-in could not be recorded.";
      if (err instanceof ApiError) {
        try {
          const parsed = JSON.parse(err.body) as { detail?: unknown };
          const d = parsed.detail;
          if (typeof d === "string") msg = d;
        } catch {
          if (err.body) msg = err.body.slice(0, 240);
        }
      } else if (err instanceof Error) msg = err.message;
      setError(msg);
      announce(msg, "assertive");
    } finally {
      setCheckInBusy(false);
    }
  };

  const checkOut = async () => {
    setError(null);
    setCheckInOk(null);
    setCheckOutBusy(true);
    try {
      await WorkflowApi.driverCheckOut();
      await refresh();
      const msg = "Check-out recorded.";
      setCheckInOk(msg);
      announce(msg, "polite");
      window.setTimeout(() => setCheckInOk(null), 6000);
    } catch (err) {
      let msg = "Check-out could not be recorded.";
      if (err instanceof ApiError) {
        try {
          const parsed = JSON.parse(err.body) as { detail?: unknown };
          const d = parsed.detail;
          if (typeof d === "string") msg = d;
        } catch {
          if (err.body) msg = err.body.slice(0, 240);
        }
      } else if (err instanceof Error) msg = err.message;
      setError(msg);
      announce(msg, "assertive");
    } finally {
      setCheckOutBusy(false);
    }
  };

  const activeTrips = trips
    .filter(isActiveOperationalTrip)
    .sort((a, b) => {
      const ta = a.assigned_at ? new Date(a.assigned_at).getTime() : 0;
      const tb = b.assigned_at ? new Date(b.assigned_at).getTime() : 0;
      return tb - ta;
    });
  const primary = activeTrips[0];
  const truckForVehicle = primary?.truck ?? activeTrips.find((x) => x.truck)?.truck ?? null;

  const historyCompleted = trips
    .filter(isCompletedTrip)
    .sort((a, b) => {
      const da = a.completed_at ? new Date(a.completed_at).getTime() : 0;
      const db = b.completed_at ? new Date(b.completed_at).getTime() : 0;
      return db - da;
    })
    .slice(0, 20);

  const attendance = summary?.attendance;
  const openShift = !!attendance?.has_open_shift;
  const a = summary?.assignments_today;
  const dkm = summary?.distance_loaded_km;
  const prof = summary?.driver_profile;
  const hprof = summary?.helper_profile;

  const earningsDelta =
    crewRole === "driver" && prof
      ? `Trip labor (completed legs) · Profile net ${formatPhpWhole(prof.net_salary_php)} / period`
      : crewRole === "helper" && hprof
        ? `Trip labor (completed legs) · Profile base ${formatPhpWhole(hprof.base_salary_php)}`
        : "Trip labor (sum of trips.labor_cost for completed legs)";

  const scheduledHref = crewRole === "helper" ? "/helper/bookings" : "/driver/scheduled-trips";
  const scheduledLabel = "Scheduled trips & bookings";

  const tabActive = crewRole === "helper" ? ("helper" as const) : ("driver" as const);

  return (
    <main style={{ padding: "1.5rem 1.25rem 2.5rem", background: "#F3F4F6", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gap: "1.25rem" }}>
        <header style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start" }}>
          <div>
            <p style={{ margin: 0, fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)", letterSpacing: "0.06em" }}>
              FleetOpt Operations
            </p>
            <h1 style={{ margin: "0.15rem 0 0", fontSize: "1.35rem", fontWeight: 800 }}>Operations dashboard</h1>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
            {openShift ? (
              <>
                <span
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    color: "#166534",
                    padding: "0.45rem 0.75rem",
                    borderRadius: 8,
                    background: "rgba(34,197,94,0.15)",
                    border: "1px solid rgba(34,197,94,0.35)",
                  }}
                >
                  Checked in
                  {attendance?.check_in_at ? ` · ${formatDateTime(attendance.check_in_at)}` : ""}
                </span>
                <button
                  type="button"
                  className="button"
                  onClick={() => void checkOut()}
                  disabled={checkOutBusy}
                  aria-busy={checkOutBusy}
                  style={{ background: "#E5E7EB", color: "var(--text)" }}
                >
                  {checkOutBusy ? "Checking out…" : "Check out"}
                </button>
              </>
            ) : (
              <button type="button" className="button" onClick={() => void checkIn()} disabled={checkInBusy} aria-busy={checkInBusy}>
                {checkInBusy ? "Check-in…" : "Check in for shift"}
              </button>
            )}
          </div>
        </header>

        {checkInOk ? (
          <div
            role="status"
            style={{
              padding: "0.75rem 1rem",
              borderRadius: 8,
              background: "var(--bg-success)",
              color: "var(--text-success)",
              fontWeight: 600,
              fontSize: "0.9rem",
            }}
          >
            {checkInOk}
          </div>
        ) : null}

        <DashboardRoleTabs active={tabActive} />

        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "1rem", alignItems: "baseline" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800 }}>Trip overview</h2>
            <p style={{ margin: "0.35rem 0 0", color: "var(--text-secondary)", fontSize: "0.92rem", maxWidth: "42rem", lineHeight: 1.5 }}>
              Live data for your assigned trips. Status and latest location follow fleet rules from trip records. Use
              Refresh for the latest view.
            </p>
          </div>
          <button type="button" className="button" style={{ background: "#E5E7EB", color: "var(--text)" }} onClick={() => void refresh()} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {error ? (
          <div role="alert" style={{ background: "var(--bg-error)", color: "var(--text-error)", padding: 12, borderRadius: 8 }}>
            {error}
          </div>
        ) : null}

        {crewRole === "driver" ? (
          <DriverTripNotificationsPanel scheduleHref="/driver/scheduled-trips" onRefresh={() => void refresh()} />
        ) : null}

        {summary ? (
          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
            <KpiCard label="Today’s assignments" value={a?.total_assigned_today ?? 0} delta="Legs assigned today (UTC)" tone="neutral" />
            <KpiCard label="Active trips" value={a?.active_trips ?? 0} delta="Assigned through dropped off (not completed/cancelled)" tone="neutral" />
            <KpiCard label="Completed trips" value={a?.completed_legs_total ?? 0} delta={`${a?.completed_today ?? 0} finished today`} tone="neutral" />
            {crewRole === "driver" ? (
              <>
                <KpiCard
                  label="Total distance"
                  value={`${(dkm?.total_km ?? 0).toFixed(1)} km`}
                  delta={dkm?.trip_count ? `Avg ${(dkm?.average_km ?? 0).toFixed(1)} km · ${dkm.trip_count} legs` : "No qualifying legs"}
                  tone="neutral"
                />
                <KpiCard label="Trip labor (completed)" value={formatPhpWhole(summary.trip_labor_completed_php ?? 0)} delta={earningsDelta} tone="neutral" />
              </>
            ) : null}
          </section>
        ) : loading ? (
          <p style={{ margin: 0, color: "var(--text-secondary)" }}>Loading summary…</p>
        ) : (
          <p style={{ margin: 0, color: "var(--text-secondary)" }}>Could not load summary. Use Refresh.</p>
        )}

        {crewRole === "driver" && truckForVehicle ? (
          <article style={{ ...card }}>
            <h3 style={{ margin: "0 0 0.75rem", fontSize: "1.02rem", fontWeight: 800 }}>Assigned vehicle</h3>
            <div style={{ display: "grid", gap: "0.35rem", fontSize: "0.9rem", color: "#334155" }}>
              <div>
                <strong>Plate:</strong> {truckForVehicle.code}
              </div>
              {truckForVehicle.model_name ? (
                <div>
                  <strong>Model:</strong> {truckForVehicle.model_name}
                </div>
              ) : null}
              <div>
                <strong>Capacity:</strong> {truckForVehicle.capacity_tons} t
              </div>
              <div>
                <strong>Fleet status:</strong> {(truckForVehicle.status || "—").replace(/_/g, " ")}
                {truckForVehicle.availability_status ? ` · ${truckForVehicle.availability_status.replace(/_/g, " ")}` : ""}
              </div>
              {primary ? (
                <div>
                  <strong>Linked trip:</strong> TRP-{primary.id} · Booking #{primary.booking_id}
                </div>
              ) : null}
            </div>
            <p style={{ margin: "0.75rem 0 0", fontSize: "0.82rem", color: "#64748B" }}>
              {crewRole === "driver" ? (
                <>
                  <Link href="/driver/vehicle-status" style={{ color: "#EA580C", fontWeight: 600 }}>
                    Report a vehicle issue
                  </Link>{" "}
                  tied to this trip when something is wrong with the truck.
                </>
              ) : (
                <>Truck issues are reported by the assigned driver for this leg.</>
              )}
            </p>
          </article>
        ) : crewRole === "driver" ? (
          <article style={{ ...card }}>
            <h3 style={{ margin: "0 0 0.35rem", fontSize: "1.02rem", fontWeight: 800 }}>Assigned vehicle</h3>
            <p style={{ margin: 0, fontSize: "0.9rem", color: "#64748B" }}>No assigned vehicle on your active trips right now.</p>
          </article>
        ) : null}

        <article style={{ ...card }}>
          <h3 style={{ margin: "0 0 0.75rem", fontSize: "1.05rem", fontWeight: 800 }}>Current active trip</h3>
          {!primary ? (
            <p style={{ margin: 0, color: "#64748B", fontSize: "0.95rem" }}>No active trip assigned right now.</p>
          ) : (
            <div style={{ display: "grid", gap: "0.45rem", fontSize: "0.9rem", color: "#1e293b" }}>
              {crewRole === "driver" ? (
                <div>
                  <strong>Trip ID:</strong> {primary.id} · <strong>Booking ID:</strong> {primary.booking_id}
                </div>
              ) : (
                <div>
                  <strong>Booking ID:</strong> {primary.booking_id}
                </div>
              )}
              {primary.booking ? (
                <>
                  {crewRole === "driver" ? (
                    <>
                      <div>
                        <strong>Customer:</strong> {primary.booking.customer_name ?? "—"}
                      </div>
                      <div>
                        <strong>Company:</strong> {primary.booking.customer_company_name ?? "—"}
                      </div>
                    </>
                  ) : null}
                  <div>
                    <strong>Pickup:</strong> {primary.booking.pickup_location}
                  </div>
                  <div>
                    <strong>Dropoff:</strong> {primary.booking.dropoff_location}
                  </div>
                  <div>
                    <strong>Schedule:</strong> {primary.booking.scheduled_date} {primary.booking.scheduled_time_slot}
                  </div>
                  <div>
                    <strong>Cargo:</strong> {primary.booking.cargo_weight_tons} t
                    {primary.booking.cargo_description ? ` — ${primary.booking.cargo_description}` : ""}
                  </div>
                  {crewRole === "driver" ? (
                    <div>
                      <strong>Quoted:</strong> {formatPhp(Number(primary.booking.estimated_cost || 0))}
                      {primary.booking.paid_amount_verified != null ? (
                        <>
                          {" "}
                          · <strong>Paid (verified):</strong> {formatPhp(Number(primary.booking.paid_amount_verified))}
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : null}
              {crewRole === "driver" ? (
                <div>
                  <strong>Truck / plate:</strong>{" "}
                  {primary.truck ? `${primary.truck.code}${primary.truck.model_name ? ` · ${primary.truck.model_name}` : ""}` : "—"}
                </div>
              ) : null}
              <div>
                <strong>Driver:</strong> {primary.driver_name ?? "—"}
              </div>
              {crewRole === "driver" ? (
                <div>
                  <strong>Helper:</strong> {primary.helper_name ?? "—"}
                </div>
              ) : null}
              <div>
                <strong>Current status:</strong> {statusSlugForRow(primary)}
              </div>
              <div>
                <strong>Latest location:</strong> {primary.latest_location ?? "—"}
              </div>
              <div style={{ marginTop: "0.35rem", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                <Link
                  href={`/trips/${primary.id}/track`}
                  className="button"
                  style={{
                    background: "#fff",
                    color: "var(--text)",
                    border: "1px solid var(--border)",
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "0.45rem 0.85rem",
                    borderRadius: 8,
                    fontWeight: 600,
                  }}
                >
                  Track trip
                </Link>
                {crewRole === "helper" ? (
                  <Link
                    href="/helper/bookings"
                    className="button"
                    style={{
                      background: "#FF9800",
                      color: "#fff",
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "0.45rem 0.85rem",
                      borderRadius: 8,
                      fontWeight: 600,
                    }}
                  >
                    Update status &amp; location
                  </Link>
                ) : (
                  <Link
                    href="/driver/general-form"
                    className="button"
                    style={{
                      background: "#FF9800",
                      color: "#fff",
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "0.45rem 0.85rem",
                      borderRadius: 8,
                      fontWeight: 600,
                    }}
                  >
                    Forms &amp; reports
                  </Link>
                )}
              </div>
            </div>
          )}
        </article>

        <article style={{ ...card }}>
          <h3 style={{ margin: "0 0 0.75rem", fontSize: "1.05rem", fontWeight: 800 }}>Assigned trips (not completed)</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ ...tableBase, minWidth: crewRole === "helper" ? 760 : 1040 }}>
              <thead>
                <tr>
                  {crewRole === "driver" ? <th style={th}>Trip ID</th> : null}
                  <th style={th}>Booking ID</th>
                  <th style={th}>Pickup</th>
                  <th style={th}>Dropoff</th>
                  <th style={th}>Schedule</th>
                  <th style={{ ...th, textAlign: "right" }}>Cargo (t)</th>
                  {crewRole === "driver" ? <th style={th}>Truck</th> : null}
                  <th style={th}>Driver</th>
                  {crewRole === "driver" ? <th style={th}>Helper</th> : null}
                  <th style={th}>Status</th>
                  {crewRole === "driver" ? <th style={th}>Latest location</th> : null}
                  <th style={{ ...th, textAlign: "center" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {activeTrips.length === 0 ? (
                  <tr>
                    <td colSpan={crewRole === "helper" ? 8 : 12} style={{ ...td, color: "#64748B" }}>
                      No active assigned trips.
                    </td>
                  </tr>
                ) : (
                  activeTrips.map((t) => (
                    <tr key={t.id}>
                      {crewRole === "driver" ? <td style={{ ...td, fontWeight: 700 }}>{t.id}</td> : null}
                      <td style={{ ...td, fontWeight: crewRole === "helper" ? 700 : undefined }}>{t.booking_id}</td>
                      <td style={td} title={t.booking?.pickup_location}>
                        {shorten(t.booking?.pickup_location, 48)}
                      </td>
                      <td style={td} title={t.booking?.dropoff_location}>
                        {shorten(t.booking?.dropoff_location, 48)}
                      </td>
                      <td style={td}>
                        {t.booking ? (
                          <>
                            {t.booking.scheduled_date}
                            <br />
                            {t.booking.scheduled_time_slot}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td style={{ ...td, textAlign: "right" }}>{t.booking ? t.booking.cargo_weight_tons : "—"}</td>
                      {crewRole === "driver" ? <td style={td}>{t.truck?.code ?? "—"}</td> : null}
                      <td style={td}>{t.driver_name ?? "—"}</td>
                      {crewRole === "driver" ? <td style={td}>{t.helper_name ?? "—"}</td> : null}
                      <td style={td}>
                        <StatusPill ok={false} slug={statusSlugForRow(t)} />
                      </td>
                      {crewRole === "driver" ? (
                        <td style={td} title={t.latest_location || ""}>
                          {shorten(t.latest_location, 40)}
                        </td>
                      ) : null}
                      <td style={{ ...td, textAlign: "center" }}>
                        <button type="button" style={viewBtnStyle} onClick={() => setDetailTrip(t)}>
                          {crewRole === "helper" ? "Open" : "View details"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article style={{ ...card }}>
          <h3 style={{ margin: "0 0 0.75rem", fontSize: "1.05rem", fontWeight: 800 }}>Recent trip history (completed)</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ ...tableBase, minWidth: crewRole === "helper" ? 640 : 880 }}>
              <thead>
                <tr>
                  {crewRole === "driver" ? <th style={th}>Trip ID</th> : null}
                  <th style={th}>Booking ID</th>
                  <th style={th}>{crewRole === "helper" ? "Route" : "Route"}</th>
                  <th style={th}>Schedule</th>
                  {crewRole === "driver" ? (
                    <>
                      <th style={{ ...th, textAlign: "right" }}>Distance</th>
                      <th style={{ ...th, textAlign: "right" }}>Fuel cost</th>
                    </>
                  ) : null}
                  <th style={th}>Status</th>
                  <th style={th}>Completed</th>
                </tr>
              </thead>
              <tbody>
                {historyCompleted.length === 0 ? (
                  <tr>
                    <td colSpan={crewRole === "helper" ? 5 : 8} style={{ ...td, color: "#64748B" }}>
                      No completed trips yet.
                    </td>
                  </tr>
                ) : (
                  historyCompleted.map((t) => (
                    <tr key={t.id}>
                      {crewRole === "driver" ? <td style={{ ...td, fontWeight: 700 }}>{t.id}</td> : null}
                      <td style={td}>{t.booking_id}</td>
                      <td style={td} title={formatRouteLabel(t)}>
                        {formatRouteLabel(t)}
                      </td>
                      <td style={td}>
                        {t.booking ? (
                          <>
                            {t.booking.scheduled_date}
                            <br />
                            {t.booking.scheduled_time_slot}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      {crewRole === "driver" ? (
                        <>
                          <td style={{ ...td, textAlign: "right" }}>{t.distance_km} km</td>
                          <td style={{ ...td, textAlign: "right" }}>{formatPhpWhole(t.fuel_cost || 0)}</td>
                        </>
                      ) : null}
                      <td style={td}>
                        <StatusPill ok slug={statusSlugForRow(t)} />
                      </td>
                      <td style={td}>{t.completed_at ? formatDateTime(t.completed_at) : "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>

        <section style={{ ...card, display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <Link
            href={scheduledHref}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: 8,
              border: "1px solid var(--border)",
              fontWeight: 700,
              textDecoration: "none",
              color: "#C2410C",
              background: "#fff",
            }}
          >
            {scheduledLabel}
          </Link>
          {crewRole === "driver" ? (
            <Link
              href="/driver/general-form"
              style={{
                padding: "0.5rem 1rem",
                borderRadius: 8,
                border: "1px solid var(--border)",
                fontWeight: 700,
                textDecoration: "none",
                color: "#1e40af",
                background: "#fff",
              }}
            >
              Forms &amp; reports
            </Link>
          ) : (
            <Link
              href="/helper/bookings"
              style={{
                padding: "0.5rem 1rem",
                borderRadius: 8,
                border: "1px solid var(--border)",
                fontWeight: 700,
                textDecoration: "none",
                color: "#1e40af",
                background: "#fff",
              }}
            >
              Update status &amp; location
            </Link>
          )}
        </section>
      </div>

      {detailTrip ? (
        <div
          role="dialog"
          aria-modal
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "grid",
            placeItems: "center",
            zIndex: 2000,
            padding: 16,
          }}
          onClick={() => setDetailTrip(null)}
        >
          <div
            style={{
              background: "white",
              borderRadius: 12,
              maxWidth: crewRole === "driver" ? 720 : 560,
              width: "100%",
              padding: "1.35rem",
              maxHeight: "88vh",
              overflowY: "auto",
              boxShadow: "0 12px 40px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0 }}>{crewRole === "helper" ? `Booking #${detailTrip.booking_id}` : `Trip #${detailTrip.id}`}</h2>
            {crewRole === "driver" ? (
              <CrewSchedulingPlotPanel plot={schedulingPlotFromTrip(detailTrip)} title="Scheduling plot" />
            ) : null}
            <div style={{ display: "grid", gap: "0.4rem", fontSize: "0.92rem" }}>
              {crewRole === "driver" ? (
                <p style={{ margin: 0 }}>
                  <strong>Booking:</strong> #{detailTrip.booking_id}
                </p>
              ) : null}
              <p style={{ margin: 0 }}>
                <strong>Pickup:</strong> {detailTrip.booking?.pickup_location ?? "—"}
              </p>
              <p style={{ margin: 0 }}>
                <strong>Dropoff:</strong> {detailTrip.booking?.dropoff_location ?? "—"}
              </p>
              {crewRole === "driver" ? (
                <p style={{ margin: 0 }}>
                  <strong>Route:</strong> {formatRouteLabel(detailTrip)}
                </p>
              ) : null}
              <p style={{ margin: 0 }}>
                <strong>Status:</strong> {statusSlugForRow(detailTrip)}
              </p>
              <p style={{ margin: 0 }}>
                <strong>Latest location:</strong> {detailTrip.latest_location ?? "—"}
              </p>
              {detailTrip.booking ? (
                <>
                  {crewRole === "driver" ? (
                    <p style={{ margin: 0 }}>
                      <strong>Customer:</strong> {detailTrip.booking.customer_name ?? "—"}
                    </p>
                  ) : null}
                  <p style={{ margin: 0 }}>
                    <strong>Schedule:</strong> {detailTrip.booking.scheduled_date} {detailTrip.booking.scheduled_time_slot}
                  </p>
                  <p style={{ margin: 0 }}>
                    <strong>Cargo:</strong> {detailTrip.booking.cargo_weight_tons} t
                    {detailTrip.booking.cargo_description ? ` — ${detailTrip.booking.cargo_description}` : ""}
                  </p>
                  <p style={{ margin: 0 }}>
                    <strong>Driver:</strong> {detailTrip.driver_name ?? "—"}
                  </p>
                </>
              ) : null}
            </div>
            <div style={{ marginTop: "1rem", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {crewRole === "driver" ? (
                <Link href={`/trips/${detailTrip.id}/track`} className="button" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
                  Open live track
                </Link>
              ) : null}
              {crewRole === "helper" ? (
                <Link href="/helper/bookings" className="button" style={{ background: "#FF9800", color: "#fff", textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
                  Update status &amp; location
                </Link>
              ) : (
                <Link href="/driver/general-form" className="button" style={{ background: "#FF9800", color: "#fff", textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
                  Forms &amp; reports
                </Link>
              )}
              <button type="button" className="button" style={{ background: "#E5E7EB", color: "var(--text)" }} onClick={() => setDetailTrip(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function StatusPill({ ok, slug }: { ok: boolean; slug: string }) {
  return (
    <span
      title={slug && slug !== "—" ? slug : undefined}
      style={{
        fontSize: "0.7rem",
        fontWeight: 700,
        padding: "0.2rem 0.5rem",
        borderRadius: 999,
        background: ok ? "rgba(5,150,105,0.15)" : "rgba(100,116,139,0.12)",
        color: ok ? "#059669" : "#475569",
        whiteSpace: "nowrap",
      }}
    >
      {slug}
    </span>
  );
}
