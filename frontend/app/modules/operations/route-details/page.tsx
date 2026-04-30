"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Breadcrumbs from "@/components/Breadcrumbs";
import { useState } from "react";

type RouteDetails = {
  name: string;
  pickup_city: string;
  dropoff_city: string;
  estimated_distance: string;
  estimated_duration: string;
  estimated_stops: number;
  cargo_restrictions?: string;
  hazmat_required?: boolean;
};

export default function RouteDetailsPage() {
  useRoleGuard(["driver"]);

  const [route] = useState<RouteDetails>({
    name: "NYC to Philadelphia Standard",
    pickup_city: "New York, NY",
    dropoff_city: "Philadelphia, PA",
    estimated_distance: "95 miles",
    estimated_duration: "2.5 hours",
    estimated_stops: 2,
    cargo_restrictions: "Weight limit: 25 tons. No hazardous materials.",
    hazmat_required: false,
  });

  const [showAlternatives, setShowAlternatives] = useState(false);

  const alternatives = [
    {
      name: "NYC to Philadelphia via New Jersey",
      distance: "98 miles",
      duration: "2.75 hours",
      toll_cost: "$18.50",
      traffic: "Light",
    },
    {
      name: "NYC to Philadelphia via I-95 Express",
      distance: "92 miles",
      duration: "2.25 hours",
      toll_cost: "$22.00",
      traffic: "Moderate",
    },
  ];

  return (
    <div className="container" style={{ paddingTop: "2rem" }}>
      <Breadcrumbs
        items={[
          { label: "Modules", href: "/dashboard/driver" },
          { label: "My Tasks" },
          { label: "Route Details & Navigation" },
        ]}
      />

      <div style={{ marginTop: "2rem" }}>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem" }}>
          🗺️ Route Details & Navigation
        </h1>
        <p style={{ color: "#666666", marginBottom: "1.5rem" }}>
          View your assigned route requirements and alternative route options.
        </p>

        {/* Main Route */}
        <div
          className="card"
          style={{
            padding: "1.5rem",
            background: "rgba(33, 150, 243, 0.1)",
            border: "1px solid #BBDEFB",
            marginBottom: "2rem",
          }}
        >
          <h2 style={{ color: "#1A1A1A", margin: "0 0 1rem 0" }}>
            {route.name}
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "1rem",
              marginBottom: "1.5rem",
            }}
          >
            <div className="card" style={{ padding: "1rem", textAlign: "center" }}>
              <p style={{ color: "#666666", fontSize: "0.9rem", margin: "0 0 0.5rem 0" }}>
                Distance
              </p>
              <p style={{ color: "#2196F3", fontWeight: 700, fontSize: "1.3rem" }}>
                {route.estimated_distance}
              </p>
            </div>
            <div className="card" style={{ padding: "1rem", textAlign: "center" }}>
              <p style={{ color: "#666666", fontSize: "0.9rem", margin: "0 0 0.5rem 0" }}>
                Duration
              </p>
              <p style={{ color: "#FF9800", fontWeight: 700, fontSize: "1.3rem" }}>
                {route.estimated_duration}
              </p>
            </div>
            <div className="card" style={{ padding: "1rem", textAlign: "center" }}>
              <p style={{ color: "#666666", fontSize: "0.9rem", margin: "0 0 0.5rem 0" }}>
                Stops
              </p>
              <p style={{ color: "#4CAF50", fontWeight: 700, fontSize: "1.3rem" }}>
                {route.estimated_stops}
              </p>
            </div>
          </div>

          <div style={{ borderTop: "1px solid #E3F2FD", paddingTop: "1rem" }}>
            <p style={{ margin: "0.5rem 0", color: "#666666" }}>
              <strong>📍 Pickup:</strong> {route.pickup_city}
            </p>
            <p style={{ margin: "0.5rem 0", color: "#666666" }}>
              <strong>📍 Dropoff:</strong> {route.dropoff_city}
            </p>
            {route.cargo_restrictions && (
              <p style={{ margin: "0.5rem 0", color: "#666666" }}>
                <strong>⚠️ Cargo Restrictions:</strong> {route.cargo_restrictions}
              </p>
            )}
            {route.hazmat_required && (
              <p style={{ margin: "0.5rem 0", color: "#F44336", fontWeight: 600 }}>
                <strong>🚨 Hazmat Required</strong>
              </p>
            )}
          </div>

          <button
            style={{
              marginTop: "1rem",
              padding: "0.75rem 1.5rem",
              background: "#2196F3",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            📱 Open GPS Navigation
          </button>
        </div>

        {/* Alternatives */}
        <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>
          Alternative Routes
        </h3>
        <button
          onClick={() => setShowAlternatives(!showAlternatives)}
          style={{
            marginBottom: "1rem",
            padding: "0.5rem 1rem",
            background: "#F0F0F0",
            color: "#1A1A1A",
            border: "1px solid #E8E8E8",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {showAlternatives ? "Hide" : "Show"} Alternative Routes
        </button>

        {showAlternatives && (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {alternatives.map((alt, index) => (
              <div key={index} className="card" style={{ padding: "1rem" }}>
                <p style={{ margin: "0 0 0.5rem 0", fontWeight: 600, color: "#1A1A1A" }}>
                  {alt.name}
                </p>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: "1rem",
                    marginBottom: "1rem",
                    fontSize: "0.85rem",
                  }}
                >
                  <div>
                    <p style={{ color: "#666666" }}>Distance</p>
                    <p style={{ color: "#1A1A1A", fontWeight: 600 }}>{alt.distance}</p>
                  </div>
                  <div>
                    <p style={{ color: "#666666" }}>Duration</p>
                    <p style={{ color: "#1A1A1A", fontWeight: 600 }}>{alt.duration}</p>
                  </div>
                  <div>
                    <p style={{ color: "#666666" }}>Toll Cost</p>
                    <p style={{ color: "#FF9800", fontWeight: 600 }}>{alt.toll_cost}</p>
                  </div>
                  <div>
                    <p style={{ color: "#666666" }}>Traffic</p>
                    <p style={{ color: "#1A1A1A", fontWeight: 600 }}>{alt.traffic}</p>
                  </div>
                </div>
                <button
                  style={{
                    padding: "0.5rem 1rem",
                    background: "#4CAF50",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                  }}
                >
                  Select This Route
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
