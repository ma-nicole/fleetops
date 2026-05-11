"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRoleGuard } from "@/lib/useRoleGuard";
import { AdminFlowService, type AdminSchedule, type AdminTrip } from "@/lib/adminFlowService";
import { formatPhp } from "@/lib/appLocale";

export default function AdminDashboardPage() {
  useRoleGuard(["admin", "manager"]);
  const [kpis, setKpis] = useState(AdminFlowService.getKpis());
  const [schedules, setSchedules] = useState<AdminSchedule[]>([]);
  const [trips, setTrips] = useState<AdminTrip[]>([]);
  useEffect(() => {
    AdminFlowService.init();
    setKpis(AdminFlowService.getKpis());
    setSchedules(AdminFlowService.getSchedules());
    setTrips(AdminFlowService.getTrips());
  }, []);

  const statusPill = (label: string, tone: "blue" | "amber" | "green") => {
    const tones = {
      blue: { bg: "#DBEAFE", color: "#1E40AF" },
      amber: { bg: "#FEF3C7", color: "#92400E" },
      green: { bg: "#DCFCE7", color: "#166534" },
    } as const;
    const t = tones[tone];
    return (
      <span
        style={{
          display: "inline-block",
          padding: "0.2rem 0.5rem",
          borderRadius: "999px",
          fontSize: "0.75rem",
          fontWeight: 700,
          background: t.bg,
          color: t.color,
          textTransform: "capitalize",
        }}
      >
        {label}
      </span>
    );
  };

  return (
    <main style={{ padding: "var(--page-main-padding)", background: "#FAFAFA", minHeight: "100vh" }}>
      <div className="container" style={{ maxWidth: "1200px", margin: "0 auto", display: "grid", gap: "1.5rem" }}>
        <div>
          <h1 style={{ margin: "0 0 0.4rem", fontSize: "2rem", fontWeight: 900, color: "#1A1A1A" }}>Admin Dashboard</h1>
          <p style={{ margin: 0, color: "#666" }}>
            Complete operations view across payment verification and trip monitoring.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "1rem" }}>
          {[
            { label: "Schedules", value: kpis.totalSchedules, color: "#3B82F6" },
            { label: "Ongoing Trips", value: kpis.ongoingTrips, color: "#F59E0B" },
            { label: "Completed Trips", value: kpis.completedTrips, color: "#10B981" },
            { label: "Revenue", value: formatPhp(kpis.totalRevenue), color: "#8B5CF6" },
            { label: "Paid Orders", value: kpis.paidOrders, color: "#0EA5E9" },
            { label: "Operational Cost", value: formatPhp(kpis.totalFuel + kpis.totalToll), color: "#EF4444" },
          ].map((item) => (
            <div key={item.label} style={{ background: "white", border: "1px solid #E8E8E8", borderRadius: "10px", padding: "1rem" }}>
              <p style={{ margin: "0 0 0.4rem", color: "#666", fontSize: "0.85rem" }}>{item.label}</p>
              <p style={{ margin: 0, fontSize: "1.6rem", fontWeight: 800, color: item.color }}>{item.value}</p>
            </div>
          ))}
        </div>

        <section style={{ background: "#fff", border: "1px solid #E8E8E8", borderRadius: "10px", padding: "1rem" }}>
          <h3 style={{ margin: "0 0 0.8rem 0" }}>Quick actions</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "0.75rem" }}>
            {[
              { label: "Payment Approval", href: "/admin/payment-approval" },
              { label: "Trip Monitoring", href: "/admin/trip-monitoring" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  textDecoration: "none",
                  padding: "0.75rem 0.9rem",
                  borderRadius: "8px",
                  border: "1px solid #E5E7EB",
                  background: "#F9FAFB",
                  color: "#111827",
                  fontWeight: 600,
                  textAlign: "center",
                }}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </section>

        <section style={{ background: "#fff", border: "1px solid #E8E8E8", borderRadius: "10px", padding: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}>
            <h3 style={{ margin: 0 }}>Operations snapshot</h3>
            <Link href="/admin/payment-approval" style={{ color: "#2563EB", textDecoration: "none", fontWeight: 600 }}>
              Payment approvals
            </Link>
          </div>
          <div style={{ display: "grid", gap: "0.55rem" }}>
            {schedules.slice(0, 4).map((s) => (
              <div key={s.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "0.6rem", padding: "0.65rem", border: "1px solid #F0F0F0", borderRadius: "8px" }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 700 }}>{s.id} • {s.route}</p>
                  <p style={{ margin: "0.25rem 0 0", color: "#666", fontSize: "0.9rem" }}>
                    {s.driver} • {s.vehicle} • {s.startTime} to {s.eta}
                  </p>
                </div>
                <div>
                  {statusPill(s.status, s.status === "completed" ? "green" : s.status === "enroute" ? "amber" : "blue")}
                </div>
              </div>
            ))}
          </div>
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))", gap: "1rem" }}>
          <section style={{ background: "#fff", border: "1px solid #E8E8E8", borderRadius: "10px", padding: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}>
              <h3 style={{ margin: 0 }}>Live trip monitoring</h3>
              <Link href="/admin/trip-monitoring" style={{ color: "#2563EB", textDecoration: "none", fontWeight: 600 }}>
                Open page
              </Link>
            </div>
            <div style={{ display: "grid", gap: "0.5rem" }}>
              {trips.slice(0, 4).map((t) => (
                <div key={t.id} style={{ padding: "0.6rem", border: "1px solid #F0F0F0", borderRadius: "8px" }}>
                  <p style={{ margin: 0, fontWeight: 700 }}>{t.id} • {t.location}</p>
                  <p style={{ margin: "0.25rem 0", color: "#666", fontSize: "0.9rem" }}>
                    {t.driver} • {t.vehicle} • ETA {t.eta}
                  </p>
                  {statusPill(t.status, t.status === "completed" ? "green" : t.status === "delayed" ? "amber" : "blue")}
                </div>
              ))}
            </div>
            <p style={{ margin: "0.75rem 0 0", color: "#64748B", fontSize: "0.88rem" }}>
              Full board includes customer, company, paid amount, locations, and per-row <strong>View details</strong>.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

