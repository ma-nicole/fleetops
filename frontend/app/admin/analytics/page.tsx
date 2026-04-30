"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRoleGuard } from "@/lib/useRoleGuard";
import { AdminFlowService } from "@/lib/adminFlowService";

export default function AdminAnalyticsPage() {
  useRoleGuard(["admin", "manager"]);
  const [kpis, setKpis] = useState(AdminFlowService.getKpis());

  useEffect(() => {
    setKpis(AdminFlowService.getKpis());
  }, []);

  return (
    <main style={{ padding: "2rem", background: "#FAFAFA", minHeight: "100vh" }}>
      <div className="container" style={{ maxWidth: "1100px", margin: "0 auto", display: "grid", gap: "1.2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <Link href="/admin/trip-monitoring" style={{ color: "#0EA5E9", textDecoration: "none" }}>← Trip Monitoring</Link>
            <h1 style={{ margin: "0.75rem 0 0.25rem", fontSize: "2rem" }}>Analytics Overview</h1>
          </div>
          <Link href="/admin/orders" style={{ textDecoration: "none", background: "#3B82F6", color: "white", padding: "0.6rem 1rem", borderRadius: "6px", fontWeight: 600 }}>Next: Orders</Link>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
          {[
            { label: "Ongoing Trips", value: kpis.ongoingTrips, color: "#F59E0B" },
            { label: "Completed Trips", value: kpis.completedTrips, color: "#10B981" },
            { label: "Total Revenue", value: `$${kpis.totalRevenue.toFixed(2)}`, color: "#8B5CF6" },
            { label: "Paid Orders", value: kpis.paidOrders, color: "#3B82F6" },
          ].map((kpi) => (
            <div key={kpi.label} style={{ background: "white", border: "1px solid #E8E8E8", borderRadius: "10px", padding: "1rem" }}>
              <p style={{ margin: "0 0 0.3rem", color: "#666", fontSize: "0.85rem" }}>{kpi.label}</p>
              <p style={{ margin: 0, color: kpi.color, fontWeight: 900, fontSize: "1.8rem" }}>{kpi.value}</p>
            </div>
          ))}
        </div>

        <section style={{ background: "white", border: "1px solid #E8E8E8", borderRadius: "10px", padding: "1rem" }}>
          <h3 style={{ marginTop: 0 }}>KPI Report Placeholder</h3>
          <p style={{ color: "#666", marginBottom: 0 }}>Trips, cost, and performance trends are summarized from monitoring and order data. You can replace this section with real charts once backend analytics is connected.</p>
        </section>
      </div>
    </main>
  );
}

