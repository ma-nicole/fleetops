"use client";

import Link from "next/link";
import { useState } from "react";
import { useRoleGuard } from "@/lib/useRoleGuard";
import { DriverDataFlowService } from "@/lib/driverDataFlowService";

export default function CreateBookingFlowPage() {
  useRoleGuard(["customer", "dispatcher", "manager", "admin"]);
  const [customerName, setCustomerName] = useState("");
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [load, setLoad] = useState("");
  const [createdId, setCreatedId] = useState("");

  const submit = () => {
    if (!customerName || !pickup || !dropoff || !load) return;
    const booking = DriverDataFlowService.createBooking({ customerName, pickup, dropoff, load });
    setCreatedId(booking.id);
    setCustomerName("");
    setPickup("");
    setDropoff("");
    setLoad("");
  };

  return (
    <main style={{ padding: "2rem", background: "#FAFAFA", minHeight: "100vh" }}>
      <div className="container" style={{ maxWidth: "900px", margin: "0 auto", display: "grid", gap: "1rem" }}>
        <h1 style={{ margin: 0 }}>Create Booking</h1>
        <section style={{ background: "white", border: "1px solid #E8E8E8", borderRadius: "10px", padding: "1rem", display: "grid", gap: "0.75rem" }}>
          <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name" style={{ padding: "0.7rem", border: "1px solid #D1D5DB", borderRadius: "6px" }} />
          <input value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder="Pickup location" style={{ padding: "0.7rem", border: "1px solid #D1D5DB", borderRadius: "6px" }} />
          <input value={dropoff} onChange={(e) => setDropoff(e.target.value)} placeholder="Dropoff location" style={{ padding: "0.7rem", border: "1px solid #D1D5DB", borderRadius: "6px" }} />
          <input value={load} onChange={(e) => setLoad(e.target.value)} placeholder="Load details" style={{ padding: "0.7rem", border: "1px solid #D1D5DB", borderRadius: "6px" }} />
          <div style={{ display: "flex", gap: "0.7rem" }}>
            <button onClick={submit} style={{ border: "none", borderRadius: "6px", background: "#10B981", color: "white", fontWeight: 600, padding: "0.65rem 1rem", cursor: "pointer" }}>Save Booking</button>
            <Link href="/dispatcher/confirm-order" style={{ textDecoration: "none", borderRadius: "6px", background: "#3B82F6", color: "white", fontWeight: 600, padding: "0.65rem 1rem" }}>Next: Confirm Order</Link>
          </div>
        </section>
        {createdId && <p style={{ margin: 0, color: "#059669" }}>Booking {createdId} created and stored.</p>}
      </div>
    </main>
  );
}

