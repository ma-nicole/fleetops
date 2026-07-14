"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import StatusBanner from "@/components/ui/StatusBanner";
import { useRoleGuard } from "@/lib/useRoleGuard";
import { WorkflowApi, type Booking } from "@/lib/workflowApi";

const BOOKING_GENERAL = "general";

function CustomerSupportForm() {
  useRoleGuard(["customer"]);
  const searchParams = useSearchParams();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingKey, setBookingKey] = useState("");
  const [rating, setRating] = useState(5);
  const [category, setCategory] = useState("support");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ booking?: string; message?: string }>({});

  useEffect(() => {
    WorkflowApi.listBookings()
      .then((b) => setBookings(b))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load bookings"));
  }, []);

  useEffect(() => {
    const q = searchParams.get("booking");
    if (q && /^\d+$/.test(q)) setBookingKey(q);
  }, [searchParams]);

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
        booking_id
          ? `Support request for Booking #${booking_id} was submitted.`
          : "Thanks — your feedback has been saved.",
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
          <h1 style={{ margin: 0 }}>Contact Support</h1>
          <p style={{ marginTop: 6, color: "#6B7280" }}>
            Ask about an existing booking or send general feedback. When a booking is selected, its ID is included
            automatically.
          </p>
        </header>

        {error ? <StatusBanner tone="error">{error}</StatusBanner> : null}
        {okMsg ? <StatusBanner tone="success">{okMsg}</StatusBanner> : null}

        <section style={card}>
          <div style={{ display: "grid", gap: 14 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Related booking</span>
              <select className="input" value={bookingKey} onChange={(e) => setBookingKey(e.target.value)}>
                <option value="">Select…</option>
                <option value={BOOKING_GENERAL}>General (no booking)</option>
                {bookings.map((b) => (
                  <option key={b.id} value={String(b.id)}>
                    Booking #{b.id} — {b.pickup_location} → {b.dropoff_location}
                  </option>
                ))}
              </select>
              {fieldErrors.booking ? (
                <span style={{ color: "#B91C1C", fontSize: "0.85rem" }}>{fieldErrors.booking}</span>
              ) : null}
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Category</span>
              <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="support">Support inquiry</option>
                <option value="service">Service</option>
                <option value="billing">Billing</option>
                <option value="app">App / website</option>
                <option value="other">Other</option>
              </select>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Rating</span>
              <select className="input" value={rating} onChange={(e) => setRating(Number(e.target.value))}>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Message</span>
              <textarea
                className="input"
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={2000}
                placeholder={
                  bookingKey && bookingKey !== BOOKING_GENERAL
                    ? `Describe your question about Booking #${bookingKey}…`
                    : "How can we help?"
                }
              />
              {fieldErrors.message ? (
                <span style={{ color: "#B91C1C", fontSize: "0.85rem" }}>{fieldErrors.message}</span>
              ) : null}
            </label>

            <button type="button" className="button" onClick={() => void submit()}>
              Submit support request
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function CustomerSupportPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading support…</div>}>
      <CustomerSupportForm />
    </Suspense>
  );
}
