"use client";

import { useCallback, useRef, useState } from "react";
import DigitalSignaturePad from "@/components/DigitalSignaturePad";
import { FLEETOPT_TERMS_SECTIONS, FLEETOPT_TERMS_VERSION } from "@/lib/fleetoptTermsAgreement";

type Props = {
  termsAccepted: boolean;
  signatureFile: File | null;
  termsScrolled: boolean;
  disabled?: boolean;
  errors?: {
    terms_read?: string;
    terms_signature?: string;
    terms_accepted?: string;
  };
  onTermsAcceptedChange: (accepted: boolean) => void;
  onSignatureChange: (file: File | null) => void;
  onTermsScrolledChange: (scrolled: boolean) => void;
  onClearError?: (key: string) => void;
};

export default function TermsAgreementPanel({
  termsAccepted,
  signatureFile,
  termsScrolled,
  disabled,
  errors,
  onTermsAcceptedChange,
  onSignatureChange,
  onTermsScrolledChange,
  onClearError,
}: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollHint, setScrollHint] = useState("Scroll through the full agreement to continue.");

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 24;
    if (atBottom && !termsScrolled) {
      onTermsScrolledChange(true);
      onClearError?.("terms_read");
      setScrollHint("You have reached the end of the agreement.");
    }
  }, [termsScrolled, onTermsScrolledChange, onClearError]);

  const canSign = termsScrolled && !disabled;

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div>
        <h3 style={{ margin: "0 0 0.35rem 0", fontSize: "1rem" }}>FleetOpt Terms &amp; Agreement</h3>
        <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>
          Read the agreement below, sign electronically, and confirm acceptance. Version: {FLEETOPT_TERMS_VERSION}
        </p>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        role="region"
        aria-label="FleetOpt Terms and Agreement"
        style={{
          maxHeight: 280,
          overflowY: "auto",
          padding: "1rem",
          borderRadius: 10,
          border: "1px solid #D1D5DB",
          background: "#FFFFFF",
          fontSize: "0.86rem",
          lineHeight: 1.55,
          color: "#1F2937",
        }}
      >
        {FLEETOPT_TERMS_SECTIONS.map((section) => (
          <section key={section.title} style={{ marginBottom: "1rem" }}>
            <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.92rem", color: "#111827" }}>{section.title}</h4>
            {section.paragraphs.map((p) => (
              <p key={p.slice(0, 40)} style={{ margin: "0 0 0.65rem" }}>
                {p}
              </p>
            ))}
          </section>
        ))}
      </div>

      <p style={{ margin: 0, fontSize: "0.8rem", color: termsScrolled ? "#047857" : "#B45309", fontWeight: 600 }}>
        {scrollHint}
      </p>
      {errors?.terms_read ? (
        <p style={{ margin: 0, fontSize: "0.8rem", color: "#DC2626" }}>{errors.terms_read}</p>
      ) : null}

      <div style={{ opacity: canSign ? 1 : 0.55, pointerEvents: canSign ? "auto" : "none" }}>
        <p style={{ margin: "0 0 0.5rem", fontSize: "0.9rem", fontWeight: 600 }}>Electronic signature</p>
        <DigitalSignaturePad
          disabled={!canSign}
          value={signatureFile}
          onChange={(file) => {
            onSignatureChange(file);
            onClearError?.("terms_signature");
          }}
        />
        {signatureFile ? (
          <p style={{ margin: "0.35rem 0 0", fontSize: "0.8rem", color: "#059669" }}>
            Signature captured: {signatureFile.name}
          </p>
        ) : null}
        {errors?.terms_signature ? (
          <p style={{ margin: "0.35rem 0 0", fontSize: "0.8rem", color: "#DC2626" }}>{errors.terms_signature}</p>
        ) : null}
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "0.5rem",
          fontSize: "0.9rem",
          cursor: disabled || !canSign || !signatureFile ? "not-allowed" : "pointer",
          opacity: disabled || !canSign || !signatureFile ? 0.55 : 1,
        }}
      >
        <input
          type="checkbox"
          checked={termsAccepted}
          disabled={disabled || !canSign || !signatureFile}
          onChange={(e) => {
            onTermsAcceptedChange(e.target.checked);
            onClearError?.("terms_accepted");
          }}
          style={{ marginTop: "0.2rem" }}
        />
        <span>
          I have read the FleetOpt Terms &amp; Agreement, I agree to be bound by its terms, and I authorize FleetOpt to
          store my electronic signature with this booking.
        </span>
      </label>
      {errors?.terms_accepted ? (
        <p style={{ color: "#F44336", fontSize: "0.8rem", margin: 0 }}>{errors.terms_accepted}</p>
      ) : null}
    </div>
  );
}
