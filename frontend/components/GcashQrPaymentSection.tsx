"use client";

import { useState } from "react";
import { formatPhp } from "@/lib/appLocale";
import { GCASH_PAYMENT_STEPS, gcashQrImageUrl } from "@/lib/gcashPaymentConfig";
import { GCASH_MAX_TRANSACTION_PHP } from "@/lib/paymentLimits";

type Props = {
  bookingId: number;
  total: number;
};

export default function GcashQrPaymentSection({ bookingId, total }: Props) {
  const [qrError, setQrError] = useState(false);
  const qrSrc = gcashQrImageUrl();

  return (
    <div
      style={{
        display: "grid",
        gap: "1rem",
        padding: "1rem",
        border: "1px solid #BFDBFE",
        borderRadius: "10px",
        background: "linear-gradient(180deg, #EFF6FF 0%, #FFFFFF 100%)",
      }}
    >
      <div>
        <h4 style={{ margin: "0 0 0.35rem 0", color: "#1E3A8A" }}>Step 1 — Scan GCash QR</h4>
        <p style={{ margin: 0, fontSize: "0.88rem", color: "#475569", lineHeight: 1.5 }}>
          Open the GCash app, tap <strong>Scan</strong>, and pay the exact amount below. Payment is{" "}
          <strong>not confirmed automatically</strong> — an administrator must verify your uploaded proof.
        </p>
      </div>

      <ol
        style={{
          margin: 0,
          paddingLeft: "1.2rem",
          fontSize: "0.85rem",
          color: "#374151",
          display: "grid",
          gap: "0.35rem",
        }}
      >
        {GCASH_PAYMENT_STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "1.25rem",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            padding: "0.75rem",
            background: "#fff",
            border: "2px solid #007cff",
            borderRadius: "12px",
            boxShadow: "0 4px 14px rgba(0, 124, 255, 0.12)",
          }}
        >
          {!qrError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrSrc}
              alt="FleetOps GCash QR code"
              width={220}
              height={220}
              style={{ display: "block", width: 220, height: 220, objectFit: "contain" }}
              onError={() => setQrError(true)}
            />
          ) : (
            <div
              style={{
                width: 220,
                height: 220,
                display: "grid",
                placeItems: "center",
                textAlign: "center",
                padding: "1rem",
                fontSize: "0.85rem",
                color: "#6B7280",
              }}
            >
              GCash QR is temporarily unavailable. Contact FleetOps support for payment details.
            </div>
          )}
        </div>

        <div style={{ minWidth: 180, fontSize: "0.9rem", color: "#374151" }}>
          <p style={{ margin: "0 0 0.5rem 0" }}>
            <strong>Amount to pay:</strong>{" "}
            <span style={{ color: "#FF9800", fontWeight: 700 }}>{formatPhp(total)}</span>
          </p>
          <p style={{ margin: "0 0 0.5rem 0" }}>
            <strong>Booking reference:</strong> #{bookingId}
          </p>
          <p style={{ margin: 0, fontSize: "0.82rem", color: "#6B7280" }}>
            GCash limit: {formatPhp(GCASH_MAX_TRANSACTION_PHP)} per transaction
          </p>
        </div>
      </div>

      <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748B" }}>
        Only scan QR codes issued by FleetOps. After paying, continue to <strong>Step 2</strong> below to upload your
        payment proof.
      </p>
    </div>
  );
}
