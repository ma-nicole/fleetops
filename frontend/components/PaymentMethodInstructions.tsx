"use client";

import type { CSSProperties } from "react";
import GcashQrPaymentSection from "@/components/GcashQrPaymentSection";
import { formatPhp } from "@/lib/appLocale";
import type { CustomerPaymentMethod } from "@/lib/paymentMethodOptions";
import { getPaymentMethodOption } from "@/lib/paymentMethodOptions";

type Props = {
  method: CustomerPaymentMethod;
  bookingId: number;
  total: number;
  gcashBlocked: boolean;
};

export default function PaymentMethodInstructions({ method, bookingId, total, gcashBlocked }: Props) {
  const option = getPaymentMethodOption(method);

  const panelStyle: CSSProperties = {
    padding: "1.5rem",
    border: "1px solid #E8E8E8",
    borderRadius: "8px",
    marginBottom: "1rem",
    background: "#FFFBF0",
  };

  if (method === "gcash" && !gcashBlocked) {
    return (
      <div style={{ display: "grid", gap: "1rem" }}>
        <GcashQrPaymentSection bookingId={bookingId} total={total} />
        <div style={panelStyle}>
          <p style={{ color: "#666666", margin: 0, fontSize: "0.9rem" }}>
            Use only the official FleetOps GCash merchant account. Do not send payment to numbers from unofficial
            channels.
          </p>
        </div>
      </div>
    );
  }

  if (method === "bank") {
    return (
      <div style={panelStyle}>
        <h4 style={{ margin: "0 0 0.8rem 0", color: "#1A1A1A" }}>Bank transfer</h4>
        <p style={{ color: "#666666", margin: "0.5rem 0", fontSize: "0.95rem" }}>
          Transfer only to the official bank account issued by FleetOps operations (branch, account name, and number are
          shared out-of-band or in your contract).
        </p>
        <p style={{ color: "#666666", margin: "0.5rem 0", fontSize: "0.85rem" }}>
          <strong>Reference:</strong> Booking #{bookingId}
        </p>
        <p style={{ color: "#FF9800", fontWeight: 700, margin: "0.75rem 0 0 0" }}>Amount: {formatPhp(total)}</p>
      </div>
    );
  }

  if (method === "manual") {
    return (
      <div style={panelStyle}>
        <h4 style={{ margin: "0 0 0.8rem 0", color: "#1A1A1A" }}>Manual payment proof upload</h4>
        <p style={{ color: "#666666", margin: "0.5rem 0", fontSize: "0.95rem" }}>
          Complete your payment through an approved offline channel (cheque, over-the-counter deposit, company voucher,
          etc.), then upload a clear photo or PDF of the receipt or deposit slip below.
        </p>
        <p style={{ color: "#666666", fontSize: "0.85rem", margin: "0.5rem 0 0 0" }}>
          <strong>Reference:</strong> Booking #{bookingId} · <strong>Amount:</strong> {formatPhp(total)}
        </p>
      </div>
    );
  }

  if (method === "cod") {
    return (
      <div style={panelStyle}>
        <h4 style={{ margin: "0 0 0.8rem 0", color: "#1A1A1A" }}>Cash on delivery / payment</h4>
        <p style={{ color: "#666666", margin: "0.5rem 0", fontSize: "0.95rem" }}>
          You will pay {formatPhp(total)} in cash to the driver or crew when your shipment is delivered. No upfront
          payment proof is required — FleetOps will confirm your COD request before dispatch.
        </p>
        <p style={{ color: "#666666", fontSize: "0.85rem", margin: "0.5rem 0 0 0" }}>
          Click <strong>Confirm COD request</strong> below to submit this payment option for admin review.
        </p>
      </div>
    );
  }

  return option ? (
    <div style={panelStyle}>
      <h4 style={{ margin: "0 0 0.5rem 0", color: "#1A1A1A" }}>{option.label}</h4>
      <p style={{ color: "#666666", margin: 0, fontSize: "0.9rem" }}>{option.description}</p>
    </div>
  ) : null;
}
