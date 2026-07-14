"use client";

import { QRCodeSVG } from "qrcode.react";

type Props = {
  bookingId: number;
  payload?: string | null;
  /** Manual Verification Code fallback (same token encoded in the QR). */
  verificationCode?: string | null;
  verified?: boolean;
  verifiedAt?: string | null;
  compact?: boolean;
};

/** Customer-facing Booking Completion QR for helper verification at destination. */
export default function CustomerBookingQrCard({
  bookingId,
  payload,
  verificationCode = null,
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
        Booking Completion QR appears after payment is verified. Keep it available for the helper at delivery.
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
        Booking #{bookingId} Completion QR
      </div>
      <div className="booking-qr-wrap">
        <QRCodeSVG className="booking-qr-svg" value={payload} size={compact ? 128 : 168} level="M" includeMargin />
      </div>
      <p style={{ margin: 0, fontSize: "0.8rem", color: "#6B7280", textAlign: "center", lineHeight: 1.4 }}>
        {verified
          ? `Verified${verifiedAt ? ` · ${new Date(verifiedAt).toLocaleString()}` : ""}. Booking is completed.`
          : "Show this to your helper at the destination to complete the booking."}
      </p>
      {!verified ? (
        <div style={{ display: "grid", gap: 4, justifyItems: "center", width: "100%" }}>
          {verificationCode ? (
            <p
              style={{
                margin: 0,
                fontSize: "0.78rem",
                color: "#374151",
                textAlign: "center",
                lineHeight: 1.35,
              }}
            >
              Manual Verification Code:{" "}
              <code style={{ wordBreak: "break-all", fontWeight: 700 }}>{verificationCode}</code>
            </p>
          ) : null}
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
            Helper paste (full payload): {payload}
          </p>
        </div>
      ) : null}
    </div>
  );
}
