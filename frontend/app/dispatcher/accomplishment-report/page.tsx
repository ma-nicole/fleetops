"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Link from "next/link";
import { useState } from "react";

type AccomplishmentReport = {
  reportId: string;
  driverName: string;
  tripId: string;
  date: string;
  startOdometer: string;
  endOdometer: string;
  fuelConsumed: string;
  issues: string;
  status: "pending" | "reviewed" | "approved" | "archived";
};

export default function AccomplishmentReportPage() {
  useRoleGuard(["dispatcher"]);

  const [reports] = useState<AccomplishmentReport[]>([
    {
      reportId: "REP-2024-0001",
      driverName: "Carlos Rodriguez",
      tripId: "TRIP-001",
      date: "2024-04-10",
      startOdometer: "158,420 km",
      endOdometer: "158,455 km",
      fuelConsumed: "12.5 L",
      issues: "None",
      status: "reviewed",
    },
    {
      reportId: "REP-2024-0002",
      driverName: "Maria Santos",
      tripId: "TRIP-002",
      date: "2024-04-10",
      startOdometer: "142,200 km",
      endOdometer: "142,268 km",
      fuelConsumed: "15.2 L",
      issues: "Minor traffic delay",
      status: "pending",
    },
    {
      reportId: "REP-2024-0003",
      driverName: "Juan Dela Cruz",
      tripId: "TRIP-003",
      date: "2024-04-10",
      startOdometer: "165,800 km",
      endOdometer: "165,842 km",
      fuelConsumed: "10.8 L",
      issues: "None",
      status: "approved",
    },
    {
      reportId: "REP-2024-0004",
      driverName: "Miguel Reyes",
      tripId: "TRIP-004",
      date: "2024-04-09",
      startOdometer: "172,100 km",
      endOdometer: "172,185 km",
      fuelConsumed: "18.5 L",
      issues: "Vehicle inspection recommended",
      status: "approved",
    },
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "#2196F3";
      case "reviewed":
        return "#FF9800";
      case "approved":
        return "#4CAF50";
      case "archived":
        return "#999";
      default:
        return "#999";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "📋 Pending Review";
      case "reviewed":
        return "👀 Reviewed";
      case "approved":
        return "✅ Approved";
      case "archived":
        return "🗂️ Archived";
      default:
        return "Unknown";
    }
  };

  return (
    <div style={{ padding: "2rem", display: "grid", gap: "2rem" }}>
      <div>
        <Link href="/dispatcher/dashboard" style={{ color: "#FF9800", textDecoration: "none", fontWeight: "600" }}>
          ← Back to Dashboard
        </Link>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem", marginTop: "1rem" }}>Accomplishment Reports</h1>
        <p style={{ color: "#666666", margin: "0" }}>Review driver trip completion reports</p>
      </div>

      {/* Filter Section */}
      <div
        style={{
          padding: "1.5rem",
          border: "1px solid #E8E8E8",
          borderRadius: "8px",
          background: "#F9F9F9",
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "1rem",
        }}
      >
        <div>
          <label style={{ display: "block", fontWeight: "600", marginBottom: "0.5rem", color: "#1A1A1A" }}>
            Status
          </label>
          <select
            style={{
              width: "100%",
              padding: "0.6rem",
              border: "1px solid #E8E8E8",
              borderRadius: "6px",
              backgroundColor: "white",
            }}
          >
            <option>All</option>
            <option>Pending</option>
            <option>Reviewed</option>
            <option>Approved</option>
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontWeight: "600", marginBottom: "0.5rem", color: "#1A1A1A" }}>
            Driver
          </label>
          <select
            style={{
              width: "100%",
              padding: "0.6rem",
              border: "1px solid #E8E8E8",
              borderRadius: "6px",
              backgroundColor: "white",
            }}
          >
            <option>All Drivers</option>
            <option>Carlos Rodriguez</option>
            <option>Maria Santos</option>
            <option>Juan Dela Cruz</option>
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontWeight: "600", marginBottom: "0.5rem", color: "#1A1A1A" }}>
            Date Range
          </label>
          <input
            type="date"
            style={{
              width: "100%",
              padding: "0.6rem",
              border: "1px solid #E8E8E8",
              borderRadius: "6px",
            }}
          />
        </div>
      </div>

      {/* Reports List */}
      <div style={{ display: "grid", gap: "1rem" }}>
        {reports.map((report) => (
          <div
            key={report.reportId}
            style={{
              padding: "1.5rem",
              border: `1px solid #E8E8E8`,
              borderRadius: "8px",
              background: "#F9F9F9",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr auto",
                gap: "1.5rem",
                marginBottom: "1rem",
                alignItems: "center",
              }}
            >
              <div>
                <h3 style={{ color: "#1A1A1A", margin: "0" }}>{report.reportId}</h3>
                <p style={{ color: "#999", fontSize: "0.85rem", margin: "0.25rem 0 0 0" }}>
                  {report.driverName} • {report.tripId}
                </p>
              </div>

              <div>
                <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>REPORT DATE</p>
                <p style={{ color: "#1A1A1A", fontWeight: "600", margin: "0.25rem 0 0 0" }}>
                  {report.date}
                </p>
              </div>

              <div>
                <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>DISTANCE</p>
                <p style={{ color: "#1A1A1A", fontWeight: "600", margin: "0.25rem 0 0 0" }}>
                  {report.endOdometer} (from {report.startOdometer})
                </p>
              </div>

              <span
                style={{
                  padding: "0.4rem 0.75rem",
                  background: getStatusColor(report.status) + "20",
                  color: getStatusColor(report.status),
                  borderRadius: "4px",
                  fontWeight: "600",
                  fontSize: "0.75rem",
                  whiteSpace: "nowrap",
                }}
              >
                {getStatusLabel(report.status)}
              </span>
            </div>

            <div
              style={{
                padding: "1rem",
                background: "white",
                borderRadius: "6px",
                border: "1px solid #E8E8E8",
                marginBottom: "1rem",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1rem",
              }}
            >
              <div>
                <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>FUEL CONSUMED</p>
                <p style={{ color: "#1A1A1A", fontWeight: "600", margin: "0.25rem 0 0 0" }}>
                  {report.fuelConsumed}
                </p>
              </div>
              <div>
                <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>ISSUES REPORTED</p>
                <p
                  style={{
                    color: report.issues === "None" ? "#4CAF50" : "#F44336",
                    fontWeight: "600",
                    margin: "0.25rem 0 0 0",
                  }}
                >
                  {report.issues}
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.5rem" }}>
              {report.status === "pending" && (
                <>
                  <button
                    style={{
                      padding: "0.5rem 1rem",
                      background: "#FF9800",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontWeight: "600",
                      fontSize: "0.85rem",
                    }}
                    onClick={() => alert("Reviewing report " + report.reportId)}
                  >
                    Review
                  </button>
                  <button
                    style={{
                      padding: "0.5rem 1rem",
                      background: "#F44336",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontWeight: "600",
                      fontSize: "0.85rem",
                    }}
                    onClick={() => alert("Rejecting report...")}
                  >
                    Reject
                  </button>
                </>
              )}
              {report.status === "reviewed" && (
                <button
                  style={{
                    padding: "0.5rem 1rem",
                    background: "#4CAF50",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: "600",
                    fontSize: "0.85rem",
                  }}
                  onClick={() => alert("Approving report...")}
                >
                  Approve
                </button>
              )}
              <Link
                href="/dispatcher/dashboard"
                style={{
                  padding: "0.5rem 1rem",
                  background: "#F5F5F5",
                  color: "#1A1A1A",
                  border: "1px solid #E8E8E8",
                  borderRadius: "4px",
                  textDecoration: "none",
                  fontWeight: "600",
                  fontSize: "0.85rem",
                }}
              >
                View Full Report
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
