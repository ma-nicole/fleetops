"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRoleGuard } from "@/lib/useRoleGuard";
import { apiFullUrl } from "@/lib/api";
import { formatPhp, formatDateTime } from "@/lib/appLocale";
import type { Booking, Payment } from "@/lib/workflowApi";
import { WorkflowApi } from "@/lib/workflowApi";

function tokenHeader(): HeadersInit {
  if (typeof window === "undefined") return {};
  const t = window.localStorage.getItem("token") || window.localStorage.getItem("authToken");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function isImageFilename(name: string | null | undefined): boolean {
  if (!name) return false;
  const l = name.toLowerCase();
  return l.endsWith(".jpg") || l.endsWith(".jpeg") || l.endsWith(".png");
}

function isPdfFilename(name: string | null | undefined): boolean {
  return !!name && name.toLowerCase().endsWith(".pdf");
}

type ProofPreview = {
  url: string;
  fileName: string;
  isPdf: boolean;
};

function ProofFileCell({
  paymentId,
  fileName,
  onOpen,
}: {
  paymentId: number;
  fileName: string;
  onOpen: (paymentId: number, fileName: string) => void;
}) {
  const isImg = isImageFilename(fileName);
  const isPdf = isPdfFilename(fileName);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isImg) return;
    setThumbUrl(null);
    let cancelled = false;
    let created: string | null = null;
    void (async () => {
      const res = await fetch(apiFullUrl(`/payments/${paymentId}/proof`), {
        headers: tokenHeader(),
        cache: "no-store",
      });
      if (!res.ok || cancelled) return;
      const blob = await res.blob();
      if (cancelled) return;
      if (!blob.type.startsWith("image/")) return;
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
  }, [paymentId, fileName, isImg]);

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
        <button
          type="button"
          onClick={() => onOpen(paymentId, fileName)}
          style={btnStyle}
          title="View proof"
          aria-label={`View proof ${fileName}`}
        >
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
          onClick={() => onOpen(paymentId, fileName)}
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
          title="View PDF"
          aria-label={`View PDF ${fileName}`}
        >
          PDF
        </button>
      )}
      <button
        type="button"
        onClick={() => onOpen(paymentId, fileName)}
        style={{
          background: "none",
          border: "none",
          color: "#2563EB",
          cursor: "pointer",
          textDecoration: "underline",
          fontWeight: 500,
          fontSize: "0.85rem",
          textAlign: "left",
        }}
      >
        {fileName}
      </button>
    </div>
  );
}

type Row = {
  payment: Payment;
  bookingLabel: string;
};

function formatStatus(s: Payment["status"]): string {
  switch (s) {
    case "for_verification":
      return "for verification";
    case "verified":
      return "verified";
    case "rejected":
      return "rejected";
    case "refunded":
      return "refunded";
    default:
      return s;
  }
}

export default function AdminPaymentApprovalPage() {
  useRoleGuard(["admin", "manager"]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | Payment["status"]>("all");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [preview, setPreview] = useState<ProofPreview | null>(null);

  const closePreview = useCallback(() => {
    setPreview((p) => {
      if (p?.url) URL.revokeObjectURL(p.url);
      return null;
    });
  }, []);

  const openPreview = useCallback(async (paymentId: number, fileName: string) => {
    const res = await fetch(apiFullUrl(`/payments/${paymentId}/proof`), {
      headers: tokenHeader(),
      cache: "no-store",
    });
    if (!res.ok) {
      window.alert(res.status === 404 ? "Proof file is not available." : "Could not load proof.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const isPdf = isPdfFilename(fileName) || blob.type === "application/pdf";
    setPreview((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return { url, fileName, isPdf };
    });
  }, []);

  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePreview();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [preview, closePreview]);

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      const [p, b] = await Promise.all([WorkflowApi.listPayments(), WorkflowApi.listBookings()]);
      setPayments(p);
      setBookings(b);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
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

  const statusBadge = (status: Payment["status"]) => {
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
        {formatStatus(status)}
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
            <h1 style={{ margin: "0.75rem 0 0.25rem", fontSize: "2rem" }}>Payment approval</h1>
            <p style={{ margin: 0, color: "#6B7280", fontSize: "0.95rem" }}>
              Approve or reject customer proof-of-payment uploads. Booking payment status follows these decisions.
            </p>
          </div>
          <Link
            href="/admin/trip-monitoring"
            style={{
              textDecoration: "none",
              background: "#3B82F6",
              color: "white",
              padding: "0.6rem 1rem",
              borderRadius: "6px",
              fontWeight: 600,
            }}
          >
            Next: Trip Monitoring
          </Link>
        </div>

        {loadError && (
          <div style={{ background: "#FEE2E2", color: "#991B1B", padding: 12, borderRadius: 8 }}>{loadError}</div>
        )}

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
                <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: 600 }}>Amount</th>
                <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: 600 }}>Uploaded</th>
                <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: 600 }}>File</th>
                <th style={{ padding: "0.75rem", textAlign: "center", fontWeight: 600 }}>Status</th>
                <th style={{ padding: "0.75rem", textAlign: "center", fontWeight: 600 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: "2rem", textAlign: "center", color: "#6B7280" }}>
                    No payments match your filter.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const p = row.payment;
                  return (
                    <tr key={p.id} style={{ borderBottom: "1px solid #E8E8E8" }}>
                      <td style={{ padding: "0.75rem", fontWeight: 700, color: "#1F2937" }}>{p.reference}</td>
                      <td style={{ padding: "0.75rem", color: "#1F2937", fontSize: "0.85rem" }}>{row.bookingLabel}</td>
                      <td style={{ padding: "0.75rem", fontWeight: 600, color: "#10B981" }}>{formatPhp(p.amount)}</td>
                      <td style={{ padding: "0.75rem", fontSize: "0.85rem", color: "#6B7280" }}>
                        {p.proof_uploaded_at ? formatDateTime(p.proof_uploaded_at) : "—"}
                      </td>
                      <td style={{ padding: "0.75rem", fontSize: "0.85rem" }}>
                        {p.proof_original_filename ? (
                          <ProofFileCell
                            paymentId={p.id}
                            fileName={p.proof_original_filename}
                            onOpen={(pid, name) => void openPreview(pid, name)}
                          />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td style={{ padding: "0.75rem", textAlign: "center" }}>{statusBadge(p.status)}</td>
                      <td style={{ padding: "0.75rem", textAlign: "center" }}>
                        {p.status === "for_verification" && p.proof_original_filename ? (
                          <div style={{ display: "flex", gap: "0.35rem", justifyContent: "center", flexWrap: "wrap" }}>
                            <button
                              type="button"
                              onClick={() => void onApprove(p.id)}
                              disabled={busyId === p.id}
                              style={{
                                padding: "0.4rem 0.7rem",
                                background: "#10B981",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: busyId === p.id ? "wait" : "pointer",
                                fontWeight: 600,
                                fontSize: "0.8rem",
                              }}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => void onReject(p.id)}
                              disabled={busyId === p.id}
                              style={{
                                padding: "0.4rem 0.7rem",
                                background: "#EF4444",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: busyId === p.id ? "wait" : "pointer",
                                fontWeight: 600,
                                fontSize: "0.8rem",
                              }}
                            >
                              Reject
                            </button>
                          </div>
                        ) : p.status === "for_verification" && !p.proof_original_filename ? (
                          <span style={{ fontSize: "0.8rem", color: "#B45309" }}>Awaiting proof</span>
                        ) : (
                          <span style={{ fontSize: "0.8rem", color: "#6B7280" }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </section>

        {preview && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Payment proof preview"
            onClick={closePreview}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.55)",
              zIndex: 1100,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "1rem",
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "white",
                borderRadius: 12,
                maxWidth: "min(960px, 96vw)",
                maxHeight: "92vh",
                overflow: "auto",
                boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
                display: "grid",
                gap: "0.75rem",
                padding: "1rem 1.25rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                <strong style={{ color: "#111827", wordBreak: "break-all" }}>{preview.fileName}</strong>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <a
                    href={preview.url}
                    download={preview.fileName}
                    style={{
                      background: "#10B981",
                      color: "white",
                      padding: "0.45rem 0.85rem",
                      borderRadius: 6,
                      fontWeight: 600,
                      fontSize: "0.875rem",
                      textDecoration: "none",
                    }}
                  >
                    Download
                  </a>
                  <button
                    type="button"
                    onClick={closePreview}
                    style={{
                      background: "#F3F4F6",
                      color: "#111827",
                      border: "1px solid #E5E7EB",
                      padding: "0.45rem 0.85rem",
                      borderRadius: 6,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
              {preview.isPdf ? (
                <iframe
                  src={preview.url}
                  title={preview.fileName}
                  style={{
                    width: "min(920px, 92vw)",
                    height: "min(72vh, 640px)",
                    border: "1px solid #E5E7EB",
                    borderRadius: 8,
                  }}
                />
              ) : (
                <img
                  src={preview.url}
                  alt={preview.fileName}
                  style={{
                    maxWidth: "100%",
                    maxHeight: "72vh",
                    width: "auto",
                    height: "auto",
                    objectFit: "contain",
                    justifySelf: "center",
                  }}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
