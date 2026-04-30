"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Link from "next/link";
import { useState } from "react";

type Schedule = {
  date: string;
  day: string;
  startTime: string;
  endTime: string;
  trips: number;
  totalDistance: string;
  status: string;
};

export default function SchedulePage() {
  useRoleGuard(["driver"]);

  const [schedule] = useState<Schedule[]>([
    {
      date: "2024-04-29",
      day: "Monday",
      startTime: "06:00 AM",
      endTime: "06:00 PM",
      trips: 3,
      totalDistance: "85 km",
      status: "today",
    },
    {
      date: "2024-04-30",
      day: "Tuesday",
      startTime: "06:30 AM",
      endTime: "05:30 PM",
      trips: 4,
      totalDistance: "105 km",
      status: "upcoming",
    },
    {
      date: "2024-05-01",
      day: "Wednesday",
      startTime: "05:30 AM",
      endTime: "04:30 PM",
      trips: 2,
      totalDistance: "62 km",
      status: "upcoming",
    },
    {
      date: "2024-05-02",
      day: "Thursday",
      startTime: "06:00 AM",
      endTime: "06:00 PM",
      trips: 3,
      totalDistance: "92 km",
      status: "upcoming",
    },
    {
      date: "2024-05-03",
      day: "Friday",
      startTime: "06:00 AM",
      endTime: "02:00 PM",
      trips: 2,
      totalDistance: "58 km",
      status: "upcoming",
    },
  ]);

  const [weeklyStats] = useState({
    totalTrips: 14,
    totalDistance: "402 km",
    totalEarnings: "$1,850.75",
    averageRating: 4.8,
  });

  const getStatusColor = (status: string) => {
    return status === "today" ? "#FF9800" : status === "upcoming" ? "#2196F3" : "#4CAF50";
  };

  return (
    <div style={{ padding: "2rem", display: "grid", gap: "2rem" }}>
      <div>
        <Link href="/driver/dashboard" style={{ color: "#FF9800", textDecoration: "none", fontWeight: "600" }}>
          ← Back to Dashboard
        </Link>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem", marginTop: "1rem" }}>Schedule</h1>
        <p style={{ color: "#666666", margin: "0" }}>View your weekly schedule and upcoming trips</p>
      </div>

      {/* Weekly Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.5rem" }}>
        <div
          style={{
            padding: "1.5rem",
            border: "1px solid #E8E8E8",
            borderRadius: "8px",
            background: "linear-gradient(135deg, rgba(255, 152, 0, 0.1), rgba(255, 152, 0, 0.05))",
          }}
        >
          <p style={{ color: "#999", margin: "0 0 0.5rem 0", fontSize: "0.75rem", fontWeight: "600" }}>TOTAL TRIPS</p>
          <p style={{ color: "#FF9800", fontSize: "2rem", fontWeight: "700", margin: "0" }}>
            {weeklyStats.totalTrips}
          </p>
        </div>

        <div
          style={{
            padding: "1.5rem",
            border: "1px solid #E8E8E8",
            borderRadius: "8px",
            background: "linear-gradient(135deg, rgba(33, 150, 243, 0.1), rgba(33, 150, 243, 0.05))",
          }}
        >
          <p style={{ color: "#999", margin: "0 0 0.5rem 0", fontSize: "0.75rem", fontWeight: "600" }}>TOTAL DISTANCE</p>
          <p style={{ color: "#2196F3", fontSize: "2rem", fontWeight: "700", margin: "0" }}>
            {weeklyStats.totalDistance}
          </p>
        </div>

        <div
          style={{
            padding: "1.5rem",
            border: "1px solid #E8E8E8",
            borderRadius: "8px",
            background: "linear-gradient(135deg, rgba(76, 175, 80, 0.1), rgba(76, 175, 80, 0.05))",
          }}
        >
          <p style={{ color: "#999", margin: "0 0 0.5rem 0", fontSize: "0.75rem", fontWeight: "600" }}>TOTAL EARNINGS</p>
          <p style={{ color: "#4CAF50", fontSize: "2rem", fontWeight: "700", margin: "0" }}>
            {weeklyStats.totalEarnings}
          </p>
        </div>

        <div
          style={{
            padding: "1.5rem",
            border: "1px solid #E8E8E8",
            borderRadius: "8px",
            background: "linear-gradient(135deg, rgba(156, 39, 176, 0.1), rgba(156, 39, 176, 0.05))",
          }}
        >
          <p style={{ color: "#999", margin: "0 0 0.5rem 0", fontSize: "0.75rem", fontWeight: "600" }}>AVERAGE RATING</p>
          <p style={{ color: "#9C27B0", fontSize: "2rem", fontWeight: "700", margin: "0" }}>
            {weeklyStats.averageRating} ⭐
          </p>
        </div>
      </div>

      {/* Schedule Table */}
      <div style={{ border: "1px solid #E8E8E8", borderRadius: "8px", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", padding: "1rem", background: "#F5F5F5", borderBottom: "1px solid #E8E8E8", gap: "1rem" }}>
          <p style={{ color: "#999", fontWeight: "600", margin: "0", fontSize: "0.75rem" }}>DATE</p>
          <p style={{ color: "#999", fontWeight: "600", margin: "0", fontSize: "0.75rem" }}>DAY</p>
          <p style={{ color: "#999", fontWeight: "600", margin: "0", fontSize: "0.75rem" }}>START</p>
          <p style={{ color: "#999", fontWeight: "600", margin: "0", fontSize: "0.75rem" }}>END</p>
          <p style={{ color: "#999", fontWeight: "600", margin: "0", fontSize: "0.75rem" }}>TRIPS</p>
          <p style={{ color: "#999", fontWeight: "600", margin: "0", fontSize: "0.75rem" }}>DISTANCE</p>
          <p style={{ color: "#999", fontWeight: "600", margin: "0", fontSize: "0.75rem" }}>STATUS</p>
        </div>

        {schedule.map((item, idx) => (
          <div key={idx} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", padding: "1rem", borderBottom: idx < schedule.length - 1 ? "1px solid #E8E8E8" : "none", gap: "1rem", background: item.status === "today" ? "rgba(255, 152, 0, 0.05)" : "white" }}>
            <p style={{ color: "#1A1A1A", fontWeight: "600", margin: "0", fontSize: "0.9rem" }}>{item.date}</p>
            <p style={{ color: "#1A1A1A", fontWeight: "600", margin: "0", fontSize: "0.9rem" }}>{item.day}</p>
            <p style={{ color: "#1A1A1A", margin: "0", fontSize: "0.9rem" }}>{item.startTime}</p>
            <p style={{ color: "#1A1A1A", margin: "0", fontSize: "0.9rem" }}>{item.endTime}</p>
            <p style={{ color: "#1A1A1A", fontWeight: "600", margin: "0", fontSize: "0.9rem" }}>{item.trips}</p>
            <p style={{ color: "#2196F3", fontWeight: "600", margin: "0", fontSize: "0.9rem" }}>{item.totalDistance}</p>
            <span
              style={{
                padding: "0.4rem 0.8rem",
                background: getStatusColor(item.status) + "20",
                color: getStatusColor(item.status),
                borderRadius: "4px",
                fontWeight: "600",
                fontSize: "0.75rem",
                textAlign: "center",
                width: "fit-content",
              }}
            >
              {item.status === "today" ? "🔴 TODAY" : "📅 UPCOMING"}
            </span>
          </div>
        ))}
      </div>

      {/* Shift Details Card */}
      <div style={{ padding: "1.5rem", border: "1px solid #E8E8E8", borderRadius: "8px", background: "#F9F9F9" }}>
        <h2 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Break Time Allocation</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem" }}>
          <div>
            <p style={{ color: "#999", fontSize: "0.8rem", fontWeight: "600", margin: "0" }}>LUNCH BREAK</p>
            <p style={{ color: "#1A1A1A", fontWeight: "600", margin: "0.5rem 0 0 0" }}>12:00 PM - 1:00 PM (1 hour)</p>
          </div>
          <div>
            <p style={{ color: "#999", fontSize: "0.8rem", fontWeight: "600", margin: "0" }}>REST BREAKS</p>
            <p style={{ color: "#1A1A1A", fontWeight: "600", margin: "0.5rem 0 0 0" }}>3:00 PM - 3:15 PM (15 mins)</p>
          </div>
          <div>
            <p style={{ color: "#999", fontSize: "0.8rem", fontWeight: "600", margin: "0" }}>REFUEL STOP</p>
            <p style={{ color: "#1A1A1A", fontWeight: "600", margin: "0.5rem 0 0 0" }}>As needed (max 30 mins)</p>
          </div>
          <div>
            <p style={{ color: "#999", fontSize: "0.8rem", fontWeight: "600", margin: "0" }}>INSPECTION TIME</p>
            <p style={{ color: "#1A1A1A", fontWeight: "600", margin: "0.5rem 0 0 0" }}>Pre-trip & post-trip (15 mins)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
