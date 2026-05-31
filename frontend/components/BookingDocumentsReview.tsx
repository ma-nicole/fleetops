"use client";

import AdminDocumentViewButton from "@/components/AdminDocumentViewButton";
import DocumentPreviewModal from "@/components/DocumentPreviewModal";
import { FILE_NOT_FOUND_MESSAGE } from "@/lib/documentFileTypes";
import { useDocumentPreview } from "@/lib/useDocumentPreview";
import type { Booking } from "@/lib/workflowApi";

export default function BookingDocumentsReview({
  booking,
}: {
  booking: Pick<
    Booking,
    | "id"
    | "cargo_declaration_original_filename"
    | "cargo_declaration_file_url"
    | "terms_agreement_original_filename"
    | "terms_agreement_file_url"
  >;
}) {
  const { preview, error, busy, closePreview, openDocument, openInNewTab, clearError } =
    useDocumentPreview();

  const hasDecl = !!(booking.cargo_declaration_file_url || booking.cargo_declaration_original_filename);
  const hasTerms = !!(booking.terms_agreement_file_url || booking.terms_agreement_original_filename);

  const viewDeclaration = () =>
    void openDocument({
      fileName: booking.cargo_declaration_original_filename,
      staticUrl: booking.cargo_declaration_file_url,
      apiPath: `/bookings/${booking.id}/documents/cargo-declaration`,
    });

  const viewTerms = () =>
    void openDocument({
      fileName: booking.terms_agreement_original_filename,
      staticUrl: booking.terms_agreement_file_url,
      apiPath: `/bookings/${booking.id}/documents/terms-agreement`,
    });

  return (
    <>
      <div style={{ display: "grid", gap: "0.65rem" }}>
        <p style={{ margin: 0, fontSize: "0.85rem", color: "#374151", fontWeight: 600 }}>
          Booking documents {hasDecl && hasTerms ? "· ready for review" : "· incomplete"}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          <AdminDocumentViewButton
            label="declaration"
            fileName={booking.cargo_declaration_original_filename}
            staticUrl={booking.cargo_declaration_file_url}
            apiPath={`/bookings/${booking.id}/documents/cargo-declaration`}
            busy={busy}
            onView={viewDeclaration}
          />
          <AdminDocumentViewButton
            label="terms"
            fileName={booking.terms_agreement_original_filename}
            staticUrl={booking.terms_agreement_file_url}
            apiPath={`/bookings/${booking.id}/documents/terms-agreement`}
            busy={busy}
            onView={viewTerms}
          />
        </div>
        {error && (
          <p style={{ margin: 0, fontSize: "0.8rem", color: "#B45309" }} role="alert">
            {error}{" "}
            <button
              type="button"
              onClick={clearError}
              style={{
                border: "none",
                background: "transparent",
                color: "var(--brand-text)",
                cursor: "pointer",
                fontSize: "0.8rem",
                textDecoration: "underline",
              }}
            >
              Dismiss
            </button>
          </p>
        )}
        {!hasDecl && !hasTerms && (
          <p style={{ margin: 0, fontSize: "0.75rem", color: "#B45309" }}>{FILE_NOT_FOUND_MESSAGE}</p>
        )}
      </div>
      {preview && (
        <DocumentPreviewModal preview={preview} onClose={closePreview} onOpenInNewTab={openInNewTab} />
      )}
    </>
  );
}
