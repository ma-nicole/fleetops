"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Breadcrumbs from "@/components/Breadcrumbs";
import { useState } from "react";

type Exception = {
  id: number;
  trip_id: number;
  exception_type: "delay" | "breakdown" | "accident" | "weather" | "traffic";
  description: string;
  reported_by: string;
  reported_time: string;
  status: "reported" | "acknowledged" | "resolved";
  severity: "low" | "medium" | "high" | "critical";
};

export default function ExceptionsPage() {
  useRoleGuard(["dispatcher"]);

  const [exceptions] = useState<Exception[]>([
    {
      id: 1,
      trip_id: 101,
      exception_type: "delay",
      description: "Traffic congestion on I-95. Estimated delay: 45 minutes",
      reported_by: "Carlos Rodriguez",
      reported_time: "2026-04-28 09:30",
      status: "acknowledged",
      severity: "medium",
    },
    {
      id: 2,
      trip_id: 103,
      exception_type: "breakdown",
      description: "Engine warning light activated. Driver pulled over for inspection.",
      reported_by: "James Cooper",
      reported_time: "2026-04-28 11:45",
      status: "reported",
      severity: "high",
    },
    {
      id: 3,
      trip_id: 102,
      exception_type: "weather",
      description: "Heavy rain and reduced visibility. Speed reduced to 40 mph.",
      reported_by: "Sarah Williams",
      reported_time: "2026-04-27 14:20",
      status: "resolved",
      severity: "low",
    },
    {
      id: 4,
      trip_id: 104,
      exception_type: "traffic",
      description: "Road closure due to accident ahead. Rerouting via alternative route.",
      reported_by: "Michael Torres",
      reported_time: "2026-04-29 08:00",
      status: "reported",
      severity: "high",
    },
  ]);

  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedException, setSelectedException] = useState<number | null>(null);

  const filteredExceptions =
    filterStatus === "all"
      ? exceptions
      : exceptions.filter((e) => e.status === filterStatus);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "#F44336";
      case "high":
        return "#FF9800";
      case "medium":
        return "#FFC107";
      case "low":
        return "#4CAF50";
      default:
        return "#999";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "reported":
        return "#FF9800";
      case "acknowledged":
        return "#2196F3";
      case "resolved":
        return "#4CAF50";
      default:
        return "#999";
    }
  };

  const stats = {
    total: exceptions.length,
    reported: exceptions.filter((e) => e.status === "reported").length,
    acknowledged: exceptions.filter((e) => e.status === "acknowledged").length,
    resolved: exceptions.filter((e) => e.status === "resolved").length,
    critical: exceptions.filter((e) => e.severity === "critical").length,
  };

  return (
    <div className="container" style={{ paddingTop: "2rem" }}>
      <Breadcrumbs
        items={[
          { label: "Modules", href: "/dashboard/dispatcher" },
          { label: "Dispatcher Coordination" },
          { label: "Exceptions & Delays" },
        ]}
      />

      <div style={{ marginTop: "2rem" }}>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem" }}>
           Exceptions & Delays
        </h1>
        <p style={{ color: "#666666", marginBottom: "1.5rem" }}>
          Monitor and manage trip exceptions, delays, and incidents. Coordinate responses and track resolution.
        </p>

        {/* Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "1rem",
            marginBottom: "2rem",
          }}
        >
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#1A1A1A" }}>
              {stats.total}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>
              Total Exceptions
            </div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#F44336" }}>
              {stats.critical}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Critical</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#FF9800" }}>
              {stats.reported}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Reported</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#2196F3" }}>
              {stats.acknowledged}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>
              Acknowledged
            </div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#4CAF50" }}>
              {stats.resolved}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Resolved</div>
          </div>
        </div>

        {/* Filter */}
        <div style={{ marginBottom: "1.5rem" }}>
          <label style={{ color: "#1A1A1A", fontWeight: 600, marginRight: "1rem" }}>
            Filter by Status:
          </label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              padding: "0.5rem 1rem",
              border: "1px solid #E8E8E8",
              borderRadius: "6px",
              color: "#1A1A1A",
              cursor: "pointer",
            }}
          >
            <option value="all">All Exceptions</option>
            <option value="reported">Reported</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>

        {/* Exceptions List */}
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {filteredExceptions.map((exception) => (
            <div
              key={exception.id}
              className="card"
              onClick={() =>
                setSelectedException(
                  selectedException === exception.id ? null : exception.id
                )
              }
              style={{
                padding: "1rem",
                cursor: "pointer",
                background:
                  selectedException === exception.id
                    ? "rgba(255, 152, 0, 0.15)"
                    : "#FFFFFF",
                border:
                  selectedException === exception.id
                    ? "2px solid #FF9800"
                    : "1px solid #E8E8E8",
                borderLeft: `4px solid ${getSeverityColor(exception.severity)}`,
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
                      Trip #{exception.trip_id}
                    </strong>
                    <span
                      style={{
                        padding: "0.25rem 0.75rem",
                        background: getSeverityColor(exception.severity),
                        color: "white",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        textTransform: "capitalize",
                      }}
                    >
                      {exception.severity}
                    </span>
                    <span
                      style={{
                        padding: "0.25rem 0.75rem",
                        background: getStatusColor(exception.status),
                        color: "white",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        textTransform: "capitalize",
                      }}
                    >
                      {exception.status}
                    </span>
                  </div>
                  <p style={{ margin: "0.25rem 0", color: "#666666", fontSize: "0.9rem" }}>
                    {exception.description}
                  </p>
                  <p style={{ margin: "0.25rem 0", color: "#999", fontSize: "0.85rem" }}>
                    Reported by {exception.reported_by} at {exception.reported_time} | Type: {exception.exception_type.replace("_", " ")}
                  </p>
                </div>
              </div>

              {selectedException === exception.id && (
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
                    Exception Details
                  </h4>
                  <p style={{ color: "#666666", margin: "0.5rem 0" }}>
                    <strong>Type:</strong>{" "}
                    {exception.exception_type.charAt(0).toUpperCase() +
                      exception.exception_type.slice(1)}
                  </p>
                  <p style={{ color: "#666666", margin: "0.5rem 0" }}>
                    <strong>Severity:</strong>{" "}
                    {exception.severity.charAt(0).toUpperCase() +
                      exception.severity.slice(1)}
                  </p>
                  <p style={{ color: "#666666", margin: "0.5rem 0" }}>
                    <strong>Reported Time:</strong> {exception.reported_time}
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
