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

function DispatcherJobAssignmentsInner() {
  const searchParams = useSearchParams();
  const fromDriverId = searchParams.get("fromDriver");
  const fromDriverName = searchParams.get("driverName");

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingId, setBookingId] = useState<number>(0);
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
      const list = await WorkflowApi.assignableBookings();
      setBookings(list);
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

  const recommend = async () => {
    if (!bookingId) return;
    setBusy(true);
    setError(null);
    try {
      const recommendation = await AnalyticsApi.recommendAssignment(bookingId);
      setRecommendation(recommendation);

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

  const dispatch = async () => {
    if (!bookingId || !recommendation?.best) return;
    setBusy(true);
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
    <main style={{ padding: "2rem", background: "#FAFAFA", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gap: 16 }}>
        <header>
          <h1 style={{ margin: 0 }}>Job Assignment Wizard</h1>
          <p style={{ color: "#6B7280", marginTop: 4 }}>
            Lists bookings that are already <strong>approved</strong> by a manager and waiting for truck/driver assignment.
          </p>
        </header>

        {loadingBookings ? (
          <p style={{ color: "#6B7280", margin: 0 }}>Loading approved bookings…</p>
        ) : null}

        {listError ? (
          <div style={{ background: "#FEE2E2", color: "#991B1B", padding: 12, borderRadius: 8 }}>
            <strong>Could not load bookings.</strong> {listError}{" "}
            Confirm the API is running and you are signed in as dispatcher (or manager/admin). Check the browser network tab for{" "}
            <code style={{ fontSize: "0.85em" }}>/workflow/booking/assignable</code>.
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
            <strong>No approved bookings yet.</strong> This dropdown only shows bookings in <strong>approved</strong> status (manager has
            accepted the request, dispatcher has not assigned a trip yet). Create a customer booking, have a manager approve it in{" "}
            <Link href="/manager/pending-bookings" style={{ fontWeight: 600, color: "#B45309" }}>
              Pending bookings
            </Link>
            , or run <code style={{ fontSize: "0.85em" }}>python seed_db.py</code> so sample rows exist. Pending (unapproved) requests do not appear here.
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
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
              Select a booking below, run <strong>Recommend assignment + route</strong>, then dispatch. Live recommendations use fleet data — verify the match or pick an alternative before confirming.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
              <Link href="/dispatcher/job-assignments" style={{ fontWeight: 600, color: "#047857", textDecoration: "underline" }}>
                Clear driver context
              </Link>
              <Link href="/dispatcher/driver-activity" style={{ fontWeight: 600, color: "#047857", textDecoration: "underline" }}>
                Back to Driver Activity
              </Link>
            </div>
          </div>
        ) : null}

        {error && (
          <div style={{ background: "#FEE2E2", color: "#991B1B", padding: 12, borderRadius: 8 }}>{error}</div>
        )}
        {okMsg && (
          <div style={{ background: "#D1FAE5", color: "#047857", padding: 12, borderRadius: 8 }}>{okMsg}</div>
        )}

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
                  #{b.id} · {b.pickup_location} → {b.dropoff_location} · {b.status}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={recommend}
            disabled={!bookingId || busy || loadingBookings || bookings.length === 0}
            style={{
              marginTop: 14,
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
              {recommendation.best.helper_name && (
                <div>Helper: {recommendation.best.helper_name}</div>
              )}
              <div style={{ marginTop: 6, fontWeight: 700 }}>Score: {recommendation.best.score}</div>
              <ul style={{ marginTop: 8 }}>
                {recommendation.best.reasoning.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
            {recommendation.alternatives.length > 0 && (
              <details style={{ marginTop: 12 }}>
                <summary style={{ cursor: "pointer" }}>{recommendation.alternatives.length} alternatives</summary>
                <ul>
                  {recommendation.alternatives.map((a, i) => (
                    <li key={i}>
                      {a.driver_name} on {a.truck_code} — score {a.score}
                    </li>
                  ))}
                </ul>
              </details>
            )}
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
            {route.constraints_applied.length > 0 && (
              <p style={{ color: "#B45309" }}>{route.constraints_applied.join(" · ")}</p>
            )}
          </section>
        )}

        {recommendation?.best && (
          <button
            type="button"
            onClick={dispatch}
            disabled={busy}
            style={{
              padding: "12px 20px",
              background: "#10B981",
              color: "white",
              border: "none",
              borderRadius: 10,
              fontWeight: 700,
              cursor: busy ? "not-allowed" : "pointer",
              fontSize: 16,
            }}
          >
            {busy ? "Dispatching…" : "Dispatch assignment"}
          </button>
        )}
      </div>
    </main>
  );
}

function JobAssignmentsFallback() {
  return (
    <main style={{ padding: "2rem", background: "#FAFAFA", minHeight: "100vh" }}>
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
