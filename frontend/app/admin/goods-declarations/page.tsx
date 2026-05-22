"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import AdminDocumentViewButton from "@/components/AdminDocumentViewButton";
import DocumentPreviewModal from "@/components/DocumentPreviewModal";
import { useRoleGuard } from "@/lib/useRoleGuard";
import { formatDateTime } from "@/lib/appLocale";
import { formatBookingWeightTons } from "@/lib/bookingWeightOptions";
import {
  goodsDeclarationReviewBadgeStyle,
  goodsDeclarationReviewLabel,
  type GoodsDeclarationReviewStatus,
} from "@/lib/goodsDeclarationReview";
import { useDocumentPreview } from "@/lib/useDocumentPreview";
import type { GoodsDeclarationAdminRow } from "@/lib/workflowApi";
import { WorkflowApi } from "@/lib/workflowApi";

type StatusFilter = "all" | GoodsDeclarationReviewStatus;

function ReviewStatusBadge({ status }: { status: string | null }) {
  const s = goodsDeclarationReviewBadgeStyle(status);
  return (
    <span
      style={{
        display: "inline-block",
        padding: "0.35rem 0.65rem",
        borderRadius: 999,
        fontSize: "0.8rem",
        fontWeight: 700,
        background: s.bg,
        color: s.color,
      }}
    >
      {goodsDeclarationReviewLabel(status)}
    </span>
  );
}

export default function AdminGoodsDeclarationsPage() {
  useRoleGuard(["admin", "manager"]);
  const { preview, error, busy, closePreview, openDocument, openInNewTab, clearError } =
    useDocumentPreview();
  const [rows, setRows] = useState<GoodsDeclarationAdminRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [busyBookingId, setBusyBookingId] = useState<number | null>(null);
  const [remarksByBooking, setRemarksByBooking] = useState<Record<number, string>>({});

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      const data = await WorkflowApi.listGoodsDeclarations();
      setRows(data);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load goods declarations.");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return rows;
    return rows.filter((r) => (r.goods_declaration_review_status ?? "pending") === statusFilter);
  }, [rows, statusFilter]);

  const submitReview = async (
    bookingId: number,
    status: "approved" | "rejected" | "revision_requested",
  ) => {
    const remarks = (remarksByBooking[bookingId] ?? "").trim();
    if ((status === "rejected" || status === "revision_requested") && !remarks) {
      window.alert("Remarks are required when rejecting or requesting revision.");
      return;
    }

    setBusyBookingId(bookingId);
    try {
      const updated = await WorkflowApi.reviewGoodsDeclaration(bookingId, {
        status,
        remarks: remarks || null,
      });
      setRows((prev) => prev.map((r) => (r.booking_id === bookingId ? updated : r)));
      if (status === "approved") {
        setRemarksByBooking((prev) => {
          const next = { ...prev };
          delete next[bookingId];
          return next;
        });
      }
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Review update failed.");
    } finally {
      setBusyBookingId(null);
    }
  };

  return (
    <main style={{ padding: "var(--page-main-padding)", background: "#FAFAFA", minHeight: "100vh" }}>
      <div className="container" style={{ maxWidth: "1200px", margin: "0 auto", display: "grid", gap: "1.2rem" }}>
        <div>
          <Link href="/admin/dashboard" style={{ color: "#0EA5E9", textDecoration: "none" }}>
            ← Admin Dashboard
          </Link>
          <h1 style={{ margin: "0.75rem 0 0.25rem", fontSize: "2rem" }}>Declaration of goods review</h1>
          <p style={{ margin: 0, color: "#6B7280", fontSize: "0.95rem" }}>
            Review uploaded cargo declaration files per booking. Approve, reject, or request revision with remarks.
            Booking workflow is unchanged — only validation status and remarks are updated.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}>
            <span style={{ color: "#374151", fontWeight: 600 }}>Filter by status</span>
            <select
              className="input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              style={{ minWidth: 180 }}
            >
              <option value="all">All</option>
              <option value="pending">Pending review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="revision_requested">Revision requested</option>
            </select>
          </label>
          <button type="button" className="button" onClick={() => void refresh()}>
            Refresh
          </button>
        </div>

        {loadError && (
          <p role="alert" style={{ margin: 0, color: "#B91C1C" }}>
            {loadError}
          </p>
        )}

        <div style={{ overflowX: "auto", background: "#fff", borderRadius: 8, border: "1px solid #E5E7EB" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
            <thead>
              <tr style={{ background: "#F9FAFB", textAlign: "left" }}>
                <th style={{ padding: "0.75rem", borderBottom: "1px solid #E5E7EB" }}>Booking</th>
                <th style={{ padding: "0.75rem", borderBottom: "1px solid #E5E7EB" }}>Route / cargo</th>
                <th style={{ padding: "0.75rem", borderBottom: "1px solid #E5E7EB" }}>Document</th>
                <th style={{ padding: "0.75rem", borderBottom: "1px solid #E5E7EB" }}>Review status</th>
                <th style={{ padding: "0.75rem", borderBottom: "1px solid #E5E7EB", minWidth: 280 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: "1.25rem", color: "#6B7280", textAlign: "center" }}>
                    No goods declaration uploads match this filter.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const busy = busyBookingId === row.booking_id;
                  const remarks = remarksByBooking[row.booking_id] ?? row.goods_declaration_review_remarks ?? "";
                  return (
                    <tr key={row.booking_id} style={{ borderBottom: "1px solid #F3F4F6", verticalAlign: "top" }}>
                      <td style={{ padding: "0.75rem" }}>
                        <strong>#{row.booking_id}</strong>
                        <div style={{ color: "#6B7280", fontSize: "0.8rem", marginTop: 4 }}>
                          Customer #{row.customer_id}
                          <br />
                          Booking: {row.status.replace(/_/g, " ")}
                        </div>
                      </td>
                      <td style={{ padding: "0.75rem", maxWidth: 260 }}>
                        <div>{row.pickup_location}</div>
                        <div style={{ color: "#6B7280" }}>→ {row.dropoff_location}</div>
                        <div style={{ marginTop: 4, fontSize: "0.8rem" }}>
                          {row.cargo_description || "—"}
                          <br />
                          {formatBookingWeightTons(row.cargo_weight_tons)}
                        </div>
                      </td>
                      <td style={{ padding: "0.75rem" }}>
                        <AdminDocumentViewButton
                          label="declaration"
                          fileName={row.cargo_declaration_original_filename}
                          staticUrl={row.cargo_declaration_file_url}
                          apiPath={`/bookings/${row.booking_id}/documents/cargo-declaration`}
                          busy={busy}
                          onView={() =>
                            void openDocument({
                              fileName: row.cargo_declaration_original_filename,
                              staticUrl: row.cargo_declaration_file_url,
                              apiPath: `/bookings/${row.booking_id}/documents/cargo-declaration`,
                            })
                          }
                        />
                        {row.cargo_declaration_uploaded_at && (
                          <div style={{ fontSize: "0.78rem", color: "#9CA3AF", marginTop: 6 }}>
                            Uploaded {formatDateTime(row.cargo_declaration_uploaded_at)}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "0.75rem" }}>
                        <ReviewStatusBadge status={row.goods_declaration_review_status} />
                        {row.goods_declaration_review_remarks && (
                          <p style={{ margin: "0.5rem 0 0", fontSize: "0.8rem", color: "#4B5563" }}>
                            {row.goods_declaration_review_remarks}
                          </p>
                        )}
                        {row.goods_declaration_reviewed_at && (
                          <p style={{ margin: "0.35rem 0 0", fontSize: "0.75rem", color: "#9CA3AF" }}>
                            Reviewed {formatDateTime(row.goods_declaration_reviewed_at)}
                          </p>
                        )}
                      </td>
                      <td style={{ padding: "0.75rem" }}>
                        <label style={{ display: "grid", gap: "0.35rem", marginBottom: "0.5rem" }}>
                          <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#374151" }}>
                            Remarks (required for reject / revision)
                          </span>
                          <textarea
                            className="input"
                            rows={2}
                            value={remarks}
                            onChange={(e) =>
                              setRemarksByBooking((prev) => ({ ...prev, [row.booking_id]: e.target.value }))
                            }
                            maxLength={2000}
                            placeholder="Notes to customer or internal team"
                          />
                        </label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                          <button
                            type="button"
                            className="button"
                            disabled={busy}
                            onClick={() => void submitReview(row.booking_id, "approved")}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void submitReview(row.booking_id, "revision_requested")}
                            style={{
                              padding: "0.45rem 0.75rem",
                              borderRadius: 6,
                              border: "1px solid #FDBA74",
                              background: "#FFF7ED",
                              color: "#9A3412",
                              cursor: busy ? "wait" : "pointer",
                              fontWeight: 600,
                            }}
                          >
                            Request revision
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void submitReview(row.booking_id, "rejected")}
                            style={{
                              padding: "0.45rem 0.75rem",
                              borderRadius: 6,
                              border: "1px solid #FCA5A5",
                              background: "#FEF2F2",
                              color: "#991B1B",
                              cursor: busy ? "wait" : "pointer",
                              fontWeight: 600,
                            }}
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      {error && (
        <p
          role="alert"
          style={{
            position: "fixed",
            bottom: "1.5rem",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#FEF2F2",
            color: "#991B1B",
            padding: "0.75rem 1rem",
            borderRadius: 8,
            border: "1px solid #FECACA",
            zIndex: 1200,
            maxWidth: "90vw",
          }}
        >
          {error}{" "}
          <button type="button" onClick={clearError} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
            Dismiss
          </button>
        </p>
      )}
      {preview && (
        <DocumentPreviewModal preview={preview} onClose={closePreview} onOpenInNewTab={openInNewTab} />
      )}
    </main>
  );
}
