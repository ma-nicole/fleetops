"use client";

import { useMemo, useState } from "react";

import Link from "next/link";

import { useRoleGuard } from "@/lib/useRoleGuard";

type Trip = {
  id: string;
  routeId: string;
  pickupLocation: string;
  dropoffLocation: string;
  startTime: string;
  endTime: string;
  distance: string;
  status: "pending" | "in_progress" | "completed";
  cargo: string;
  earnings: string;
  /** Set when status becomes completed — older completions sort first; newest completed row is last. */
  completedAt: number | null;
};

const INITIAL_TRIPS: Trip[] = [
  {
    id: "TRIP-001",
    routeId: "RT-2024-0142",
    pickupLocation: "Makati Distribution Center",
    dropoffLocation: "Quezon City Warehouse",
    startTime: "09:30 AM",
    endTime: "11:45 AM",
    distance: "28 km",
    status: "in_progress",
    cargo: "Electronics & Parts (450 kg)",
    earnings: "₱245.00",
    completedAt: null,
  },
  {
    id: "TRIP-002",
    routeId: "RT-2024-0143",
    pickupLocation: "Pasig Port Area",
    dropoffLocation: "Makati Central",
    startTime: "12:30 PM",
    endTime: "2:15 PM",
    distance: "18 km",
    status: "pending",
    cargo: "Textile & Fabrics (380 kg)",
    earnings: "₱175.50",
    completedAt: null,
  },
  {
    id: "TRIP-003",
    routeId: "RT-2024-0144",
    pickupLocation: "Las Piñas Facility",
    dropoffLocation: "Taguig Logistics Hub",
    startTime: "3:30 PM",
    endTime: "5:00 PM",
    distance: "22 km",
    status: "pending",
    cargo: "Industrial Supplies (520 kg)",
    earnings: "₱198.75",
    completedAt: null,
  },
  {
    id: "TRIP-004",
    routeId: "RT-2024-0141",
    pickupLocation: "Santa Rosa Warehouse",
    dropoffLocation: "Paranaque Distribution",
    startTime: "6:00 AM",
    endTime: "8:30 AM",
    distance: "35 km",
    status: "completed",
    cargo: "Office Equipment (600 kg)",
    earnings: "₱320.50",
    completedAt: 1,
  },
];

export default function ActiveTripsPage() {
  useRoleGuard(["driver"]);

  const [trips, setTrips] = useState<Trip[]>(INITIAL_TRIPS);

  const orderedTrips = useMemo(() => {
    const active = trips.filter((t) => t.status !== "completed");
    const completed = trips
      .filter((t) => t.status === "completed")
      .sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0));
    return [...active, ...completed];
  }, [trips]);

  const completeTrip = (tripId: string) => {
    setTrips((prev) =>
      prev.map((t) =>
        t.id === tripId ? { ...t, status: "completed" as const, completedAt: Date.now() } : t,
      ),
    );
  };

  const startTrip = (tripId: string) => {
    setTrips((prev) =>
      prev.map((t) => (t.id === tripId ? { ...t, status: "in_progress" as const } : t)),
    );
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { color: "#2196F3", label: " Pending" },
      in_progress: { color: "#FF9800", label: " In Progress" },
      completed: { color: "#4CAF50", label: " Completed" },
    };
    return statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
  };

  const activeCount = trips.filter((t) => t.status !== "completed").length;

  return (
    <div style={{ padding: "2rem", display: "grid", gap: "2rem" }}>
      <div>
        <Link href="/driver/dashboard" style={{ color: "#FF9800", textDecoration: "none", fontWeight: "600" }}>
          ← Back to Dashboard
        </Link>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem", marginTop: "1rem" }}>Active Trips</h1>
        <p style={{ color: "#666666", margin: "0" }}>
          Active trips appear first; after <strong>Complete Trip</strong>, the card moves to the bottom of the list under completed trips.
        </p>
      </div>

      <div style={{ display: "grid", gap: "1rem" }}>
        {orderedTrips.map((trip, index) => {
          const status = getStatusBadge(trip.status);
          const prev = orderedTrips[index - 1];
          const showCompletedDivider =
            trip.status === "completed" && prev && prev.status !== "completed";

          return (
            <div key={trip.id}>
              {showCompletedDivider ? (
                <p
                  style={{
                    margin: "0 0 0.75rem",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    color: "#888",
                    letterSpacing: "0.04em",
                  }}
                >
                  Completed (newest at bottom)
                </p>
              ) : null}
              <div
                style={{
                  padding: "1.5rem",
                  border: `2px solid ${status.color}`,
                  borderRadius: "8px",
                  background: "#FAFAFA",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "1rem" }}>
                  <div>
                    <h3 style={{ color: "#1A1A1A", margin: "0", fontSize: "1.1rem" }}>{trip.id}</h3>
                    <p style={{ color: "#999", fontSize: "0.9rem", margin: "0.25rem 0 0 0" }}>Route: {trip.routeId}</p>
                  </div>
                  <span
                    style={{
                      padding: "0.5rem 1rem",
                      background: status.color + "20",
                      color: status.color,
                      borderRadius: "6px",
                      fontWeight: "600",
                      fontSize: "0.85rem",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {status.label}
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1rem" }}>
                  <div>
                    <p style={{ color: "#999", fontSize: "0.8rem", fontWeight: "600", margin: "0" }}>PICKUP LOCATION</p>
                    <p style={{ color: "#1A1A1A", fontSize: "0.95rem", fontWeight: "600", margin: "0.5rem 0 0 0" }}>
                      {trip.pickupLocation}
                    </p>
                  </div>
                  <div>
                    <p style={{ color: "#999", fontSize: "0.8rem", fontWeight: "600", margin: "0" }}>DROPOFF LOCATION</p>
                    <p style={{ color: "#1A1A1A", fontSize: "0.95rem", fontWeight: "600", margin: "0.5rem 0 0 0" }}>
                      {trip.dropoffLocation}
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: "1rem",
                    marginBottom: "1rem",
                    paddingBottom: "1rem",
                    borderBottom: "1px solid #E8E8E8",
                  }}
                >
                  <div>
                    <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>START TIME</p>
                    <p style={{ color: "#1A1A1A", fontWeight: "600", margin: "0.25rem 0 0 0" }}>{trip.startTime}</p>
                  </div>
                  <div>
                    <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>END TIME</p>
                    <p style={{ color: "#1A1A1A", fontWeight: "600", margin: "0.25rem 0 0 0" }}>{trip.endTime}</p>
                  </div>
                  <div>
                    <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>DISTANCE</p>
                    <p style={{ color: "#1A1A1A", fontWeight: "600", margin: "0.25rem 0 0 0" }}>{trip.distance}</p>
                  </div>
                  <div>
                    <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>EARNING</p>
                    <p style={{ color: "#4CAF50", fontWeight: "700", margin: "0.25rem 0 0 0" }}>{trip.earnings}</p>
                  </div>
                </div>

                <p style={{ color: "#666666", fontSize: "0.9rem", margin: "0" }}> {trip.cargo}</p>

                {trip.status === "in_progress" && (
                  <div style={{ marginTop: "1rem", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
                    <button
                      type="button"
                      style={{
                        padding: "0.75rem",
                        background: "#FF9800",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontWeight: "600",
                        fontSize: "0.85rem",
                      }}
                      onClick={() => alert("Arrival recorded at " + trip.dropoffLocation)}
                    >
                      ✓ Mark Arrival
                    </button>
                    <button
                      type="button"
                      style={{
                        padding: "0.75rem",
                        background: "#2196F3",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontWeight: "600",
                        fontSize: "0.85rem",
                      }}
                      onClick={() => alert("Delivery photos uploaded")}
                    >
                      Upload Photos
                    </button>
                    <button
                      type="button"
                      style={{
                        padding: "0.75rem",
                        background: "#4CAF50",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontWeight: "600",
                        fontSize: "0.85rem",
                      }}
                      onClick={() => completeTrip(trip.id)}
                    >
                      Complete Trip
                    </button>
                  </div>
                )}

                {trip.status === "pending" && (
                  <div style={{ marginTop: "1rem" }}>
                    <button
                      type="button"
                      style={{
                        padding: "0.75rem 1rem",
                        background: "#FF9800",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontWeight: "600",
                        fontSize: "0.9rem",
                        width: "100%",
                      }}
                      onClick={() => startTrip(trip.id)}
                    >
                      Start Trip
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {activeCount === 0 ? (
        <p style={{ color: "#666", margin: 0 }}>No active trips — completed trips are listed below.</p>
      ) : null}
    </div>
  );
}
