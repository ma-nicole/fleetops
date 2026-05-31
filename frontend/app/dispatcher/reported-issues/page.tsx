"use client";

import { apiFullUrl } from "@/lib/api";
import { WorkflowApi, type DispatchVehicleIssueReportRow } from "@/lib/workflowApi";
import { announce } from "@/lib/useAnnouncer";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

function attachmentHref(url: string | null | undefined): string | null {
  const u = (url || "").trim();
  if (!u) return null;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/uploads/")) return apiFullUrl(u);
  return u;
}

function statusLabel(status: string): string {
  switch (status) {
    case "submitted":
      return "Submitted";
    case "reviewed":
      return "Reviewed";
    case "resolved":
      return "Resolved";
    default:
      return status.replace(/_/g, " ");
  }
}

function statusColor(status: string): string {
  switch (status) {
    case "submitted":
      return "var(--brand-text)";
    case "reviewed":
      return "#EA580C";
    case "resolved":
      return "#059669";
    default:
      return "#64748B";
  }
}

function severityColor(priority: string): string {
  switch (priority) {
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
}

export default function ReportedIssuesPage() {
  const [issues, setIssues] = useState<DispatchVehicleIssueReportRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await WorkflowApi.dispatchVehicleIssueReports();
      setIssues(res.reports ?? []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not load reports.";
      setLoadError(msg);
      setIssues([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setStatus = async (row: DispatchVehicleIssueReportRow, next: "reviewed" | "resolved") => {
    setBusyId(row.id);
    try {
      await WorkflowApi.dispatchVehicleIssueReportUpdate(row.id, next);
      announce(`Report #${row.id} marked ${next}`);
      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Update failed";
      announce(msg);
    } finally {
      setBusyId(null);
    }
  };

  const pendingCount = issues.filter((i) => i.status === "submitted" || i.status === "reviewed").length;
  const resolvedCount = issues.filter((i) => i.status === "resolved").length;
  const criticalHigh = issues.filter((i) => i.priority === "high" || i.priority === "critical").length;

  return (
    <div style={{ padding: "var(--page-main-padding)", display: "grid", gap: "2rem" }}>
      <div>
        <Link href="/dispatcher/dashboard" style={{ color: "#FF9800", textDecoration: "none", fontWeight: "600" }}>
          ← Back to Dashboard
        </Link>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem", marginTop: "1rem" }}>Reported Issues</h1>
        <p style={{ color: "#666666", margin: "0" }}>
          Driver-submitted vehicle issue reports (database-backed). Trip logs and operations center include the same
          records.
        </p>
      </div>

      {loadError ? (
        <div
          style={{
            padding: "1rem 1.25rem",
            borderRadius: "8px",
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            color: "#B91C1C",
          }}
        >
          {loadError}
        </div>
      ) : null}

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
          <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>TOTAL REPORTS</p>
          <p style={{ color: "#2196F3", fontSize: "2rem", fontWeight: "700", margin: "0.25rem 0 0 0" }}>
            {loading ? "—" : issues.length}
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
          <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>HIGH / CRITICAL</p>
          <p style={{ color: "#F44336", fontSize: "2rem", fontWeight: "700", margin: "0.25rem 0 0 0" }}>
            {loading ? "—" : criticalHigh}
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
          <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>OPEN (SUBMITTED / REVIEWED)</p>
          <p style={{ color: "#FF9800", fontSize: "2rem", fontWeight: "700", margin: "0.25rem 0 0 0" }}>
            {loading ? "—" : pendingCount}
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
            {loading ? "—" : resolvedCount}
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gap: "1rem" }}>
        {loading ? (
          <p style={{ color: "#666" }}>Loading…</p>
        ) : issues.length === 0 ? (
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
            <p style={{ margin: 0 }}>No vehicle issue reports yet.</p>
          </div>
        ) : (
          issues.map((issue) => {
            const att = attachmentHref(issue.attachment_url);
            const busy = busyId === issue.id;
            return (
              <div
                key={issue.id}
                style={{
                  padding: "1.5rem",
                  border: `2px solid ${severityColor(issue.priority)}`,
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
                    alignItems: "start",
                  }}
                >
                  <div>
                    <h3 style={{ color: "#1A1A1A", margin: "0" }}>Report #{issue.id}</h3>
                    <p style={{ color: "#999", fontSize: "0.85rem", margin: "0.25rem 0 0 0" }}>
                      {issue.issue_type_label}
                    </p>
                    <p style={{ color: "#64748B", fontSize: "0.8rem", margin: "0.35rem 0 0 0" }}>
                      Trip #{issue.trip_id} · Booking #{issue.booking_id}
                    </p>
                  </div>

                  <div>
                    <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>DRIVER</p>
                    <p style={{ color: "#1A1A1A", fontSize: "0.9rem", fontWeight: "600", margin: "0.25rem 0 0 0" }}>
                      {issue.driver_name ?? `User #${issue.driver_id}`}
                    </p>
                  </div>

                  <div>
                    <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>REPORTED</p>
                    <p style={{ color: "#1A1A1A", fontSize: "0.85rem", fontWeight: "600", margin: "0.25rem 0 0 0" }}>
                      {issue.created_at ? new Date(issue.created_at).toLocaleString() : "—"}
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem", flexDirection: "column", alignItems: "flex-end" }}>
                    <span
                      style={{
                        padding: "0.4rem 0.75rem",
                        background: severityColor(issue.priority) + "20",
                        color: severityColor(issue.priority),
                        borderRadius: "4px",
                        fontWeight: "600",
                        fontSize: "0.75rem",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {issue.priority.toUpperCase()} PRIORITY
                    </span>
                    <span
                      style={{
                        padding: "0.4rem 0.75rem",
                        background: statusColor(issue.status) + "20",
                        color: statusColor(issue.status),
                        borderRadius: "4px",
                        fontWeight: "600",
                        fontSize: "0.75rem",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {statusLabel(issue.status)}
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
                    ROUTE
                  </p>
                  <p style={{ color: "#334155", margin: "0 0 0.75rem", fontSize: "0.9rem" }}>{issue.route || "—"}</p>
                  <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0 0 0.5rem 0" }}>
                    DESCRIPTION
                  </p>
                  <p style={{ color: "#1A1A1A", margin: "0", lineHeight: "1.5" }}>{issue.description}</p>
                  {att ? (
                    <p style={{ margin: "0.75rem 0 0" }}>
                      <a href={att} target="_blank" rel="noopener noreferrer" style={{ color: "var(--brand-text)" }}>
                        View attachment
                      </a>
                    </p>
                  ) : null}
                </div>

                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {issue.status === "submitted" ? (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        style={{
                          padding: "0.5rem 1rem",
                          background: "#2196F3",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: busy ? "wait" : "pointer",
                          fontWeight: "600",
                          fontSize: "0.85rem",
                        }}
                        onClick={() => void setStatus(issue, "reviewed")}
                      >
                        Mark reviewed
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        style={{
                          padding: "0.5rem 1rem",
                          background: "#4CAF50",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: busy ? "wait" : "pointer",
                          fontWeight: "600",
                          fontSize: "0.85rem",
                        }}
                        onClick={() => void setStatus(issue, "resolved")}
                      >
                        Mark resolved
                      </button>
                    </>
                  ) : null}
                  {issue.status === "reviewed" ? (
                    <button
                      type="button"
                      disabled={busy}
                      style={{
                        padding: "0.5rem 1rem",
                        background: "#4CAF50",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: busy ? "wait" : "pointer",
                        fontWeight: "600",
                        fontSize: "0.85rem",
                      }}
                      onClick={() => void setStatus(issue, "resolved")}
                    >
                      Mark resolved
                    </button>
                  ) : null}
                  <button
                    type="button"
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
                    onClick={() => {
                      setExpandedId((prev) => {
                        const next = prev === issue.id ? null : issue.id;
                        announce(next ? `Details for report ${issue.id}` : "Details hidden");
                        return next;
                      });
                    }}
                  >
                    {expandedId === issue.id ? "Hide details" : "View details"}
                  </button>
                </div>

                {expandedId === issue.id ? (
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
                    <p style={{ margin: "0 0 0.5rem 0", fontWeight: 700 }}>Trip / truck</p>
                    <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
                      <li>Truck plate: {issue.truck_plate || "—"}</li>
                      <li>Truck model: {issue.truck_model ?? "—"}</li>
                      <li>Helper: {issue.helper_name ?? "—"}</li>
                      <li>Last updated: {issue.updated_at ? new Date(issue.updated_at).toLocaleString() : "—"}</li>
                    </ul>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
