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
          <p style={{ margin: 0, opacity: 0.8, fontSize: "0.95rem" }}>
            Complete the guided steps below: route, cargo, schedule, documents, review, pricing, and payment.
          </p>
        </div>

        <div className="booking-tip-grid">
          <div className="booking-tip-card">
            <strong>Live quote</strong>
            <span>Calculates after the route, cargo, and schedule details are complete.</span>
          </div>
          <div className="booking-tip-card">
            <strong>Accurate pricing</strong>
            <span>Pickup, dropoff, tonnage, tolls, and available fleet capacity drive the final quote.</span>
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
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
          gap: "1rem",
        }}
      >
        <div className="card" style={{ display: "grid", gap: "0.5rem" }}>
          <p style={{ margin: 0, fontSize: "1.1rem" }}>Real-Time Pricing</p>
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            FleetOps calculates price from distance, weight, tolls, labor, and vehicle needs.
          </p>
        </div>
        <div className="card" style={{ display: "grid", gap: "0.5rem" }}>
          <p style={{ margin: 0, fontSize: "1.1rem" }}>Transparent Costs</p>
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            Review the full pricing breakdown before proceeding to payment.
          </p>
        </div>
        <div className="card" style={{ display: "grid", gap: "0.5rem" }}>
          <p style={{ margin: 0, fontSize: "1.1rem" }}>Dispatch Readiness</p>
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            Paid and verified bookings move forward for dispatcher assignment.
          </p>
        </div>
      </section>
    </main>
  );
}
