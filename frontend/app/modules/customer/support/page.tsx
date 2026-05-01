"use client";

import { useEffect, useState } from "react";
import { useRoleGuard } from "@/lib/useRoleGuard";
import { WorkflowApi, type Booking } from "@/lib/workflowApi";

export default function CustomerSupportPage() {
  useRoleGuard(["customer"]);

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingId, setBookingId] = useState<number>(0);
  const [rating, setRating] = useState(5);
  const [category, setCategory] = useState("service");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  useEffect(() => {
    WorkflowApi.listBookings()
      .then((b) => {
        setBookings(b);
        if (b.length) setBookingId(b[0].id);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load bookings"));
  }, []);

  const submit = async () => {
    if (!bookingId) return;
    setError(null);
    try {
      await WorkflowApi.submitFeedback({
        booking_id: bookingId,
        rating,
        category,
        message,
      });
      setOkMsg("Thanks — your feedback has been recorded.");
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit feedback");
    }
  };

  const card: React.CSSProperties = {
    background: "white",
    border: "1px solid #E5E7EB",
    borderRadius: 12,
    padding: 20,
  };

  return (
    <main style={{ padding: "2rem", background: "#FAFAFA", minHeight: "100vh" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", display: "grid", gap: 16 }}>
        <header>
          <h1 style={{ margin: 0 }}>Send feedback</h1>
          <p style={{ marginTop: 6, color: "#6B7280" }}>
            Paper Customer DFD (Fig 14) — your feedback fuels the prescriptive analytics loop.
          </p>
        </header>

        {error && (
          <div style={{ background: "#FEE2E2", color: "#991B1B", padding: 12, borderRadius: 8 }}>{error}</div>
        )}
        {okMsg && (
          <div style={{ background: "#D1FAE5", color: "#047857", padding: 12, borderRadius: 8 }}>{okMsg}</div>
        )}

        <section style={card}>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Booking</span>
            <select
              value={bookingId}
              onChange={(e) => setBookingId(Number(e.target.value))}
              style={{ padding: 8, border: "1px solid #D1D5DB", borderRadius: 6 }}
            >
              <option value={0}>— pick a booking —</option>
              {bookings.map((b) => (
                <option key={b.id} value={b.id}>
                  #{b.id} · {b.pickup_location} → {b.dropoff_location} ({b.status})
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 4, marginTop: 12 }}>
            <span>Category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{ padding: 8, border: "1px solid #D1D5DB", borderRadius: 6 }}
            >
              <option value="service">Overall service</option>
              <option value="driver">Driver</option>
              <option value="vehicle">Vehicle</option>
              <option value="support">Support</option>
              <option value="general">General</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: 4, marginTop: 12 }}>
            <span>Rating ({rating} ★)</span>
            <input
              type="range"
              min={1}
              max={5}
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
            />
          </label>

          <label style={{ display: "grid", gap: 4, marginTop: 12 }}>
            <span>Message (optional)</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              style={{ padding: 8, border: "1px solid #D1D5DB", borderRadius: 6 }}
            />
          </label>

          <button
            onClick={submit}
            disabled={!bookingId}
            style={{
              marginTop: 14,
              padding: "10px 16px",
              background: "#0EA5E9",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontWeight: 600,
              cursor: !bookingId ? "not-allowed" : "pointer",
            }}
          >
            Submit feedback
          </button>
        </section>
      </div>
    </main>
  );
}
