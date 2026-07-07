"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import { useState, useEffect, useCallback } from "react";
import Breadcrumbs from "@/components/Breadcrumbs";
import DeliveryCompletionPanel from "@/components/DeliveryCompletionPanel";
import { formatPhp } from "@/lib/appLocale";
import { WorkflowApi, type Trip } from "@/lib/workflowApi";

function customerLabel(t: Trip): string {
  const cid = t.booking?.customer_id;
  return cid != null ? `Customer #${cid}` : "—";
}

function tripSchedule(t: Trip): { date: string; time: string } {
  const bk = t.booking;
  if (!bk) return { date: "—", time: "—" };
  const date =
    typeof bk.scheduled_date === "string"
      ? bk.scheduled_date
      : (bk.scheduled_date as unknown as Date)?.toISOString?.().slice(0, 10) ?? "—";
  return { date, time: bk.scheduled_time_slot || "—" };
}

function nextActionLabel(status: string): string | null {
  switch (status) {
    case "assigned":
      return "Accept job";
    case "accepted":
      return "Depart to pickup";
    case "departed":
      return "Arrived at pickup";
    case "loading":
      return "Finish loading / outbound";
    case "in_delivery":
      return "Mark delivery complete";
    default:
      return null;
  }
}

export default function DriverTaskListPage() {
  useRoleGuard(["driver"]);

  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [updatingTripId, setUpdatingTripId] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [completionTrip, setCompletionTrip] = useState<Trip | null>(null);
  const [deliveryReady, setDeliveryReady] = useState(false);

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      const list = await WorkflowApi.myTrips();
      setTrips(list);
    } catch (e) {
      setTrips([]);
      setLoadError(e instanceof Error ? e.message : "Could not load trips.");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runNextStep = async (trip: Trip) => {
    setUpdatingTripId(trip.id);
    setStatusMessage("");
    try {
      switch (trip.status) {
        case "assigned":
          await WorkflowApi.acceptJob(trip.id);
          break;
        case "accepted":
          await WorkflowApi.depart(trip.id);
          break;
        case "departed":
          await WorkflowApi.arrivedPickup(trip.id);
          break;
        case "loading":
          await WorkflowApi.loadingComplete(trip.id);
          break;
        case "in_delivery":
          if (!deliveryReady) {
            setCompletionTrip(trip);
            setStatusMessage("Complete receiving document, QR verification, and digital signature first.");
            return;
          }
          await WorkflowApi.completeTrip(trip.id);
          setCompletionTrip(null);
          break;
        default:
          return;
      }
      await refresh();
      setStatusMessage(`Trip #${trip.id} updated.`);
      setSelectedTrip(null);
      window.setTimeout(() => setStatusMessage(""), 4000);
    } catch (e) {
      setStatusMessage(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setUpdatingTripId(null);
    }
  };

  const pendingTrips = trips.filter((t) =>
    ["pending", "assigned", "accepted"].includes(t.status)
  );
  const inTransitTrips = trips.filter((t) =>
    ["departed", "loading", "in_delivery"].includes(t.status)
  );
  const completedTrips = trips.filter((t) => t.status === "completed");

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
      case "assigned":
      case "accepted":
        return "#FF9800";
      case "departed":
      case "loading":
      case "in_delivery":
        return "#2196F3";
      case "completed":
        return "#4CAF50";
      default:
        return "#666666";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "assigned":
        return "Assigned";
      case "accepted":
        return "Accepted";
      case "departed":
        return "En route";
      case "loading":
        return "Loading";
      case "in_delivery":
        return "In delivery";
      case "completed":
        return "Completed";
      case "cancelled":
        return "Cancelled";
      default:
        return status;
    }
  };

  return (
    <div className="container" style={{ paddingTop: "var(--space-3)" }}>
      <Breadcrumbs
        items={[
          { label: "Modules", href: "/dashboard/driver" },
          { label: "My Tasks" },
        ]}
      />

      <div style={{ marginTop: "2rem" }}>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem" }}>My Assigned Tasks</h1>
        <p style={{ color: "#666666", marginBottom: "1.5rem" }}>
          Progress trips using the same workflow as the driver scheduled bookings view. Each step syncs to the server.
        </p>

        {loadError ? (
          <div className="card" style={{ marginBottom: "1rem", background: "#FEE2E2", color: "#991B1B", padding: "0.75rem" }}>
            {loadError}
          </div>
        ) : null}

        {statusMessage && (
          <div
            className="card"
            style={{
              background: statusMessage.includes("Complete receiving") ? "rgba(255, 152, 0, 0.12)" : "rgba(76, 175, 80, 0.1)",
              border: statusMessage.includes("Complete receiving") ? "1px solid #FF9800" : "1px solid #4CAF50",
              color: statusMessage.includes("Complete receiving") ? "#9A3412" : "#2E7D32",
              marginBottom: "1rem",
              padding: "0.75rem",
            }}
          >
            {statusMessage}
          </div>
        )}

        {completionTrip ? (
          <div className="card" style={{ marginBottom: "1.5rem", padding: "1rem" }}>
            <h3 style={{ margin: "0 0 0.75rem", color: "#1A1A1A" }}>
              Complete delivery — Trip #{completionTrip.id}
            </h3>
            <DeliveryCompletionPanel
              tripId={completionTrip.id}
              bookingId={completionTrip.booking_id}
              onReadyChange={setDeliveryReady}
            />
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem", flexWrap: "wrap" }}>
              <button
                type="button"
                disabled={!deliveryReady || updatingTripId === completionTrip.id}
                onClick={() => void runNextStep(completionTrip)}
                style={{
                  padding: "0.75rem 1rem",
                  background: deliveryReady ? "#4CAF50" : "#9CA3AF",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  fontWeight: 600,
                  cursor: deliveryReady ? "pointer" : "not-allowed",
                }}
              >
                {updatingTripId === completionTrip.id ? "Completing…" : "Mark delivery complete"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCompletionTrip(null);
                  setDeliveryReady(false);
                }}
                style={{
                  padding: "0.75rem 1rem",
                  background: "white",
                  border: "1px solid #D1D5DB",
                  borderRadius: 6,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "1rem",
            marginBottom: "2rem",
          }}
        >
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#FF9800" }}>{pendingTrips.length}</div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Pending / pre-trip</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#2196F3" }}>{inTransitTrips.length}</div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Active</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#4CAF50" }}>{completedTrips.length}</div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Completed</div>
          </div>
        </div>

        {pendingTrips.length > 0 && (
          <div style={{ marginBottom: "2rem" }}>
            <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Pending pickups / acceptance</h3>
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {pendingTrips.map((trip) => {
                const { date, time } = tripSchedule(trip);
                const bk = trip.booking;
                return (
                  <div
                    key={trip.id}
                    className="card"
                    onClick={() => setSelectedTrip(trip)}
                    style={{
                      cursor: "pointer",
                      background: selectedTrip?.id === trip.id ? "rgba(255, 152, 0, 0.15)" : "#FFFFFF",
                      border: selectedTrip?.id === trip.id ? "2px solid #FF9800" : "1px solid #E8E8E8",
                      padding: "1rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "start",
                        marginBottom: "0.75rem",
                      }}
                    >
                      <div>
                        <strong style={{ color: "#1A1A1A", fontSize: "1.1rem" }}>Trip #{trip.id}</strong>
                        <p style={{ margin: "0.25rem 0 0 0", color: "#666666", fontSize: "0.9rem" }}>
                          Scheduled: {date} · {time}
                        </p>
                      </div>
                      <span
                        style={{
                          padding: "0.5rem 1rem",
                          background: "rgba(255, 152, 0, 0.1)",
                          color: getStatusColor(trip.status),
                          borderRadius: "6px",
                          fontSize: "0.85rem",
                          fontWeight: 600,
                        }}
                      >
                        {getStatusLabel(trip.status)}
                      </span>
                    </div>

                    <div style={{ marginBottom: "0.75rem" }}>
                      <p style={{ margin: "0.25rem 0", color: "#666666", fontSize: "0.9rem" }}>
                        {bk?.pickup_location ?? "—"} → {bk?.dropoff_location ?? "—"}
                      </p>
                      <p style={{ margin: "0.25rem 0", color: "#666666", fontSize: "0.9rem" }}>
                        {bk != null ? `${bk.cargo_weight_tons} t` : "—"} · {customerLabel(trip)}
                      </p>
                      <p style={{ margin: "0.25rem 0", color: "#FF9800", fontWeight: 600 }}>
                        Quoted: {bk != null ? formatPhp(bk.estimated_cost) : "—"}
                      </p>
                    </div>

                    {selectedTrip?.id === trip.id && nextActionLabel(trip.status) ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void runNextStep(trip);
                        }}
                        disabled={updatingTripId === trip.id}
                        style={{
                          width: "100%",
                          padding: "0.75rem",
                          background: "#FF9800",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          cursor: updatingTripId === trip.id ? "not-allowed" : "pointer",
                          fontWeight: 600,
                          marginTop: "0.75rem",
                        }}
                      >
                        {updatingTripId === trip.id ? "Updating…" : nextActionLabel(trip.status)}
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {inTransitTrips.length > 0 && (
          <div style={{ marginBottom: "2rem" }}>
            <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>In progress</h3>
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {inTransitTrips.map((trip) => {
                const bk = trip.booking;
                return (
                  <div
                    key={trip.id}
                    className="card"
                    onClick={() => setSelectedTrip(trip)}
                    style={{
                      cursor: "pointer",
                      background: selectedTrip?.id === trip.id ? "rgba(33, 150, 243, 0.15)" : "#FFFFFF",
                      border: selectedTrip?.id === trip.id ? "2px solid #2196F3" : "1px solid #E8E8E8",
                      padding: "1rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "start",
                        marginBottom: "0.75rem",
                      }}
                    >
                      <div>
                        <strong style={{ color: "#1A1A1A", fontSize: "1.1rem" }}>Trip #{trip.id}</strong>
                        <p style={{ margin: "0.25rem 0 0 0", color: "#666666", fontSize: "0.9rem" }}>
                          {trip.distance_km ? `${trip.distance_km} km route` : "Route"} · {getStatusLabel(trip.status)}
                        </p>
                      </div>
                      <span
                        style={{
                          padding: "0.5rem 1rem",
                          background: "rgba(33, 150, 243, 0.1)",
                          color: "#2196F3",
                          borderRadius: "6px",
                          fontSize: "0.85rem",
                          fontWeight: 600,
                        }}
                      >
                        {getStatusLabel(trip.status)}
                      </span>
                    </div>

                    <div style={{ marginBottom: "0.75rem" }}>
                      <p style={{ margin: "0.25rem 0", color: "#666666", fontSize: "0.9rem" }}>
                        {bk?.pickup_location ?? "—"} → {bk?.dropoff_location ?? "—"}
                      </p>
                      <p style={{ margin: "0.25rem 0", color: "#666666", fontSize: "0.9rem" }}>
                        {bk != null ? `${bk.cargo_weight_tons} t` : "—"} · {customerLabel(trip)}
                      </p>
                    </div>

                    {selectedTrip?.id === trip.id && nextActionLabel(trip.status) ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (trip.status === "in_delivery") {
                            setCompletionTrip(trip);
                            setDeliveryReady(false);
                            return;
                          }
                          void runNextStep(trip);
                        }}
                        disabled={updatingTripId === trip.id}
                        style={{
                          width: "100%",
                          padding: "0.75rem",
                          background: "#4CAF50",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          cursor: updatingTripId === trip.id ? "not-allowed" : "pointer",
                          fontWeight: 600,
                          marginTop: "0.75rem",
                        }}
                      >
                        {updatingTripId === trip.id ? "Updating…" : nextActionLabel(trip.status)}
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {completedTrips.length > 0 && (
          <div>
            <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Completed</h3>
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {completedTrips.map((trip) => {
                const bk = trip.booking;
                return (
                  <div
                    key={trip.id}
                    className="card"
                    style={{
                      opacity: 0.85,
                      padding: "1rem",
                      borderLeft: "3px solid #4CAF50",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                      <div>
                        <strong style={{ color: "#1A1A1A" }}>Trip #{trip.id}</strong>
                        <p style={{ margin: "0.25rem 0", color: "#666666", fontSize: "0.9rem" }}>
                          {bk?.pickup_location ?? "—"} → {bk?.dropoff_location ?? "—"}
                        </p>
                        {trip.completed_at ? (
                          <p style={{ margin: "0.25rem 0", color: "#666666", fontSize: "0.85rem" }}>
                            Completed: {trip.completed_at}
                          </p>
                        ) : null}
                      </div>
                      <span
                        style={{
                          padding: "0.5rem 1rem",
                          background: "rgba(76, 175, 80, 0.1)",
                          color: "#4CAF50",
                          borderRadius: "6px",
                          fontSize: "0.85rem",
                          fontWeight: 600,
                        }}
                      >
                        Completed
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {trips.length === 0 && !loadError && (
          <div className="card" style={{ textAlign: "center", padding: "3rem", color: "#666666" }}>
            <p style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>No tasks assigned yet</p>
            <p style={{ fontSize: "0.9rem" }}>When a dispatcher assigns you to a booking, it will show here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
