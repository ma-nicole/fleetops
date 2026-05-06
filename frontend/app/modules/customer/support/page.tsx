"use client";

import { useEffect, useState } from "react";
import { useRoleGuard } from "@/lib/useRoleGuard";
import { WorkflowApi, type Booking } from "@/lib/workflowApi";

const BOOKING_GENERAL = "general";

export default function CustomerSupportPage() {
  useRoleGuard(["customer"]);

  const [bookings, setBookings] = useState<Booking[]>([]);
  /** "" = not chosen yet; BOOKING_GENERAL = not tied to a booking; otherwise numeric id as string */
  const [bookingKey, setBookingKey] = useState("");
  const [rating, setRating] = useState(5);
  const [category, setCategory] = useState("service");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ booking?: string; message?: string }>({});

  useEffect(() => {
    WorkflowApi.listBookings()
      .then((b) => setBookings(b))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load bookings"));
  }, []);

  const submit = async () => {
    setFieldErrors({});
    setError(null);
    setOkMsg(null);

    if (!bookingKey) {
      setFieldErrors({ booking: "Choose whether this is about a booking or general feedback." });
      return;
    }

    if (message.length > 2000) {
      setFieldErrors({ message: "Message must be at most 2000 characters." });
      return;
    }

    const booking_id = bookingKey === BOOKING_GENERAL ? null : Number(bookingKey);

    try {
      await WorkflowApi.submitFeedback({
        booking_id,
        rating,
        category,
        message: message.trim() || undefined,
      });
      setOkMsg(
        "Thanks — your feedback has been saved. When email is configured for FleetOps, a copy is sent to the operations inbox as well.",
      );
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
    <main style={{ padding: "var(--page-main-padding)", background: "#FAFAFA", minHeight: "100vh" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", display: "grid", gap: 16 }}>
        <header>
          <h1 style={{ margin: 0 }}>Send feedback</h1>
          <p style={{ marginTop: 6, color: "#6B7280" }}>
            Share feedback about a specific booking or anything else (app, billing, service). Ratings and messages are stored
            securely and can be emailed to FleetOps when your administrator sets up the inbox in the API.
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
            <span>Related booking (optional)</span>
            <select
              value={bookingKey}
              onChange={(e) => {
                setBookingKey(e.target.value);
                if (fieldErrors.booking) setFieldErrors((f) => ({ ...f, booking: undefined }));
              }}
              aria-invalid={!!fieldErrors.booking}
              style={{ padding: 8, border: fieldErrors.booking ? "2px solid #DC2626" : "1px solid #D1D5DB", borderRadius: 6 }}
            >
              <option value="">— Select: general or a booking —</option>
              <option value={BOOKING_GENERAL}>General feedback (not about a specific booking)</option>
              {bookings.map((b) => (
                <option key={b.id} value={String(b.id)}>
                  #{b.id} · {b.pickup_location} → {b.dropoff_location} ({b.status})
                </option>
              ))}
            </select>
            {fieldErrors.booking && (
              <span role="alert" style={{ color: "#DC2626", fontSize: "0.85rem" }}>
                {fieldErrors.booking}
              </span>
            )}
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
              <option value="support">Account / help</option>
              <option value="general">General / other</option>
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
              onChange={(e) => {
                setMessage(e.target.value);
                if (fieldErrors.message) setFieldErrors((f) => ({ ...f, message: undefined }));
              }}
              rows={5}
              maxLength={2000}
              aria-invalid={!!fieldErrors.message}
              style={{ padding: 8, border: fieldErrors.message ? "2px solid #DC2626" : "1px solid #D1D5DB", borderRadius: 6 }}
            />
            <span style={{ fontSize: "0.8rem", color: message.length > 2000 ? "#DC2626" : "#6B7280" }}>
              {message.length}/2000
            </span>
            {fieldErrors.message && (
              <span role="alert" style={{ color: "#DC2626", fontSize: "0.85rem" }}>
                {fieldErrors.message}
              </span>
            )}
          </label>

          <button
            type="button"
            onClick={submit}
            disabled={!bookingKey}
            style={{
              marginTop: 14,
              padding: "10px 16px",
              background: "#0EA5E9",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontWeight: 600,
              cursor: !bookingKey ? "not-allowed" : "pointer",
            }}
          >
            Submit feedback
          </button>
        </section>
      </div>
    </main>
  );
}
