"use client";

import BookingDocumentUploadFields from "@/components/BookingDocumentUploadFields";
import type { FormErrors } from "./wizardTypes";

type Props = {
  cargoDeclaration: File | null;
  termsAgreement: File | null;
  termsAccepted: boolean;
  disabled: boolean;
  errors: FormErrors;
  onCargoDeclarationChange: (file: File | null) => void;
  onTermsAgreementChange: (file: File | null) => void;
  onTermsAcceptedChange: (accepted: boolean) => void;
  onClearError: (key: string) => void;
};

export default function DocumentsStep({
  cargoDeclaration,
  termsAgreement,
  termsAccepted,
  disabled,
  errors,
  onCargoDeclarationChange,
  onTermsAgreementChange,
  onTermsAcceptedChange,
  onClearError,
}: Props) {
  return (
    <div className="booking-wizard-step">
      <BookingDocumentUploadFields
        cargoDeclaration={cargoDeclaration}
        termsAgreement={termsAgreement}
        termsAccepted={termsAccepted}
        onCargoDeclarationChange={(file) => {
          onCargoDeclarationChange(file);
          onClearError("cargo_declaration");
        }}
        onTermsAgreementChange={(file) => {
          onTermsAgreementChange(file);
          onClearError("terms_agreement");
        }}
        onTermsAcceptedChange={(accepted) => {
          onTermsAcceptedChange(accepted);
          onClearError("terms_accepted");
        }}
        disabled={disabled}
        errors={{
          cargo_declaration: errors.cargo_declaration,
          terms_agreement: errors.terms_agreement,
          terms_accepted: errors.terms_accepted,
        }}
      />
    </div>
  );
}
