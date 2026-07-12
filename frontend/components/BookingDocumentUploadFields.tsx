"use client";

import TermsAgreementPanel from "@/components/booking/TermsAgreementPanel";

const ALLOWED_EXT = [".jpg", ".jpeg", ".png", ".pdf"];
const MAX_BYTES = 5 * 1024 * 1024;

export function validateBookingDocumentFile(file: File | null): string | null {
  if (!file) return "This document is required.";
  const lower = file.name.toLowerCase();
  const extOk = ALLOWED_EXT.some((ext) => lower.endsWith(ext));
  if (!extOk) return "Only JPEG, PNG, and PDF files are allowed.";
  if (file.type && !["image/jpeg", "image/png", "application/pdf"].includes(file.type)) {
    return "Only JPEG, PNG, and PDF files are allowed.";
  }
  if (file.size > MAX_BYTES) return "File must not exceed 5MB.";
  return null;
}

type BookingDocumentUploadFieldsProps = {
  cargoDeclaration: File | null;
  termsSignature: File | null;
  termsAccepted: boolean;
  termsScrolled: boolean;
  onCargoDeclarationChange: (file: File | null) => void;
  onTermsSignatureChange: (file: File | null) => void;
  onTermsAcceptedChange: (accepted: boolean) => void;
  onTermsScrolledChange: (scrolled: boolean) => void;
  onClearError?: (key: string) => void;
  disabled?: boolean;
  errors?: {
    cargo_declaration?: string;
    terms_signature?: string;
    terms_accepted?: string;
    terms_read?: string;
  };
};

export default function BookingDocumentUploadFields({
  cargoDeclaration,
  termsSignature,
  termsAccepted,
  termsScrolled,
  onCargoDeclarationChange,
  onTermsSignatureChange,
  onTermsAcceptedChange,
  onTermsScrolledChange,
  onClearError,
  disabled,
  errors,
}: BookingDocumentUploadFieldsProps) {
  const pickFile = (
    e: React.ChangeEvent<HTMLInputElement>,
    onChange: (file: File | null) => void,
    errorKey?: string,
  ) => {
    const file = e.target.files?.[0] ?? null;
    onChange(file);
    if (file && errorKey) onClearError?.(errorKey);
  };

  return (
    <div
      style={{
        display: "grid",
        gap: "1.25rem",
        padding: "1rem",
        borderRadius: "10px",
        border: "1px solid var(--border, #E8E8E8)",
        background: "rgba(249, 250, 251, 0.8)",
      }}
    >
      <div>
        <h3 style={{ margin: "0 0 0.35rem 0", fontSize: "1rem" }}>Required documents</h3>
        <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.45 }}>
          Two steps: (1) choose your Cargo Declaration file, (2) scroll, sign, and accept Terms. Going back in the
          wizard keeps these selections.
        </p>
      </div>

      <div>
        <label
          htmlFor="booking-cargo-declaration"
          style={{ display: "block", fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.4rem" }}
        >
          Cargo Declaration Sheet <span style={{ color: "#DC2626" }}>*</span>
        </label>
        <p style={{ margin: "0 0 0.5rem", fontSize: "0.8rem", color: "#6B7280" }}>
          JPEG, PNG, or PDF — max 5MB. One file is enough.
        </p>
        <input
          id="booking-cargo-declaration"
          type="file"
          accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
          disabled={disabled}
          onChange={(e) => pickFile(e, onCargoDeclarationChange, "cargo_declaration")}
          style={{
            display: "block",
            width: "100%",
            maxWidth: "100%",
            boxSizing: "border-box",
            padding: "0.55rem 0.65rem",
            borderRadius: 8,
            border: errors?.cargo_declaration ? "1px solid #F44336" : "1px solid #D1D5DB",
            background: "#fff",
            font: "inherit",
          }}
        />
        {cargoDeclaration ? (
          <p style={{ margin: "0.45rem 0 0 0", fontSize: "0.85rem", color: "#059669", fontWeight: 600 }}>
            Ready: {cargoDeclaration.name}
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                onCargoDeclarationChange(null);
                const el = document.getElementById("booking-cargo-declaration") as HTMLInputElement | null;
                if (el) el.value = "";
              }}
              style={{
                marginLeft: "0.65rem",
                border: "none",
                background: "transparent",
                color: "#991B1B",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: "0.8rem",
                textDecoration: "underline",
              }}
            >
              Remove
            </button>
          </p>
        ) : (
          <p style={{ margin: "0.35rem 0 0", fontSize: "0.8rem", color: "#9CA3AF" }}>No file selected yet.</p>
        )}
        {errors?.cargo_declaration ? (
          <p style={{ color: "#F44336", fontSize: "0.8rem", margin: "0.35rem 0 0 0" }}>{errors.cargo_declaration}</p>
        ) : null}
      </div>

      <TermsAgreementPanel
        termsAccepted={termsAccepted}
        signatureFile={termsSignature}
        termsScrolled={termsScrolled}
        disabled={disabled}
        errors={{
          terms_read: errors?.terms_read,
          terms_signature: errors?.terms_signature,
          terms_accepted: errors?.terms_accepted,
        }}
        onTermsAcceptedChange={onTermsAcceptedChange}
        onSignatureChange={onTermsSignatureChange}
        onTermsScrolledChange={onTermsScrolledChange}
        onClearError={onClearError}
      />
    </div>
  );
}
