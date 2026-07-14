"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRoleGuard } from "@/lib/useRoleGuard";
import ContactSupportButton from "@/components/ContactSupportButton";
import CustomerDocumentReviewSection from "@/components/CustomerDocumentReviewSection";
import LoadingMessage from "@/components/ui/LoadingMessage";
import StatusBanner from "@/components/ui/StatusBanner";
import { HYBRID_PAYMENT_METHODS, formatPaymentMethodLabel } from "@/lib/paymentMethodOptions";
import { isCashPayment, paymentDisplayStatus, transactionReference } from "@/lib/paymentDisplayStatus";
import { LOADING_AUTH_RESTORE } from "@/lib/loadingMessages";
import { WorkflowApi, type Booking, type Payment } from "@/lib/workflowApi";
import { formatDateTime, formatPhpWhole } from "@/lib/appLocale";

export default function CustomerPaymentPage() {
  const { ready, allowed } = useRoleGuard(["customer", "manager", "admin"]);

  const [payments, setPayments] = useState<Payment[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const [p, b] = await Promise.all([WorkflowApi.listPayments(), WorkflowApi.listBookings()]);
      setPayments(p);
      setBookings(b);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  };

  const bookingById = useMemo(() => new Map(bookings.map((b) => [b.id, b])), [bookings]);

  const actionRequiredBookings = useMemo(() => {
    const ids = new Set<number>();
    for (const p of payments) {
      const booking = bookingById.get(p.booking_id);
      if (
        p.status === "rejected" ||
        ["revision_requested", "rejected"].includes(booking?.goods_declaration_review_status ?? "")
      ) {
        ids.add(p.booking_id);
      }
    }
    return [...ids];
  }, [payments, bookingById]);

  useEffect(() => {
    if (!ready || !allowed) return;
    void refresh();
  }, [ready, allowed]);

  const card: React.CSSProperties = {
    background: "white",
    border: "1px solid #E5E7EB",
    borderRadius: 12,
    padding: 18,
  };

  if (!ready) {
    return (
      <main style={{ padding: "var(--page-main-padding)", background: "#FAFAFA", minHeight: "100vh" }}>
        <LoadingMessage label={LOADING_AUTH_RESTORE} />
      </main>
    );
  }

  if (!allowed) return null;

  return (
    <main style={{ padding: "var(--page-main-padding)", background: "#FAFAFA", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gap: 16 }}>
        <header>
          <h1 style={{ margin: 0 }}>Payment History</h1>
          <p style={{ marginTop: 4, color: "#6B7280" }}>
            Unified payment history across GCash, card, bank transfer, cash, and legacy methods.
          </p>
        </header>

        {error ? <StatusBanner tone="error">{error}</StatusBanner> : null}

        <section style={card}>
          <h2 style={{ marginTop: 0 }}>Payment methods</h2>
          <p style={{ margin: "0 0 1rem 0", color: "#6B7280", fontSize: "0.9rem" }}>
            When paying for a booking, choose from the options below. Xendit online methods verify automatically. Cash
            is confirmed by FleetOps staff without proof upload.
          </p>
          <ul style={{ margin: 0, paddingLeft: "1.25rem", display: "grid", gap: "0.65rem", color: "#374151", fontSize: "0.9rem" }}>
            {HYBRID_PAYMENT_METHODS.map((opt) => (
              <li key={opt.value}>
                <strong>{opt.label}</strong>
                {opt.channel === "xendit" ? " — automatic verification" : " — admin confirmation"}
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
            <>
              <div className="customer-payment-mobile-list">
                {payments.map((p) => {
                  const paidAt = p.xendit_paid_at || p.paid_at || p.proof_uploaded_at;
                  return (
                    <article
                      key={`m-pay-${p.id}`}
                      style={{
                        border: "1px solid #E5E7EB",
                        borderRadius: 12,
                        padding: "0.9rem 1rem",
                        display: "grid",
                        gap: 6,
                        background: "#FAFAFA",
                        minWidth: 0,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                        <Link href={`/booking/payment?bookingId=${p.booking_id}`} style={{ color: "#0EA5E9", fontWeight: 700 }}>
                          Booking #{p.booking_id}
                        </Link>
                        <span style={{ fontWeight: 700, color: statusColor(p.status) }}>{paymentDisplayStatus(p)}</span>
                      </div>
                      <div style={{ fontSize: "0.88rem", color: "#374151", overflowWrap: "anywhere" }}>
                        <div>{formatPaymentMethodLabel(p.method)} · {formatPhpWhole(p.amount)}</div>
                        <div style={{ color: "#6B7280", fontSize: "0.82rem" }}>
                          Ref: {transactionReference(p)}
                        </div>
                        <div style={{ color: "#6B7280", fontSize: "0.82rem" }}>
                          {paidAt ? formatDateTime(paidAt) : "—"}
                          {isCashPayment(p) && p.verified_by_name ? ` · ${p.verified_by_name}` : ""}
                        </div>
                      </div>
                      <Link
                        href={`/modules/operations/trips?booking=${p.booking_id}`}
                        style={{ color: "#92400E", fontWeight: 700, fontSize: "0.9rem" }}
                      >
                        Track booking
                      </Link>
                    </article>
                  );
                })}
              </div>
              <div className="customer-payment-desktop-table">
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
                  <thead>
                    <tr style={{ background: "#F3F4F6" }}>
                      <th style={th}>Booking</th>
                      <th style={th}>Method</th>
                      <th style={th}>Status</th>
                      <th style={th}>Amount</th>
                      <th style={th}>Transaction ref</th>
                      <th style={th}>Paid at</th>
                      <th style={th}>Verified by</th>
                      <th style={th}>Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => {
                      const paidAt = p.xendit_paid_at || p.paid_at || p.proof_uploaded_at;
                      return (
                        <tr key={p.id}>
                          <td style={td}>
                            <Link href={`/booking/payment?bookingId=${p.booking_id}`} style={{ color: "#0EA5E9", fontWeight: 600 }}>
                              #{p.booking_id}
                            </Link>
                          </td>
                          <td style={td}>{formatPaymentMethodLabel(p.method)}</td>
                          <td style={{ ...td, fontWeight: 700, color: statusColor(p.status) }}>{paymentDisplayStatus(p)}</td>
                          <td style={td}>{formatPhpWhole(p.amount)}</td>
                          <td style={{ ...td, fontSize: "0.85rem", wordBreak: "break-all" }}>{transactionReference(p)}</td>
                          <td style={td}>{paidAt ? formatDateTime(paidAt) : "—"}</td>
                          <td style={td}>{isCashPayment(p) && p.verified_by_name ? p.verified_by_name : "—"}</td>
                          <td style={td}>
                            <Link
                              href={`/modules/operations/trips?booking=${p.booking_id}`}
                              style={{ color: "#92400E", fontWeight: 700, fontSize: "0.85rem" }}
                            >
                              Track
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        {actionRequiredBookings.length > 0 && (
          <section style={card}>
            <h2 style={{ marginTop: 0 }}>Action required</h2>
            <p style={{ margin: "0 0 1rem", color: "#6B7280", fontSize: "0.9rem" }}>
              Review decisions and resubmit corrected documents or payment proof when requested.
            </p>
            <div style={{ display: "grid", gap: "1rem" }}>
              {actionRequiredBookings.map((bookingId) => {
                const booking = bookingById.get(bookingId);
                const payment = payments.find((p) => p.booking_id === bookingId);
                if (!booking) return null;
                return (
                  <div
                    key={`review-${bookingId}`}
                    style={{
                      border: "1px solid #E5E7EB",
                      borderRadius: 10,
                      padding: "1rem",
                      background: "#FAFAFA",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
                      <p style={{ margin: 0, fontWeight: 700 }}>Booking #{bookingId}</p>
                      <ContactSupportButton bookingId={bookingId} style={{ fontSize: "0.82rem", padding: "0.3rem 0.7rem", minHeight: 0 }} />
                    </div>
                    <CustomerDocumentReviewSection
                      booking={booking}
                      payment={payment ?? null}
                      onUpdated={(updated) => {
                        setBookings((prev) =>
                          prev.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)),
                        );
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

const th: React.CSSProperties = { padding: 8, borderBottom: "1px solid #E5E7EB", textAlign: "left" };
const td: React.CSSProperties = { padding: 8, borderBottom: "1px solid #F3F4F6" };

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
