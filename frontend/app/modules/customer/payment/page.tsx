"use client";

import { useEffect, useState } from "react";
import { useRoleGuard } from "@/lib/useRoleGuard";
import { WorkflowApi, type Booking, type Payment } from "@/lib/workflowApi";
import { formatDateTime, formatPhpWhole } from "@/lib/appLocale";

export default function CustomerPaymentPage() {
  useRoleGuard(["customer", "manager", "admin"]);

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [bookingId, setBookingId] = useState<number>(0);
  const [method, setMethod] = useState<"card" | "gcash" | "bank" | "cash">("gcash");
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try {
      const [b, p] = await Promise.all([WorkflowApi.listBookings(), WorkflowApi.listPayments()]);
      setBookings(b);
      setPayments(p);
      if (!bookingId && b.length) setBookingId(b[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const selected = bookings.find((b) => b.id === bookingId);

  const pay = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await WorkflowApi.payBooking(selected.id, method, selected.estimated_cost);
      setOkMsg(`Paid ${formatPhpWhole(selected.estimated_cost)} via ${method}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  };

  const card: React.CSSProperties = {
    background: "white",
    border: "1px solid #E5E7EB",
    borderRadius: 12,
    padding: 18,
  };

  return (
    <main style={{ padding: "2rem", background: "#FAFAFA", minHeight: "100vh" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gap: 16 }}>
        <header>
          <h1 style={{ margin: 0 }}>Pay for booking</h1>
          <p style={{ marginTop: 4, color: "#6B7280" }}>
            Paper §3.2.4 Customer DFD — payment lifecycle (pending → processing → paid → refunded).
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
              <option value={0}>— select booking —</option>
              {bookings.map((b) => (
                <option key={b.id} value={b.id}>
                  #{b.id} · {b.pickup_location} → {b.dropoff_location} · ₱{b.estimated_cost} ({b.status})
                </option>
              ))}
            </select>
          </label>

          {selected && (
            <div style={{ marginTop: 14, background: "#F9FAFB", padding: 14, borderRadius: 8 }}>
              <div style={{ fontSize: 24, fontWeight: 800 }}>
                Total: {formatPhpWhole(selected.estimated_cost)}
              </div>
              <div style={{ marginTop: 6 }}>
                {selected.pickup_location} → {selected.dropoff_location}
              </div>
              <div style={{ marginTop: 6, color: "#6B7280" }}>
                Scheduled: {selected.scheduled_date}
              </div>
            </div>
          )}

          <label style={{ display: "grid", gap: 4, marginTop: 14 }}>
            <span>Payment method</span>
            <select
              value={method}
              onChange={(e) =>
                setMethod(e.target.value as "card" | "gcash" | "bank" | "cash")
              }
              style={{ padding: 8, border: "1px solid #D1D5DB", borderRadius: 6 }}
            >
              <option value="gcash">GCash</option>
              <option value="card">Credit / Debit Card</option>
              <option value="bank">Bank transfer</option>
              <option value="cash">Cash on delivery</option>
            </select>
          </label>

          <button
            onClick={pay}
            disabled={!selected || busy}
            style={{
              marginTop: 14,
              padding: "12px 18px",
              background: "#10B981",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontWeight: 700,
              cursor: !selected || busy ? "not-allowed" : "pointer",
            }}
          >
            {busy ? "Processing…" : "Pay now"}
          </button>
        </section>

        <section style={card}>
          <h2 style={{ marginTop: 0 }}>Payment history</h2>
          {payments.length === 0 ? (
            <p style={{ color: "#6B7280" }}>No payments yet.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F3F4F6" }}>
                  <th style={th}>Reference</th>
                  <th style={th}>Booking</th>
                  <th style={th}>Method</th>
                  <th style={th}>Amount</th>
                  <th style={th}>Status</th>
                  <th style={th}>Paid at</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td style={td}>{p.reference}</td>
                    <td style={td}>#{p.booking_id}</td>
                    <td style={td}>{p.method}</td>
                    <td style={td}>{formatPhpWhole(p.amount)}</td>
                    <td style={{ ...td, fontWeight: 700, color: statusColor(p.status) }}>{p.status}</td>
                    <td style={td}>{p.paid_at ? formatDateTime(p.paid_at) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  );
}

const th: React.CSSProperties = { padding: 8, borderBottom: "1px solid #E5E7EB", textAlign: "left" };
const td: React.CSSProperties = { padding: 8, borderBottom: "1px solid #F3F4F6" };

function statusColor(status: string): string {
  switch (status) {
    case "paid":
      return "#047857";
    case "refunded":
      return "#9CA3AF";
    case "failed":
      return "#B91C1C";
    case "processing":
    case "pending":
      return "#B45309";
    default:
      return "#374151";
  }
}
