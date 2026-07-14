"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { formatPhp } from "@/lib/appLocale";
import { GCASH_PAYMENT_STEPS, gcashQrImageUrl } from "@/lib/gcashPaymentConfig";
import { GCASH_MAX_TRANSACTION_PHP } from "@/lib/paymentLimits";

type Props = {
  bookingId: number;
  total: number;
  /** When set, render the Xendit dynamic QR instead of the static merchant image. */
  xenditQrString?: string | null;
  xenditStatus?: string | null;
  xenditLoading?: boolean;
  xenditError?: string | null;
  onRetryXendit?: () => void;
};

export default function GcashQrPaymentSection({
  bookingId,
  total,
  xenditQrString,
  xenditStatus,
  xenditLoading = false,
  xenditError,
  onRetryXendit,
}: Props) {
  const [qrError, setQrError] = useState(false);
  const qrSrc = gcashQrImageUrl();
  const useXendit = Boolean(xenditQrString);
  const statusUpper = (xenditStatus || "").toUpperCase();
  const isPaid = statusUpper === "PAID";
  const isPending = !statusUpper || statusUpper === "PENDING";
  const isExpired = statusUpper === "EXPIRED";
  const isFailed = statusUpper === "FAILED";

  useEffect(() => {
    setQrError(false);
  }, [xenditQrString, qrSrc]);

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
        <h4 style={{ margin: "0 0 0.35rem 0", color: "#1E3A8A" }}>
          {useXendit ? "Step 1 — Scan GCash QR (Xendit)" : "Step 1 — Scan GCash QR"}
        </h4>
        <p style={{ margin: 0, fontSize: "0.88rem", color: "#475569", lineHeight: 1.5 }}>
          {useXendit ? (
            <>
              Open GCash, tap <strong>Scan</strong>, and pay the exact amount below. Payment is verified{" "}
              <strong>automatically</strong> — no screenshot upload required.
            </>
          ) : (
            <>
              Open the GCash app, tap <strong>Scan</strong>, and pay the exact amount below. Payment is{" "}
              <strong>not confirmed automatically</strong> — an administrator must verify your uploaded proof.
            </>
          )}
        </p>
      </div>

      {useXendit && isPaid ? (
        <div
          role="status"
          style={{
            padding: "0.85rem 1rem",
            background: "#D1FAE5",
            border: "1px solid #6EE7B7",
            borderRadius: "8px",
            color: "#047857",
            fontSize: "0.9rem",
            fontWeight: 600,
          }}
        >
          Payment received. Your booking is being marked as payment verified.
        </div>
      ) : null}

      {useXendit && isExpired ? (
        <div
          role="alert"
          style={{
            padding: "0.85rem 1rem",
            background: "#FEF3C7",
            border: "1px solid #FCD34D",
            borderRadius: "8px",
            color: "#92400E",
            fontSize: "0.9rem",
          }}
        >
          This QR code has expired.{" "}
          {onRetryXendit ? (
            <button type="button" onClick={onRetryXendit} style={{ fontWeight: 700, color: "#B45309" }}>
              Generate a new QR
            </button>
          ) : null}
        </div>
      ) : null}

      {useXendit && isFailed ? (
        <div role="alert" style={{ padding: "0.85rem 1rem", background: "#FEE2E2", borderRadius: "8px", color: "#991B1B" }}>
          Payment failed. Please try again or contact support.
        </div>
      ) : null}

      {xenditError ? (
        <div role="alert" style={{ padding: "0.85rem 1rem", background: "#FEE2E2", borderRadius: "8px", color: "#991B1B" }}>
          {xenditError}
        </div>
      ) : null}

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
          className="booking-qr-wrap"
          style={{
            padding: "0.75rem",
            background: "#fff",
            border: "2px solid #007cff",
            borderRadius: "12px",
            boxShadow: "0 4px 14px rgba(0, 124, 255, 0.12)",
            width: "min(100%, 240px)",
            minHeight: 180,
            display: "grid",
            placeItems: "center",
          }}
        >
          {xenditLoading ? (
            <span style={{ fontSize: "0.85rem", color: "#6B7280" }}>Generating QR…</span>
          ) : useXendit && xenditQrString && isPending ? (
            <QRCodeSVG className="booking-qr-svg" value={xenditQrString} size={220} level="M" includeMargin />
          ) : !useXendit && !qrError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrSrc}
              alt="FleetOps GCash QR code"
              width={220}
              height={220}
              style={{ display: "block", width: "100%", maxWidth: 220, height: "auto", aspectRatio: "1", objectFit: "contain" }}
              onError={() => setQrError(true)}
            />
          ) : (
            <div
              style={{
                width: "100%",
                maxWidth: 220,
                aspectRatio: "1",
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

        <div style={{ minWidth: 0, flex: "1 1 180px", fontSize: "0.9rem", color: "#374151" }}>
          <p style={{ margin: "0 0 0.5rem 0" }}>
            <strong>Amount to pay:</strong>{" "}
            <span style={{ color: "#FF9800", fontWeight: 700 }}>{formatPhp(total)}</span>
          </p>
          <p style={{ margin: "0 0 0.5rem 0" }}>
            <strong>Booking reference:</strong> #{bookingId}
          </p>
          {useXendit && xenditStatus ? (
            <p style={{ margin: "0 0 0.5rem 0" }}>
              <strong>Payment status:</strong> {xenditStatus}
            </p>
          ) : null}
          <p style={{ margin: 0, fontSize: "0.82rem", color: "#6B7280" }}>
            GCash limit: {formatPhp(GCASH_MAX_TRANSACTION_PHP)} per transaction
          </p>
        </div>
      </div>

      <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748B" }}>
        {useXendit
          ? "Scan only the QR shown here for this booking. Do not reuse QR codes from other channels."
          : "Only scan QR codes issued by FleetOps. After paying, continue to Step 2 below to upload your payment proof."}
      </p>
    </div>
  );
}
