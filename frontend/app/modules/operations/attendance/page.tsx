"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Breadcrumbs from "@/components/Breadcrumbs";
import { useState } from "react";

type Attendance = {
  date: string;
  check_in: string;
  check_out: string;
  total_hours: number;
  status: "present" | "late" | "absent" | "sick_leave";
};

export default function AttendancePage() {
  useRoleGuard(["driver"]);

  const [attendanceRecords] = useState<Attendance[]>([
    {
      date: "2026-04-28",
      check_in: "07:30",
      check_out: "18:00",
      total_hours: 10.5,
      status: "present",
    },
    {
      date: "2026-04-27",
      check_in: "07:45",
      check_out: "17:30",
      total_hours: 9.75,
      status: "late",
    },
    {
      date: "2026-04-26",
      check_in: "07:00",
      check_out: "18:30",
      total_hours: 11.5,
      status: "present",
    },
    {
      date: "2026-04-25",
      check_in: "—",
      check_out: "—",
      total_hours: 0,
      status: "sick_leave",
    },
  ]);

  const [showCheckIn, setShowCheckIn] = useState(false);
  const [currentTime] = useState(new Date().toLocaleTimeString());

  const getStatusColor = (status: string) => {
    switch (status) {
      case "present":
        return "#4CAF50";
      case "late":
        return "#FF9800";
      case "absent":
        return "#F44336";
      case "sick_leave":
        return "#2196F3";
      default:
        return "#999";
    }
  };

  const stats = {
    present: attendanceRecords.filter((a) => a.status === "present").length,
    late: attendanceRecords.filter((a) => a.status === "late").length,
    absent: attendanceRecords.filter((a) => a.status === "absent").length,
    totalHours: attendanceRecords.reduce((sum, a) => sum + a.total_hours, 0),
  };

  return (
    <div className="container" style={{ paddingTop: "2rem" }}>
      <Breadcrumbs
        items={[
          { label: "Modules", href: "/dashboard/driver" },
          { label: "My Tasks" },
          { label: "Attendance Check-in" },
        ]}
      />

      <div style={{ marginTop: "2rem" }}>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem" }}>
          ⏱️ Attendance Check-in
        </h1>
        <p style={{ color: "#666666", marginBottom: "1.5rem" }}>
          Record your daily attendance. Check-in when you start your shift and check-out when you finish.
        </p>

        {/* Quick Check-in */}
        <div className="card" style={{ padding: "1.5rem", marginBottom: "2rem", background: "rgba(76, 175, 80, 0.1)", border: "1px solid #C8E6C9" }}>
          <p style={{ color: "#666666", fontSize: "0.9rem", margin: "0 0 1rem 0" }}>
            Current Time: <strong>{currentTime}</strong>
          </p>
          <button
            onClick={() => setShowCheckIn(!showCheckIn)}
            style={{
              padding: "0.75rem 1.5rem",
              background: "#4CAF50",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            {showCheckIn ? "Cancel" : "📍 Check-in / Check-out"}
          </button>

          {showCheckIn && (
            <div style={{ marginTop: "1rem" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "1rem",
                }}
              >
                <button
                  style={{
                    padding: "0.75rem 1rem",
                    background: "#4CAF50",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  ✓ Check-in Now
                </button>
                <button
                  style={{
                    padding: "0.75rem 1rem",
                    background: "#FF9800",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  ✗ Check-out Now
                </button>
              </div>
            </div>
          )}
        </div>

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
              {stats.present}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Present</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#FF9800" }}>
              {stats.late}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Late</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#FF9800" }}>
              {stats.totalHours.toFixed(1)}h
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Total Hours</div>
          </div>
        </div>

        {/* Attendance List */}
        <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Recent Attendance</h3>
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {attendanceRecords.map((record, index) => (
            <div key={index} className="card" style={{ padding: "1rem" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <p style={{ margin: "0 0 0.5rem 0", fontWeight: 600, color: "#1A1A1A" }}>
                    {record.date}
                  </p>
                  <p style={{ margin: "0.25rem 0", color: "#666666", fontSize: "0.9rem" }}>
                    Check-in: {record.check_in} | Check-out: {record.check_out}
                  </p>
                  <p style={{ margin: "0.25rem 0", color: "#999", fontSize: "0.85rem" }}>
                    Total Hours: {record.total_hours}h
                  </p>
                </div>
                <span
                  style={{
                    padding: "0.5rem 1rem",
                    background: getStatusColor(record.status),
                    color: "white",
                    borderRadius: "6px",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    textTransform: "capitalize",
                    whiteSpace: "nowrap",
                  }}
                >
                  {record.status.replace("_", " ")}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
