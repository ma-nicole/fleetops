"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import AdminDocumentViewButton from "@/components/AdminDocumentViewButton";
import DocumentPreviewModal from "@/components/DocumentPreviewModal";
import { useRoleGuard } from "@/lib/useRoleGuard";
import { ApiError, parseApiDetail } from "@/lib/api";
import { getEffectiveRole, ROLE_DASHBOARDS, type UserRole } from "@/lib/auth";
import { formatDateTime } from "@/lib/appLocale";
import { formatBookingWeightTons } from "@/lib/bookingWeightOptions";
import {
  canPerformGoodsDeclarationReview,
  goodsDeclarationReviewBadgeStyle,
  goodsDeclarationReviewLabel,
  isGoodsDeclarationReviewFinal,
  isGoodsDeclarationReviewLocked,
  type GoodsDeclarationReviewStatus,
} from "@/lib/goodsDeclarationReview";
import { ERROR_ANALYTICS_PERMISSION, REMARKS_REQUIRED_REVISION_REJECT } from "@/lib/loadingMessages";
import { useDocumentPreview } from "@/lib/useDocumentPreview";
import type { GoodsDeclarationAdminRow } from "@/lib/workflowApi";
import { WorkflowApi } from "@/lib/workflowApi";

type StatusFilter = "all" | GoodsDeclarationReviewStatus;

const REVIEW_CONFIRM_COPY: Record<"approved" | "rejected" | "revision_requested", string> = {
  approved:
    "Approve this goods declaration? FleetOps will mark the document as approved and continue the booking workflow.",
  rejected:
    "Reject this goods declaration? This closes document review for the booking and notifies the customer.",
  revision_requested:
    "Request document revision? Other review actions will stay locked until the customer resubmits corrected documents.",
};

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

function actionButtonStyle(variant: "revision" | "reject", enabled: boolean): CSSProperties {
  const base =
    variant === "revision"
      ? {
          border: "1px solid #FDBA74",
          background: enabled ? "#FFF7ED" : "#F9FAFB",
          color: enabled ? "#9A3412" : "#9CA3AF",
        }
      : {
          border: "1px solid #FCA5A5",
          background: enabled ? "#FEF2F2" : "#F9FAFB",
          color: enabled ? "#991B1B" : "#9CA3AF",
        };
  return {
    padding: "0.45rem 0.75rem",
    borderRadius: 6,
    fontWeight: 600,
    cursor: enabled ? "pointer" : "not-allowed",
    opacity: enabled ? 1 : 0.72,
    ...base,
  };
}

export default function AdminGoodsDeclarationsPage() {
  useRoleGuard(["admin", "manager"]);
  const {
    preview,
    error: previewError,
    busy: documentPreviewBusy,
    closePreview,
    openDocument,
    openInNewTab,
    clearError: clearPreviewError,
  } = useDocumentPreview();
  const [rows, setRows] = useState<GoodsDeclarationAdminRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [busyBookingId, setBusyBookingId] = useState<number | null>(null);
  const [remarksByBooking, setRemarksByBooking] = useState<Record<number, string>>({});
  const [actionErrorByBooking, setActionErrorByBooking] = useState<Record<number, string>>({});

  const dashboardHref = useMemo(() => {
    const role = getEffectiveRole();
    if (role && role in ROLE_DASHBOARDS) {
      return ROLE_DASHBOARDS[role as UserRole];
    }
    return "/admin/dashboard";
  }, []);

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      const data = await WorkflowApi.listGoodsDeclarations();
      setRows(data);
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        setLoadError(ERROR_ANALYTICS_PERMISSION);
      } else {
        setLoadError(e instanceof Error ? e.message : "Failed to load goods declarations.");
      }
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
    const needsRemarks = status === "rejected" || status === "revision_requested";

    setActionErrorByBooking((prev) => {
      const next = { ...prev };
      delete next[bookingId];
      return next;
    });

    if (needsRemarks && !remarks) {
      return;
    }

    if (!window.confirm(REVIEW_CONFIRM_COPY[status])) {
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
      const message =
        e instanceof ApiError
          ? parseApiDetail(e.body) ?? e.message
          : e instanceof Error
            ? e.message
            : "Review update failed.";
      console.error("[Goods declaration review]", bookingId, status, e);
      setActionErrorByBooking((prev) => ({ ...prev, [bookingId]: message }));
    } finally {
      setBusyBookingId(null);
    }
  };

  return (
    <main style={{ padding: "var(--page-main-padding)", background: "#FAFAFA", minHeight: "100vh" }}>
      <div className="container" style={{ maxWidth: "1200px", margin: "0 auto", display: "grid", gap: "1.2rem" }}>
        <div>
          <Link href={dashboardHref} style={{ color: "#0EA5E9", textDecoration: "none" }}>
            ← Dashboard
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
              <option value="resubmitted">Resubmitted</option>
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
                  const reviewBusy = busyBookingId === row.booking_id;
                  const reviewStatus = row.goods_declaration_review_status ?? "pending";
                  const canReview = canPerformGoodsDeclarationReview(reviewStatus);
                  const isLocked = isGoodsDeclarationReviewLocked(reviewStatus);
                  const isFinal = isGoodsDeclarationReviewFinal(reviewStatus);
                  const storedRemarks = row.goods_declaration_review_remarks ?? "";
                  const remarks = remarksByBooking[row.booking_id] ?? storedRemarks;
                  const remarksReady = remarks.trim().length > 0;
                  const actionError = actionErrorByBooking[row.booking_id];
                  const reviewLockedBySave = busyBookingId !== null;
                  const approveEnabled = canReview && !reviewLockedBySave;
                  const revisionRejectEnabled = canReview && remarksReady && !reviewLockedBySave;

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
                          busy={documentPreviewBusy}
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
                        <ReviewStatusBadge status={reviewStatus} />
                        {storedRemarks && (
                          <p style={{ margin: "0.5rem 0 0", fontSize: "0.8rem", color: "#4B5563" }}>
                            {isLocked ? (
                              <>
                                <span style={{ fontWeight: 600, color: "#9A3412" }}>Revision remarks: </span>
                                {storedRemarks}
                              </>
                            ) : (
                              storedRemarks
                            )}
                          </p>
                        )}
                        {row.goods_declaration_reviewed_at && (
                          <p style={{ margin: "0.35rem 0 0", fontSize: "0.75rem", color: "#9CA3AF" }}>
                            Reviewed {formatDateTime(row.goods_declaration_reviewed_at)}
                          </p>
                        )}
                        {isLocked && (
                          <p style={{ margin: "0.5rem 0 0", fontSize: "0.78rem", color: "#9A3412" }}>
                            Waiting for customer to upload revised documents.
                          </p>
                        )}
                        {isFinal && (
                          <p style={{ margin: "0.5rem 0 0", fontSize: "0.78rem", color: "#6B7280" }}>
                            Review closed — no further actions.
                          </p>
                        )}
                      </td>
                      <td style={{ padding: "0.75rem" }}>
                        {canReview ? (
                        <div style={{ display: "grid", gap: "0.35rem", marginBottom: "0.5rem" }}>
                          <label
                            htmlFor={`goods-decl-remarks-${row.booking_id}`}
                            style={{ fontSize: "0.78rem", fontWeight: 600, color: "#374151" }}
                          >
                            Remarks (required for reject / revision)
                          </label>
                          <textarea
                            id={`goods-decl-remarks-${row.booking_id}`}
                            className="input"
                            rows={2}
                            value={remarks}
                            onChange={(e) => {
                              setRemarksByBooking((prev) => ({
                                ...prev,
                                [row.booking_id]: e.target.value,
                              }));
                            }}
                            maxLength={2000}
                            placeholder="Notes to customer or internal team"
                            disabled={reviewLockedBySave}
                          />
                        </div>
                        ) : null}
                        {reviewBusy ? (
                          <p role="status" style={{ margin: "0 0 0.5rem", fontSize: "0.78rem", color: "#1E40AF" }}>
                            Decision is being saved. Other actions are locked until this finishes.
                          </p>
                        ) : null}
                        {canReview && !remarksReady && (
                          <p
                            role="status"
                            style={{
                              margin: "0 0 0.5rem",
                              fontSize: "0.78rem",
                              color: "#6B7280",
                            }}
                          >
                            {REMARKS_REQUIRED_REVISION_REJECT}
                          </p>
                        )}
                        {actionError && (
                          <p role="alert" style={{ margin: "0 0 0.5rem", fontSize: "0.78rem", color: "#B91C1C" }}>
                            {actionError}
                          </p>
                        )}
                        {canReview ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                          <button
                            type="button"
                            className="button"
                            disabled={!approveEnabled}
                            aria-disabled={!approveEnabled}
                            onClick={() => void submitReview(row.booking_id, "approved")}
                          >
                            {reviewBusy ? "Saving…" : "Approve"}
                          </button>
                          <button
                            type="button"
                            disabled={!revisionRejectEnabled}
                            aria-disabled={!revisionRejectEnabled}
                            title={
                              revisionRejectEnabled
                                ? "Request revision with remarks"
                                : REMARKS_REQUIRED_REVISION_REJECT
                            }
                            onClick={() => void submitReview(row.booking_id, "revision_requested")}
                            style={actionButtonStyle("revision", revisionRejectEnabled)}
                          >
                            Request revision
                          </button>
                          <button
                            type="button"
                            disabled={!revisionRejectEnabled}
                            aria-disabled={!revisionRejectEnabled}
                            title={
                              revisionRejectEnabled ? "Reject with remarks" : REMARKS_REQUIRED_REVISION_REJECT
                            }
                            onClick={() => void submitReview(row.booking_id, "rejected")}
                            style={actionButtonStyle("reject", revisionRejectEnabled)}
                          >
                            Reject
                          </button>
                        </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      {previewError && (
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
            pointerEvents: "auto",
          }}
        >
          {previewError}{" "}
          <button
            type="button"
            onClick={clearPreviewError}
            style={{ border: "none", background: "transparent", cursor: "pointer" }}
          >
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
