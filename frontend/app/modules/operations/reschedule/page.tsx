"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Breadcrumbs from "@/components/Breadcrumbs";
import { useState } from "react";

type Trip = {
  id: number;
  driver: string;
  pickup: string;
  dropoff: string;
  scheduled_time: string;
  status: "scheduled" | "on_route" | "delayed";
};

export default function RescheduleTripsPage() {
  useRoleGuard(["dispatcher"]);

  const [trips] = useState<Trip[]>([
    {
      id: 101,
      driver: "Carlos Rodriguez",
      pickup: "Makati CBD",
      dropoff: "Batangas City",
      scheduled_time: "2026-04-28 10:00",
      status: "scheduled",
    },
    {
      id: 102,
      driver: "James Cooper",
      pickup: "Clark Freeport",
      dropoff: "Makati CBD",
      scheduled_time: "2026-04-28 08:30",
      status: "on_route",
    },
    {
      id: 103,
      driver: "Sarah Williams",
      pickup: "Santa Rosa, Laguna",
      dropoff: "Quezon City",
      scheduled_time: "2026-04-28 14:00",
      status: "delayed",
    },
  ]);

  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [showRescheduleForm, setShowRescheduleForm] = useState(false);
  const [newTime, setNewTime] = useState("");

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled":
        return "#FF9800";
      case "on_route":
        return "#4CAF50";
      case "delayed":
        return "#F44336";
      default:
        return "#999";
    }
  };

  return (
    <div className="container" style={{ paddingTop: "2rem" }}>
      <Breadcrumbs
        items={[
          { label: "Modules", href: "/dashboard/dispatcher" },
          { label: "Dispatcher Coordination" },
          { label: "Reschedule Trips" },
        ]}
      />

      <div style={{ marginTop: "2rem" }}>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem" }}>
           Reschedule Trips
        </h1>
        <p style={{ color: "#666666", marginBottom: "1.5rem" }}>
          Reschedule trips due to delays, driver unavailability, or changed customer requests.
        </p>

        {/* Trip List */}
        <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Available Trips</h3>
        <div style={{ display: "grid", gap: "0.75rem", marginBottom: "2rem" }}>
          {trips.map((trip) => (
            <div
              key={trip.id}
              className="card"
              onClick={() => setSelectedTrip(selectedTrip?.id === trip.id ? null : trip)}
              style={{
                padding: "1rem",
                cursor: "pointer",
                background:
                  selectedTrip?.id === trip.id
                    ? "rgba(255, 152, 0, 0.15)"
                    : "#FFFFFF",
                border:
                  selectedTrip?.id === trip.id
                    ? "2px solid #FF9800"
                    : "1px solid #E8E8E8",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "start",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "1rem",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <strong style={{ color: "#1A1A1A" }}>
                      Trip #{trip.id}
                    </strong>
                    <span
                      style={{
                        padding: "0.25rem 0.75rem",
                        background: getStatusColor(trip.status),
                        color: "white",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        textTransform: "capitalize",
                      }}
                    >
                      {trip.status.replace("_", " ")}
                    </span>
                  </div>
                  <p style={{ margin: "0.25rem 0", color: "#666666", fontSize: "0.9rem" }}>
                    Driver: {trip.driver}
                  </p>
                  <p style={{ margin: "0.25rem 0", color: "#666666", fontSize: "0.9rem" }}>
                    {trip.pickup} → {trip.dropoff}
                  </p>
                  <p style={{ margin: "0.25rem 0", color: "#999", fontSize: "0.85rem" }}>
                    Scheduled: {trip.scheduled_time}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Reschedule Form */}
        {selectedTrip && (
          <div
            className="card"
            style={{
              padding: "1.5rem",
              background: "rgba(255, 152, 0, 0.1)",
              border: "1px solid #FFE0B2",
            }}
          >
            <h3 style={{ color: "#1A1A1A", margin: "0 0 1rem 0" }}>
              Reschedule Trip #{selectedTrip.id}
            </h3>

            <div style={{ marginBottom: "1rem", padding: "1rem", background: "#F5F5F5", borderRadius: "6px" }}>
              <p style={{ margin: "0.5rem 0", color: "#666666" }}>
                <strong>Driver:</strong> {selectedTrip.driver}
              </p>
              <p style={{ margin: "0.5rem 0", color: "#666666" }}>
                <strong>Route:</strong> {selectedTrip.pickup} → {selectedTrip.dropoff}
              </p>
              <p style={{ margin: "0.5rem 0", color: "#FF9800", fontWeight: 600 }}>
                <strong>Current Time:</strong> {selectedTrip.scheduled_time}
              </p>
            </div>

            {!showRescheduleForm ? (
              <button
                onClick={() => setShowRescheduleForm(true)}
                style={{
                  padding: "0.75rem 1.5rem",
                  background: "#FF9800",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Change Scheduled Time
              </button>
            ) : (
              <div style={{ display: "grid", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                    New Scheduled Time
                  </label>
                  <input
                    type="datetime-local"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      border: "1px solid #E8E8E8",
                      borderRadius: "6px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <button
                  style={{
                    padding: "0.75rem 1.5rem",
                    background: "#4CAF50",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Confirm Reschedule
                </button>
                <button
                  onClick={() => setShowRescheduleForm(false)}
                  style={{
                    padding: "0.75rem 1.5rem",
                    background: "#999",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
