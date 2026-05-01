"use client";

import Link from "next/link";
import { useState } from "react";

type ReportedIssue = {
  issueId: string;
  reportedBy: string;
  issueType: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  reportedDate: string;
  status: "reported" | "investigating" | "in_progress" | "resolved" | "closed";
  assignedTo?: string;
};

export default function ReportedIssuesPage() {
  const [issues] = useState<ReportedIssue[]>([
    {
      issueId: "ISS-2024-0001",
      reportedBy: "Carlos Rodriguez (Driver)",
      issueType: "Vehicle Maintenance",
      severity: "medium",
      description: "Vehicle AUV-2024-1440 - Strange noise from engine, needs inspection",
      reportedDate: "2024-04-10 10:15 AM",
      status: "investigating",
      assignedTo: "Maintenance Team",
    },
    {
      issueId: "ISS-2024-0002",
      reportedBy: "Maria Santos (Driver)",
      issueType: "Traffic Issue",
      severity: "low",
      description: "Severe traffic jam on EDSA causing delay to TRIP-002, estimated 45 mins late",
      reportedDate: "2024-04-10 11:30 AM",
      status: "reported",
    },
    {
      issueId: "ISS-2024-0003",
      reportedBy: "Customer - ABC Retail",
      issueType: "Delivery Issue",
      severity: "high",
      description: "Item damaged during delivery - electronics package broken, compensation requested",
      reportedDate: "2024-04-09 03:45 PM",
      status: "in_progress",
      assignedTo: "Claims Department",
    },
    {
      issueId: "ISS-2024-0004",
      reportedBy: "Juan Dela Cruz (Driver)",
      issueType: "Fuel/Refuel",
      severity: "medium",
      description: "Vehicle fuel gauge showing incorrect reading, filled 60L but gauge shows 50%",
      reportedDate: "2024-04-08 09:00 AM",
      status: "resolved",
    },
    {
      issueId: "ISS-2024-0005",
      reportedBy: "Dispatcher Station",
      issueType: "Route Issue",
      severity: "low",
      description: "Road closure on alternate route, recommending detour for upcoming trips",
      reportedDate: "2024-04-10 02:30 PM",
      status: "reported",
    },
  ]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "low":
        return "#2196F3";
      case "medium":
        return "#FF9800";
      case "high":
        return "#F44336";
      case "critical":
        return "#B71C1C";
      default:
        return "#999";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "reported":
        return "#2196F3";
      case "investigating":
        return "#FF9800";
      case "in_progress":
        return "#FF6B6B";
      case "resolved":
        return "#4CAF50";
      case "closed":
        return "#999";
      default:
        return "#999";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "reported":
        return " Reported";
      case "investigating":
        return " Investigating";
      case "in_progress":
        return " In Progress";
      case "resolved":
        return " Resolved";
      case "closed":
        return " Closed";
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
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem", marginTop: "1rem" }}>Reported Issues</h1>
        <p style={{ color: "#666666", margin: "0" }}>Manage and resolve reported operational issues</p>
      </div>

      {/* Issue Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "1rem" }}>
        <div
          style={{
            padding: "1rem",
            border: "1px solid #E8E8E8",
            borderRadius: "6px",
            background: "linear-gradient(135deg, rgba(33, 150, 243, 0.1), rgba(33, 150, 243, 0.05))",
            textAlign: "center",
          }}
        >
          <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>TOTAL ISSUES</p>
          <p style={{ color: "#2196F3", fontSize: "2rem", fontWeight: "700", margin: "0.25rem 0 0 0" }}>
            {issues.length}
          </p>
        </div>
        <div
          style={{
            padding: "1rem",
            border: "1px solid #E8E8E8",
            borderRadius: "6px",
            background: "linear-gradient(135deg, rgba(244, 67, 54, 0.1), rgba(244, 67, 54, 0.05))",
            textAlign: "center",
          }}
        >
          <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>CRITICAL/HIGH</p>
          <p style={{ color: "#F44336", fontSize: "2rem", fontWeight: "700", margin: "0.25rem 0 0 0" }}>
            {issues.filter((i) => i.severity === "high" || i.severity === "critical").length}
          </p>
        </div>
        <div
          style={{
            padding: "1rem",
            border: "1px solid #E8E8E8",
            borderRadius: "6px",
            background: "linear-gradient(135deg, rgba(255, 152, 0, 0.1), rgba(255, 152, 0, 0.05))",
            textAlign: "center",
          }}
        >
          <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>PENDING</p>
          <p style={{ color: "#FF9800", fontSize: "2rem", fontWeight: "700", margin: "0.25rem 0 0 0" }}>
            {issues.filter((i) => i.status === "reported" || i.status === "investigating").length}
          </p>
        </div>
        <div
          style={{
            padding: "1rem",
            border: "1px solid #E8E8E8",
            borderRadius: "6px",
            background: "linear-gradient(135deg, rgba(76, 175, 80, 0.1), rgba(76, 175, 80, 0.05))",
            textAlign: "center",
          }}
        >
          <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>RESOLVED</p>
          <p style={{ color: "#4CAF50", fontSize: "2rem", fontWeight: "700", margin: "0.25rem 0 0 0" }}>
            {issues.filter((i) => i.status === "resolved").length}
          </p>
        </div>
      </div>

      {/* Issues List */}
      <div style={{ display: "grid", gap: "1rem" }}>
        {issues.map((issue) => (
          <div
            key={issue.issueId}
            style={{
              padding: "1.5rem",
              border: `2px solid ${getSeverityColor(issue.severity)}`,
              borderRadius: "8px",
              background: "#F9F9F9",
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "1.5rem", marginBottom: "1rem", alignItems: "start" }}>
              <div>
                <h3 style={{ color: "#1A1A1A", margin: "0" }}>{issue.issueId}</h3>
                <p style={{ color: "#999", fontSize: "0.85rem", margin: "0.25rem 0 0 0" }}>
                  {issue.issueType}
                </p>
              </div>

              <div>
                <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>REPORTED BY</p>
                <p style={{ color: "#1A1A1A", fontSize: "0.9rem", fontWeight: "600", margin: "0.25rem 0 0 0" }}>
                  {issue.reportedBy}
                </p>
              </div>

              <div>
                <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>REPORTED DATE</p>
                <p style={{ color: "#1A1A1A", fontSize: "0.85rem", fontWeight: "600", margin: "0.25rem 0 0 0" }}>
                  {issue.reportedDate}
                </p>
              </div>

              <div style={{ display: "flex", gap: "0.5rem", flexDirection: "column", alignItems: "flex-end" }}>
                <span
                  style={{
                    padding: "0.4rem 0.75rem",
                    background: getSeverityColor(issue.severity) + "20",
                    color: getSeverityColor(issue.severity),
                    borderRadius: "4px",
                    fontWeight: "600",
                    fontSize: "0.75rem",
                    whiteSpace: "nowrap",
                  }}
                >
                  {issue.severity.toUpperCase()} SEVERITY
                </span>
                <span
                  style={{
                    padding: "0.4rem 0.75rem",
                    background: getStatusColor(issue.status) + "20",
                    color: getStatusColor(issue.status),
                    borderRadius: "4px",
                    fontWeight: "600",
                    fontSize: "0.75rem",
                    whiteSpace: "nowrap",
                  }}
                >
                  {getStatusLabel(issue.status)}
                </span>
              </div>
            </div>

            <div
              style={{
                padding: "1rem",
                background: "white",
                borderRadius: "6px",
                border: "1px solid #E8E8E8",
                marginBottom: "1rem",
              }}
            >
              <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0 0 0.5rem 0" }}>
                DESCRIPTION
              </p>
              <p style={{ color: "#1A1A1A", margin: "0", lineHeight: "1.5" }}>
                {issue.description}
              </p>
            </div>

            {issue.assignedTo && (
              <div style={{ marginBottom: "1rem" }}>
                <p style={{ color: "#4CAF50", fontSize: "0.9rem", fontWeight: "600", margin: "0" }}>
                  ✓ Assigned to: {issue.assignedTo}
                </p>
              </div>
            )}

            <div style={{ display: "flex", gap: "0.5rem" }}>
              {(issue.status === "reported" || issue.status === "investigating") && (
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
                    onClick={() => alert("Escalating issue " + issue.issueId)}
                  >
                    Escalate
                  </button>
                  <button
                    style={{
                      padding: "0.5rem 1rem",
                      background: "#2196F3",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontWeight: "600",
                      fontSize: "0.85rem",
                    }}
                    onClick={() => alert("Assigning to team...")}
                  >
                    Assign
                  </button>
                </>
              )}
              {issue.status === "in_progress" && (
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
                  onClick={() => alert("Marking as resolved...")}
                >
                  Mark Resolved
                </button>
              )}
              <button
                style={{
                  padding: "0.5rem 1rem",
                  background: "#F5F5F5",
                  color: "#1A1A1A",
                  border: "1px solid #E8E8E8",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontWeight: "600",
                  fontSize: "0.85rem",
                }}
                onClick={() => alert("Viewing details for " + issue.issueId)}
              >
                View Details
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
