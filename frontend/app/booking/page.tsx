"use client";

import Breadcrumbs from "@/components/Breadcrumbs";
import CostCalculator from "@/components/CostCalculator";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { isAuthenticated } from "@/lib/auth";

export default function BookingPage() {
  const router = useRouter();
  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/sign-in");
    }
  }, [router]);

  return (
    <main className="container" style={{ display: "grid", gap: "1.5rem", padding: "2rem 1rem" }}>
      <section className="card" style={{ maxWidth: "900px", margin: "0 auto", display: "grid", gap: "1rem" }}>
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "New booking" },
          ]}
        />
        <div id="booking-calculator" className="scroll-section">
          <h1 style={{ margin: "0 0 0.5rem 0", fontSize: "2rem" }}>Create Booking Request</h1>
          <p style={{ margin: 0, opacity: 0.8, fontSize: "0.95rem" }}>Fill in your shipment details below. The quoted amount updates in real time.</p>
        </div>

        <div className="booking-tip-grid">
          <div className="booking-tip-card">
            <strong>Live quote</strong>
            <span>Updates while you choose pickup, dropoff, and weight.</span>
          </div>
          <div className="booking-tip-card">
            <strong>Accurate pricing</strong>
            <span>Pickup, dropoff, and tonnage drive the quoted total—fill them in carefully.</span>
          </div>
        </div>

        <CostCalculator />
      </section>

      <section
        id="booking-info"
        className="scroll-section"
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "1rem",
        }}
      >
        <div className="card" style={{ display: "grid", gap: "0.5rem" }}>
          <p style={{ margin: 0, fontSize: "1.1rem" }}>Real-Time Pricing</p>
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            Our AI calculates the best price based on distance, weight, and demand.
          </p>
        </div>
        <div className="card" style={{ display: "grid", gap: "0.5rem" }}>
          <p style={{ margin: 0, fontSize: "1.1rem" }}>Transparent Costs</p>
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            See road distance, fuel/route charge, and driver fee (10%) before you pay.
          </p>
        </div>
        <div className="card" style={{ display: "grid", gap: "0.5rem" }}>
          <p style={{ margin: 0, fontSize: "1.1rem" }}>Instant Confirmation</p>
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            Booking confirmed immediately with email notification.
          </p>
        </div>
      </section>
    </main>
  );
}
