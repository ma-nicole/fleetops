"use client";

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
  termsAgreement: File | null;
  termsAccepted: boolean;
  onCargoDeclarationChange: (file: File | null) => void;
  onTermsAgreementChange: (file: File | null) => void;
  onTermsAcceptedChange: (accepted: boolean) => void;
  disabled?: boolean;
  errors?: {
    cargo_declaration?: string;
    terms_agreement?: string;
    terms_accepted?: string;
  };
};

export default function BookingDocumentUploadFields({
  cargoDeclaration,
  termsAgreement,
  termsAccepted,
  onCargoDeclarationChange,
  onTermsAgreementChange,
  onTermsAcceptedChange,
  disabled,
  errors,
}: BookingDocumentUploadFieldsProps) {
  const pickFile = (
    e: React.ChangeEvent<HTMLInputElement>,
    onChange: (file: File | null) => void,
  ) => {
    const file = e.target.files?.[0] ?? null;
    onChange(file);
  };

  return (
    <div
      style={{
        display: "grid",
        gap: "1rem",
        padding: "1rem",
        borderRadius: "10px",
        border: "1px solid var(--border, #E8E8E8)",
        background: "rgba(249, 250, 251, 0.8)",
      }}
    >
      <div>
        <h3 style={{ margin: "0 0 0.35rem 0", fontSize: "1rem" }}>Required documents</h3>
        <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>
          Upload your Cargo Declaration Sheet and signed Terms &amp; Agreement before confirming the booking.
        </p>
      </div>

      <div>
        <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.4rem" }}>
          Cargo Declaration Sheet <span style={{ color: "#DC2626" }}>*</span>
        </label>
        <input
          type="file"
          accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
          disabled={disabled}
          onChange={(e) => pickFile(e, onCargoDeclarationChange)}
          style={errors?.cargo_declaration ? { borderColor: "#F44336" } : undefined}
        />
        {cargoDeclaration && (
          <p style={{ margin: "0.35rem 0 0 0", fontSize: "0.8rem", color: "#059669" }}>
            Selected: {cargoDeclaration.name}
          </p>
        )}
        {errors?.cargo_declaration && (
          <p style={{ color: "#F44336", fontSize: "0.8rem", margin: "0.35rem 0 0 0" }}>{errors.cargo_declaration}</p>
        )}
      </div>

      <div>
        <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.4rem" }}>
          Terms &amp; Agreement (signed) <span style={{ color: "#DC2626" }}>*</span>
        </label>
        <input
          type="file"
          accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
          disabled={disabled}
          onChange={(e) => pickFile(e, onTermsAgreementChange)}
          style={errors?.terms_agreement ? { borderColor: "#F44336" } : undefined}
        />
        {termsAgreement && (
          <p style={{ margin: "0.35rem 0 0 0", fontSize: "0.8rem", color: "#059669" }}>
            Selected: {termsAgreement.name}
          </p>
        )}
        {errors?.terms_agreement && (
          <p style={{ color: "#F44336", fontSize: "0.8rem", margin: "0.35rem 0 0 0" }}>{errors.terms_agreement}</p>
        )}
      </div>

      <label style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", fontSize: "0.9rem", cursor: disabled ? "not-allowed" : "pointer" }}>
        <input
          type="checkbox"
          checked={termsAccepted}
          disabled={disabled}
          onChange={(e) => onTermsAcceptedChange(e.target.checked)}
          style={{ marginTop: "0.2rem" }}
        />
        <span>
          I have read and accept the FleetOpt Terms &amp; Agreement for this shipment.
        </span>
      </label>
      {errors?.terms_accepted && (
        <p style={{ color: "#F44336", fontSize: "0.8rem", margin: 0 }}>{errors.terms_accepted}</p>
      )}
    </div>
  );
}
