"use client";

import { Suspense, useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { WorkflowApi, type Booking } from "@/lib/workflowApi";
import {
  AnalyticsApi,
  type AssignmentRecommendResponse,
  type RouteOptimizeResponse,
} from "@/lib/analyticsApi";
import { formatPhpWhole } from "@/lib/appLocale";

type Roster = {
  trucks: { id: number; code: string; capacity_tons: number }[];
  drivers: { id: number; name: string }[];
  helpers: { id: number; name: string }[];
};

type AssignmentRow = {
  trip_id: number;
  trip_status: string;
  booking_id: number;
  pickup_location: string;
  dropoff_location: string;
  scheduled_date: string;
  scheduled_time_slot: string;
  cargo_weight_tons: number;
  truck_code: string;
  driver_name: string | null;
  helper_name: string | null;
  helper_progress_status: string | null;
  distance_km: number;
  current_latitude: number | null;
  current_longitude: number | null;
};

function DispatcherJobAssignmentsInner() {
  const searchParams = useSearchParams();
  const fromDriverId = searchParams.get("fromDriver");
  const fromDriverName = searchParams.get("driverName");

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingId, setBookingId] = useState<number>(0);
  const [roster, setRoster] = useState<Roster | null>(null);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [pickTruck, setPickTruck] = useState<number>(0);
  const [pickDriver, setPickDriver] = useState<number>(0);
  const [pickHelper, setPickHelper] = useState<number>(0);
  const [recommendation, setRecommendation] = useState<AssignmentRecommendResponse | null>(null);
  const [route, setRoute] = useState<RouteOptimizeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setListError(null);
    try {
      const [list, r, board] = await Promise.all([
        WorkflowApi.assignableBookings(),
        WorkflowApi.dispatchRoster().catch(() => null),
        WorkflowApi.dispatchAssignmentsBoard().catch(() => null),
      ]);
      setBookings(list);
      setRoster(r);
      setAssignments(board?.assignments ?? []);
      setBookingId((prev) => {
        if (list.length === 0) return 0;
        if (prev && list.some((b) => b.id === prev)) return prev;
        return list[0].id;
      });
    } catch (err) {
      setBookings([]);
      setBookingId(0);
      setListError(err instanceof Error ? err.message : "Could not load assignable bookings.");
    } finally {
      setLoadingBookings(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const selected = bookings.find((b) => b.id === bookingId);

  useEffect(() => {
    if (!roster || roster.trucks.length === 0) {
      setPickTruck(0);
      return;
    }
    setPickTruck((t) => (t && roster.trucks.some((x) => x.id === t) ? t : roster.trucks[0].id));
  }, [roster, bookingId]);

  useEffect(() => {
    if (!roster || roster.drivers.length === 0) {
      setPickDriver(0);
      return;
    }
    setPickDriver((t) => (t && roster.drivers.some((x) => x.id === t) ? t : roster.drivers[0].id));
  }, [roster, bookingId]);

  useEffect(() => {
    if (!roster || roster.helpers.length === 0) {
      setPickHelper(0);
      return;
    }
    setPickHelper(0);
  }, [roster, bookingId]);

  const recommend = async () => {
    if (!bookingId) return;
    setBusy(true);
    setError(null);
    try {
      const rec = await AnalyticsApi.recommendAssignment(bookingId);
      setRecommendation(rec);

      if (selected) {
        const r = await AnalyticsApi.optimizeRoute({
          origin: selected.pickup_location,
          destination: selected.dropoff_location,
          weight: "cost",
          cargo_weight_tons: selected.cargo_weight_tons,
          departure_hour: 8,
        });
        setRoute(r);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recommendation failed");
    } finally {
      setBusy(false);
    }
  };

  const assignManual = async () => {
    if (!bookingId || !pickTruck || !pickDriver) {
      setError("Select a truck and driver.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const top = route?.candidates[0];
      await WorkflowApi.manualAssign(bookingId, {
        truck_id: pickTruck,
        driver_id: pickDriver,
        helper_id: pickHelper || undefined,
        route_path: top?.path,
        distance_km: top?.distance_km,
        duration_hours: top?.distance_km ? top.distance_km / 50 : undefined,
        fuel_cost: top?.fuel_cost,
        toll_cost: top?.toll_cost,
        labor_cost: top ? top.time_penalty * 10 : undefined,
        predicted_total_cost: top?.total_cost,
      });
      setOkMsg("Assignment saved. Crew notified.");
      setRecommendation(null);
      setRoute(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assignment failed");
    } finally {
      setBusy(false);
    }
  };

  const applyRecommendation = async () => {
    if (!bookingId || !recommendation?.best) return;
    setPickTruck(recommendation.best.truck_id);
    setPickDriver(recommendation.best.driver_id);
    if (recommendation.best.helper_id) setPickHelper(recommendation.best.helper_id);
  };

  const dispatchFromRecommendation = async () => {
    if (!bookingId || !recommendation?.best) return;
    setBusy(true);
    setError(null);
    try {
      const best = recommendation.best;
      const top = route?.candidates[0];
      await WorkflowApi.manualAssign(bookingId, {
        truck_id: best.truck_id,
        driver_id: best.driver_id,
        helper_id: best.helper_id ?? undefined,
        route_path: top?.path,
        distance_km: top?.distance_km,
        duration_hours: top?.distance_km ? top.distance_km / 50 : undefined,
        fuel_cost: top?.fuel_cost,
        toll_cost: top?.toll_cost,
        labor_cost: top ? top.time_penalty * 10 : undefined,
        predicted_total_cost: top?.total_cost,
      });
      setOkMsg("Assignment dispatched and driver notified");
      setRecommendation(null);
      setRoute(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dispatch failed");
    } finally {
      setBusy(false);
    }
  };

  const card: CSSProperties = {
    background: "white",
    border: "1px solid #E5E7EB",
    borderRadius: 12,
    padding: 18,
  };

  const driverContext = fromDriverId || fromDriverName;

  return (
    <main style={{ padding: "var(--page-main-padding)", background: "#FAFAFA", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gap: 16 }}>
        <header>
          <h1 style={{ margin: 0 }}>Job Assignment</h1>
          <p style={{ color: "#6B7280", marginTop: 4 }}>
            Shows bookings with <strong>verified payment</strong> that still need truck / driver / helper assignment.
            Capacity rules (four 42 t trucks, overlap by route duration) also apply to customer booking windows.
          </p>
        </header>

        {loadingBookings ? <p style={{ color: "#6B7280", margin: 0 }}>Loading bookings…</p> : null}

        {listError ? (
          <div style={{ background: "#FEE2E2", color: "#991B1B", padding: 12, borderRadius: 8 }}>
            <strong>Could not load bookings.</strong> {listError}{" "}
            <code style={{ fontSize: "0.85em" }}>/workflow/booking/assignable</code>
          </div>
        ) : null}

        {!loadingBookings && !listError && bookings.length === 0 ? (
          <div
            role="status"
            style={{
              background: "#FFFBEB",
              border: "1px solid #FCD34D",
              color: "#92400E",
              padding: 14,
              borderRadius: 10,
              lineHeight: 1.5,
            }}
          >
            <strong>No verified-payment bookings waiting for assignment.</strong> Customers must complete payment proof and an
            admin/manager must <strong>verify</strong> it. Approve the booking if it is still pending, then return here.
          </div>
        ) : null}

        {driverContext ? (
          <div
            role="status"
            style={{
              background: "#ECFDF5",
              border: "1px solid #6EE7B7",
              color: "#065F46",
              padding: 14,
              borderRadius: 10,
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ fontWeight: 700 }}>Driver context (from Driver Activity)</div>
            <div>
              {fromDriverName ? <strong>{fromDriverName}</strong> : null}
              {fromDriverId ? (
                <span style={{ color: "#047857" }}>
                  {fromDriverName ? " · " : null}
                  {fromDriverId}
                </span>
              ) : null}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
              <Link href="/dispatcher/job-assignments" style={{ fontWeight: 600, color: "#047857", textDecoration: "underline" }}>
                Clear driver context
              </Link>
            </div>
          </div>
        ) : null}

        {error && (
          <div style={{ background: "#FEE2E2", color: "#991B1B", padding: 12, borderRadius: 8 }}>{error}</div>
        )}
        {okMsg && <div style={{ background: "#D1FAE5", color: "#047857", padding: 12, borderRadius: 8 }}>{okMsg}</div>}

        <section style={card}>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Booking</span>
            <select
              value={bookingId}
              onChange={(e) => {
                setBookingId(Number(e.target.value));
                setRecommendation(null);
                setRoute(null);
              }}
              disabled={loadingBookings || bookings.length === 0}
              style={{ padding: 8, border: "1px solid #D1D5DB", borderRadius: 6 }}
            >
              <option value={0}>{loadingBookings ? "Loading…" : "— pick a booking —"}</option>
              {bookings.map((b) => (
                <option key={b.id} value={b.id}>
                  #{b.id} · {b.cargo_weight_tons} t · {b.pickup_location.slice(0, 36)}… → {b.status}
                </option>
              ))}
            </select>
          </label>

          {selected ? (
            <p style={{ color: "#4B5563", fontSize: 14, marginTop: 10, lineHeight: 1.5 }}>
              <strong>Pickup:</strong> {selected.pickup_location}
              <br />
              <strong>Dropoff:</strong> {selected.dropoff_location}
              <br />
              <strong>Schedule:</strong> {selected.scheduled_date} · window {selected.scheduled_time_slot} ·{" "}
              <strong>{selected.cargo_weight_tons} t</strong> cargo
            </p>
          ) : null}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
              marginTop: 14,
            }}
          >
            <label style={{ display: "grid", gap: 4 }}>
              <span>Truck</span>
              <select
                value={pickTruck}
                onChange={(e) => setPickTruck(Number(e.target.value))}
                disabled={!roster?.trucks.length}
                style={{ padding: 8, border: "1px solid #D1D5DB", borderRadius: 6 }}
              >
                <option value={0}>— truck —</option>
                {(roster?.trucks ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.code} · {t.capacity_tons} t
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span>Driver</span>
              <select
                value={pickDriver}
                onChange={(e) => setPickDriver(Number(e.target.value))}
                disabled={!roster?.drivers.length}
                style={{ padding: 8, border: "1px solid #D1D5DB", borderRadius: 6 }}
              >
                <option value={0}>— driver —</option>
                {(roster?.drivers ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span>Helper (optional)</span>
              <select
                value={pickHelper}
                onChange={(e) => setPickHelper(Number(e.target.value))}
                style={{ padding: 8, border: "1px solid #D1D5DB", borderRadius: 6 }}
              >
                <option value={0}>— none —</option>
                {(roster?.helpers ?? []).map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
            <button
              type="button"
              onClick={recommend}
              disabled={!bookingId || busy || loadingBookings || bookings.length === 0}
              style={{
                padding: "10px 18px",
                background: "#0EA5E9",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontWeight: 600,
                cursor: !bookingId || busy ? "not-allowed" : "pointer",
              }}
            >
              {busy ? "Computing…" : "Recommend assignment + route"}
            </button>
            <button
              type="button"
              onClick={applyRecommendation}
              disabled={!recommendation?.best || busy}
              style={{
                padding: "10px 18px",
                background: "#E0F2FE",
                color: "#0369A1",
                border: "1px solid #7DD3FC",
                borderRadius: 8,
                fontWeight: 600,
              }}
            >
              Apply recommendation to dropdowns
            </button>
            <button
              type="button"
              onClick={assignManual}
              disabled={!bookingId || !pickTruck || !pickDriver || busy}
              style={{
                padding: "10px 18px",
                background: "#2563EB",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontWeight: 600,
              }}
            >
              Assign selected crew
            </button>
          </div>
        </section>

        {recommendation?.best && (
          <section style={card}>
            <h2 style={{ marginTop: 0 }}>Best assignment</h2>
            <div style={{ background: "#F0FDF4", borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>
                Driver: {recommendation.best.driver_name} (#{recommendation.best.driver_id})
              </div>
              <div>
                Truck: {recommendation.best.truck_code} (#{recommendation.best.truck_id})
              </div>
              {recommendation.best.helper_name && <div>Helper: {recommendation.best.helper_name}</div>}
              <div style={{ marginTop: 6, fontWeight: 700 }}>Score: {recommendation.best.score}</div>
              <ul style={{ marginTop: 8 }}>
                {recommendation.best.reasoning.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
            <button
              type="button"
              onClick={dispatchFromRecommendation}
              disabled={busy}
              style={{
                marginTop: 12,
                padding: "12px 20px",
                background: "#10B981",
                color: "white",
                border: "none",
                borderRadius: 10,
                fontWeight: 700,
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              {busy ? "Dispatching…" : "Dispatch recommended assignment"}
            </button>
          </section>
        )}

        {route?.candidates && route.candidates.length > 0 && (
          <section style={card}>
            <h2 style={{ marginTop: 0 }}>Recommended route</h2>
            <p>
              <strong>{route.candidates[0].path.join(" → ")}</strong>
            </p>
            <p>
              Distance {route.candidates[0].distance_km} km · Total cost {formatPhpWhole(route.candidates[0].total_cost)}
            </p>
          </section>
        )}

        <section style={card}>
          <h2 style={{ marginTop: 0 }}>Assigned trips</h2>
          <p style={{ color: "#6B7280", marginTop: 0 }}>
            Live board: booking, pickup window, locations, truck, driver, helper, helper field status, last known GPS.
          </p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB", textAlign: "left" }}>
                  <th style={{ padding: 8 }}>Trip</th>
                  <th style={{ padding: 8 }}>Booking</th>
                  <th style={{ padding: 8 }}>Date / slot</th>
                  <th style={{ padding: 8 }}>Route</th>
                  <th style={{ padding: 8 }}>Wt (t)</th>
                  <th style={{ padding: 8 }}>Truck</th>
                  <th style={{ padding: 8 }}>Driver</th>
                  <th style={{ padding: 8 }}>Helper</th>
                  <th style={{ padding: 8 }}>Helper status</th>
                  <th style={{ padding: 8 }}>GPS</th>
                </tr>
              </thead>
              <tbody>
                {assignments.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: 12, color: "#6B7280" }}>
                      No assignments yet.
                    </td>
                  </tr>
                ) : (
                  assignments.map((a) => (
                    <tr key={a.trip_id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                      <td style={{ padding: 8, fontWeight: 600 }}>#{a.trip_id}</td>
                      <td style={{ padding: 8 }}>#{a.booking_id}</td>
                      <td style={{ padding: 8 }}>
                        {a.scheduled_date} {a.scheduled_time_slot}
                      </td>
                      <td style={{ padding: 8, maxWidth: 220 }}>
                        {a.pickup_location.slice(0, 40)}… → {a.dropoff_location.slice(0, 40)}…
                      </td>
                      <td style={{ padding: 8 }}>{a.cargo_weight_tons}</td>
                      <td style={{ padding: 8 }}>{a.truck_code}</td>
                      <td style={{ padding: 8 }}>{a.driver_name ?? "—"}</td>
                      <td style={{ padding: 8 }}>{a.helper_name ?? "—"}</td>
                      <td style={{ padding: 8 }}>{a.helper_progress_status ?? "—"}</td>
                      <td style={{ padding: 8 }}>
                        {a.current_latitude != null && a.current_longitude != null
                          ? `${a.current_latitude.toFixed(4)}, ${a.current_longitude.toFixed(4)}`
                          : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function JobAssignmentsFallback() {
  return (
    <main style={{ padding: "var(--page-main-padding)", background: "#FAFAFA", minHeight: "100vh" }}>
      <p style={{ color: "#6B7280" }}>Loading job assignment…</p>
    </main>
  );
}

export default function DispatcherJobAssignmentsPage() {
  return (
    <Suspense fallback={<JobAssignmentsFallback />}>
      <DispatcherJobAssignmentsInner />
    </Suspense>
  );
}
