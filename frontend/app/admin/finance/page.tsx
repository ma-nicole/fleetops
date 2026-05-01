"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRoleGuard } from "@/lib/useRoleGuard";
import { AdminFlowService } from "@/lib/adminFlowService";
import { formatPhp } from "@/lib/appLocale";

export default function AdminFinancePage() {
  useRoleGuard(["admin", "manager"]);
  const [kpis, setKpis] = useState(AdminFlowService.getKpis());

  useEffect(() => {
    setKpis(AdminFlowService.getKpis());
  }, []);

  return (
    <main style={{ padding: "2rem", background: "#FAFAFA", minHeight: "100vh" }}>
      <div className="container" style={{ maxWidth: "1000px", margin: "0 auto", display: "grid", gap: "1.2rem" }}>
        <div>
          <Link href="/admin/orders" style={{ color: "#0EA5E9", textDecoration: "none" }}>← Orders</Link>
          <h1 style={{ margin: "0.75rem 0 0.25rem", fontSize: "2rem" }}>Finance View</h1>
          <p style={{ margin: 0, color: "#666" }}>Financial reports sourced from order, fuel, toll, and payment mock data.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
          <div style={{ background: "white", border: "1px solid #E8E8E8", borderRadius: "10px", padding: "1rem" }}>
            <p style={{ margin: "0 0 0.35rem", color: "#666", fontSize: "0.85rem" }}>Payment Totals</p>
            <p style={{ margin: 0, fontSize: "1.8rem", fontWeight: 900, color: "#10B981" }}>{formatPhp(kpis.totalRevenue)}</p>
          </div>
          <div style={{ background: "white", border: "1px solid #E8E8E8", borderRadius: "10px", padding: "1rem" }}>
            <p style={{ margin: "0 0 0.35rem", color: "#666", fontSize: "0.85rem" }}>Fuel Costs</p>
            <p style={{ margin: 0, fontSize: "1.8rem", fontWeight: 900, color: "#F59E0B" }}>{formatPhp(kpis.totalFuel)}</p>
          </div>
          <div style={{ background: "white", border: "1px solid #E8E8E8", borderRadius: "10px", padding: "1rem" }}>
            <p style={{ margin: "0 0 0.35rem", color: "#666", fontSize: "0.85rem" }}>Toll Fees</p>
            <p style={{ margin: 0, fontSize: "1.8rem", fontWeight: 900, color: "#3B82F6" }}>{formatPhp(kpis.totalToll)}</p>
          </div>
        </div>

        <section style={{ background: "white", border: "1px solid #E8E8E8", borderRadius: "10px", padding: "1rem" }}>
          <h3 style={{ marginTop: 0 }}>Financial Summary</h3>
          <p style={{ margin: "0 0 0.35rem", color: "#666" }}>Net after fuel+toll (mock): {formatPhp(kpis.totalRevenue - (kpis.totalFuel + kpis.totalToll))}</p>
          <p style={{ margin: 0, color: "#666" }}>Use this as a placeholder for deeper finance reports once backend data is ready.</p>
        </section>
      </div>
    </main>
  );
}

