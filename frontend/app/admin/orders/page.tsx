"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRoleGuard } from "@/lib/useRoleGuard";
import { AdminFlowService, AdminOrder } from "@/lib/adminFlowService";

export default function AdminOrdersPage() {
  useRoleGuard(["admin", "manager"]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);

  useEffect(() => {
    setOrders(AdminFlowService.getOrders());
  }, []);

  return (
    <main style={{ padding: "2rem", background: "#FAFAFA", minHeight: "100vh" }}>
      <div className="container" style={{ maxWidth: "1200px", margin: "0 auto", display: "grid", gap: "1.2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <Link href="/admin/analytics" style={{ color: "#0EA5E9", textDecoration: "none" }}>← Analytics</Link>
            <h1 style={{ margin: "0.75rem 0 0.25rem", fontSize: "2rem" }}>Order Details</h1>
          </div>
          <Link href="/admin/finance" style={{ textDecoration: "none", background: "#3B82F6", color: "white", padding: "0.6rem 1rem", borderRadius: "6px", fontWeight: 600 }}>Next: Finance</Link>
        </div>

        <section style={{ background: "white", border: "1px solid #E8E8E8", borderRadius: "10px", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E8E8E8" }}>
              <th style={{ padding: "0.75rem", textAlign: "left" }}>Order</th><th style={{ padding: "0.75rem", textAlign: "left" }}>Customer</th><th style={{ padding: "0.75rem", textAlign: "left" }}>Route</th><th style={{ padding: "0.75rem", textAlign: "left" }}>Driver/Vehicle</th><th style={{ padding: "0.75rem", textAlign: "left" }}>Amount</th><th style={{ padding: "0.75rem", textAlign: "left" }}>Payment</th>
            </tr></thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} style={{ borderBottom: "1px solid #E8E8E8" }}>
                  <td style={{ padding: "0.75rem", fontWeight: 700 }}>{order.id}</td>
                  <td style={{ padding: "0.75rem" }}>{order.customer}</td>
                  <td style={{ padding: "0.75rem" }}>{order.route}</td>
                  <td style={{ padding: "0.75rem" }}>{order.driver} / {order.vehicle}</td>
                  <td style={{ padding: "0.75rem" }}>${order.amount.toFixed(2)}</td>
                  <td style={{ padding: "0.75rem", textTransform: "capitalize" }}>{order.paymentStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}

