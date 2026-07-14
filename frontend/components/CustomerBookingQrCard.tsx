"use client";

import { QRCodeSVG } from "qrcode.react";

type Props = {
  bookingId: number;
  payload?: string | null;
  /** Prefer showing the short Delivery Verification code when available. */
  verificationCode?: string | null;
  verified?: boolean;
  verifiedAt?: string | null;
  compact?: boolean;
};

/**
 * Customer confirmation credential for helper completion.
 * Prefers Delivery Verification payload/code (same as dashboard Delivery Verification section).
 */
export default function CustomerBookingQrCard({
  bookingId,
  payload,
  verificationCode = null,
  verified = false,
  verifiedAt = null,
  compact = false,
}: Props) {
  if (!payload && !verificationCode) {
    return (
      <div
        style={{
          border: "1px dashed #D1D5DB",
          borderRadius: 10,
          padding: compact ? "0.75rem" : "1rem",
          background: "#F9FAFB",
          fontSize: "0.85rem",
          color: "#6B7280",
        }}
      >
        Delivery Verification appears after payment is verified. Keep the code ready for the helper at delivery.
      </div>
    );
  }

  return (
    <div
      style={{
        border: "1px solid #E5E7EB",
        borderRadius: 10,
        padding: compact ? "0.75rem" : "1rem",
        background: "#fff",
        display: "grid",
        gap: "0.65rem",
        justifyItems: "center",
      }}
    >
      <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#111827", textAlign: "center" }}>
        Booking #{bookingId} Delivery Verification
      </div>
      {payload ? <QRCodeSVG value={payload} size={compact ? 128 : 168} level="M" includeMargin /> : null}
      <p style={{ margin: 0, fontSize: "0.8rem", color: "#6B7280", textAlign: "center", lineHeight: 1.4 }}>
        {verified
          ? `Verified${verifiedAt ? ` · ${new Date(verifiedAt).toLocaleString()}` : ""}. Booking is completed.`
          : "Show this QR or read the Verification Code to your helper at the destination."}
      </p>
      {!verified && verificationCode ? (
        <p
          style={{
            margin: 0,
            fontSize: "1rem",
            color: "#312E81",
            textAlign: "center",
            fontWeight: 800,
            letterSpacing: "0.12em",
            background: "#EEF2FF",
            padding: "0.45rem 0.75rem",
            borderRadius: 8,
          }}
        >
          {verificationCode}
        </p>
      ) : null}
      {!verified && !verificationCode && payload ? (
        <p
          style={{
            margin: 0,
            fontSize: "0.72rem",
            color: "#9CA3AF",
            textAlign: "center",
            wordBreak: "break-all",
            lineHeight: 1.35,
          }}
        >
          Helper paste: {payload}
        </p>
      ) : null}
    </div>
  );
}
