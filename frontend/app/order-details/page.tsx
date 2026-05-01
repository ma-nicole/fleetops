"use client";

import Link from "next/link";
import { useMemo } from "react";
import { CustomerDataFlowService } from "@/lib/customerDataFlowService";

export default function OrderDetailsPage() {
  const booking = useMemo(() => CustomerDataFlowService.getCurrentBooking(), []);
  const payment = useMemo(() => CustomerDataFlowService.getPaymentForCurrentBooking(), []);

  return (
    <main style={{ padding: "2rem", minHeight: "100vh", background: "#FAFAFA" }}>
      <div style={{ maxWidth: "900px", margin: "0 auto", display: "grid", gap: "1rem" }}>
        <h1 style={{ margin: 0 }}>Order Details</h1>
        <section style={{ background: "white", border: "1px solid #E8E8E8", borderRadius: "10px", padding: "1rem", display: "grid", gap: "0.5rem" }}>
          {!booking ? (
            <p style={{ margin: 0, color: "#666" }}>No order details found.</p>
          ) : (
            <>
              <p style={{ margin: 0 }}><strong>Booking Info:</strong> {booking.id} | {booking.pickup} → {booking.dropoff}</p>
              <p style={{ margin: 0 }}><strong>Service:</strong> {booking.serviceType}</p>
              <p style={{ margin: 0 }}><strong>Payment Status:</strong> {payment?.status || "unpaid"}</p>
              {payment && (
                <p style={{ margin: 0 }}><strong>Payment Reference:</strong> {payment.reference}</p>
              )}
              <p style={{ margin: 0 }}><strong>Trip Summary:</strong> Driver assignment pending, ETA will be sent after dispatch.</p>
            </>
          )}
        </section>
        <Link href="/feedback" style={{ width: "fit-content", textDecoration: "none", borderRadius: "6px", background: "#3B82F6", color: "white", fontWeight: 600, padding: "0.65rem 1rem" }}>
          Continue to Feedback / Receipt
        </Link>
      </div>
    </main>
  );
}

