"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Link from "next/link";
import { useState } from "react";

type AnalyticsData = {
  totalTrips: number;
  completedTrips: number;
  cancelledTrips: number;
  averageRating: number;
  totalEarnings: string;
  averageCostPerTrip: string;
  fuelCostPerLiter: string;
  maintenanceCost: string;
};

type TripTrend = {
  date: string;
  trips: number;
  revenue: string;
};

export default function AnalyticsPage() {
  useRoleGuard(["manager", "admin"]);

  const [analytics] = useState<AnalyticsData>({
    totalTrips: 1156,
    completedTrips: 1089,
    cancelledTrips: 67,
    averageRating: 4.7,
    totalEarnings: "$245,680.50",
    averageCostPerTrip: "$195.50",
    fuelCostPerLiter: "$1.35",
    maintenanceCost: "$12,450.00",
  });

  const [tripTrends] = useState<TripTrend[]>([
    { date: "Monday", trips: 145, revenue: "$28,450" },
    { date: "Tuesday", trips: 152, revenue: "$29,680" },
    { date: "Wednesday", trips: 138, revenue: "$27,220" },
    { date: "Thursday", trips: 161, revenue: "$31,590" },
    { date: "Friday", trips: 173, revenue: "$33,870" },
    { date: "Saturday", trips: 145, revenue: "$28,350" },
    { date: "Sunday", trips: 98, revenue: "$19,240" },
  ]);

  return (
    <main style={{ padding: "2rem", background: "#FAFAFA", minHeight: "100vh" }}>
      <div className="container" style={{ maxWidth: "1400px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
            <Link href="/manager/dashboard" style={{ color: "#0EA5E9", textDecoration: "none" }}>
              ← Dashboard
            </Link>
          </div>
          <h1 style={{ margin: "0 0 0.5rem", fontSize: "2rem", fontWeight: 900, color: "#1A1A1A" }}>
            Analytics Overview
          </h1>
          <p style={{ margin: 0, color: "#666", fontSize: "1rem" }}>Comprehensive fleet analytics and insights</p>
        </div>

        {/* Analytics Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "1.5rem",
            marginBottom: "2rem",
          }}
        >
          <div style={{ background: "white", padding: "1.5rem", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <div style={{ color: "#666", fontSize: "0.9rem", marginBottom: "0.5rem" }}>Total Trips</div>
            <div style={{ fontSize: "2.5rem", fontWeight: 900, color: "#1A1A1A" }}>{analytics.totalTrips}</div>
            <div style={{ fontSize: "0.8rem", color: "#999", marginTop: "0.5rem" }}>All time</div>
          </div>

          <div style={{ background: "white", padding: "1.5rem", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <div style={{ color: "#666", fontSize: "0.9rem", marginBottom: "0.5rem" }}>Completed Trips</div>
            <div style={{ fontSize: "2.5rem", fontWeight: 900, color: "#10B981" }}>{analytics.completedTrips}</div>
            <div style={{ fontSize: "0.8rem", color: "#999", marginTop: "0.5rem" }}>{((analytics.completedTrips / analytics.totalTrips) * 100).toFixed(1)}% success rate</div>
          </div>

          <div style={{ background: "white", padding: "1.5rem", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <div style={{ color: "#666", fontSize: "0.9rem", marginBottom: "0.5rem" }}>Total Earnings</div>
            <div style={{ fontSize: "2.5rem", fontWeight: 900, color: "#FF9800" }}>{analytics.totalEarnings}</div>
            <div style={{ fontSize: "0.8rem", color: "#999", marginTop: "0.5rem" }}>Revenue generated</div>
          </div>

          <div style={{ background: "white", padding: "1.5rem", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <div style={{ color: "#666", fontSize: "0.9rem", marginBottom: "0.5rem" }}>Avg Rating</div>
            <div style={{ fontSize: "2.5rem", fontWeight: 900, color: "#8B5CF6" }}>★ {analytics.averageRating}</div>
            <div style={{ fontSize: "0.8rem", color: "#999", marginTop: "0.5rem" }}>Customer satisfaction</div>
          </div>
        </div>

        {/* Cost Analytics */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "1.5rem",
            marginBottom: "2rem",
          }}
        >
          <div style={{ background: "white", padding: "1.5rem", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <h2 style={{ margin: "0 0 1rem", fontSize: "1.2rem", fontWeight: 700 }}>Cost Analysis</h2>
            <div style={{ display: "grid", gap: "1rem" }}>
              <div style={{ padding: "1rem", background: "#F0F9FF", borderRadius: "6px", borderLeft: "3px solid #0EA5E9" }}>
                <div style={{ color: "#666", fontSize: "0.9rem" }}>Avg Cost Per Trip</div>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#0EA5E9" }}>{analytics.averageCostPerTrip}</div>
              </div>
              <div style={{ padding: "1rem", background: "#FEF3C7", borderRadius: "6px", borderLeft: "3px solid #F59E0B" }}>
                <div style={{ color: "#666", fontSize: "0.9rem" }}>Fuel Cost Per Liter</div>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#F59E0B" }}>{analytics.fuelCostPerLiter}</div>
              </div>
              <div style={{ padding: "1rem", background: "#FEE2E2", borderRadius: "6px", borderLeft: "3px solid #EF4444" }}>
                <div style={{ color: "#666", fontSize: "0.9rem" }}>Maintenance Cost</div>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#EF4444" }}>{analytics.maintenanceCost}</div>
              </div>
            </div>
          </div>

          {/* Weekly Trends */}
          <div style={{ background: "white", padding: "1.5rem", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <h2 style={{ margin: "0 0 1rem", fontSize: "1.2rem", fontWeight: 700 }}>Weekly Trends</h2>
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {tripTrends.map((trend, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "80px 1fr 100px", gap: "1rem", alignItems: "center" }}>
                  <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "#666" }}>{trend.date}</span>
                  <div style={{ background: "#F0F0F0", borderRadius: "4px", height: "30px", position: "relative", overflow: "hidden" }}>
                    <div
                      style={{
                        background: "#FF9800",
                        height: "100%",
                        width: `${(trend.trips / 173) * 100}%`,
                        borderRadius: "4px",
                      }}
                    />
                  </div>
                  <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "#1A1A1A", textAlign: "right" }}>{trend.trips} trips</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "1rem" }}>
          <Link
            href="/manager/scheduled-bookings"
            style={{
              padding: "1rem",
              background: "white",
              border: "1px solid #E8E8E8",
              borderRadius: "8px",
              textDecoration: "none",
              textAlign: "center",
              color: "#1A1A1A",
              fontWeight: 600,
            }}
          >
            View Bookings
          </Link>
          <Link
            href="/manager/history"
            style={{
              padding: "1rem",
              background: "white",
              border: "1px solid #E8E8E8",
              borderRadius: "8px",
              textDecoration: "none",
              textAlign: "center",
              color: "#1A1A1A",
              fontWeight: 600,
            }}
          >
            View History
          </Link>
        </div>
      </div>
    </main>
  );
}
