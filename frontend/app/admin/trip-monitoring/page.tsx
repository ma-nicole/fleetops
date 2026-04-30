"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRoleGuard } from "@/lib/useRoleGuard";
import { AdminFlowService, AdminTrip } from "@/lib/adminFlowService";

export default function AdminTripMonitoringPage() {
  useRoleGuard(["admin", "manager"]);
  const [trips, setTrips] = useState<AdminTrip[]>([]);

  useEffect(() => {
    setTrips(AdminFlowService.getTrips());
  }, []);

  return (
    <main style={{ padding: "2rem", background: "#FAFAFA", minHeight: "100vh" }}>
      <div className="container" style={{ maxWidth: "1200px", margin: "0 auto", display: "grid", gap: "1.2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <Link href="/admin/scheduling" style={{ color: "#0EA5E9", textDecoration: "none" }}>← Scheduling</Link>
            <h1 style={{ margin: "0.75rem 0 0.25rem", fontSize: "2rem" }}>Trip Execution & Monitoring</h1>
          </div>
          <Link href="/admin/analytics" style={{ textDecoration: "none", background: "#3B82F6", color: "white", padding: "0.6rem 1rem", borderRadius: "6px", fontWeight: 600 }}>Next: Analytics</Link>
        </div>

        <section style={{ background: "white", border: "1px solid #E8E8E8", borderRadius: "10px", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E8E8E8" }}>
              <th style={{ padding: "0.75rem", textAlign: "left" }}>Trip</th><th style={{ padding: "0.75rem", textAlign: "left" }}>Driver</th><th style={{ padding: "0.75rem", textAlign: "left" }}>Vehicle</th><th style={{ padding: "0.75rem", textAlign: "left" }}>Location</th><th style={{ padding: "0.75rem", textAlign: "left" }}>ETA</th><th style={{ padding: "0.75rem", textAlign: "left" }}>Status</th>
            </tr></thead>
            <tbody>
              {trips.map((trip) => (
                <tr key={trip.id} style={{ borderBottom: "1px solid #E8E8E8" }}>
                  <td style={{ padding: "0.75rem", fontWeight: 700 }}>{trip.id}</td><td style={{ padding: "0.75rem" }}>{trip.driver}</td><td style={{ padding: "0.75rem" }}>{trip.vehicle}</td><td style={{ padding: "0.75rem" }}>{trip.location}</td><td style={{ padding: "0.75rem" }}>{trip.eta}</td><td style={{ padding: "0.75rem", textTransform: "capitalize" }}>{trip.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}

