"use client";

import BookingDocumentUploadFields from "@/components/BookingDocumentUploadFields";
import type { FormErrors } from "./wizardTypes";

type Props = {
  cargoDeclaration: File | null;
  termsSignature: File | null;
  termsAccepted: boolean;
  termsScrolled: boolean;
  disabled: boolean;
  errors: FormErrors;
  onCargoDeclarationChange: (file: File | null) => void;
  onTermsSignatureChange: (file: File | null) => void;
  onTermsAcceptedChange: (accepted: boolean) => void;
  onTermsScrolledChange: (scrolled: boolean) => void;
  onClearError: (key: string) => void;
};

export default function DocumentsStep({
  cargoDeclaration,
  termsSignature,
  termsAccepted,
  termsScrolled,
  disabled,
  errors,
  onCargoDeclarationChange,
  onTermsSignatureChange,
  onTermsAcceptedChange,
  onTermsScrolledChange,
  onClearError,
}: Props) {
  return (
    <div className="booking-wizard-step">
      <BookingDocumentUploadFields
        cargoDeclaration={cargoDeclaration}
        termsSignature={termsSignature}
        termsAccepted={termsAccepted}
        termsScrolled={termsScrolled}
        onCargoDeclarationChange={(file) => {
          onCargoDeclarationChange(file);
          onClearError("cargo_declaration");
        }}
        onTermsSignatureChange={(file) => {
          onTermsSignatureChange(file);
          onClearError("terms_signature");
        }}
        onTermsAcceptedChange={(accepted) => {
          onTermsAcceptedChange(accepted);
          onClearError("terms_accepted");
        }}
        onTermsScrolledChange={(scrolled) => {
          onTermsScrolledChange(scrolled);
          onClearError("terms_read");
        }}
        onClearError={onClearError}
        disabled={disabled}
        errors={{
          cargo_declaration: errors.cargo_declaration,
          terms_signature: errors.terms_signature,
          terms_accepted: errors.terms_accepted,
          terms_read: errors.terms_read,
        }}
      />
    </div>
  );
}
