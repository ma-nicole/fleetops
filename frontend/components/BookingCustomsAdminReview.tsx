"use client";

import { useCallback, useState } from "react";
import { formatPhp } from "@/lib/appLocale";
import { customsStatusLabel } from "@/lib/bookingCustomsOptions";
import type { Booking } from "@/lib/workflowApi";
import { WorkflowApi } from "@/lib/workflowApi";

type CustomsFields = Pick<
  Booking,
  | "id"
  | "customs_clearance_status"
  | "customs_tariff_notes"
  | "customs_additional_charges_php"
  | "customs_admin_validated"
  | "customs_validated_additional_charges_php"
  | "customs_admin_notes"
>;

export default function BookingCustomsAdminReview({
  booking,
  onValidated,
}: {
  booking: CustomsFields;
  onValidated?: (updated: Booking) => void;
}) {
  const hasCustoms =
    booking.customs_clearance_status ||
    booking.customs_tariff_notes ||
    booking.customs_additional_charges_php != null;

  const [adminNotes, setAdminNotes] = useState(booking.customs_admin_notes ?? "");
  const [validatedCharges, setValidatedCharges] = useState(
    booking.customs_validated_additional_charges_php != null
      ? String(booking.customs_validated_additional_charges_php)
      : booking.customs_additional_charges_php != null
        ? String(booking.customs_additional_charges_php)
        : "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = useCallback(
    async (validated: boolean) => {
      setBusy(true);
      setError(null);
      try {
        const parsed =
          validatedCharges.trim() === "" ? null : Number(validatedCharges);
        if (parsed != null && (Number.isNaN(parsed) || parsed < 0)) {
          setError("Enter a valid non-negative validated charge amount.");
          return;
        }
        const updated = await WorkflowApi.validateBookingCustoms(booking.id, {
          validated,
          customs_admin_notes: adminNotes.trim() || null,
          customs_validated_additional_charges_php: parsed,
        });
        onValidated?.(updated);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Validation failed.");
      } finally {
        setBusy(false);
      }
    },
    [adminNotes, booking.id, onValidated, validatedCharges],
  );

  if (!hasCustoms && !booking.customs_admin_validated) {
    return (
      <p style={{ margin: 0, fontSize: "0.85rem", color: "#6B7280" }}>
        No customs information submitted by customer.
      </p>
    );
  }

  return (
    <div style={{ display: "grid", gap: "0.55rem", fontSize: "0.85rem" }}>
      <p style={{ margin: 0, fontWeight: 600, color: "#374151" }}>
        Customs clearance {booking.customs_admin_validated ? "· validated" : "· pending review"}
      </p>
      <p style={{ margin: 0 }}>
        <strong>Status:</strong> {customsStatusLabel(booking.customs_clearance_status)}
      </p>
      {booking.customs_tariff_notes && (
        <p style={{ margin: 0 }}>
          <strong>Tariff notes:</strong> {booking.customs_tariff_notes}
        </p>
      )}
      {booking.customs_additional_charges_php != null && (
        <p style={{ margin: 0 }}>
          <strong>Customer proposed charges:</strong> {formatPhp(booking.customs_additional_charges_php)}
        </p>
      )}

      <label style={{ display: "grid", gap: "0.25rem" }}>
        <span style={{ fontWeight: 600 }}>Validated additional charges (PHP)</span>
        <input
          className="input"
          type="number"
          min={0}
          step={0.01}
          value={validatedCharges}
          onChange={(e) => setValidatedCharges(e.target.value)}
          style={{ maxWidth: 220 }}
        />
      </label>
      <label style={{ display: "grid", gap: "0.25rem" }}>
        <span style={{ fontWeight: 600 }}>Admin notes</span>
        <textarea
          className="input"
          rows={2}
          value={adminNotes}
          onChange={(e) => setAdminNotes(e.target.value)}
          maxLength={2000}
        />
      </label>
      {error && (
        <p role="alert" style={{ margin: 0, color: "#B91C1C" }}>
          {error}
        </p>
      )}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button type="button" className="button" disabled={busy} onClick={() => void validate(true)}>
          {busy ? "…" : "Validate customs info"}
        </button>
        {booking.customs_admin_validated && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void validate(false)}
            style={{
              padding: "0.5rem 0.85rem",
              borderRadius: 6,
              border: "1px solid #FCA5A5",
              background: "#fff",
              color: "#B91C1C",
              cursor: busy ? "wait" : "pointer",
            }}
          >
            Revoke validation
          </button>
        )}
      </div>
    </div>
  );
}
