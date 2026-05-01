"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Breadcrumbs from "@/components/Breadcrumbs";
import { useState } from "react";

type HistoryRecord = {
  id: number;
  trip_id: number;
  activity_type: "accomplished" | "ongoing" | "scheduled";
  trip_details: string;
  start_time?: string;
  end_time?: string;
  scheduled_date?: string;
  driver: string;
  vehicle: string;
};

export default function HistoryPage() {
  useRoleGuard(["admin"]);

  const [records] = useState<HistoryRecord[]>([
    {
      id: 1,
      trip_id: 101,
      activity_type: "accomplished",
      trip_details: "Makati → Batangas",
      start_time: "2026-04-28 08:00",
      end_time: "2026-04-28 10:30",
      driver: "Carlos Rodriguez",
      vehicle: "VOL-2024-001",
    },
    {
      id: 2,
      trip_id: 102,
      activity_type: "accomplished",
      trip_details: "Angeles → Makati",
      start_time: "2026-04-27 06:00",
      end_time: "2026-04-27 10:00",
      driver: "Sarah Williams",
      vehicle: "SCA-2023-002",
    },
    {
      id: 3,
      trip_id: 103,
      activity_type: "ongoing",
      trip_details: "Laguna → Quezon City",
      start_time: "2026-04-28 11:00",
      driver: "James Cooper",
      vehicle: "DAF-2022-003",
    },
    {
      id: 4,
      trip_id: 104,
      activity_type: "scheduled",
      trip_details: "Manila → Laoag",
      scheduled_date: "2026-04-29 07:00",
      driver: "Michael Torres",
      vehicle: "VOL-2024-001",
    },
  ]);

  const [filterType, setFilterType] = useState<string>("all");
  const [selectedRecord, setSelectedRecord] = useState<number | null>(null);

  const filteredRecords =
    filterType === "all"
      ? records
      : records.filter((r) => r.activity_type === filterType);

  const getTypeColor = (type: string) => {
    switch (type) {
      case "accomplished":
        return "#4CAF50";
      case "ongoing":
        return "#2196F3";
      case "scheduled":
        return "#FF9800";
      default:
        return "#999";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "accomplished":
        return "✓";
      case "ongoing":
        return "●";
      case "scheduled":
        return "";
      default:
        return "?";
    }
  };

  const stats = {
    accomplished: records.filter((r) => r.activity_type === "accomplished").length,
    ongoing: records.filter((r) => r.activity_type === "ongoing").length,
    scheduled: records.filter((r) => r.activity_type === "scheduled").length,
  };

  return (
    <div className="container" style={{ paddingTop: "2rem" }}>
      <Breadcrumbs
        items={[
          { label: "Modules", href: "/dashboard/admin" },
          { label: "System Administration" },
          { label: "History" },
        ]}
      />

      <div style={{ marginTop: "2rem" }}>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem" }}>
           Trip History
        </h1>
        <p style={{ color: "#666666", marginBottom: "1.5rem" }}>
          View all accomplished, ongoing, and scheduled trips. Monitor trip progress and completion.
        </p>

        {/* Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "1rem",
            marginBottom: "2rem",
          }}
        >
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#4CAF50" }}>
              {stats.accomplished}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>
              Accomplished
            </div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#2196F3" }}>
              {stats.ongoing}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Ongoing</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#FF9800" }}>
              {stats.scheduled}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Scheduled</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#1A1A1A" }}>
              {records.length}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Total Trips</div>
          </div>
        </div>

        {/* Filter */}
        <div style={{ marginBottom: "1.5rem" }}>
          <label style={{ color: "#1A1A1A", fontWeight: 600, marginRight: "1rem" }}>
            Filter by Status:
          </label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{
              padding: "0.5rem 1rem",
              border: "1px solid #E8E8E8",
              borderRadius: "6px",
              color: "#1A1A1A",
              cursor: "pointer",
            }}
          >
            <option value="all">All Trips</option>
            <option value="accomplished">Accomplished</option>
            <option value="ongoing">Ongoing</option>
            <option value="scheduled">Scheduled</option>
          </select>
        </div>

        {/* History Records */}
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {filteredRecords.map((record) => (
            <div
              key={record.id}
              className="card"
              onClick={() =>
                setSelectedRecord(
                  selectedRecord === record.id ? null : record.id
                )
              }
              style={{
                padding: "1rem",
                cursor: "pointer",
                background:
                  selectedRecord === record.id
                    ? "rgba(255, 152, 0, 0.15)"
                    : "#FFFFFF",
                border:
                  selectedRecord === record.id
                    ? "2px solid #FF9800"
                    : "1px solid #E8E8E8",
                borderLeft: `4px solid ${getTypeColor(record.activity_type)}`,
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
                      Trip #{record.trip_id}
                    </strong>
                    <span
                      style={{
                        padding: "0.25rem 0.75rem",
                        background: getTypeColor(record.activity_type),
                        color: "white",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        textTransform: "capitalize",
                      }}
                    >
                      {getTypeIcon(record.activity_type)}{" "}
                      {record.activity_type}
                    </span>
                  </div>
                  <p style={{ margin: "0.25rem 0", color: "#666666", fontSize: "0.9rem" }}>
                    {record.trip_details}
                  </p>
                  <p style={{ margin: "0.25rem 0", color: "#666666", fontSize: "0.9rem" }}>
                    Driver: <strong>{record.driver}</strong> • Vehicle:{" "}
                    <strong>{record.vehicle}</strong>
                  </p>
                  <p style={{ margin: "0.25rem 0", color: "#999", fontSize: "0.85rem" }}>
                    {record.start_time && `Start: ${record.start_time}`}
                    {record.end_time && ` | End: ${record.end_time}`}
                    {record.scheduled_date && `Scheduled: ${record.scheduled_date}`}
                  </p>
                </div>
              </div>

              {selectedRecord === record.id && (
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
                    Trip Timeline
                  </h4>
                  <div style={{ color: "#666666", fontSize: "0.9rem" }}>
                    {record.start_time && (
                      <p style={{ margin: "0.5rem 0" }}>
                        <strong>Start:</strong> {record.start_time}
                      </p>
                    )}
                    {record.end_time && (
                      <p style={{ margin: "0.5rem 0" }}>
                        <strong>End:</strong> {record.end_time}
                      </p>
                    )}
                    {record.scheduled_date && (
                      <p style={{ margin: "0.5rem 0" }}>
                        <strong>Scheduled:</strong> {record.scheduled_date}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
