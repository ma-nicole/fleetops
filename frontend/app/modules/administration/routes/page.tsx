"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Breadcrumbs from "@/components/Breadcrumbs";
import { useState } from "react";

type Route = {
  id: number;
  name: string;
  pickup_city: string;
  dropoff_city: string;
  estimated_distance: number;
  estimated_duration: number;
  base_fare: number;
  status: "active" | "inactive" | "seasonal";
  frequency: string;
};

export default function RoutesPage() {
  useRoleGuard(["admin"]);

  const [routes] = useState<Route[]>([
    {
      id: 1,
      name: "NYC to Philadelphia",
      pickup_city: "New York, NY",
      dropoff_city: "Philadelphia, PA",
      estimated_distance: 95,
      estimated_duration: 2.5,
      base_fare: 150,
      status: "active",
      frequency: "Daily",
    },
    {
      id: 2,
      name: "Boston to NYC",
      pickup_city: "Boston, MA",
      dropoff_city: "New York, NY",
      estimated_distance: 215,
      estimated_duration: 4,
      base_fare: 180,
      status: "active",
      frequency: "Daily",
    },
    {
      id: 3,
      name: "Philadelphia to DC",
      pickup_city: "Philadelphia, PA",
      dropoff_city: "Washington, DC",
      estimated_distance: 140,
      estimated_duration: 3,
      base_fare: 120,
      status: "active",
      frequency: "5 times/week",
    },
    {
      id: 4,
      name: "DC to Atlanta",
      pickup_city: "Washington, DC",
      dropoff_city: "Atlanta, GA",
      estimated_distance: 640,
      estimated_duration: 10,
      base_fare: 200,
      status: "seasonal",
      frequency: "3 times/week",
    },
  ]);

  const [selectedRoute, setSelectedRoute] = useState<number | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "#4CAF50";
      case "seasonal":
        return "#FF9800";
      case "inactive":
        return "#F44336";
      default:
        return "#999";
    }
  };

  return (
    <div className="container" style={{ paddingTop: "2rem" }}>
      <Breadcrumbs
        items={[
          { label: "Modules", href: "/dashboard/admin" },
          { label: "System Administration" },
          { label: "Route Mappings" },
        ]}
      />

      <div style={{ marginTop: "2rem" }}>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem" }}>
          🗺️ Route Mappings
        </h1>
        <p style={{ color: "#666666", marginBottom: "1.5rem" }}>
          Configure and manage delivery routes. Set pricing and frequency for each route.
        </p>

        {/* Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "1rem",
            marginBottom: "2rem",
          }}
        >
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#1A1A1A" }}>
              {routes.length}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>
              Total Routes
            </div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#4CAF50" }}>
              {routes.filter((r) => r.status === "active").length}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Active</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: "2rem",
                fontWeight: 700,
                color: "#FF9800",
              }}
            >
              {routes.filter((r) => r.status === "seasonal").length}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Seasonal</div>
          </div>
        </div>

        {/* Routes List */}
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {routes.map((route) => (
            <div
              key={route.id}
              className="card"
              onClick={() =>
                setSelectedRoute(selectedRoute === route.id ? null : route.id)
              }
              style={{
                padding: "1rem",
                cursor: "pointer",
                background:
                  selectedRoute === route.id
                    ? "rgba(255, 152, 0, 0.15)"
                    : "#FFFFFF",
                border:
                  selectedRoute === route.id
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
                    <strong style={{ color: "#1A1A1A" }}>{route.name}</strong>
                    <span
                      style={{
                        padding: "0.25rem 0.75rem",
                        background: getStatusColor(route.status),
                        color: "white",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        textTransform: "capitalize",
                      }}
                    >
                      {route.status}
                    </span>
                  </div>
                  <p style={{ margin: "0.25rem 0", color: "#666666", fontSize: "0.9rem" }}>
                    {route.pickup_city} → {route.dropoff_city}
                  </p>
                  <p style={{ margin: "0.25rem 0", color: "#999", fontSize: "0.85rem" }}>
                    {route.estimated_distance}km | {route.estimated_duration}h |{" "}
                    {route.frequency}
                  </p>
                </div>
                <div
                  style={{
                    textAlign: "right",
                    marginLeft: "1rem",
                    whiteSpace: "nowrap",
                  }}
                >
                  <div style={{ color: "#FF9800", fontWeight: 700, fontSize: "1.1rem" }}>
                    ${route.base_fare.toFixed(2)}
                  </div>
                  <p
                    style={{
                      color: "#666666",
                      fontSize: "0.85rem",
                      margin: "0.25rem 0 0 0",
                    }}
                  >
                    Base Fare
                  </p>
                </div>
              </div>

              {selectedRoute === route.id && (
                <div
                  style={{
                    background: "rgba(255, 152, 0, 0.08)",
                    border: "1px solid #FFE0B2",
                    borderRadius: "8px",
                    padding: "1rem",
                    marginTop: "1rem",
                  }}
                >
                  <h4 style={{ color: "#1A1A1A", margin: "0 0 1rem 0" }}>
                    Route Details
                  </h4>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "1rem",
                    }}
                  >
                    <div>
                      <p style={{ color: "#666666", fontSize: "0.85rem" }}>
                        Distance
                      </p>
                      <p style={{ color: "#1A1A1A", fontWeight: 700 }}>
                        {route.estimated_distance} km
                      </p>
                    </div>
                    <div>
                      <p style={{ color: "#666666", fontSize: "0.85rem" }}>
                        Estimated Duration
                      </p>
                      <p style={{ color: "#1A1A1A", fontWeight: 700 }}>
                        {route.estimated_duration} hours
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
