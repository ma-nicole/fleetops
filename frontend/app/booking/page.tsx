"use client";

import Breadcrumbs from "@/components/Breadcrumbs";
import CostCalculator from "@/components/CostCalculator";

export default function BookingPage() {
  return (
    <main className="container" style={{ display: "grid", gap: "1.5rem", padding: "2rem 1rem" }}>
      <section className="card" style={{ maxWidth: "900px", margin: "0 auto", display: "grid", gap: "1rem" }}>
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Booking" },
            { label: "Payment" },
            { label: "Confirmation" },
          ]}
        />
        <div>
          <h1 style={{ margin: "0 0 0.5rem 0", fontSize: "2rem" }}>Create Booking Request</h1>
          <p style={{ margin: 0, opacity: 0.8, fontSize: "0.95rem" }}>Fill in your shipment details below. Cost updates in real-time.</p>
        </div>

        <div className="booking-stepper" aria-label="Booking progress">
          <span className="booking-step is-active">1. Details</span>
          <span className="booking-step">2. Payment</span>
          <span className="booking-step">3. Confirmation</span>
        </div>

        <div className="booking-tip-grid">
          <div className="booking-tip-card">
            <strong>Live estimate</strong>
            <span>Updates while you type pickup, dropoff, and weight.</span>
          </div>
          <div className="booking-tip-card">
            <strong>Fast start</strong>
            <span>Try Manhattan → Newark to see a sample estimate.</span>
          </div>
        </div>

        <CostCalculator />
      </section>

      {/* Info Cards */}
      <section
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
            See fuel, toll, and labor breakdown before confirming.
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
