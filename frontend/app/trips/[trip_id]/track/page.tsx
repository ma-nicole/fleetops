"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useRoleGuard } from "@/lib/useRoleGuard";
import { WorkflowApi, type Trip } from "@/lib/workflowApi";
import { formatDateTime, formatPhp } from "@/lib/appLocale";

const STATUS_PROGRESS: Record<string, number> = {
  pending: 5,
  assigned: 15,
  accepted: 25,
  departed: 40,
  loading: 55,
  in_delivery: 75,
  completed: 100,
  cancelled: 100,
};

export default function TripTrackPage() {
  useRoleGuard(["customer", "dispatcher", "manager", "admin", "driver"]);
  const params = useParams<{ trip_id: string }>();
  const tripId = Number(params.trip_id);

  const [trip, setTrip] = useState<Trip | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const t = await WorkflowApi.getTrip(tripId);
        if (alive) setTrip(t);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Failed to load trip");
      }
    };
    tick();
    const id = setInterval(tick, 8000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [tripId]);

  if (error) {
    return (
      <main style={{ padding: "2rem" }}>
        <p style={{ color: "#B91C1C" }}>{error}</p>
      </main>
    );
  }
  if (!trip) {
    return (
      <main style={{ padding: "2rem" }}>
        <p>Loading…</p>
      </main>
    );
  }

  const progress = STATUS_PROGRESS[trip.status] ?? 0;

  return (
    <main style={{ padding: "2rem", background: "#FAFAFA", minHeight: "100vh" }}>
      <div style={{ maxWidth: 800, margin: "0 auto", display: "grid", gap: 16 }}>
        <header>
          <h1 style={{ margin: 0 }}>Trip #{trip.id}</h1>
          <p style={{ marginTop: 4, color: "#6B7280" }}>
            Status: <strong>{trip.status.toUpperCase()}</strong> · auto-refresh every 8s
          </p>
        </header>

        <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 12, padding: 20 }}>
          <h3 style={{ marginTop: 0 }}>Progress</h3>
          <div style={{ background: "#E5E7EB", borderRadius: 999, height: 14, overflow: "hidden" }}>
            <div
              style={{
                width: `${progress}%`,
                height: "100%",
                background: progress === 100 ? "#10B981" : "#0EA5E9",
                transition: "width 0.6s ease",
              }}
            />
          </div>
          <p style={{ marginTop: 6, fontSize: 13, color: "#6B7280" }}>{progress}%</p>
        </div>

        <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 12, padding: 20 }}>
          <h3 style={{ marginTop: 0 }}>Live position</h3>
          {trip.current_latitude && trip.current_longitude ? (
            <p>
               {trip.current_latitude.toFixed(4)}, {trip.current_longitude.toFixed(4)}
            </p>
          ) : (
            <p style={{ color: "#6B7280" }}>Waiting for first GPS ping from driver…</p>
          )}
          {trip.estimated_delivery_time && (
            <p>ETA: {formatDateTime(trip.estimated_delivery_time)}</p>
          )}
        </div>

        <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 12, padding: 20 }}>
          <h3 style={{ marginTop: 0 }}>Timeline</h3>
          <Timeline trip={trip} />
        </div>

        <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 12, padding: 20 }}>
          <h3 style={{ marginTop: 0 }}>Cost</h3>
          <p>Fuel: {formatPhp(trip.fuel_cost)}</p>
          <p>Toll: {formatPhp(trip.toll_cost)}</p>
          <p>Labor: {formatPhp(trip.labor_cost)}</p>
          <p>
            <strong>Total: {formatPhp(trip.fuel_cost + trip.toll_cost + trip.labor_cost)}</strong>
          </p>
        </div>
      </div>
    </main>
  );
}

function Timeline({ trip }: { trip: Trip }) {
  const items: Array<[string, string | null]> = [
    ["Assigned", trip.assigned_at],
    ["Accepted", trip.accepted_at],
    ["Departed", trip.departure_time],
    ["Arrived pickup", trip.arrival_pickup_time],
    ["Loading complete", trip.loading_end_time],
    ["Out for delivery", trip.departure_delivery_time],
    ["Delivered", trip.completed_at],
  ];
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
      {items.map(([label, ts]) => (
        <li
          key={label}
          style={{
            display: "grid",
            gridTemplateColumns: "180px 1fr",
            gap: 8,
            padding: "6px 0",
            borderBottom: "1px solid #F3F4F6",
            color: ts ? "#111827" : "#9CA3AF",
          }}
        >
          <span>{label}</span>
          <span>{ts ? formatDateTime(ts) : "—"}</span>
        </li>
      ))}
    </ul>
  );
}
