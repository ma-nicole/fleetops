"use client";

import Link from "next/link";
import { useState } from "react";

import { announce } from "@/lib/useAnnouncer";

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
  const [issues, setIssues] = useState<ReportedIssue[]>([]);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const patchIssue = (issueId: string, patch: Partial<ReportedIssue>) => {
    setIssues((prev) => prev.map((i) => (i.issueId === issueId ? { ...i, ...patch } : i)));
  };

  const escalate = (issue: ReportedIssue) => {
    const nextSeverity: ReportedIssue["severity"] =
      issue.severity === "low"
        ? "medium"
        : issue.severity === "medium"
          ? "high"
          : issue.severity === "high"
            ? "critical"
            : "critical";
    patchIssue(issue.issueId, { severity: nextSeverity, status: "investigating" });
    announce(`Issue ${issue.issueId} escalated to ${nextSeverity.replace("_", " ")} severity`);
  };

  const assignToTeam = (issue: ReportedIssue) => {
    patchIssue(issue.issueId, {
      status: "in_progress",
      assignedTo: issue.assignedTo ?? "Operations — Dispatch Desk",
    });
    announce(`Issue ${issue.issueId} assigned`);
  };

  const markResolved = (issue: ReportedIssue) => {
    patchIssue(issue.issueId, { status: "resolved" });
    announce(`Issue ${issue.issueId} marked resolved`);
  };

  const toggleDetails = (issueId: string) => {
    setExpandedId((prev) => {
      const next = prev === issueId ? null : issueId;
      announce(next ? `Showing details for ${issueId}` : "Details hidden");
      return next;
    });
  };

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
    <div style={{ padding: "var(--page-main-padding)", display: "grid", gap: "2rem" }}>
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
        {issues.length === 0 ? (
          <div
            style={{
              padding: "2rem",
              border: "1px solid #E8E8E8",
              borderRadius: "8px",
              background: "#FAFAFA",
              color: "#666666",
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0 }}>No reported issues yet. Driver-reported trip issues will list here when that feed is connected.</p>
          </div>
        ) : (
          issues.map((issue) => (
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
                    onClick={() => escalate(issue)}
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
                    onClick={() => assignToTeam(issue)}
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
                  onClick={() => markResolved(issue)}
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
                type="button"
                onClick={() => toggleDetails(issue.issueId)}
              >
                {expandedId === issue.issueId ? "Hide details" : "View Details"}
              </button>
            </div>

            {expandedId === issue.issueId && (
              <div
                style={{
                  marginTop: "0.75rem",
                  padding: "1rem",
                  background: "#fff",
                  border: "1px dashed #BDBDBD",
                  borderRadius: "6px",
                  fontSize: "0.88rem",
                  color: "#424242",
                }}
              >
                <p style={{ margin: "0 0 0.5rem 0", fontWeight: 700 }}>Audit trail</p>
                <p style={{ margin: 0 }}>
                  Full narrative: {issue.description} — Last update: escalate or assign updates status in this list; FleetOpt
                  will sync with the API when ticketing is wired.
                </p>
              </div>
            )}
          </div>
          ))
        )}
      </div>
    </div>
  );
}
