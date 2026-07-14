"use client";

import { Suspense, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
import StatusBanner from "@/components/ui/StatusBanner";
import { useRoleGuard } from "@/lib/useRoleGuard";
import { WorkflowApi, type Booking } from "@/lib/workflowApi";

const BOOKING_GENERAL = "general";

const CATEGORIES: Array<{ value: string; label: string }> = [
  { value: "support", label: "Support inquiry" },
  { value: "service", label: "Service quality" },
  { value: "driver", label: "Driver" },
  { value: "vehicle", label: "Vehicle" },
  { value: "general", label: "General feedback" },
];

/** 5 = most urgent. Stored as feedback.rating (1–5) for API compatibility. */
const SEVERITY_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 5, label: "Critical — blocking / safety" },
  { value: 4, label: "High — urgent issue" },
  { value: 3, label: "Medium — needs attention soon" },
  { value: 2, label: "Low — minor inconvenience" },
  { value: 1, label: "Info — question or suggestion" },
];

function CustomerSupportForm() {
  useRoleGuard(["customer"]);
  const searchParams = useSearchParams();
  const formId = useId();
  const errorRef = useRef<HTMLDivElement | null>(null);
  const screenshotInputRef = useRef<HTMLInputElement | null>(null);

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingKey, setBookingKey] = useState("");
  const [severity, setSeverity] = useState(3);
  const [category, setCategory] = useState("support");
  const [message, setMessage] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ booking?: string; message?: string; screenshot?: string }>({});

  const resetForm = () => {
    setBookingKey("");
    setSeverity(3);
    setCategory("support");
    setMessage("");
    setScreenshot(null);
    setFieldErrors({});
    if (screenshotInputRef.current) {
      screenshotInputRef.current.value = "";
    }
  };

  useEffect(() => {
    WorkflowApi.listBookings()
      .then((b) => setBookings(b))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load bookings"));
  }, []);

  useEffect(() => {
    const q = searchParams.get("booking");
    if (q && /^\d+$/.test(q)) setBookingKey(q);
  }, [searchParams]);

  useEffect(() => {
    if (error || Object.keys(fieldErrors).length) {
      errorRef.current?.focus();
    }
  }, [error, fieldErrors]);

  const submit = async () => {
    setFieldErrors({});
    setError(null);
    setOkMsg(null);

    const nextErrors: { booking?: string; message?: string; screenshot?: string } = {};
    if (!bookingKey) {
      nextErrors.booking = "Choose whether this is about a booking or general feedback.";
    }
    if (message.length > 2000) {
      nextErrors.message = "Message must be at most 2000 characters.";
    }
    if (screenshot && screenshot.size > 5 * 1024 * 1024) {
      nextErrors.screenshot = "Screenshot must be 5 MB or smaller.";
    }
    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      return;
    }

    const booking_id = bookingKey === BOOKING_GENERAL ? null : Number(bookingKey);

    setBusy(true);
    try {
      await WorkflowApi.submitFeedback({
        booking_id,
        rating: severity,
        category,
        message: message.trim() || undefined,
        screenshot,
      });
      setOkMsg(
        booking_id
          ? `Support request for Booking #${booking_id} was submitted.`
          : "Thanks — your feedback has been saved.",
      );
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit feedback");
    } finally {
      setBusy(false);
    }
  };

  const card: CSSProperties = {
    background: "white",
    border: "1px solid #E5E7EB",
    borderRadius: 12,
    padding: 20,
  };

  const labelStyle: CSSProperties = { display: "grid", gap: 6 };
  const inputTouch: CSSProperties = { minHeight: 44, fontSize: 16 };

  return (
    <main style={{ padding: "var(--page-main-padding)", background: "#FAFAFA", minHeight: "100vh" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", display: "grid", gap: 16 }}>
        <header>
          <h1 style={{ margin: 0 }}>Contact Support</h1>
          <p style={{ marginTop: 6, color: "#6B7280", lineHeight: 1.5 }}>
            Ask about an existing booking or send general feedback. Optionally attach a screenshot to help us
            investigate.
          </p>
        </header>

        <div ref={errorRef} tabIndex={-1} style={{ outline: "none" }}>
          {error ? <StatusBanner tone="error">{error}</StatusBanner> : null}
          {okMsg ? <StatusBanner tone="success">{okMsg}</StatusBanner> : null}
        </div>

        <section style={card} aria-labelledby={`${formId}-title`}>
          <h2 id={`${formId}-title`} style={{ margin: "0 0 1rem", fontSize: "1.05rem" }}>
            Support request
          </h2>
          <div style={{ display: "grid", gap: 14 }}>
            <label style={labelStyle}>
              <span style={{ fontWeight: 600 }}>Related booking</span>
              <select
                className="input"
                style={inputTouch}
                value={bookingKey}
                aria-invalid={Boolean(fieldErrors.booking)}
                aria-describedby={fieldErrors.booking ? `${formId}-booking-err` : undefined}
                onChange={(e) => setBookingKey(e.target.value)}
              >
                <option value="">Select…</option>
                <option value={BOOKING_GENERAL}>General (no booking)</option>
                {bookings.map((b) => (
                  <option key={b.id} value={String(b.id)}>
                    Booking #{b.id} — {b.pickup_location} → {b.dropoff_location}
                  </option>
                ))}
              </select>
              {fieldErrors.booking ? (
                <span id={`${formId}-booking-err`} role="alert" style={{ color: "#B91C1C", fontSize: "0.85rem" }}>
                  {fieldErrors.booking}
                </span>
              ) : null}
            </label>

            <label style={labelStyle}>
              <span style={{ fontWeight: 600 }}>Category</span>
              <select
                className="input"
                style={inputTouch}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>

            <label style={labelStyle}>
              <span style={{ fontWeight: 600 }}>Severity</span>
              <select
                className="input"
                style={inputTouch}
                value={severity}
                onChange={(e) => setSeverity(Number(e.target.value))}
                aria-describedby={`${formId}-severity-hint`}
              >
                {SEVERITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <span id={`${formId}-severity-hint`} style={{ fontSize: "0.8rem", color: "#6B7280" }}>
                Choose how urgent this situation is for operations.
              </span>
            </label>

            <label style={labelStyle}>
              <span style={{ fontWeight: 600 }}>Message</span>
              <textarea
                className="input"
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={2000}
                style={{ fontSize: 16, lineHeight: 1.45 }}
                aria-invalid={Boolean(fieldErrors.message)}
                aria-describedby={fieldErrors.message ? `${formId}-message-err` : undefined}
                placeholder={
                  bookingKey && bookingKey !== BOOKING_GENERAL
                    ? `Describe your question about Booking #${bookingKey}…`
                    : "How can we help?"
                }
              />
              {fieldErrors.message ? (
                <span id={`${formId}-message-err`} role="alert" style={{ color: "#B91C1C", fontSize: "0.85rem" }}>
                  {fieldErrors.message}
                </span>
              ) : null}
            </label>

            <label style={labelStyle}>
              <span style={{ fontWeight: 600 }}>Screenshot (optional)</span>
              <input
                ref={screenshotInputRef}
                className="input"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                style={{ ...inputTouch, paddingTop: 10 }}
                aria-invalid={Boolean(fieldErrors.screenshot)}
                aria-describedby={`${formId}-shot-hint`}
                onChange={(e) => {
                  setScreenshot(e.target.files?.[0] ?? null);
                  setFieldErrors((prev) => ({ ...prev, screenshot: undefined }));
                }}
              />
              <span id={`${formId}-shot-hint`} style={{ fontSize: "0.8rem", color: "#6B7280" }}>
                JPEG, PNG, WEBP, or GIF up to 5 MB.
                {screenshot ? ` Selected: ${screenshot.name}` : ""}
              </span>
              {fieldErrors.screenshot ? (
                <span role="alert" style={{ color: "#B91C1C", fontSize: "0.85rem" }}>
                  {fieldErrors.screenshot}
                </span>
              ) : null}
            </label>

            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={() => void submit()}
              style={{ minHeight: 48, fontWeight: 700 }}
            >
              {busy ? "Submitting…" : "Submit support request"}
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
