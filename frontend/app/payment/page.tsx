"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getDashboardPath, type UserRole } from "@/lib/auth";
import { CustomerDataFlowService } from "@/lib/customerDataFlowService";
import { formatPhp } from "@/lib/appLocale";
import { useAuthStatus } from "@/lib/useAuthStatus";

export default function PaymentPage() {
  const router = useRouter();
  const { role } = useAuthStatus();
  const booking = useMemo(() => CustomerDataFlowService.getCurrentBooking(), []);
  const [method, setMethod] = useState("Credit Card");
  const [error, setError] = useState("");

  const amount = 450;

  const pay = () => {
    setError("");
    const result = CustomerDataFlowService.payCurrentBooking(method, amount);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.push("/order-details");
  };

  return (
    <main style={{ padding: "var(--page-main-padding)", minHeight: "100vh", background: "#FAFAFA" }}>
      <div style={{ maxWidth: "800px", margin: "0 auto", display: "grid", gap: "1rem" }}>
        <h1 style={{ margin: 0 }}>Payment</h1>
        <section style={{ background: "white", border: "1px solid #E8E8E8", borderRadius: "10px", padding: "1rem", display: "grid", gap: "0.6rem" }}>
          {!booking ? (
            <>
              <p style={{ margin: 0, color: "#666" }}>No booking found.</p>
              {role === "customer" ? (
                <Link href="/booking" style={{ color: "#2563EB", textDecoration: "none" }}>
                  Create booking first
                </Link>
              ) : role ? (
                <Link href={getDashboardPath(role as UserRole)} style={{ color: "#2563EB", textDecoration: "none" }}>
                  Go to dashboard
                </Link>
              ) : (
                <Link href="/sign-in" style={{ color: "#2563EB", textDecoration: "none" }}>
                  Sign in
                </Link>
              )}
            </>
          ) : (
            <>
              <p style={{ margin: 0 }}><strong>Booking:</strong> {booking.id}</p>
              <p style={{ margin: 0 }}><strong>Amount:</strong> {formatPhp(amount)}</p>
              <select value={method} onChange={(e) => setMethod(e.target.value)} style={{ padding: "0.7rem", border: "1px solid #D1D5DB", borderRadius: "6px", maxWidth: "280px" }}>
                <option>Credit Card</option>
                <option>Bank Transfer</option>
                <option>GCash</option>
              </select>
              {error && <p style={{ margin: 0, color: "#DC2626" }}>{error}</p>}
              <button onClick={pay} style={{ width: "fit-content", border: "none", borderRadius: "6px", background: "#10B981", color: "white", fontWeight: 600, padding: "0.65rem 1rem", cursor: "pointer" }}>
                Pay Now
              </button>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

