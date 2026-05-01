"use client";

import { useEffect, useState } from "react";
import { WorkflowApi, type Booking } from "@/lib/workflowApi";
import {
  AnalyticsApi,
  type AssignmentRecommendResponse,
  type RouteOptimizeResponse,
} from "@/lib/analyticsApi";

export default function DispatcherJobAssignmentsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingId, setBookingId] = useState<number>(0);
  const [recommendation, setRecommendation] = useState<AssignmentRecommendResponse | null>(null);
  const [route, setRoute] = useState<RouteOptimizeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try {
      const list = await WorkflowApi.pendingApprovals().catch(() => [] as Booking[]);
      const approved = list.filter((b) => b.status === "approved" || b.status === "pending_approval");
      setBookings(approved);
      if (!bookingId && approved.length) setBookingId(approved[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load bookings");
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
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dispatch failed");
    } finally {
      setBusy(false);
    }
  };

  const card: React.CSSProperties = {
    background: "white",
    border: "1px solid #E5E7EB",
    borderRadius: 12,
    padding: 18,
  };

  return (
    <main style={{ padding: "2rem", background: "#FAFAFA", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gap: 16 }}>
        <header>
          <h1 style={{ margin: 0 }}>Job Assignment Wizard</h1>
          <p style={{ color: "#6B7280", marginTop: 4 }}>
            Paper Fig 25 — pick a booking, get a prescribed driver/truck/helper + optimized route, then dispatch.
          </p>
        </header>

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
              style={{ padding: 8, border: "1px solid #D1D5DB", borderRadius: 6 }}
            >
              <option value={0}>— pick a booking —</option>
              {bookings.map((b) => (
                <option key={b.id} value={b.id}>
                  #{b.id} · {b.pickup_location} → {b.dropoff_location} · {b.status}
                </option>
              ))}
            </select>
          </label>

          <button
            onClick={recommend}
            disabled={!bookingId || busy}
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
              Distance {route.candidates[0].distance_km}km · Total cost ₱
              {route.candidates[0].total_cost.toLocaleString()}
            </p>
            {route.constraints_applied.length > 0 && (
              <p style={{ color: "#B45309" }}>{route.constraints_applied.join(" · ")}</p>
            )}
          </section>
        )}

        {recommendation?.best && (
          <button
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
