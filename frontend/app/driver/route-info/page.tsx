"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Link from "next/link";
import { useState } from "react";

type RouteInfo = {
  id: string;
  pickupAddress: string;
  dropoffAddress: string;
  distance: string;
  estimatedDuration: string;
  roadCondition: string;
  tollGates: number;
  waypoints: string[];
};

export default function RouteInfoPage() {
  useRoleGuard(["driver"]);

  const [route] = useState<RouteInfo>({
    id: "RT-2024-0142",
    pickupAddress: "Makati Distribution Center, Makati CBD",
    dropoffAddress: "Quezon City Warehouse, Quezon Ave",
    distance: "28 km",
    estimatedDuration: "2 hours 15 minutes",
    roadCondition: "Moderate Traffic",
    tollGates: 3,
    waypoints: [
      "EDSA (North) - Makati",
      "Skyway via NLEX",
      "Commonwealth Avenue - Quezon City",
      "Quezon Avenue - Destination",
    ],
  });

  const [alternatives] = useState([
    {
      name: "Alternative Route 1",
      distance: "32 km",
      duration: "2 hours 45 minutes",
      tollCost: "$12.50",
      trafficLevel: "Low",
    },
    {
      name: "Alternative Route 2",
      distance: "26 km",
      duration: "2 hours 20 minutes",
      tollCost: "$8.75",
      trafficLevel: "Moderate",
    },
    {
      name: "Alternative Route 3",
      distance: "30 km",
      duration: "2 hours 50 minutes",
      tollCost: "$10.00",
      trafficLevel: "Light",
    },
  ]);

  return (
    <div style={{ padding: "2rem", display: "grid", gap: "2rem" }}>
      <div>
        <Link href="/driver/dashboard" style={{ color: "#FF9800", textDecoration: "none", fontWeight: "600" }}>
          ← Back to Dashboard
        </Link>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem", marginTop: "1rem" }}>Route Information</h1>
        <p style={{ color: "#666666", margin: "0" }}>Current route details and alternative options</p>
      </div>

      {/* Primary Route */}
      <div style={{ padding: "2rem", border: "2px solid #FF9800", borderRadius: "8px", background: "rgba(255, 152, 0, 0.05)" }}>
        <h2 style={{ color: "#FF9800", marginBottom: "1.5rem" }}>Primary Route: {route.id}</h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", marginBottom: "1.5rem" }}>
          <div>
            <p style={{ color: "#999", fontSize: "0.8rem", fontWeight: "600", margin: "0" }}>PICKUP LOCATION</p>
            <p style={{ color: "#1A1A1A", fontSize: "0.95rem", fontWeight: "600", margin: "0.5rem 0 0 0" }}>
              {route.pickupAddress}
            </p>
          </div>
          <div>
            <p style={{ color: "#999", fontSize: "0.8rem", fontWeight: "600", margin: "0" }}>DROPOFF LOCATION</p>
            <p style={{ color: "#1A1A1A", fontSize: "0.95rem", fontWeight: "600", margin: "0.5rem 0 0 0" }}>
              {route.dropoffAddress}
            </p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "1rem", paddingBottom: "1.5rem", borderBottom: "1px solid #E8E8E8" }}>
          <div>
            <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>DISTANCE</p>
            <p style={{ color: "#1A1A1A", fontSize: "1.1rem", fontWeight: "700", margin: "0.5rem 0 0 0" }}>
              {route.distance}
            </p>
          </div>
          <div>
            <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>DURATION</p>
            <p style={{ color: "#1A1A1A", fontSize: "0.9rem", fontWeight: "600", margin: "0.5rem 0 0 0" }}>
              {route.estimatedDuration}
            </p>
          </div>
          <div>
            <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>TRAFFIC</p>
            <p style={{ color: "#FF9800", fontSize: "0.9rem", fontWeight: "600", margin: "0.5rem 0 0 0" }}>
              {route.roadCondition}
            </p>
          </div>
          <div>
            <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>TOLL GATES</p>
            <p style={{ color: "#1A1A1A", fontSize: "1.1rem", fontWeight: "700", margin: "0.5rem 0 0 0" }}>
              {route.tollGates}
            </p>
          </div>
          <div>
            <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>TOLL COST</p>
            <p style={{ color: "#4CAF50", fontSize: "0.9rem", fontWeight: "700", margin: "0.5rem 0 0 0" }}>
              ~$10.50
            </p>
          </div>
        </div>

        <h3 style={{ color: "#1A1A1A", marginBottom: "1rem", marginTop: "1.5rem" }}>Waypoints:</h3>
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {route.waypoints.map((waypoint, idx) => (
            <div
              key={idx}
              style={{
                padding: "0.75rem",
                background: "white",
                border: "1px solid #E8E8E8",
                borderRadius: "4px",
              }}
            >
              <p style={{ color: "#1A1A1A", fontWeight: "600", margin: "0" }}>
                {idx + 1}. {waypoint}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Alternative Routes */}
      <div>
        <h2 style={{ color: "#1A1A1A", marginBottom: "1.5rem" }}>Alternative Routes</h2>
        <div style={{ display: "grid", gap: "1rem" }}>
          {alternatives.map((alt, idx) => (
            <div
              key={idx}
              style={{
                padding: "1.5rem",
                border: "1px solid #E8E8E8",
                borderRadius: "8px",
                background: "#FAFAFA",
                display: "grid",
                gridTemplateColumns: "1fr auto",
                alignItems: "center",
              }}
            >
              <div>
                <h3 style={{ color: "#1A1A1A", margin: "0", fontSize: "1rem" }}>{alt.name}</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "2rem", marginTop: "1rem" }}>
                  <div>
                    <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>DISTANCE</p>
                    <p style={{ color: "#1A1A1A", fontWeight: "600", margin: "0.25rem 0 0 0" }}>{alt.distance}</p>
                  </div>
                  <div>
                    <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>DURATION</p>
                    <p style={{ color: "#1A1A1A", fontWeight: "600", margin: "0.25rem 0 0 0" }}>{alt.duration}</p>
                  </div>
                  <div>
                    <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>TRAFFIC</p>
                    <p style={{ color: "#2196F3", fontWeight: "600", margin: "0.25rem 0 0 0" }}>{alt.trafficLevel}</p>
                  </div>
                  <div>
                    <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>TOLL COST</p>
                    <p style={{ color: "#4CAF50", fontWeight: "700", margin: "0.25rem 0 0 0" }}>{alt.tollCost}</p>
                  </div>
                </div>
              </div>
              <button
                style={{
                  padding: "0.75rem 1.5rem",
                  background: "#2196F3",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontWeight: "600",
                  fontSize: "0.85rem",
                  whiteSpace: "nowrap",
                }}
              >
                Use Route
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Safety Tips */}
      <div style={{ padding: "1.5rem", background: "#E3F2FD", borderRadius: "8px", border: "1px solid #2196F3" }}>
        <p style={{ color: "#1565C0", margin: "0", fontWeight: "600" }}> Safety Reminders:</p>
        <ul style={{ color: "#1565C0", margin: "0.5rem 0 0 0", paddingLeft: "1.5rem" }}>
          <li>Check weather conditions before departure</li>
          <li>Ensure all cargo is properly secured</li>
          <li>Take breaks every 3 hours during long trips</li>
          <li>Report any road hazards immediately</li>
        </ul>
      </div>
    </div>
  );
}
