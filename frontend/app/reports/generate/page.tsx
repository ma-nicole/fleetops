"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRoleGuard } from "@/lib/useRoleGuard";
import { DriverDataFlowService, DriverFlowBooking, DriverFlowReport } from "@/lib/driverDataFlowService";

export default function GenerateReportPage() {
  useRoleGuard(["dispatcher", "manager", "admin"]);
  const [bookings, setBookings] = useState<DriverFlowBooking[]>([]);
  const [reports, setReports] = useState<DriverFlowReport[]>([]);

  useEffect(() => {
    setBookings(DriverDataFlowService.getBookings());
    setReports(DriverDataFlowService.getReports());
  }, []);

  const generate = (bookingId: string) => {
    DriverDataFlowService.generateReport(bookingId);
    setReports(DriverDataFlowService.getReports());
  };

  return (
    <main style={{ padding: "2rem", background: "#FAFAFA", minHeight: "100vh" }}>
      <div className="container" style={{ maxWidth: "1100px", margin: "0 auto", display: "grid", gap: "1rem" }}>
        <h1 style={{ margin: 0 }}>Generate Report</h1>
        <section style={{ background: "white", border: "1px solid #E8E8E8", borderRadius: "10px", padding: "1rem", display: "grid", gap: "0.6rem" }}>
          {bookings.map((b) => (
            <div key={b.id} style={{ border: "1px solid #E8E8E8", borderRadius: "8px", padding: "0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>{b.id} | {b.pickup} → {b.dropoff} | {b.status}</span>
              <button onClick={() => generate(b.id)} style={{ border: "none", borderRadius: "6px", background: "#10B981", color: "white", fontWeight: 600, padding: "0.5rem 0.8rem", cursor: "pointer" }}>Generate</button>
            </div>
          ))}
        </section>
        <p style={{ margin: 0, color: "#666" }}>Generated reports: {reports.length}</p>
        <Link href="/reports/final" style={{ width: "fit-content", textDecoration: "none", borderRadius: "6px", background: "#3B82F6", color: "white", fontWeight: 600, padding: "0.65rem 1rem" }}>Next: Final Completion Report</Link>
      </div>
    </main>
  );
}

