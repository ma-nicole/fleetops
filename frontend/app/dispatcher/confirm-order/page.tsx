"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRoleGuard } from "@/lib/useRoleGuard";
import { DriverDataFlowService, DriverFlowBooking } from "@/lib/driverDataFlowService";

export default function DispatcherConfirmOrderPage() {
  useRoleGuard(["dispatcher"]);
  const [bookings, setBookings] = useState<DriverFlowBooking[]>([]);
  const dispatcher = "dispatcher-001";

  useEffect(() => {
    setBookings(DriverDataFlowService.getBookings());
  }, []);

  const confirm = (id: string) => {
    DriverDataFlowService.confirmOrder(id, dispatcher, "driver-001");
    setBookings(DriverDataFlowService.getBookings());
  };

  return (
    <main style={{ padding: "2rem", background: "#FAFAFA", minHeight: "100vh" }}>
      <div className="container" style={{ maxWidth: "1100px", margin: "0 auto", display: "grid", gap: "1rem" }}>
        <h1 style={{ margin: 0 }}>Confirm Order</h1>
        <section style={{ background: "white", border: "1px solid #E8E8E8", borderRadius: "10px", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E8E8E8" }}>
              <th style={{ padding: "0.75rem", textAlign: "left" }}>Booking</th><th style={{ padding: "0.75rem", textAlign: "left" }}>Customer</th><th style={{ padding: "0.75rem", textAlign: "left" }}>Trip</th><th style={{ padding: "0.75rem", textAlign: "left" }}>Status</th><th style={{ padding: "0.75rem", textAlign: "left" }}>Action</th>
            </tr></thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} style={{ borderBottom: "1px solid #E8E8E8" }}>
                  <td style={{ padding: "0.75rem", fontWeight: 700 }}>{b.id}</td>
                  <td style={{ padding: "0.75rem" }}>{b.customerName}</td>
                  <td style={{ padding: "0.75rem" }}>{b.pickup} → {b.dropoff}</td>
                  <td style={{ padding: "0.75rem", textTransform: "capitalize" }}>{b.status}</td>
                  <td style={{ padding: "0.75rem" }}>
                    {b.status === "pending" ? (
                      <button onClick={() => confirm(b.id)} style={{ border: "none", borderRadius: "6px", background: "#10B981", color: "white", fontWeight: 600, padding: "0.5rem 0.8rem", cursor: "pointer" }}>Confirm</button>
                    ) : "Confirmed"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <Link href="/trips/status" style={{ width: "fit-content", textDecoration: "none", borderRadius: "6px", background: "#3B82F6", color: "white", fontWeight: 600, padding: "0.65rem 1rem" }}>Next: Update Trip Status</Link>
      </div>
    </main>
  );
}

