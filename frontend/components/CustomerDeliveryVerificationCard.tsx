"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

type Props = {
  bookingId: number;
  payload?: string | null;
  verificationCode?: string | null;
  active?: boolean;
  used?: boolean;
  usedAt?: string | null;
};

export default function CustomerDeliveryVerificationCard({
  bookingId,
  payload,
  verificationCode,
  active = false,
  used = false,
  usedAt = null,
}: Props) {
  const [copied, setCopied] = useState(false);

  if (used) {
    return (
      <article style={{ border: "1px solid #BBF7D0", borderRadius: 12, padding: "1rem", background: "#F0FDF4" }}>
        <strong style={{ color: "#166534" }}>Booking #{bookingId} delivery verified</strong>
        <p style={{ margin: "0.35rem 0 0", color: "#166534", fontSize: "0.85rem" }}>
          This credential is disabled{usedAt ? ` since ${new Date(usedAt).toLocaleString()}` : ""}.
        </p>
      </article>
    );
  }

  if (!active || !payload || !verificationCode) return null;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(verificationCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <article
      style={{
        border: "1px solid #C7D2FE",
        borderRadius: 12,
        padding: "1rem",
        background: "#fff",
        display: "grid",
        gap: "0.9rem",
        gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
        alignItems: "center",
      }}
    >
      <div style={{ display: "grid", justifyItems: "center", gap: 6 }}>
        <QRCodeSVG value={payload} size={145} level="M" includeMargin aria-label={`Delivery QR for booking ${bookingId}`} />
        <span style={{ fontSize: "0.76rem", color: "#64748B" }}>Booking #{bookingId}</span>
      </div>
      <div style={{ minWidth: 0 }}>
        <strong style={{ color: "#111827" }}>Present this only at the destination</strong>
        <p style={{ color: "#475569", fontSize: "0.86rem", lineHeight: 1.5, margin: "0.4rem 0 0.8rem" }}>
          Ask the assigned helper to scan this QR after your shipment arrives. If scanning is unavailable, provide the backup code.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <code style={{ padding: "0.55rem 0.7rem", borderRadius: 8, background: "#EEF2FF", color: "#312E81", fontSize: "1.1rem", fontWeight: 800, letterSpacing: "0.12em" }}>
            {verificationCode}
          </code>
          <button type="button" className="button" onClick={() => void copyCode()} style={{ minHeight: 0, padding: "0.5rem 0.75rem" }}>
            {copied ? "Copied" : "Copy code"}
          </button>
        </div>
      </div>
    </article>
  );
}
