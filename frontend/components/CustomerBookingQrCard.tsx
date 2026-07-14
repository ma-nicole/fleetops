"use client";

import { QRCodeSVG } from "qrcode.react";

type Props = {
  bookingId: number;
  payload?: string | null;
  verified?: boolean;
  verifiedAt?: string | null;
  compact?: boolean;
};

/** Customer-facing booking QR for helper verification before trip start. */
export default function CustomerBookingQrCard({
  bookingId,
  payload,
  verified = false,
  verifiedAt = null,
  compact = false,
}: Props) {
  if (!payload) {
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
        Booking QR appears after payment is verified. Show it to the helper before trip start.
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
        Booking #{bookingId} helper QR
      </div>
      <QRCodeSVG value={payload} size={compact ? 128 : 168} level="M" includeMargin />
      <p style={{ margin: 0, fontSize: "0.8rem", color: "#6B7280", textAlign: "center", lineHeight: 1.4 }}>
        {verified
          ? `Verified${verifiedAt ? ` · ${new Date(verifiedAt).toLocaleString()}` : ""}. Helper may start the trip.`
          : "Ask your assigned helper to scan this code before starting the trip."}
      </p>
      {!verified ? (
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
          Code for helper paste: {payload}
        </p>
      ) : null}
    </div>
  );
}
