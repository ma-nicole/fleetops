"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRoleGuard } from "@/lib/useRoleGuard";
import { DriverDataFlowService, DriverFlowBooking, DriverFlowStatus } from "@/lib/driverDataFlowService";

const flowStatuses: DriverFlowStatus[] = ["pending", "confirmed", "scheduled", "ongoing", "completed"];

export default function TripStatusPage() {
  useRoleGuard(["driver", "dispatcher", "manager", "admin"]);
  const [bookings, setBookings] = useState<DriverFlowBooking[]>([]);

  useEffect(() => {
    setBookings(DriverDataFlowService.getBookings());
  }, []);

  const updateStatus = (id: string, status: DriverFlowStatus) => {
    DriverDataFlowService.updateStatus(id, status);
    setBookings(DriverDataFlowService.getBookings());
  };

  return (
    <main style={{ padding: "2rem", background: "#FAFAFA", minHeight: "100vh" }}>
      <div className="container" style={{ maxWidth: "1100px", margin: "0 auto", display: "grid", gap: "1rem" }}>
        <h1 style={{ margin: 0 }}>Trip Status</h1>
        <section style={{ display: "grid", gap: "0.75rem" }}>
          {bookings.map((b) => (
            <div key={b.id} style={{ background: "white", border: "1px solid #E8E8E8", borderRadius: "10px", padding: "0.9rem", display: "grid", gap: "0.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>{b.id}</strong>
                <span style={{ textTransform: "capitalize", fontWeight: 600 }}>{b.status}</span>
              </div>
              <p style={{ margin: 0, color: "#666" }}>{b.pickup} → {b.dropoff} | Driver: {b.assignedDriver || "-"}</p>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {flowStatuses.map((status) => (
                  <button key={status} onClick={() => updateStatus(b.id, status)} style={{ border: "1px solid #D1D5DB", borderRadius: "999px", background: b.status === status ? "#E0F2FE" : "white", padding: "0.4rem 0.7rem", cursor: "pointer", textTransform: "capitalize", fontSize: "0.8rem", fontWeight: 600 }}>
                    {status}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
        <Link href="/reports/generate" style={{ width: "fit-content", textDecoration: "none", borderRadius: "6px", background: "#3B82F6", color: "white", fontWeight: 600, padding: "0.65rem 1rem" }}>Next: Generate Report</Link>
      </div>
    </main>
  );
}

