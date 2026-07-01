"use client";

import { QRCodeSVG } from "qrcode.react";
import { formatPhp } from "@/lib/appLocale";
import {
  formatPaymentExpiry,
  formatXenditStatusLabel,
  openGcashApp,
  XENDIT_GCASH_PAYMENT_STEPS,
} from "@/lib/xenditPaymentUi";
import type { Payment } from "@/lib/workflowApi";
import LoadingMessage from "@/components/ui/LoadingMessage";

type Props = {
  bookingId: number;
  amount: number;
  pickup?: string;
  dropoff?: string;
  scheduledDate?: string;
  qrString: string | null;
  xenditStatus: string | null;
  payment: Payment | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
};

function statusTone(status: string | null | undefined): { bg: string; border: string; color: string } {
  switch ((status || "").toUpperCase()) {
    case "PAID":
      return { bg: "#D1FAE5", border: "#6EE7B7", color: "#047857" };
    case "EXPIRED":
      return { bg: "#FEF3C7", border: "#FCD34D", color: "#92400E" };
    case "FAILED":
      return { bg: "#FEE2E2", border: "#FECACA", color: "#991B1B" };
    default:
      return { bg: "#EFF6FF", border: "#BFDBFE", color: "#1E40AF" };
  }
}

export default function XenditPaymentCard({
  bookingId,
  amount,
  pickup,
  dropoff,
  scheduledDate,
  qrString,
  xenditStatus,
  payment,
  loading = false,
  error,
  onRetry,
}: Props) {
  const statusUpper = (xenditStatus || "").toUpperCase();
  const isPaid = statusUpper === "PAID" || payment?.status === "verified";
  const isPending = !statusUpper || statusUpper === "PENDING";
  const isExpired = statusUpper === "EXPIRED";
  const isFailed = statusUpper === "FAILED";
  const tone = statusTone(isPaid ? "PAID" : xenditStatus);

  const xenditRef =
    payment?.xendit_external_id || payment?.xendit_qr_id || payment?.reference || null;
  const expiresAt = payment?.xendit_expires_at ?? null;

  return (
    <article className="xendit-payment-card">
      <header className="xendit-payment-card__header">
        <div>
          <p className="xendit-payment-card__eyebrow">GCash via Xendit</p>
          <h2 className="xendit-payment-card__title">Booking #{bookingId}</h2>
        </div>
        <div
          className="xendit-payment-card__status"
          style={{ background: tone.bg, borderColor: tone.border, color: tone.color }}
          role="status"
        >
          {formatXenditStatusLabel(isPaid ? "PAID" : xenditStatus)}
        </div>
      </header>

      <dl className="xendit-payment-card__summary">
        {pickup ? (
          <div className="xendit-payment-card__row">
            <dt>From</dt>
            <dd>{pickup}</dd>
          </div>
        ) : null}
        {dropoff ? (
          <div className="xendit-payment-card__row">
            <dt>To</dt>
            <dd>{dropoff}</dd>
          </div>
        ) : null}
        {scheduledDate ? (
          <div className="xendit-payment-card__row">
            <dt>Schedule</dt>
            <dd>{scheduledDate}</dd>
          </div>
        ) : null}
        <div className="xendit-payment-card__row xendit-payment-card__row--amount">
          <dt>Amount due</dt>
          <dd>{formatPhp(amount)}</dd>
        </div>
        <div className="xendit-payment-card__row">
          <dt>Payment method</dt>
          <dd>GCash via Xendit</dd>
        </div>
        {xenditRef ? (
          <div className="xendit-payment-card__row">
            <dt>Xendit payment ID</dt>
            <dd className="xendit-payment-card__mono">{xenditRef}</dd>
          </div>
        ) : null}
        {expiresAt && isPending ? (
          <div className="xendit-payment-card__row">
            <dt>Expires</dt>
            <dd>{formatPaymentExpiry(expiresAt)}</dd>
          </div>
        ) : null}
      </dl>

      {error ? (
        <div className="xendit-payment-card__alert xendit-payment-card__alert--error" role="alert">
          {error}
          {onRetry ? (
            <button type="button" className="xendit-payment-card__link-btn" onClick={onRetry}>
              Try again
            </button>
          ) : null}
        </div>
      ) : null}

      {isPaid ? (
        <div className="xendit-payment-card__alert xendit-payment-card__alert--success" role="status">
          Payment received. Your booking is marked as payment verified.
        </div>
      ) : null}

      {isExpired ? (
        <div className="xendit-payment-card__alert xendit-payment-card__alert--warn" role="alert">
          This QR code has expired.
          {onRetry ? (
            <button type="button" className="xendit-payment-card__link-btn" onClick={onRetry}>
              Generate a new QR
            </button>
          ) : null}
        </div>
      ) : null}

      {isFailed ? (
        <div className="xendit-payment-card__alert xendit-payment-card__alert--error" role="alert">
          Payment failed. Generate a new QR or contact support.
          {onRetry ? (
            <button type="button" className="xendit-payment-card__link-btn" onClick={onRetry}>
              Try again
            </button>
          ) : null}
        </div>
      ) : null}

      {!isPaid && !isExpired && !isFailed ? (
        <>
          <ol className="xendit-payment-card__steps">
            {XENDIT_GCASH_PAYMENT_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>

          <div className="xendit-payment-card__qr-wrap">
            {loading ? (
              <LoadingMessage label="Generating Xendit payment QR…" size="sm" />
            ) : qrString && isPending ? (
              <QRCodeSVG value={qrString} size={240} level="M" includeMargin />
            ) : (
              <p className="xendit-payment-card__qr-fallback">
                QR code unavailable.
                {onRetry ? (
                  <button type="button" className="xendit-payment-card__link-btn" onClick={onRetry}>
                    Generate QR
                  </button>
                ) : null}
              </p>
            )}
          </div>

          <div className="xendit-payment-card__actions">
            <button type="button" className="button xendit-payment-card__gcash-btn" onClick={openGcashApp}>
              Pay via GCash
            </button>
            {onRetry ? (
              <button type="button" className="button button--secondary" onClick={onRetry} disabled={loading}>
                Refresh QR
              </button>
            ) : null}
          </div>

          <p className="xendit-payment-card__hint">
            Waiting for payment… This page checks status every few seconds. Do not upload a screenshot — Xendit
            confirms payment automatically.
          </p>
        </>
      ) : null}
    </article>
  );
}
