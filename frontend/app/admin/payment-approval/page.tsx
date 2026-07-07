"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import AdminDocumentViewButton from "@/components/AdminDocumentViewButton";
import DocumentPreviewModal from "@/components/DocumentPreviewModal";
import ErrorState from "@/components/ui/ErrorState";
import LoadingMessage from "@/components/ui/LoadingMessage";
import SubmitButton from "@/components/ui/SubmitButton";
import TableEmptyRow from "@/components/ui/TableEmptyRow";
import { SkeletonTable } from "@/components/Skeleton";
import { ERROR_LOAD_DATA } from "@/lib/loadingMessages";
import { useRoleGuard } from "@/lib/useRoleGuard";
import { apiFullUrl } from "@/lib/api";
import { formatPhp, formatDateTime } from "@/lib/appLocale";
import { FILE_NOT_FOUND_MESSAGE, isImageFilename, isPdfFilename } from "@/lib/documentFileTypes";
import { useDocumentPreview } from "@/lib/useDocumentPreview";
import {
  canManuallyApprove,
  canManuallyReject,
  isManualPayment,
  isXenditPayment,
  paymentDisplayStatus,
} from "@/lib/paymentDisplayStatus";
import { WorkflowApi, type Booking, type Payment } from "@/lib/workflowApi";

function tokenHeader(): HeadersInit {
  if (typeof window === "undefined") return {};
  const t = window.localStorage.getItem("token") || window.localStorage.getItem("authToken");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function ProofFileCell({
  payment,
  busy,
  onView,
}: {
  payment: Payment;
  busy?: boolean;
  onView: () => void;
}) {
  const fileName = payment.proof_original_filename;
  const isImg = isImageFilename(fileName);
  const isPdf = isPdfFilename(fileName);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isImg || !fileName) return;
    setThumbUrl(null);
    let cancelled = false;
    let created: string | null = null;
    const src = payment.proof_file_url
      ? apiFullUrl(payment.proof_file_url)
      : apiFullUrl(`/payments/${payment.id}/proof`);

    void (async () => {
      const res = await fetch(src, {
        headers: payment.proof_file_url ? {} : tokenHeader(),
        cache: "no-store",
      });
      if (!res.ok || cancelled) return;
      const blob = await res.blob();
      if (cancelled || !blob.type.startsWith("image/")) return;
      created = URL.createObjectURL(blob);
      if (cancelled) {
        URL.revokeObjectURL(created);
        return;
      }
      setThumbUrl(created);
    })();
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [payment.id, payment.proof_file_url, fileName, isImg]);

  if (!fileName && !payment.proof_file_url) {
    return <span style={{ fontSize: "0.85rem", color: "#B45309" }}>{FILE_NOT_FOUND_MESSAGE}</span>;
  }

  const btnStyle: React.CSSProperties = {
    padding: 0,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    borderRadius: 6,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
      {isImg && thumbUrl && (
        <button type="button" onClick={onView} style={btnStyle} title="Preview payment proof">
          <img
            src={thumbUrl}
            alt=""
            style={{
              width: 52,
              height: 52,
              objectFit: "cover",
              borderRadius: 6,
              border: "1px solid #E5E7EB",
              display: "block",
            }}
          />
        </button>
      )}
      {isPdf && (
        <button
          type="button"
          onClick={onView}
          style={{
            ...btnStyle,
            width: 52,
            height: 52,
            background: "#F3F4F6",
            border: "1px solid #E5E7EB",
            justifyContent: "center",
            fontSize: "0.7rem",
            fontWeight: 700,
            color: "#B91C1C",
          }}
          title="Preview PDF"
        >
          PDF
        </button>
      )}
      <AdminDocumentViewButton
        label="proof"
        fileName={fileName}
        staticUrl={payment.proof_file_url}
        apiPath={`/payments/${payment.id}/proof`}
        busy={busy}
        onView={onView}
      />
    </div>
  );
}

type Row = {
  payment: Payment;
  bookingLabel: string;
};

function formatStatus(payment: Payment): string {
  return paymentDisplayStatus(payment);
}

export default function AdminPaymentApprovalPage() {
  useRoleGuard(["admin", "manager"]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | Payment["status"]>("all");
  const [busyId, setBusyId] = useState<number | null>(null);
  const { preview, error, busy: previewBusy, closePreview, openDocument, openInNewTab, clearError } =
    useDocumentPreview();

  const openPaymentProof = useCallback(
    (payment: Payment) =>
      void openDocument({
        fileName: payment.proof_original_filename,
        staticUrl: payment.proof_file_url,
        apiPath: `/payments/${payment.id}/proof`,
      }),
    [openDocument],
  );

  const refresh = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const [p, b] = await Promise.all([WorkflowApi.listPayments(), WorkflowApi.listBookings()]);
      setPayments(p);
      setBookings(b);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : ERROR_LOAD_DATA);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const rows: Row[] = useMemo(() => {
    const byId = new Map(bookings.map((bk) => [bk.id, bk]));
    return payments.map((payment) => {
      const bk = byId.get(payment.booking_id);
      const route =
        bk?.pickup_location && bk?.dropoff_location
          ? `${bk.pickup_location.slice(0, 40)}… → ${bk.dropoff_location.slice(0, 40)}…`
          : "";
      return {
        payment,
        bookingLabel: bk ? `#${bk.id}${route ? ` — ${route}` : ""}` : `#${payment.booking_id}`,
      };
    });
  }, [payments, bookings]);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return rows;
    return rows.filter((r) => r.payment.status === statusFilter);
  }, [rows, statusFilter]);

  const onApprove = async (id: number) => {
    const payment = payments.find((p) => p.id === id);
    if (!payment || payment.status !== "for_verification") {
      window.alert("This payment is no longer awaiting verification.");
      return;
    }
    if (
      !window.confirm(
        "Approve this payment proof? The booking will be marked payment verified and cleared for dispatch readiness.",
      )
    ) {
      return;
    }
    setBusyId(id);
    try {
      await WorkflowApi.verifyPayment(id);
      await refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setBusyId(null);
    }
  };

  const onReject = async (id: number) => {
    const payment = payments.find((p) => p.id === id);
    if (!payment || payment.status !== "for_verification") {
      window.alert("This payment is no longer awaiting verification.");
      return;
    }
    if (
      !window.confirm(
        "Reject this payment proof? The customer will need to submit a corrected payment proof before dispatch can continue.",
      )
    ) {
      return;
    }
    setBusyId(id);
    try {
      await WorkflowApi.rejectPayment(id);
      await refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Reject failed");
    } finally {
      setBusyId(null);
    }
  };

  const statusBadge = (payment: Payment) => {
    const status = payment.status;
    const styles: Record<string, { bg: string; color: string }> = {
      for_verification: { bg: "#FEF3C7", color: "#92400E" },
      verified: { bg: "#DCFCE7", color: "#166534" },
      rejected: { bg: "#FEE2E2", color: "#991B1B" },
      refunded: { bg: "#E5E7EB", color: "#374151" },
    };
    const s = styles[status] ?? { bg: "#F3F4F6", color: "#374151" };
    return (
      <span
        style={{
          display: "inline-block",
          padding: "0.35rem 0.65rem",
          borderRadius: "999px",
          fontSize: "0.8rem",
          fontWeight: 700,
          background: s.bg,
          color: s.color,
          textTransform: "none" as const,
        }}
      >
        {formatStatus(payment)}
      </span>
    );
  };

  return (
    <main style={{ padding: "var(--page-main-padding)", background: "#FAFAFA", minHeight: "100vh" }}>
      <div className="container" style={{ maxWidth: "1200px", margin: "0 auto", display: "grid", gap: "1.2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <Link href="/admin/dashboard" style={{ color: "#0EA5E9", textDecoration: "none" }}>
              ← Admin Dashboard
            </Link>
            <h1 style={{ margin: "0.75rem 0 0.25rem", fontSize: "2rem" }}>Payment monitoring</h1>
            <p style={{ margin: 0, color: "#6B7280", fontSize: "0.95rem" }}>
              Xendit online payments verify automatically via webhook. Manual review remains only for bank transfer,
              COD, and legacy proof uploads.
            </p>
          </div>
          <Link
            href="/admin/trip-monitoring"
            style={{
              textDecoration: "none",
              background: "var(--accent)",
              color: "white",
              padding: "0.6rem 1rem",
              borderRadius: "6px",
              fontWeight: 600,
            }}
          >
            Next: Trip Monitoring
          </Link>
        </div>

        {loadError && !loading ? <ErrorState message={loadError} onRetry={() => void refresh()} /> : null}

        {loading ? (
          <div aria-busy="true" style={{ display: "grid", gap: "1rem" }}>
            <LoadingMessage label="Loading payments…" />
            <SkeletonTable rows={6} cols={9} />
          </div>
        ) : (
        <>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            padding: "1rem",
            background: "white",
            border: "1px solid #E8E8E8",
            borderRadius: "10px",
          }}
        >
          <label style={{ display: "grid", gap: "0.35rem" }}>
            <span style={{ fontSize: "0.75rem", color: "#6B7280", fontWeight: 600 }}>Filter by status</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              style={{
                padding: "0.5rem 0.65rem",
                border: "1px solid #D1D5DB",
                borderRadius: "6px",
                fontSize: "0.9rem",
              }}
              aria-label="Filter payments by status"
            >
              <option value="all">All statuses</option>
              <option value="for_verification">For verification</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
              <option value="refunded">Refunded</option>
            </select>
          </label>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#6B7280", marginTop: "1.35rem" }}>
            Showing <strong>{filtered.length}</strong> of {rows.length}
            {statusFilter !== "all" ? " (filtered)" : ""}
          </p>
        </div>

        <section style={{ background: "white", border: "1px solid #E8E8E8", borderRadius: "10px", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E8E8E8" }}>
                <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: 600 }}>Reference</th>
                <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: 600 }}>Booking</th>
                <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: 600 }}>Method</th>
                <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: 600 }}>Amount</th>
                <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: 600 }}>Paid at</th>
                <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: 600 }}>Transaction ID</th>
                <th style={{ padding: "0.75rem", textAlign: "center", fontWeight: 600 }}>Status</th>
                <th style={{ padding: "0.75rem", textAlign: "center", fontWeight: 600 }}>Verification</th>
                <th style={{ padding: "0.75rem", textAlign: "center", fontWeight: 600 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <TableEmptyRow colSpan={9} message="No payments match your filter." />
              ) : (
                filtered.map((row) => {
                  const p = row.payment;
                  const paidAt = p.xendit_paid_at || p.paid_at || p.proof_uploaded_at;
                  const transactionId = p.xendit_payment_id || p.xendit_external_id || "—";
                  return (
                    <tr key={p.id} style={{ borderBottom: "1px solid #E8E8E8" }}>
                      <td style={{ padding: "0.75rem", fontWeight: 700, color: "#1F2937" }}>{p.reference}</td>
                      <td style={{ padding: "0.75rem", color: "#1F2937", fontSize: "0.85rem" }}>{row.bookingLabel}</td>
                      <td style={{ padding: "0.75rem", fontSize: "0.85rem", color: "#374151", textTransform: "capitalize" }}>
                        {isXenditPayment(p) ? "Xendit / GCash" : p.method}
                      </td>
                      <td style={{ padding: "0.75rem", fontWeight: 600, color: "#10B981" }}>{formatPhp(p.amount)}</td>
                      <td style={{ padding: "0.75rem", fontSize: "0.85rem", color: "#6B7280" }}>
                        {paidAt ? formatDateTime(paidAt) : "—"}
                      </td>
                      <td style={{ padding: "0.75rem", fontSize: "0.78rem", color: "#4B5563", wordBreak: "break-all" }}>
                        {transactionId}
                      </td>
                      <td style={{ padding: "0.75rem", textAlign: "center" }}>{statusBadge(p)}</td>
                      <td style={{ padding: "0.75rem", textAlign: "center", fontSize: "0.8rem" }}>
                        {p.webhook_verified || (isXenditPayment(p) && p.status === "verified") ? (
                          <div style={{ display: "grid", gap: "0.25rem" }}>
                            <span style={{ color: "#166534", fontWeight: 700 }}>Verified automatically via Xendit</span>
                            <span style={{ color: "#6B7280" }}>Webhook: {p.webhook_status || p.xendit_status || "PAID"}</span>
                          </div>
                        ) : isXenditPayment(p) ? (
                          <div style={{ display: "grid", gap: "0.25rem" }}>
                            <span style={{ color: "#92400E", fontWeight: 600 }}>Awaiting Xendit webhook</span>
                            <span style={{ color: "#6B7280" }}>Webhook: {p.webhook_status || p.xendit_status || "PENDING"}</span>
                          </div>
                        ) : (
                          <span style={{ color: "#6B7280" }}>Manual proof review</span>
                        )}
                      </td>
                      <td style={{ padding: "0.75rem", textAlign: "center" }}>
                        {canManuallyApprove(p) ? (
                          <div style={{ display: "flex", gap: "0.35rem", justifyContent: "center", flexWrap: "wrap" }}>
                            <SubmitButton
                              type="button"
                              className=""
                              busy={busyId === p.id}
                              busyLabel="Approving…"
                              label="Approve"
                              disabled={busyId !== null}
                              onClick={() => void onApprove(p.id)}
                              style={{
                                padding: "0.4rem 0.7rem",
                                background: "#10B981",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                fontWeight: 600,
                                fontSize: "0.8rem",
                              }}
                            />
                            {canManuallyReject(p) ? (
                              <SubmitButton
                                type="button"
                                className=""
                                busy={busyId === p.id}
                                busyLabel="Rejecting…"
                                label="Reject"
                                disabled={busyId !== null}
                                onClick={() => void onReject(p.id)}
                                style={{
                                  padding: "0.4rem 0.7rem",
                                  background: "#EF4444",
                                  color: "white",
                                  border: "none",
                                  borderRadius: "4px",
                                  fontWeight: 600,
                                  fontSize: "0.8rem",
                                }}
                              />
                            ) : null}
                          </div>
                        ) : isManualPayment(p) && p.proof_original_filename ? (
                          <ProofFileCell payment={p} busy={previewBusy} onView={() => openPaymentProof(p)} />
                        ) : isManualPayment(p) && p.status === "for_verification" ? (
                          <span style={{ fontSize: "0.8rem", color: "#B45309" }}>Awaiting proof</span>
                        ) : (
                          <span style={{ fontSize: "0.8rem", color: "#6B7280" }}>Monitor only</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </section>
        </>
        )}

        {error && (
          <div style={{ background: "#FEF2F2", color: "#991B1B", padding: 12, borderRadius: 8 }} role="alert">
            {error}{" "}
            <button type="button" onClick={clearError} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
              Dismiss
            </button>
          </div>
        )}

        {preview && (
          <DocumentPreviewModal preview={preview} onClose={closePreview} onOpenInNewTab={openInNewTab} />
        )}
      </div>
    </main>
  );
}
