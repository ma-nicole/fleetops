"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { announce } from "@/lib/useAnnouncer";
import { WorkflowApi } from "@/lib/workflowApi";

export default function AssetsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"drivers" | "vehicles">("drivers");
  const [expandedVehicleId, setExpandedVehicleId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [drivers, setDrivers] = useState<
    Awaited<ReturnType<typeof WorkflowApi.dispatchFleetAssets>>["drivers"]
  >([]);
  const [trucks, setTrucks] = useState<Awaited<ReturnType<typeof WorkflowApi.dispatchFleetAssets>>["trucks"]>(
    [],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await WorkflowApi.dispatchFleetAssets();
      setDrivers(data.drivers);
      setTrucks(data.trucks);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load fleet assets.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "#4CAF50";
      case "on_trip":
        return "#FF6B6B";
      case "on_break":
        return "#FF9800";
      case "off_duty":
        return "#999";
      case "in_use":
        return "#FF6B6B";
      case "maintenance":
        return "#F44336";
      case "inspection":
        return "#2196F3";
      default:
        return "#999";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "available":
        return "✓ Available";
      case "on_trip":
        return "On Trip";
      case "on_break":
        return "On Break";
      case "off_duty":
        return "Off Duty";
      case "in_use":
        return "In Use";
      case "maintenance":
        return "Under maintenance";
      case "inspection":
        return "Inspection";
      default:
        return status.replace(/_/g, " ");
    }
  };

  return (
    <div style={{ padding: "var(--page-main-padding)", display: "grid", gap: "2rem" }}>
      <div>
        <Link href="/dispatcher/dashboard" style={{ color: "#FF9800", textDecoration: "none", fontWeight: "600" }}>
          ← Back to Dashboard
        </Link>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem", marginTop: "1rem" }}>Assets Management</h1>
        <p style={{ color: "#666666", margin: "0" }}>Manage drivers and vehicles</p>
      </div>

      {loadError && (
        <div
          role="alert"
          style={{
            padding: "1rem",
            borderRadius: "8px",
            background: "rgba(244, 67, 54, 0.08)",
            border: "1px solid rgba(244, 67, 54, 0.4)",
            color: "#c62828",
          }}
        >
          {loadError}{" "}
          <button
            type="button"
            onClick={() => refresh()}
            style={{
              marginLeft: "0.5rem",
              padding: "0.25rem 0.6rem",
              borderRadius: "4px",
              border: "1px solid #c62828",
              background: "white",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Retry
          </button>
        </div>
      )}

      <div style={{ display: "flex", gap: "0.5rem", borderBottom: "2px solid #E8E8E8" }}>
        <button
          type="button"
          onClick={() => setActiveTab("drivers")}
          style={{
            padding: "0.75rem 1.5rem",
            background: activeTab === "drivers" ? "#FF9800" : "transparent",
            color: activeTab === "drivers" ? "white" : "#1A1A1A",
            border: "none",
            cursor: "pointer",
            fontWeight: "600",
            borderRadius: "6px 6px 0 0",
          }}
        >
          Drivers ({loading ? "…" : drivers.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("vehicles")}
          style={{
            padding: "0.75rem 1.5rem",
            background: activeTab === "vehicles" ? "#FF9800" : "transparent",
            color: activeTab === "vehicles" ? "white" : "#1A1A1A",
            border: "none",
            cursor: "pointer",
            fontWeight: "600",
            borderRadius: "6px 6px 0 0",
          }}
        >
          Vehicles ({loading ? "…" : trucks.length})
        </button>
      </div>

      {activeTab === "drivers" && (
        <div style={{ display: "grid", gap: "1rem" }}>
          {loading && <p style={{ margin: 0, color: "#666" }}>Loading drivers…</p>}
          {!loading && drivers.length === 0 && (
            <p style={{ margin: 0, color: "#666" }}>No driver accounts found in the database.</p>
          )}
          {!loading &&
            drivers.map((driver) => {
              const uiStatus = driver.status === "on_trip" ? "on_trip" : "available";
              return (
                <div
                  key={driver.id}
                  style={{
                    padding: "1.5rem",
                    border: `2px solid ${getStatusColor(uiStatus)}`,
                    borderRadius: "8px",
                    background: "#F9F9F9",
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr auto",
                    gap: "1.5rem",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <h3 style={{ color: "#1A1A1A", margin: "0" }}>{driver.name}</h3>
                    <p style={{ color: "#999", fontSize: "0.85rem", margin: "0.25rem 0 0 0" }}>
                      Driver ID {driver.id}
                    </p>
                  </div>

                  <div>
                    <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>ASSIGNED TRUCK</p>
                    <p style={{ color: "#1A1A1A", fontWeight: "600", margin: "0.25rem 0 0 0" }}>
                      {driver.assigned_truck_code ?? "—"}
                    </p>
                    <p style={{ color: "#2196F3", fontSize: "0.85rem", margin: "0.25rem 0 0 0" }}>{driver.phone || "—"}</p>
                  </div>

                  <div>
                    <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>PERFORMANCE</p>
                    <p style={{ color: "#1A1A1A", fontWeight: "600", margin: "0.25rem 0 0 0" }}>
                      ★ {driver.rating} • {driver.completed_trips} completed trip{driver.completed_trips === 1 ? "" : "s"}
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem", flexDirection: "column", alignItems: "flex-end" }}>
                    <span
                      style={{
                        padding: "0.4rem 0.75rem",
                        background: getStatusColor(uiStatus) + "20",
                        color: getStatusColor(uiStatus),
                        borderRadius: "4px",
                        fontWeight: "600",
                        fontSize: "0.75rem",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {getStatusLabel(uiStatus)}
                    </span>
                    <button
                      type="button"
                      style={{
                        padding: "0.4rem 0.75rem",
                        background: "#2196F3",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontWeight: "600",
                        fontSize: "0.75rem",
                      }}
                      onClick={() => {
                        announce(`Opening assignments to schedule ${driver.name}`);
                        router.push(
                          `/dispatcher/job-assignments?fromDriver=${encodeURIComponent(String(driver.id))}&driverName=${encodeURIComponent(driver.name)}`,
                        );
                      }}
                    >
                      Assign
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {activeTab === "vehicles" && (
        <div style={{ display: "grid", gap: "1rem" }}>
          {loading && <p style={{ margin: 0, color: "#666" }}>Loading vehicles…</p>}
          {!loading && trucks.length === 0 && (
            <p style={{ margin: 0, color: "#666" }}>
              No vehicles in the fleet yet. Admins can add trucks under System → Vehicle Management.
            </p>
          )}
          {!loading &&
            trucks.map((vehicle) => (
              <div
                key={vehicle.id}
                style={{
                  padding: "1.5rem",
                  border: `2px solid ${getStatusColor(vehicle.status)}`,
                  borderRadius: "8px",
                  background: "#F9F9F9",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr auto",
                    gap: "1.5rem",
                    alignItems: "center",
                    marginBottom: "0.75rem",
                  }}
                >
                  <div>
                    <h3 style={{ color: "#1A1A1A", margin: "0" }}>{vehicle.plate}</h3>
                    <p style={{ color: "#999", fontSize: "0.85rem", margin: "0.25rem 0 0 0" }}>
                      {vehicle.model_name?.trim() ? vehicle.model_name : "Model not set"}
                    </p>
                  </div>

                  <div>
                    <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>DRIVER</p>
                    <p style={{ color: "#1A1A1A", fontWeight: "600", margin: "0.25rem 0 0 0" }}>
                      {vehicle.assigned_driver_name || "Not assigned"}
                    </p>
                  </div>

                  <div>
                    <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>ODOMETER & CAPACITY</p>
                    <p style={{ color: "#1A1A1A", fontWeight: "600", margin: "0.25rem 0 0 0" }}>
                      {Math.round(vehicle.odometer_km).toLocaleString()} km • {vehicle.capacity_tons} t max
                    </p>
                  </div>

                  <span
                    style={{
                      padding: "0.4rem 0.75rem",
                      background: getStatusColor(vehicle.status) + "20",
                      color: getStatusColor(vehicle.status),
                      borderRadius: "4px",
                      fontWeight: "600",
                      fontSize: "0.75rem",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {getStatusLabel(vehicle.status)}
                  </span>
                </div>

                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    style={{
                      padding: "0.4rem 0.75rem",
                      background: "#2196F3",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontWeight: "600",
                      fontSize: "0.75rem",
                    }}
                    onClick={() => {
                      setExpandedVehicleId((prev) => {
                        const next = prev === vehicle.id ? null : vehicle.id;
                        announce(next ? `Showing details for ${vehicle.plate}` : "Vehicle details hidden");
                        return next;
                      });
                    }}
                  >
                    {expandedVehicleId === vehicle.id ? "Hide details" : "View Details"}
                  </button>
                </div>

                {expandedVehicleId === vehicle.id && (
                  <div
                    style={{
                      marginTop: "0.75rem",
                      padding: "0.85rem",
                      background: "#fff",
                      border: "1px solid #E0E0E0",
                      borderRadius: "6px",
                      fontSize: "0.85rem",
                    }}
                  >
                    <p style={{ margin: "0 0 0.35rem 0", fontWeight: 700 }}>Truck #{vehicle.id}</p>
                    <p style={{ margin: 0, color: "#555" }}>
                      Recorded status: {vehicle.db_status}. Age {vehicle.age_years} yr
                      {vehicle.age_years === 1 ? "" : "s"}. Capacity {vehicle.capacity_tons} t.
                    </p>
                    <button
                      type="button"
                      style={{
                        marginTop: "0.65rem",
                        padding: "0.35rem 0.65rem",
                        background: "#FF9800",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontWeight: 600,
                        fontSize: "0.75rem",
                      }}
                      onClick={() => {
                        announce(`Opening trip monitoring for fleet overview`);
                        router.push("/dispatcher/trip-monitoring");
                      }}
                    >
                      Open trip monitoring
                    </button>
                  </div>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
