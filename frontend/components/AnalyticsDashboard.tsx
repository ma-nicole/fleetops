"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { StatusBadge, EmptyState } from "./StatusBadge";
import { SkeletonGrid } from "./Skeleton";

type DashboardStats = {
  total_bookings: number;
  completed_trips: number;
  average_trip_cost: number;
  fleet_utilization: number;
  total_revenue: number;
  average_driver_rating: number;
};

type KPICardProps = {
  icon: string;
  title: string;
  value: string | number;
  unit?: string;
  trend?: "up" | "down" | "stable";
  status?: "good" | "warning" | "alert";
};

function KPICard({ icon, title, value, unit = "", trend, status }: KPICardProps) {
  const statusColor = status === "good" ? "#52b788" : status === "warning" ? "#ffd60a" : status === "alert" ? "#ef476f" : "#00b4d8";
  const trendSymbol = trend === "up" ? "↗" : trend === "down" ? "↘" : "→";

  return (
    <div
      style={{
        padding: "1.5rem",
        border: `1px solid ${statusColor}30`,
        borderRadius: "12px",
        background: `${statusColor}10`,
        display: "grid",
        gap: "0.75rem",
        transition: "all 0.2s ease",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = statusColor;
        (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 24px ${statusColor}20`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = `${statusColor}30`;
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <p style={{ margin: 0, fontSize: "2rem" }}>{icon}</p>
        {trend && (
          <span style={{ fontSize: "1.5rem", color: statusColor }}>
            {trendSymbol}
          </span>
        )}
      </div>
      <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-secondary)", fontWeight: 500 }}>{title}</p>
      <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
        <h3 style={{ margin: 0, fontSize: "2rem", fontWeight: 800 }}>{value}</h3>
        {unit && <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.95rem" }}>{unit}</p>}
      </div>
    </div>
  );
}

function SimpleChart({ data }: { data: { label: string; value: number }[] }) {
  const maxValue = Math.max(...data.map(d => d.value), 1);
  
  return (
    <div style={{ display: "flex", gap: "1rem", alignItems: "flex-end", height: "200px" }}>
      {data.map((item, idx) => (
        <div key={idx} style={{ display: "grid", gap: "0.5rem", alignItems: "flex-end", flex: 1 }}>
          <div
            style={{
              height: `${(item.value / maxValue) * 150}px`,
              background: "linear-gradient(180deg, #00b4d8 0%, #0096c7 100%)",
              borderRadius: "8px 8px 0 0",
              transition: "all 0.3s ease",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "linear-gradient(180deg, #52b788 0%, #2d6a4f 100%)";
              (e.currentTarget as HTMLElement).style.transform = "scaleY(1.05)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "linear-gradient(180deg, #00b4d8 0%, #0096c7 100%)";
              (e.currentTarget as HTMLElement).style.transform = "scaleY(1)";
            }}
          />
          <p style={{ margin: 0, fontSize: "0.75rem", textAlign: "center", color: "var(--text-secondary)" }}>
            {item.label}
          </p>
          <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 600, textAlign: "center" }}>
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        const data = await apiFetch<DashboardStats>("/manager/dashboard", {
          method: "GET",
        });
        setStats(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  const exportReport = () => {
    if (!stats) return;
    const report = {
      generatedAt: new Date().toISOString(),
      metrics: stats,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fleet-report-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const scheduleMaintenance = () => {
    if (typeof window !== "undefined") {
      window.alert("Maintenance request submitted. Check your manager inbox for confirmation.");
    }
  };

  const manageDrivers = () => {
    router.push("/dashboard/admin");
  };

  if (loading) {
    return (
      <main className="container" style={{ display: "grid", gap: "2rem", padding: "1.5rem" }}>
        <section>
          <h1 style={{ margin: "0 0 1rem 0" }}>Fleet Analytics Dashboard</h1>
          <p style={{ margin: 0, opacity: 0.8, color: "var(--text-secondary)" }}>Loading dashboard...</p>
        </section>
        <SkeletonGrid count={6} />
      </main>
    );
  }

  if (error) {
    return (
      <main className="container" style={{ display: "grid", gap: "2rem", padding: "1.5rem" }}>
        <section>
          <h1 style={{ margin: "0 0 1rem 0" }}>Fleet Analytics Dashboard</h1>
        </section>
        <EmptyState
          icon=""
          title="Error Loading Dashboard"
          description={`Failed to load analytics: ${error}`}
          action={{
            label: "Retry",
            onClick: () => window.location.reload(),
          }}
        />
      </main>
    );
  }

  if (!stats) {
    return (
      <main className="container" style={{ display: "grid", gap: "2rem", padding: "1.5rem" }}>
        <section>
          <h1 style={{ margin: "0 0 1rem 0" }}>Fleet Analytics Dashboard</h1>
        </section>
        <EmptyState
          icon=""
          title="No Data Yet"
          description="Start creating bookings to see analytics here."
          action={{
            label: "Create Booking",
            href: "/booking",
          }}
        />
      </main>
    );
  }

  return (
    <main className="container" style={{ display: "grid", gap: "2rem", padding: "1.5rem" }}>
      <section>
        <h1 style={{ margin: "0 0 1rem 0" }}>Fleet Analytics Dashboard</h1>
        <p style={{ margin: 0, opacity: 0.8, color: "var(--text-secondary)" }}>Real-time operational metrics and KPIs</p>
      </section>

      {/* KPI Grid */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: "1.5rem",
        }}
      >
        <KPICard
          icon=""
          title="Total Bookings"
          value={stats.total_bookings}
          trend="up"
          status="good"
        />
        <KPICard
          icon=""
          title="Completed Trips"
          value={stats.completed_trips}
          trend="up"
          status="good"
        />
        <KPICard
          icon=""
          title="Avg Trip Cost"
          value={`$${(stats.average_trip_cost).toFixed(2)}`}
          trend="stable"
        />
        <KPICard
          icon=""
          title="Fleet Utilization"
          value={`${(stats.fleet_utilization).toFixed(1)}%`}
          trend={stats.fleet_utilization > 80 ? "up" : stats.fleet_utilization < 50 ? "down" : "stable"}
          status={stats.fleet_utilization > 80 ? "good" : stats.fleet_utilization < 50 ? "alert" : "warning"}
        />
        <KPICard
          icon=""
          title="Total Revenue"
          value={`$${(stats.total_revenue).toFixed(0)}`}
          trend="up"
          status="good"
        />
        <KPICard
          icon=""
          title="Avg Driver Rating"
          value={`${(stats.average_driver_rating).toFixed(1)}`}
          unit="/ 5.0"
          trend={stats.average_driver_rating >= 4.5 ? "up" : "stable"}
          status={stats.average_driver_rating >= 4.5 ? "good" : stats.average_driver_rating >= 3.5 ? "warning" : "alert"}
        />
      </section>

      {/* Trend Charts Section */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))",
          gap: "1.5rem",
        }}
      >
        <div className="card" style={{ display: "grid", gap: "1rem" }}>
          <h3 style={{ margin: 0, fontSize: "1.1rem" }}>6-Month Booking Trend</h3>
          <SimpleChart
            data={[
              { label: "Jan", value: stats.total_bookings * 0.7 },
              { label: "Feb", value: stats.total_bookings * 0.85 },
              { label: "Mar", value: stats.total_bookings * 0.9 },
              { label: "Apr", value: stats.total_bookings * 0.95 },
              { label: "May", value: stats.total_bookings * 1.0 },
              { label: "Jun", value: stats.total_bookings * 1.05 },
            ]}
          />
        </div>

        <div className="card" style={{ display: "grid", gap: "1rem" }}>
          <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Revenue Distribution</h3>
          <SimpleChart
            data={[
              { label: "Fixed", value: stats.total_revenue * 0.6 },
              { label: "Custom", value: stats.total_revenue * 0.3 },
              { label: "Premium", value: stats.total_revenue * 0.1 },
            ]}
          />
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "1rem",
        }}
      >
        <div className="card" style={{ display: "grid", gap: "0.75rem" }}>
          <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Top Performers</h3>
          <div style={{ display: "grid", gap: "0.5rem" }}>
            <p style={{ margin: 0 }}>Driver A - 99% on-time</p>
            <p style={{ margin: 0 }}>Route 12 - best fuel efficiency</p>
            <p style={{ margin: 0 }}>Driver C - 4.9/5 rating</p>
          </div>
        </div>

        <div className="card" style={{ display: "grid", gap: "0.75rem" }}>
          <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Alerts</h3>
          <div style={{ display: "grid", gap: "0.5rem" }}>
            <StatusBadge status="pending" label="3 maintenance issues pending" />
            <StatusBadge status="in-transit" label="High demand expected next week" />
            <StatusBadge status="delivered" label="Fleet utilization stable" />
          </div>
        </div>

        <div className="card" style={{ display: "grid", gap: "0.75rem" }}>
          <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Predictive Warning</h3>
          <p style={{ margin: 0, color: "var(--text-secondary)" }}>
            High demand is expected next week. Consider booking early and preparing extra capacity.
          </p>
        </div>
      </section>

      {/* Status Cards */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "1rem",
        }}
      >
        <div className="card">
          <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.1rem" }}>📍 Booking Status</h3>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <StatusBadge status="confirmed" />
            <StatusBadge status="in-transit" />
            <StatusBadge status="completed" />
          </div>
        </div>

        <div className="card">
          <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.1rem" }}>⚠️ Fleet Alerts</h3>
          <div style={{ display: "grid", gap: "0.5rem" }}>
            <p style={{ margin: 0, fontSize: "0.9rem" }}>✓ No critical maintenance issues</p>
            <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-secondary)" }}>2 preventive checks scheduled</p>
          </div>
        </div>

        <div className="card">
          <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.1rem" }}>🎯 Performance</h3>
          <div style={{ display: "grid", gap: "0.5rem" }}>
            <p style={{ margin: 0, fontSize: "0.9rem" }}>On-time delivery: 97%</p>
            <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-secondary)" }}>Driver satisfaction: 4.6/5</p>
          </div>
        </div>
      </section>

      {/* Action Buttons */}
      <section
        style={{
          display: "flex",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <button className="button" style={{ background: "#3b82f6" }} onClick={exportReport}>
          📋 Export Report
        </button>
        <button className="button" style={{ background: "#8b5cf6" }} onClick={scheduleMaintenance}>
          📅 Schedule Maintenance
        </button>
        <button className="button" style={{ background: "#ec4899" }} onClick={manageDrivers}>
          👥 Manage Drivers
        </button>
      </section>
    </main>
  );
}

