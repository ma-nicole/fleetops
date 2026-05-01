"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRoleGuard } from "@/lib/useRoleGuard";
import { AdminFlowService } from "@/lib/adminFlowService";
import { formatPhp } from "@/lib/appLocale";

export default function AdminDashboardPage() {
  useRoleGuard(["admin", "manager"]);
  const [kpis, setKpis] = useState(AdminFlowService.getKpis());

  useEffect(() => {
    AdminFlowService.init();
    setKpis(AdminFlowService.getKpis());
  }, []);

  return (
    <main style={{ padding: "2rem", background: "#FAFAFA", minHeight: "100vh" }}>
      <div className="container" style={{ maxWidth: "1200px", margin: "0 auto", display: "grid", gap: "1.5rem" }}>
        <div>
          <h1 style={{ margin: "0 0 0.4rem", fontSize: "2rem", fontWeight: 900, color: "#1A1A1A" }}>Admin Dashboard</h1>
          <p style={{ margin: 0, color: "#666" }}>System flow: Scheduling → Monitoring → Analytics → Orders → Finance</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "1rem" }}>
          {[
            { label: "Schedules", value: kpis.totalSchedules, color: "#3B82F6" },
            { label: "Ongoing Trips", value: kpis.ongoingTrips, color: "#F59E0B" },
            { label: "Completed Trips", value: kpis.completedTrips, color: "#10B981" },
            { label: "Revenue", value: formatPhp(kpis.totalRevenue), color: "#8B5CF6" },
          ].map((item) => (
            <div key={item.label} style={{ background: "white", border: "1px solid #E8E8E8", borderRadius: "10px", padding: "1rem" }}>
              <p style={{ margin: "0 0 0.4rem", color: "#666", fontSize: "0.85rem" }}>{item.label}</p>
              <p style={{ margin: 0, fontSize: "1.6rem", fontWeight: 800, color: item.color }}>{item.value}</p>
            </div>
          ))}
        </div>

        <section style={{ background: "white", border: "1px solid #E8E8E8", borderRadius: "10px", padding: "1rem" }}>
          <h3 style={{ marginTop: 0 }}>Admin Workflow Modules</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
            {[
              { label: "Scheduling", href: "/admin/scheduling" },
              { label: "Trip Monitoring", href: "/admin/trip-monitoring" },
              { label: "Analytics", href: "/admin/analytics" },
              { label: "Orders", href: "/admin/orders" },
              { label: "Finance", href: "/admin/finance" },
            ].map((module) => (
              <Link key={module.label} href={module.href} style={{ padding: "0.55rem 0.9rem", border: "1px solid #E5E7EB", borderRadius: "999px", textDecoration: "none", color: "#1A1A1A", background: "#F9FAFB", fontWeight: 600, fontSize: "0.85rem" }}>
                {module.label}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

