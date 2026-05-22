"use client";

import { useEffect, useState } from "react";
import { useRoleGuard } from "@/lib/useRoleGuard";
import { CUSTOMER_PAYMENT_METHODS, formatPaymentMethodLabel } from "@/lib/paymentMethodOptions";
import { WorkflowApi, type Payment } from "@/lib/workflowApi";
import { formatDateTime, formatPhpWhole } from "@/lib/appLocale";

export default function CustomerPaymentPage() {
  useRoleGuard(["customer", "manager", "admin"]);

  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const p = await WorkflowApi.listPayments();
      setPayments(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const card: React.CSSProperties = {
    background: "white",
    border: "1px solid #E5E7EB",
    borderRadius: 12,
    padding: 18,
  };

  return (
    <main style={{ padding: "var(--page-main-padding)", background: "#FAFAFA", minHeight: "100vh" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gap: 16 }}>
        <header>
          <h1 style={{ margin: 0 }}>Payment History</h1>
          <p style={{ marginTop: 4, color: "#6B7280" }}>
            View all payments for your bookings. Payment status: for verification → verified → rejected.
          </p>
        </header>

        {error && (
          <div style={{ background: "#FEE2E2", color: "#991B1B", padding: 12, borderRadius: 8 }}>{error}</div>
        )}

        <section style={card}>
          <h2 style={{ marginTop: 0 }}>Payment methods</h2>
          <p style={{ margin: "0 0 1rem 0", color: "#6B7280", fontSize: "0.9rem" }}>
            When paying for a booking, you can choose from the options below. Proof upload is required for GCash, bank
            transfer, and manual offline payments. Cash on delivery does not require upfront proof.
          </p>
          <ul style={{ margin: 0, paddingLeft: "1.25rem", display: "grid", gap: "0.65rem", color: "#374151", fontSize: "0.9rem" }}>
            {CUSTOMER_PAYMENT_METHODS.map((opt) => (
              <li key={opt.value}>
                <strong>{opt.label}</strong>
                {opt.requiresProof ? " — proof required" : " — no upfront proof"}
                <br />
                <span style={{ color: "#6B7280", fontSize: "0.85rem" }}>{opt.description}</span>
              </li>
            ))}
          </ul>
        </section>

        <section style={card}>
          <h2 style={{ marginTop: 0 }}>Payment History</h2>
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
                  <th style={th}>Verified / paid at</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td style={td}>{p.reference}</td>
                    <td style={td}>#{p.booking_id}</td>
                    <td style={td}>{formatPaymentMethodLabel(p.method)}</td>
                    <td style={td}>{formatPhpWhole(p.amount)}</td>
                    <td style={{ ...td, fontWeight: 700, color: statusColor(p.status) }}>{formatPaymentStatus(p.status)}</td>
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

function formatPaymentStatus(status: string): string {
  switch (status) {
    case "for_verification":
      return "for verification";
    case "verified":
      return "verified";
    case "rejected":
      return "rejected";
    case "refunded":
      return "refunded";
    default:
      return status;
  }
}

function statusColor(status: string): string {
  switch (status) {
    case "verified":
      return "#047857";
    case "rejected":
      return "#B91C1C";
    case "for_verification":
      return "#B45309";
    case "refunded":
      return "#9CA3AF";
    default:
      return "#374151";
  }
}
