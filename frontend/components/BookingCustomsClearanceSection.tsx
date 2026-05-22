"use client";

import { useCallback, useEffect, useState } from "react";
import { formatPhp } from "@/lib/appLocale";
import {
  CUSTOMS_CLEARANCE_STATUSES,
  customsStatusLabel,
} from "@/lib/bookingCustomsOptions";
import type { Booking } from "@/lib/workflowApi";
import { WorkflowApi } from "@/lib/workflowApi";

type CustomsFields = Pick<
  Booking,
  | "id"
  | "customs_clearance_status"
  | "customs_tariff_notes"
  | "customs_additional_charges_php"
  | "customs_customer_updated_at"
  | "customs_admin_validated"
  | "customs_validated_at"
  | "customs_admin_notes"
  | "customs_validated_additional_charges_php"
>;

export default function BookingCustomsClearanceSection({
  booking,
  editable = true,
  onUpdated,
}: {
  booking: CustomsFields;
  editable?: boolean;
  onUpdated?: (updated: Booking) => void;
}) {
  const [status, setStatus] = useState(booking.customs_clearance_status ?? "not_started");
  const [notes, setNotes] = useState(booking.customs_tariff_notes ?? "");
  const [charges, setCharges] = useState(
    booking.customs_additional_charges_php != null ? String(booking.customs_additional_charges_php) : "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setStatus(booking.customs_clearance_status ?? "not_started");
    setNotes(booking.customs_tariff_notes ?? "");
    setCharges(
      booking.customs_additional_charges_php != null ? String(booking.customs_additional_charges_php) : "",
    );
  }, [
    booking.customs_clearance_status,
    booking.customs_tariff_notes,
    booking.customs_additional_charges_php,
  ]);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const parsedCharges = charges.trim() === "" ? null : Number(charges);
      if (parsedCharges != null && (Number.isNaN(parsedCharges) || parsedCharges < 0)) {
        setError("Enter a valid non-negative amount for additional charges.");
        return;
      }
      const updated = await WorkflowApi.customerUpdateBookingCustoms(booking.id, {
        customs_clearance_status: status,
        customs_tariff_notes: notes.trim() || null,
        customs_additional_charges_php: parsedCharges,
      });
      setSaved(true);
      onUpdated?.(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save customs information.");
    } finally {
      setSaving(false);
    }
  }, [booking.id, charges, notes, onUpdated, status]);

  const validatedCharges =
    booking.customs_admin_validated && booking.customs_validated_additional_charges_php != null
      ? booking.customs_validated_additional_charges_php
      : null;
  const proposedCharges = booking.customs_additional_charges_php;

  return (
    <div
      style={{
        border: "1px solid #BFDBFE",
        borderRadius: "8px",
        padding: "1rem",
        background: "rgba(59, 130, 246, 0.04)",
        marginTop: "1rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "0.75rem", flexWrap: "wrap" }}>
        <h4 style={{ color: "#1E3A8A", margin: "0 0 0.35rem 0" }}>Customs clearance &amp; tariffs</h4>
        {booking.customs_admin_validated ? (
          <span
            style={{
              padding: "0.2rem 0.55rem",
              borderRadius: 4,
              fontSize: "0.75rem",
              fontWeight: 700,
              background: "#D1FAE5",
              color: "#065F46",
            }}
          >
            Admin validated
          </span>
        ) : proposedCharges != null || booking.customs_tariff_notes || booking.customs_clearance_status ? (
          <span
            style={{
              padding: "0.2rem 0.55rem",
              borderRadius: 4,
              fontSize: "0.75rem",
              fontWeight: 700,
              background: "#FEF3C7",
              color: "#92400E",
            }}
          >
            Pending admin review
          </span>
        ) : null}
      </div>
      <p style={{ margin: "0 0 0.85rem 0", fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
        Provide customs clearance status, tariff notes, and any expected additional charges. These details are
        informational only and do not change your quoted freight total until an administrator validates them.
      </p>

      {editable ? (
        <div style={{ display: "grid", gap: "0.65rem" }}>
          <label style={{ display: "grid", gap: "0.3rem", fontSize: "0.85rem" }}>
            <span style={{ fontWeight: 600, color: "#374151" }}>Clearance status</span>
            <select
              className="select"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setSaved(false);
              }}
              style={{ maxWidth: 320 }}
            >
              {CUSTOMS_CLEARANCE_STATUSES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: "0.3rem", fontSize: "0.85rem" }}>
            <span style={{ fontWeight: 600, color: "#374151" }}>Tariff notes</span>
            <textarea
              className="input"
              rows={3}
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setSaved(false);
              }}
              placeholder="HS codes, duty estimates, broker contact, special handling…"
              maxLength={2000}
            />
          </label>

          <label style={{ display: "grid", gap: "0.3rem", fontSize: "0.85rem", maxWidth: 280 }}>
            <span style={{ fontWeight: 600, color: "#374151" }}>Possible additional charges (PHP)</span>
            <input
              className="input"
              type="number"
              min={0}
              step={0.01}
              value={charges}
              onChange={(e) => {
                setCharges(e.target.value);
                setSaved(false);
              }}
              placeholder="0.00"
            />
          </label>

          {error && (
            <p role="alert" style={{ margin: 0, fontSize: "0.82rem", color: "#B91C1C" }}>
              {error}
            </p>
          )}
          {saved && !error && (
            <p style={{ margin: 0, fontSize: "0.82rem", color: "#047857" }}>Customs information saved.</p>
          )}

          <div>
            <button type="button" className="button" disabled={saving} onClick={() => void save()}>
              {saving ? "Saving…" : "Save customs info"}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "0.45rem", fontSize: "0.88rem", color: "#374151" }}>
          <p style={{ margin: 0 }}>
            <strong>Status:</strong> {customsStatusLabel(booking.customs_clearance_status)}
          </p>
          <p style={{ margin: 0 }}>
            <strong>Tariff notes:</strong> {booking.customs_tariff_notes?.trim() || "—"}
          </p>
          <p style={{ margin: 0 }}>
            <strong>Proposed additional charges:</strong>{" "}
            {proposedCharges != null ? formatPhp(proposedCharges) : "—"}
          </p>
        </div>
      )}

      {(validatedCharges != null || booking.customs_admin_notes) && (
        <div
          style={{
            marginTop: "0.85rem",
            paddingTop: "0.75rem",
            borderTop: "1px solid #BFDBFE",
            fontSize: "0.85rem",
            color: "#1E40AF",
          }}
        >
          {validatedCharges != null && (
            <p style={{ margin: "0 0 0.35rem 0" }}>
              <strong>Admin-confirmed additional charges:</strong> {formatPhp(validatedCharges)}
            </p>
          )}
          {booking.customs_admin_notes && (
            <p style={{ margin: 0 }}>
              <strong>Admin note:</strong> {booking.customs_admin_notes}
            </p>
          )}
          {booking.customs_validated_at && (
            <p style={{ margin: "0.35rem 0 0 0", fontSize: "0.78rem", color: "#64748B" }}>
              Validated {new Date(booking.customs_validated_at).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {booking.customs_customer_updated_at && (
        <p style={{ margin: "0.65rem 0 0 0", fontSize: "0.75rem", color: "#94A3B8" }}>
          Last updated {new Date(booking.customs_customer_updated_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}
