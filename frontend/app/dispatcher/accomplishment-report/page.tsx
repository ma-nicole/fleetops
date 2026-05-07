"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { announce } from "@/lib/useAnnouncer";

type AccomplishmentReport = {
  reportId: string;
  driverName: string;
  tripId: string;
  date: string;
  /** Odometer readings in km — trip distance derived for analytics display */
  startOdometerKm: number;
  endOdometerKm: number;
  /** Fuel used on this trip (L), consistent with distance × plausible km/L for a laden truck */
  fuelLiters: number;
  issues: string;
  status: "pending" | "reviewed" | "approved" | "archived" | "rejected";
};

function fmtOdom(n: number): string {
  return `${n.toLocaleString("en-US")} km`;
}

/** Liters consumed for trip km at ~6–8 km/L (urban lower, highway higher) */
function tripFuelEconomy(tripKm: number, liters: number): number | null {
  if (!liters || liters <= 0) return null;
  return tripKm / liters;
}

export default function AccomplishmentReportPage() {
  const [reports, setReports] = useState<AccomplishmentReport[]>([
    {
      reportId: "REP-2024-0001",
      driverName: "Carlos Rodriguez",
      tripId: "TRIP-001",
      date: "2024-04-10",
      startOdometerKm: 158_420,
      endOdometerKm: 158_458,
      fuelLiters: 6.3,
      issues: "None",
      status: "reviewed",
    },
    {
      reportId: "REP-2024-0002",
      driverName: "Maria Santos",
      tripId: "TRIP-002",
      date: "2024-04-10",
      startOdometerKm: 142_200,
      endOdometerKm: 142_385,
      fuelLiters: 26.5,
      issues: "Minor traffic delay",
      status: "pending",
    },
    {
      reportId: "REP-2024-0003",
      driverName: "Juan Dela Cruz",
      tripId: "TRIP-003",
      date: "2024-04-10",
      startOdometerKm: 165_800,
      endOdometerKm: 165_895,
      fuelLiters: 14.6,
      issues: "None",
      status: "approved",
    },
    {
      reportId: "REP-2024-0004",
      driverName: "Miguel Reyes",
      tripId: "TRIP-004",
      date: "2024-04-09",
      startOdometerKm: 172_100,
      endOdometerKm: 172_315,
      fuelLiters: 31.6,
      issues: "Vehicle inspection recommended",
      status: "approved",
    },
  ]);

  const [filterStatus, setFilterStatus] = useState("All");
  const [filterDriver, setFilterDriver] = useState("All Drivers");
  const [filterReportDate, setFilterReportDate] = useState("");
  const [expandedReport, setExpandedReport] = useState<string | null>(null);

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (filterStatus !== "All") {
        const map: Record<string, AccomplishmentReport["status"]> = {
          Pending: "pending",
          "Ready to approve": "reviewed",
          Approved: "approved",
          Rejected: "rejected",
          Archived: "archived",
        };
        const want = map[filterStatus];
        if (want !== undefined && r.status !== want) return false;
      }
      if (filterDriver !== "All Drivers" && r.driverName !== filterDriver) return false;
      if (filterReportDate && r.date < filterReportDate) return false;
      return true;
    });
  }, [reports, filterDriver, filterReportDate, filterStatus]);

  const patchReport = (reportId: string, patch: Partial<AccomplishmentReport>) => {
    setReports((prev) => prev.map((rep) => (rep.reportId === reportId ? { ...rep, ...patch } : rep)));
  };

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
      case "rejected":
        return "#F44336";
      default:
        return "#999";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return " Pending Review";
      case "reviewed":
        return "Ready to approve";
      case "approved":
        return " Approved";
      case "archived":
        return " Archived";
      case "rejected":
        return " Rejected";
      default:
        return "Unknown";
    }
  };

  return (
    <div style={{ padding: "var(--page-main-padding)", display: "grid", gap: "2rem" }}>
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
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
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
            <option>Ready to approve</option>
            <option>Approved</option>
            <option>Rejected</option>
            <option>Archived</option>
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontWeight: "600", marginBottom: "0.5rem", color: "#1A1A1A" }}>
            Driver
          </label>
          <select
            value={filterDriver}
            onChange={(e) => setFilterDriver(e.target.value)}
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
            <option>Miguel Reyes</option>
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontWeight: "600", marginBottom: "0.5rem", color: "#1A1A1A" }}>
            Date Range
          </label>
          <input
            type="date"
            value={filterReportDate}
            onChange={(e) => setFilterReportDate(e.target.value)}
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
        {filteredReports.length === 0 ? (
          <p style={{ margin: 0, color: "#666" }}>No reports match these filters.</p>
        ) : null}
        {filteredReports.map((report) => {
          const tripKm = Math.max(0, report.endOdometerKm - report.startOdometerKm);
          const kmPerL = tripFuelEconomy(tripKm, report.fuelLiters);
          return (
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
                <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>
                  TRIP DISTANCE
                </p>
                <p style={{ color: "#1A1A1A", fontWeight: "700", margin: "0.25rem 0 0 0", fontSize: "1.05rem" }}>
                  {tripKm.toLocaleString("en-US")} km
                </p>
                <p style={{ color: "#888", fontSize: "0.78rem", margin: "0.2rem 0 0 0" }}>
                  Odometer {fmtOdom(report.startOdometerKm)} → {fmtOdom(report.endOdometerKm)}
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
                  {report.fuelLiters.toFixed(1)} L
                </p>
                {kmPerL != null && (
                  <p style={{ color: "#555", fontSize: "0.78rem", margin: "0.2rem 0 0 0" }}>
                    ~{kmPerL.toFixed(1)} km/L on this leg
                  </p>
                )}
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

            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {report.status === "pending" && (
                <>
                  <button
                    type="button"
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
                    onClick={() => {
                      patchReport(report.reportId, { status: "reviewed" });
                      announce(`${report.reportId} marked reviewed`);
                    }}
                  >
                    Review
                  </button>
                  <button
                    type="button"
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
                    onClick={() => {
                      patchReport(report.reportId, { status: "rejected" });
                      announce(`${report.reportId} rejected`, "assertive");
                    }}
                  >
                    Reject
                  </button>
                </>
              )}
              {report.status === "reviewed" && (
                <button
                  type="button"
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
                  onClick={() => {
                    patchReport(report.reportId, { status: "approved" });
                    announce(`${report.reportId} approved`);
                  }}
                >
                  Approve
                </button>
              )}
              <button
                type="button"
                style={{
                  padding: "0.5rem 1rem",
                  background: "#F5F5F5",
                  color: "#1A1A1A",
                  border: "1px solid #E8E8E8",
                  borderRadius: "4px",
                  fontWeight: "600",
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
                onClick={() => {
                  setExpandedReport((prev) => {
                    const next = prev === report.reportId ? null : report.reportId;
                    announce(next ? `Expanded ${report.reportId}` : "Summary collapsed");
                    return next;
                  });
                }}
              >
                {expandedReport === report.reportId ? "Hide full report" : "View Full Report"}
              </button>
            </div>

            {expandedReport === report.reportId && (
              <div
                style={{
                  marginTop: "0.75rem",
                  padding: "1rem",
                  background: "#fff",
                  border: "1px solid #E0E0E0",
                  borderRadius: "6px",
                  fontSize: "0.88rem",
                }}
              >
                <p style={{ margin: "0 0 0.5rem 0", fontWeight: 700 }}>Trip {report.tripId}</p>
                <p style={{ margin: 0, color: "#555" }}>
                  Trip {tripKm.toLocaleString("en-US")} km; odometer {fmtOdom(report.startOdometerKm)} →{" "}
                  {fmtOdom(report.endOdometerKm)}; fuel {report.fuelLiters.toFixed(1)} L
                  {kmPerL != null ? ` (~${kmPerL.toFixed(1)} km/L)` : ""}; notes: {report.issues}.
                </p>
              </div>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
}
