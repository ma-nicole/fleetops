"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getDashboardPath, type UserRole } from "@/lib/auth";
import { CustomerDataFlowService } from "@/lib/customerDataFlowService";
import { useAuthStatus } from "@/lib/useAuthStatus";

export default function OrderConfirmationPage() {
  const router = useRouter();
  const { role } = useAuthStatus();
  const booking = useMemo(() => CustomerDataFlowService.getCurrentBooking(), []);
  const [error, setError] = useState("");

  const confirm = () => {
    setError("");
    const result = CustomerDataFlowService.confirmCurrentBooking();
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.push("/payment");
  };

  return (
    <main style={{ padding: "var(--page-main-padding)", minHeight: "100vh", background: "#FAFAFA" }}>
      <div style={{ maxWidth: "900px", margin: "0 auto", display: "grid", gap: "1rem" }}>
        <h1 style={{ margin: 0 }}>Order Confirmation</h1>
        <section style={{ background: "white", border: "1px solid #E8E8E8", borderRadius: "10px", padding: "1rem", display: "grid", gap: "0.5rem" }}>
          {!booking ? (
            <>
              <p style={{ margin: 0, color: "#666" }}>No booking found. Please create a booking first.</p>
              {role === "customer" ? (
                <Link href="/booking" style={{ color: "var(--brand-text)", textDecoration: "none" }}>
                  Go to booking
                </Link>
              ) : role ? (
                <Link href={getDashboardPath(role as UserRole)} style={{ color: "var(--brand-text)", textDecoration: "none" }}>
                  Go to dashboard
                </Link>
              ) : (
                <Link href="/sign-in" style={{ color: "var(--brand-text)", textDecoration: "none" }}>
                  Sign in
                </Link>
              )}
            </>
          ) : (
            <>
              <p style={{ margin: 0 }}><strong>Booking:</strong> {booking.id}</p>
              <p style={{ margin: 0 }}><strong>Service:</strong> {booking.serviceType}</p>
              <p style={{ margin: 0 }}><strong>Route:</strong> {booking.pickup} → {booking.dropoff}</p>
              <p style={{ margin: 0 }}><strong>Load:</strong> {booking.load}</p>
              <p style={{ margin: 0, textTransform: "capitalize" }}><strong>Status:</strong> {booking.status}</p>
              {error && <p style={{ margin: 0, color: "#DC2626" }}>{error}</p>}
              <button onClick={confirm} style={{ width: "fit-content", marginTop: "0.5rem", border: "none", borderRadius: "6px", background: "var(--accent)", color: "white", fontWeight: 600, padding: "0.65rem 1rem", cursor: "pointer" }}>
                Confirm and Proceed to Payment
              </button>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

