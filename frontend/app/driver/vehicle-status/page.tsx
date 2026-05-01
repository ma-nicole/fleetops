"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Link from "next/link";
import { useState } from "react";

type VehicleStatus = {
  plate: string;
  model: string;
  status: string;
  mileage: string;
  fuelLevel: number;
  lastService: string;
  nextService: string;
  tireCondition: string;
  brakeCondition: string;
  batteryCondition: string;
};

export default function VehicleStatusPage() {
  useRoleGuard(["driver"]);

  const [vehicle] = useState<VehicleStatus>({
    plate: "AUV-2024-1447",
    model: "Hino 500 - 6 Wheels Truck",
    status: "operational",
    mileage: "158,420 km",
    fuelLevel: 85,
    lastService: "April 15, 2024",
    nextService: "May 15, 2024 (30 days)",
    tireCondition: "Good",
    brakeCondition: "Excellent",
    batteryCondition: "Good",
  });

  const [issues] = useState([
    {
      id: 1,
      type: "Minor",
      description: "Left mirror slightly loose",
      severity: "low",
      reportedDate: "April 28, 2024",
      status: "reported",
    },
    {
      id: 2,
      type: "Maintenance",
      description: "Oil change overdue (last 5000km ago)",
      severity: "medium",
      reportedDate: "April 29, 2024",
      status: "scheduled",
    },
  ]);

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case "Excellent":
        return "#4CAF50";
      case "Good":
        return "#8BC34A";
      case "Fair":
        return "#FF9800";
      case "Poor":
        return "#F44336";
      default:
        return "#999";
    }
  };

  return (
    <div style={{ padding: "2rem", display: "grid", gap: "2rem" }}>
      <div>
        <Link href="/driver/dashboard" style={{ color: "#FF9800", textDecoration: "none", fontWeight: "600" }}>
          ← Back to Dashboard
        </Link>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem", marginTop: "1rem" }}>Vehicle Status</h1>
        <p style={{ color: "#666666", margin: "0" }}>Monitor your assigned vehicle condition and maintenance schedule</p>
      </div>

      {/* Vehicle Info Card */}
      <div style={{ padding: "2rem", border: "2px solid #2196F3", borderRadius: "8px", background: "rgba(33, 150, 243, 0.05)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "1.5rem" }}>
          <div>
            <h2 style={{ color: "#1A1A1A", margin: "0" }}>{vehicle.model}</h2>
            <p style={{ color: "#999", margin: "0.5rem 0 0 0", fontSize: "0.95rem" }}>Plate: {vehicle.plate}</p>
          </div>
          <span
            style={{
              padding: "0.75rem 1.5rem",
              background: "#4CAF50",
              color: "white",
              borderRadius: "6px",
              fontWeight: "600",
              fontSize: "0.9rem",
            }}
          >
             Operational
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1.5rem" }}>
          <div>
            <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>MILEAGE</p>
            <p style={{ color: "#1A1A1A", fontSize: "1.2rem", fontWeight: "700", margin: "0.5rem 0 0 0" }}>
              {vehicle.mileage}
            </p>
          </div>
          <div>
            <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>FUEL LEVEL</p>
            <div style={{ marginTop: "0.5rem" }}>
              <div
                style={{
                  height: "8px",
                  background: "#E8E8E8",
                  borderRadius: "4px",
                  overflow: "hidden",
                  marginBottom: "0.5rem",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${vehicle.fuelLevel}%`,
                    background: vehicle.fuelLevel > 25 ? "#4CAF50" : "#F44336",
                  }}
                />
              </div>
              <p style={{ color: "#1A1A1A", fontSize: "0.9rem", fontWeight: "600", margin: "0" }}>
                {vehicle.fuelLevel}%
              </p>
            </div>
          </div>
          <div>
            <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>LAST SERVICE</p>
            <p style={{ color: "#1A1A1A", fontSize: "0.9rem", fontWeight: "600", margin: "0.5rem 0 0 0" }}>
              {vehicle.lastService}
            </p>
          </div>
          <div>
            <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>NEXT SERVICE</p>
            <p style={{ color: "#2196F3", fontSize: "0.9rem", fontWeight: "600", margin: "0.5rem 0 0 0" }}>
              {vehicle.nextService}
            </p>
          </div>
        </div>
      </div>

      {/* Vehicle Components */}
      <div>
        <h2 style={{ color: "#1A1A1A", marginBottom: "1.5rem" }}>Component Condition</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.5rem" }}>
          <div style={{ padding: "1.5rem", border: "1px solid #E8E8E8", borderRadius: "8px", background: "#F9F9F9" }}>
            <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>TIRES</p>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.75rem" }}>
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  background: getConditionColor(vehicle.tireCondition),
                }}
              />
              <p style={{ color: "#1A1A1A", fontWeight: "600", margin: "0" }}>{vehicle.tireCondition}</p>
            </div>
            <p style={{ color: "#666666", fontSize: "0.8rem", margin: "0.75rem 0 0 0" }}>All 6 tires properly inflated</p>
          </div>

          <div style={{ padding: "1.5rem", border: "1px solid #E8E8E8", borderRadius: "8px", background: "#F9F9F9" }}>
            <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>BRAKES</p>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.75rem" }}>
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  background: getConditionColor(vehicle.brakeCondition),
                }}
              />
              <p style={{ color: "#1A1A1A", fontWeight: "600", margin: "0" }}>{vehicle.brakeCondition}</p>
            </div>
            <p style={{ color: "#666666", fontSize: "0.8rem", margin: "0.75rem 0 0 0" }}>All brake systems functional</p>
          </div>

          <div style={{ padding: "1.5rem", border: "1px solid #E8E8E8", borderRadius: "8px", background: "#F9F9F9" }}>
            <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>BATTERY</p>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.75rem" }}>
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  background: getConditionColor(vehicle.batteryCondition),
                }}
              />
              <p style={{ color: "#1A1A1A", fontWeight: "600", margin: "0" }}>{vehicle.batteryCondition}</p>
            </div>
            <p style={{ color: "#666666", fontSize: "0.8rem", margin: "0.75rem 0 0 0" }}>Battery voltage stable</p>
          </div>
        </div>
      </div>

      {/* Maintenance Issues */}
      <div>
        <h2 style={{ color: "#1A1A1A", marginBottom: "1.5rem" }}>Reported Issues</h2>
        <div style={{ display: "grid", gap: "1rem" }}>
          {issues.map((issue) => (
            <div
              key={issue.id}
              style={{
                padding: "1.5rem",
                border: issue.severity === "high" ? "2px solid #F44336" : "1px solid #E8E8E8",
                borderRadius: "8px",
                background: "#F9F9F9",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "0.75rem" }}>
                <div>
                  <h3 style={{ color: "#1A1A1A", margin: "0" }}>{issue.description}</h3>
                  <p style={{ color: "#999", fontSize: "0.85rem", margin: "0.5rem 0 0 0" }}>Type: {issue.type}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span
                    style={{
                      padding: "0.4rem 0.8rem",
                      background:
                        issue.severity === "high"
                          ? "#F4433620"
                          : issue.severity === "medium"
                            ? "#FF980020"
                            : "#2196F320",
                      color:
                        issue.severity === "high"
                          ? "#F44336"
                          : issue.severity === "medium"
                            ? "#FF9800"
                            : "#2196F3",
                      borderRadius: "4px",
                      fontWeight: "600",
                      fontSize: "0.75rem",
                    }}
                  >
                    {issue.severity.toUpperCase()}
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", gap: "2rem", fontSize: "0.85rem" }}>
                <div>
                  <p style={{ color: "#999", margin: "0" }}>Reported: {issue.reportedDate}</p>
                </div>
                <div>
                  <p style={{ color: issue.status === "scheduled" ? "#4CAF50" : "#FF9800", margin: "0", fontWeight: "600" }}>
                    {issue.status === "scheduled" ? "✓ Maintenance Scheduled" : "⏳ Awaiting Action"}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Log New Issue */}
      <div style={{ padding: "1.5rem", border: "1px solid #E8E8E8", borderRadius: "8px", background: "#F9F9F9" }}>
        <h3 style={{ color: "#1A1A1A", margin: "0 0 1rem 0" }}>Report a New Issue</h3>
        <textarea
          placeholder="Describe any vehicle issues or problems you've noticed..."
          style={{
            width: "100%",
            padding: "0.75rem",
            border: "1px solid #E8E8E8",
            borderRadius: "6px",
            fontFamily: "inherit",
            minHeight: "80px",
            marginBottom: "1rem",
            boxSizing: "border-box",
          }}
        />
        <button
          style={{
            padding: "0.75rem 1.5rem",
            background: "#FF9800",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "600",
          }}
          onClick={() => alert("Issue reported successfully")}
        >
          Submit Report
        </button>
      </div>
    </div>
  );
}
