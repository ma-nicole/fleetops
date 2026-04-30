"use client";

import { useEffect, useMemo, useState } from "react";
import { useRoleGuard } from "@/lib/useRoleGuard";
import { DriverDataFlowService, DriverFlowReport } from "@/lib/driverDataFlowService";

export default function FinalReportPage() {
  useRoleGuard(["dispatcher", "manager", "admin"]);
  const [reports, setReports] = useState<DriverFlowReport[]>([]);

  useEffect(() => {
    setReports(DriverDataFlowService.getReports());
  }, []);

  const finalReports = useMemo(() => reports.filter((r) => r.final), [reports]);

  return (
    <main style={{ padding: "2rem", background: "#FAFAFA", minHeight: "100vh" }}>
      <div className="container" style={{ maxWidth: "1100px", margin: "0 auto", display: "grid", gap: "1rem" }}>
        <h1 style={{ margin: 0 }}>Final Completion Report</h1>
        <section style={{ background: "white", border: "1px solid #E8E8E8", borderRadius: "10px", padding: "1rem", display: "grid", gap: "0.7rem" }}>
          {finalReports.length === 0 && <p style={{ margin: 0, color: "#666" }}>No completed final reports yet. Complete trips and generate reports first.</p>}
          {finalReports.map((report) => (
            <div key={report.id} style={{ border: "1px solid #E8E8E8", borderRadius: "8px", padding: "0.8rem", display: "grid", gap: "0.35rem" }}>
              <strong>{report.id} (Booking {report.bookingId})</strong>
              <span style={{ color: "#666" }}>Trip: {report.tripDetails}</span>
              <span style={{ color: "#666" }}>Costs: {report.costs}</span>
              <span style={{ color: "#666" }}>Status: {report.status}</span>
              <span style={{ color: "#666" }}>Driver Activity: {report.driverActivity}</span>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}

