"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Breadcrumbs from "@/components/Breadcrumbs";
import { useState } from "react";

type Report = {
  id: number;
  trip_id: number;
  report_type: "damage" | "delay" | "safety" | "fuel_discrepancy" | "other";
  title: string;
  description: string;
  date: string;
  status: "submitted" | "under_review" | "resolved";
  resolved_date?: string;
};

export default function SubmitReportsPage() {
  useRoleGuard(["driver"]);

  const [reports] = useState<Report[]>([
    {
      id: 1,
      trip_id: 101,
      report_type: "delay",
      title: "Traffic Congestion on I-95",
      description:
        "Unexpected traffic delays caused arrival 45 minutes late. Documented with dashcam.",
      date: "2026-04-28",
      status: "submitted",
    },
    {
      id: 2,
      trip_id: 102,
      report_type: "safety",
      title: "Unsafe Road Conditions",
      description:
        "Pothole damage on Route 27 caused minor vibration. No truck damage observed.",
      date: "2026-04-27",
      status: "under_review",
    },
    {
      id: 3,
      trip_id: 100,
      report_type: "fuel_discrepancy",
      title: "Fuel Gauge Inconsistency",
      description:
        "Fuel gauge reading did not match actual consumption. Requires inspection.",
      date: "2026-04-25",
      status: "resolved",
      resolved_date: "2026-04-26",
    },
  ]);

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    trip_id: "",
    report_type: "other",
    title: "",
    description: "",
  });

  const [expandedReport, setExpandedReport] = useState<number | null>(null);

  const getTypeColor = (type: string) => {
    switch (type) {
      case "damage":
        return "#F44336";
      case "delay":
        return "#FF9800";
      case "safety":
        return "#D32F2F";
      case "fuel_discrepancy":
        return "#2196F3";
      case "other":
        return "#999";
      default:
        return "#999";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "submitted":
        return "#FF9800";
      case "under_review":
        return "#2196F3";
      case "resolved":
        return "#4CAF50";
      default:
        return "#999";
    }
  };

  return (
    <div className="container" style={{ paddingTop: "2rem" }}>
      <Breadcrumbs
        items={[
          { label: "Modules", href: "/dashboard/driver" },
          { label: "My Tasks" },
          { label: "Submit System Reports" },
        ]}
      />

      <div style={{ marginTop: "2rem" }}>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem" }}>
          📋 Submit System-Based Logged Reports
        </h1>
        <p style={{ color: "#666666", marginBottom: "1.5rem" }}>
          Report issues, incidents, or discrepancies during your trips.
        </p>

        {/* New Report Button */}
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            marginBottom: "1.5rem",
            padding: "0.75rem 1.5rem",
            background: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {showForm ? "Cancel" : "+ New Report"}
        </button>

        {/* Report Form */}
        {showForm && (
          <div
            className="card"
            style={{
              padding: "1.5rem",
              background: "rgba(76, 175, 80, 0.1)",
              border: "1px solid #C8E6C9",
              marginBottom: "2rem",
            }}
          >
            <h3 style={{ color: "#1A1A1A", margin: "0 0 1rem 0" }}>
              Create New Report
            </h3>
            <div style={{ display: "grid", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Trip ID
                </label>
                <input
                  type="text"
                  placeholder="e.g., 101"
                  value={formData.trip_id}
                  onChange={(e) =>
                    setFormData({ ...formData, trip_id: e.target.value })
                  }
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #E8E8E8",
                    borderRadius: "6px",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Report Type
                </label>
                <select
                  value={formData.report_type}
                  onChange={(e) =>
                    setFormData({ ...formData, report_type: e.target.value })
                  }
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #E8E8E8",
                    borderRadius: "6px",
                    boxSizing: "border-box",
                  }}
                >
                  <option value="damage">Cargo/Vehicle Damage</option>
                  <option value="delay">Trip Delay</option>
                  <option value="safety">Safety Issue</option>
                  <option value="fuel_discrepancy">Fuel Discrepancy</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Title
                </label>
                <input
                  type="text"
                  placeholder="Brief summary of the issue"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #E8E8E8",
                    borderRadius: "6px",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Description
                </label>
                <textarea
                  placeholder="Detailed description of the issue"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #E8E8E8",
                    borderRadius: "6px",
                    boxSizing: "border-box",
                    minHeight: "100px",
                    fontFamily: "inherit",
                  }}
                />
              </div>
              <button
                style={{
                  padding: "0.75rem",
                  background: "#4CAF50",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Submit Report
              </button>
            </div>
          </div>
        )}

        {/* Reports List */}
        <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>
          Your Reports
        </h3>
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {reports.map((report) => (
            <div
              key={report.id}
              className="card"
              onClick={() =>
                setExpandedReport(expandedReport === report.id ? null : report.id)
              }
              style={{
                padding: "1rem",
                cursor: "pointer",
                background:
                  expandedReport === report.id
                    ? "rgba(255, 152, 0, 0.15)"
                    : "#FFFFFF",
                border:
                  expandedReport === report.id
                    ? "2px solid #FF9800"
                    : "1px solid #E8E8E8",
                borderLeft: `4px solid ${getTypeColor(report.report_type)}`,
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
                    <strong style={{ color: "#1A1A1A" }}>
                      {report.title}
                    </strong>
                    <span
                      style={{
                        padding: "0.25rem 0.75rem",
                        background: getStatusColor(report.status),
                        color: "white",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        textTransform: "capitalize",
                      }}
                    >
                      {report.status.replace("_", " ")}
                    </span>
                  </div>
                  <p style={{ margin: "0.25rem 0", color: "#999", fontSize: "0.85rem" }}>
                    Trip #{report.trip_id} | {report.date} | Type: {report.report_type.replace("_", " ")}
                  </p>
                </div>
              </div>

              {expandedReport === report.id && (
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
                    Report Details
                  </h4>
                  <p style={{ color: "#666666", margin: "0.5rem 0" }}>
                    {report.description}
                  </p>
                  <p style={{ color: "#999", margin: "1rem 0 0 0", fontSize: "0.85rem" }}>
                    Submitted: {report.date}
                    {report.resolved_date && ` | Resolved: ${report.resolved_date}`}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
