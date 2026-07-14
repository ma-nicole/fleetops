"use client";

import Link from "next/link";
import { useCallback, useState, type CSSProperties } from "react";
import { validateBookingDocumentFile } from "@/components/BookingDocumentUploadFields";
import {
  canCustomerResubmitDocuments,
  customerDocumentReviewGuidance,
  customerDocumentReviewStatusLabel,
  goodsDeclarationReviewBadgeStyle,
} from "@/lib/goodsDeclarationReview";
import { customerBookingPaymentPath } from "@/lib/customerPaymentNavigation";
import type { Booking, Payment } from "@/lib/workflowApi";
import { WorkflowApi } from "@/lib/workflowApi";

type DocumentReviewFields = Pick<
  Booking,
  | "id"
  | "cargo_declaration_original_filename"
  | "cargo_declaration_uploaded_at"
  | "terms_agreement_original_filename"
  | "terms_agreed_at"
  | "terms_e_signed"
  | "goods_declaration_review_status"
  | "goods_declaration_review_status_label"
  | "goods_declaration_review_remarks"
  | "goods_declaration_reviewed_at"
>;

function ReviewStatusBadge({
  status,
  label,
}: {
  status: string | null | undefined;
  label: string;
}) {
  const s = goodsDeclarationReviewBadgeStyle(status);
  const attention = status === "revision_requested" || status === "rejected";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: attention ? "0.4rem 0.75rem" : "0.3rem 0.6rem",
        borderRadius: 999,
        fontSize: attention ? "0.82rem" : "0.78rem",
        fontWeight: 800,
        letterSpacing: attention ? "0.01em" : undefined,
        background: s.bg,
        color: s.color,
        border: attention ? `1px solid ${s.color}33` : "none",
        boxShadow: attention ? "0 1px 2px rgba(0,0,0,0.06)" : undefined,
      }}
    >
      {attention ? "● " : ""}
      {label}
    </span>
  );
}

function PaymentReviewNotice({ payment, bookingId }: { payment: Payment; bookingId: number }) {
  if (payment.status !== "rejected") return null;
  return (
    <div
      style={{
        marginTop: "0.75rem",
        padding: "0.75rem",
        borderRadius: 8,
        background: "#FEF2F2",
        border: "1px solid #FECACA",
      }}
    >
      <p style={{ margin: "0 0 0.35rem", fontWeight: 700, color: "#991B1B", fontSize: "0.88rem" }}>
        Payment proof rejected
      </p>
      <p style={{ margin: 0, fontSize: "0.85rem", color: "#7F1D1D" }}>
        Your payment proof was rejected. Please upload a clearer image from the payment page.
      </p>
      <Link
        href={customerBookingPaymentPath(bookingId)}
        style={{
          display: "inline-block",
          marginTop: "0.5rem",
          fontSize: "0.85rem",
          fontWeight: 600,
          color: "#B91C1C",
        }}
      >
        Resubmit payment proof
      </Link>
    </div>
  );
}

export default function CustomerDocumentReviewSection({
  booking,
  payment,
  compact = false,
  onUpdated,
}: {
  booking: DocumentReviewFields;
  payment?: Payment | null;
  compact?: boolean;
  onUpdated?: (updated: Booking) => void;
}) {
  const hasDeclaration = !!booking.cargo_declaration_original_filename;
  if (!hasDeclaration) return null;

  const reviewStatus = booking.goods_declaration_review_status ?? "pending";
  const statusLabel = customerDocumentReviewStatusLabel(
    reviewStatus,
    booking.goods_declaration_review_status_label,
  );
  const guidance = customerDocumentReviewGuidance(reviewStatus);
  const remarks = (booking.goods_declaration_review_remarks ?? "").trim();
  const canResubmit = canCustomerResubmitDocuments(reviewStatus);
  const isRejected = reviewStatus === "rejected";

  const [cargoFile, setCargoFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<{ cargo?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  const submitResubmit = useCallback(async () => {
    setErrors({});
    setSuccess(false);

    if (!cargoFile) {
      setErrors({ form: "Upload a revised cargo declaration to continue." });
      return;
    }

    const cargoErr = validateBookingDocumentFile(cargoFile);
    if (cargoErr) {
      setErrors({ cargo: cargoErr });
      return;
    }

    if (
      !window.confirm(
        "Submit this revised cargo declaration for review? FleetOps will lock the previous revision request and notify reviewers immediately.",
      )
    ) {
      return;
    }

    setBusy(true);
    try {
      const updated = await WorkflowApi.resubmitBookingDocuments(booking.id, {
        cargo_declaration: cargoFile,
      });
      setSuccess(true);
      setCargoFile(null);
      onUpdated?.(updated);
    } catch (e) {
      setErrors({ form: e instanceof Error ? e.message : "Upload failed. Please try again." });
    } finally {
      setBusy(false);
    }
  }, [booking.id, cargoFile, onUpdated]);

  const boxStyle: CSSProperties = compact
    ? {
        marginTop: "0.65rem",
        padding: "0.65rem 0.75rem",
        borderRadius: 8,
        border: "1px solid #E5E7EB",
        background: "#FAFAFA",
        fontSize: "0.85rem",
      }
    : {
        marginTop: "1rem",
        padding: "1rem",
        borderRadius: 8,
        border: "1px solid #BFDBFE",
        background: "rgba(59, 130, 246, 0.04)",
      };

  return (
    <div
      style={{
        ...boxStyle,
        ...(reviewStatus === "revision_requested" || isRejected
          ? {
              border: isRejected ? "1px solid #FCA5A5" : "1px solid #FDBA74",
              background: isRejected ? "#FEF2F2" : "#FFF7ED",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }
          : {}),
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "0.5rem",
          flexWrap: "wrap",
          marginBottom: compact ? "0.35rem" : "0.5rem",
        }}
      >
        <h4 style={{ margin: 0, color: "#1E3A8A", fontSize: compact ? "0.85rem" : "1rem" }}>
          Document review
        </h4>
        <ReviewStatusBadge status={reviewStatus} label={statusLabel} />
      </div>

      {guidance && (
        <p
          style={{
            margin: "0 0 0.35rem",
            color: reviewStatus === "revision_requested" || isRejected ? "#9A3412" : "#374151",
            fontSize: compact ? "0.85rem" : "0.9rem",
            fontWeight: reviewStatus === "revision_requested" || isRejected ? 700 : 400,
            lineHeight: 1.45,
          }}
        >
          {guidance}
        </p>
      )}

      {remarks && (
        <div
          style={{
            margin: "0.45rem 0 0",
            padding: "0.55rem 0.7rem",
            borderRadius: 8,
            background: "#FFFFFF",
            border: "1px solid #E5E7EB",
            fontSize: compact ? "0.82rem" : "0.88rem",
            color: "#1F2937",
            lineHeight: 1.45,
          }}
        >
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#6B7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Manager remarks
          </div>
          {remarks}
        </div>
      )}

      {!compact && !canResubmit && !isRejected && (
        <p style={{ margin: "0.5rem 0 0", fontSize: "0.8rem", color: "#6B7280" }}>
          Current files: {booking.cargo_declaration_original_filename ?? "—"}
          {booking.terms_e_signed || booking.terms_agreed_at
            ? " · Terms: electronically signed"
            : booking.terms_agreement_original_filename
              ? ` · Terms: ${booking.terms_agreement_original_filename}`
              : ""}
        </p>
      )}

      {canResubmit && !compact && (
        <div style={{ marginTop: "0.85rem", display: "grid", gap: "0.65rem" }}>
          <p style={{ margin: 0, fontSize: "0.82rem", color: "#374151" }}>
            Upload a revised cargo declaration (JPEG, PNG, or PDF, max 5MB). Your electronic terms acceptance
            from booking remains on file.
          </p>
          <label style={{ display: "grid", gap: "0.25rem", fontSize: "0.82rem", fontWeight: 600 }}>
            Revised cargo declaration
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
              disabled={busy}
              onChange={(e) => {
                setCargoFile(e.target.files?.[0] ?? null);
                setErrors((prev) => ({ ...prev, cargo: undefined, form: undefined }));
              }}
            />
            {cargoFile && (
              <span style={{ fontWeight: 400, color: "#059669" }}>Selected: {cargoFile.name}</span>
            )}
            {errors.cargo && (
              <span style={{ color: "#B91C1C", fontWeight: 400 }}>{errors.cargo}</span>
            )}
          </label>
          {errors.form && (
            <p role="alert" style={{ margin: 0, color: "#B91C1C", fontSize: "0.82rem" }}>
              {errors.form}
            </p>
          )}
          {success && (
            <p role="status" style={{ margin: 0, color: "#047857", fontSize: "0.82rem", fontWeight: 600 }}>
              Documents submitted. Status is now Resubmitted — our team will review shortly.
            </p>
          )}
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={() => void submitResubmit()}
            style={{ justifySelf: "start", minHeight: 44, minWidth: 160 }}
          >
            {busy ? "Uploading…" : "Submit revised declaration"}
          </button>
        </div>
      )}

      {canResubmit && compact && (
        <Link
          href={`/modules/operations/trips?booking=${booking.id}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginTop: "0.55rem",
            padding: "0.55rem 0.9rem",
            borderRadius: 8,
            fontSize: "0.85rem",
            fontWeight: 700,
            color: "#fff",
            background: "#B45309",
            textDecoration: "none",
            minHeight: 44,
          }}
        >
          Open booking to resubmit
        </Link>
      )}

      {isRejected && (
        <div style={{ marginTop: "0.65rem", display: "flex", gap: "0.65rem", flexWrap: "wrap", alignItems: "center" }}>
          <p style={{ margin: 0, fontSize: "0.8rem", color: "#6B7280", flex: "1 1 180px" }}>
            Further document uploads are not available for this booking. Contact support if you need assistance.
          </p>
          <Link
            href={`/modules/customer/support?booking=${booking.id}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "0.5rem 0.85rem",
              borderRadius: 8,
              fontSize: "0.82rem",
              fontWeight: 700,
              color: "#991B1B",
              background: "#FEE2E2",
              textDecoration: "none",
              minHeight: 44,
            }}
          >
            Contact support
          </Link>
        </div>
      )}

      {payment && <PaymentReviewNotice payment={payment} bookingId={booking.id} />}
    </div>
  );
}
