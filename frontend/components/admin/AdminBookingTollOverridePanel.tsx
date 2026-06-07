"use client";

import { useState } from "react";
import BookingTollReviewPanel from "@/components/BookingTollReviewPanel";

export default function AdminBookingTollOverridePanel() {
  const [bookingId, setBookingId] = useState("");

  const id = Number(bookingId);
  const validId = Number.isFinite(id) && id > 0 ? id : 0;

  return (
    <div>
      <p style={{ color: "var(--text-secondary)", marginBottom: "1rem" }}>
        Admin manual override for toll plazas, vehicle class, and distance when geocoding is uncertain.
      </p>
      <label style={{ display: "grid", gap: 4, maxWidth: "20rem", marginBottom: "1rem" }}>
        <span>Booking ID</span>
        <input
          value={bookingId}
          onChange={(e) => setBookingId(e.target.value)}
          placeholder="e.g. 42"
          style={{ padding: "0.5rem", borderRadius: 6, border: "1px solid #E5E7EB" }}
        />
      </label>
      {validId > 0 ? (
        <BookingTollReviewPanel bookingId={validId} />
      ) : (
        <p style={{ color: "#6B7280", fontSize: "0.9rem" }}>Enter a booking ID to review or override toll settings.</p>
      )}
    </div>
  );
}
