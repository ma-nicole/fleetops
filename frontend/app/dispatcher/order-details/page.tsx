"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { announce } from "@/lib/useAnnouncer";
import { WorkflowApi, type Booking } from "@/lib/workflowApi";
import { formatPhp } from "@/lib/appLocale";
import BookingCargoWeightDisplay from "@/components/BookingCargoWeightDisplay";
import BookingDocumentsReview from "@/components/BookingDocumentsReview";
import BookingTollReviewPanel from "@/components/BookingTollReviewPanel";
import PreDeliveryVerificationChecklist from "@/components/PreDeliveryVerificationChecklist";
import StatusBanner from "@/components/ui/StatusBanner";

function OrderDetailsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingIdRaw = searchParams.get("booking_id") || searchParams.get("booking");

  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!bookingIdRaw);

  useEffect(() => {
    if (!bookingIdRaw) {
      setBooking(null);
      setLoading(false);
      setError(null);
      return;
    }
    const id = Number(bookingIdRaw);
    if (!Number.isFinite(id) || id <= 0) {
      setError("Invalid booking id.");
      setBooking(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    WorkflowApi.getBooking(id)
      .then((b) => {
        if (!cancelled) setBooking(b);
      })
      .catch((e) => {
        if (!cancelled) {
          setBooking(null);
          setError(e instanceof Error ? e.message : "Could not load booking.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bookingIdRaw]);

  if (!bookingIdRaw) {
    return (
      <div style={{ padding: "var(--page-main-padding)", display: "grid", gap: "1.5rem", maxWidth: "1000px" }}>
        <div>
          <Link href="/dispatcher/dashboard" style={{ color: "#FF9800", textDecoration: "none", fontWeight: "600" }}>
            ← Back to Dashboard
          </Link>
          <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem", marginTop: "1rem" }}>Order details</h1>
          <p style={{ color: "#666666", margin: "0" }}>Open a booking from assignments or append <code>?booking_id=</code> to this URL.</p>
        </div>
        <div style={{ padding: "2rem", border: "1px solid #E8E8E8", borderRadius: "8px", background: "#FAFAFA", color: "#666" }}>
          <p style={{ margin: 0 }}>No booking selected. Use the job assignments board and link to this page with a booking id.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: "var(--page-main-padding)" }}>
        <p style={{ color: "#666" }}>Loading booking…</p>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div style={{ padding: "var(--page-main-padding)", display: "grid", gap: "1rem", maxWidth: "1000px" }}>
        <Link href="/dispatcher/dashboard" style={{ color: "#FF9800", textDecoration: "none", fontWeight: "600" }}>
          ← Back to Dashboard
        </Link>
        <StatusBanner tone="error">{error || "Booking not found."}</StatusBanner>
      </div>
    );
  }

  const scheduled =
    typeof booking.scheduled_date === "string"
      ? booking.scheduled_date
      : (booking.scheduled_date as unknown as Date)?.toISOString?.().slice(0, 10) ?? "—";

  return (
    <div style={{ padding: "var(--page-main-padding)", display: "grid", gap: "2rem", maxWidth: "1000px" }}>
      <div>
        <Link href="/dispatcher/dashboard" style={{ color: "#FF9800", textDecoration: "none", fontWeight: "600" }}>
          ← Back to Dashboard
        </Link>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem", marginTop: "1rem" }}>Order details</h1>
        <p style={{ color: "#666666", margin: "0" }}>Booking #{booking.id} · Customer #{booking.customer_id}</p>
      </div>

      <div
        style={{
          padding: "1.5rem",
          border: "2px solid #2196F3",
          borderRadius: "8px",
          background: "rgba(33, 150, 243, 0.05)",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", marginBottom: "1rem" }}>
          <div>
            <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>BOOKING ID</p>
            <p style={{ color: "#1A1A1A", fontSize: "1.3rem", fontWeight: "700", margin: "0.5rem 0 0 0" }}>#{booking.id}</p>
          </div>
          <div>
            <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>STATUS</p>
            <p style={{ color: "#1A1A1A", fontWeight: "700", margin: "0.5rem 0 0 0" }}>{booking.status}</p>
          </div>
        </div>
        <p style={{ margin: 0, color: "#374151" }}>
          <strong>Window:</strong> {scheduled} {booking.scheduled_time_slot}
        </p>
        <p style={{ margin: "0.5rem 0 0 0", color: "#374151" }}>
          <strong>Quoted:</strong> {formatPhp(booking.estimated_cost)}
        </p>
      </div>

      <div style={{ padding: "1.5rem", border: "1px solid #E8E8E8", borderRadius: "8px" }}>
        <h2 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Cargo</h2>
        <BookingCargoWeightDisplay
          cargoWeightTons={booking.cargo_weight_tons}
          requiredTruckCount={booking.required_truck_count}
          cargoDescription={booking.cargo_description}
        />
      </div>

      <div style={{ padding: "1.5rem", border: "1px solid #E8E8E8", borderRadius: "8px" }}>
        <PreDeliveryVerificationChecklist bookingId={booking.id} canValidate />
      </div>

      <div style={{ padding: "1.5rem", border: "1px solid #E8E8E8", borderRadius: "8px" }}>
        <h2 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Documents</h2>
        <BookingDocumentsReview booking={booking} />
      </div>

      <div style={{ padding: "1.5rem", border: "1px solid #E8E8E8", borderRadius: "8px" }}>
        <h2 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Toll estimate</h2>
        <BookingTollReviewPanel booking={booking} compact onUpdated={(u) => setBooking((b) => (b ? { ...b, ...u } : b))} />
      </div>

      <div style={{ padding: "1.5rem", border: "1px solid #E8E8E8", borderRadius: "8px" }}>
        <h2 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Pickup</h2>
        <p style={{ margin: 0, color: "#1A1A1A" }}>{booking.pickup_location}</p>
        <p style={{ margin: "0.75rem 0 0 0", fontSize: "0.9rem", color: "#666" }}>Contact details use customer account records in administration.</p>
      </div>

      <div style={{ padding: "1.5rem", border: "1px solid #E8E8E8", borderRadius: "8px" }}>
        <h2 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Delivery</h2>
        <p style={{ margin: 0, color: "#1A1A1A" }}>{booking.dropoff_location}</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
        <button
          type="button"
          style={{
            padding: "0.75rem",
            background: "#FF9800",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "600",
          }}
          onClick={() => {
            announce(`Opening job assignments for booking ${booking.id}`);
            router.push("/dispatcher/job-assignments");
          }}
        >
          Job assignments
        </button>
        <button
          type="button"
          style={{
            padding: "0.75rem",
            background: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "600",
          }}
          onClick={() => {
            announce("Opening print dialog for this order summary");
            window.print();
          }}
        >
          Print
        </button>
        <Link
          href="/dispatcher/dashboard"
          style={{
            padding: "0.75rem",
            background: "#F5F5F5",
            color: "#1A1A1A",
            border: "1px solid #E8E8E8",
            borderRadius: "6px",
            textDecoration: "none",
            textAlign: "center",
            fontWeight: "600",
          }}
        >
          Dashboard
        </Link>
      </div>
    </div>
  );
}

export default function OrderDetailsPage() {
  return (
    <Suspense fallback={<div style={{ padding: "var(--page-main-padding)" }}>Loading…</div>}>
      <OrderDetailsInner />
    </Suspense>
  );
}
