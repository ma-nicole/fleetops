"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CARGO_TYPE_CATEGORIES,
  cargoTypeCategoryLabel,
  type CargoTypeScreening,
} from "@/lib/cargoTypeCategories";
import type { Booking } from "@/lib/workflowApi";
import { WorkflowApi } from "@/lib/workflowApi";

type CargoFields = Pick<
  Booking,
  | "id"
  | "cargo_description"
  | "cargo_type_category"
  | "cargo_type_validated"
  | "cargo_type_admin_notes"
  | "cargo_restricted_flag"
  | "cargo_restricted_reasons"
>;

function parseReasons(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
  } catch {
    /* fall through */
  }
  return raw.split("|").map((s) => s.trim()).filter(Boolean);
}

export default function BookingCargoTypeAdminReview({
  booking,
  onValidated,
}: {
  booking: CargoFields;
  onValidated?: (updated: Booking) => void;
}) {
  const [category, setCategory] = useState(booking.cargo_type_category ?? "");
  const [adminNotes, setAdminNotes] = useState(booking.cargo_type_admin_notes ?? "");
  const [cargoDescription, setCargoDescription] = useState(booking.cargo_description ?? "");
  const [screening, setScreening] = useState<CargoTypeScreening | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const storedReasons = parseReasons(booking.cargo_restricted_reasons);

  const loadScreening = useCallback(async () => {
    if (!category) {
      setScreening(null);
      return;
    }
    try {
      const result = await WorkflowApi.previewCargoTypeScreening(booking.id, category);
      setScreening(result);
    } catch {
      setScreening(null);
    }
  }, [booking.id, category]);

  useEffect(() => {
    void loadScreening();
  }, [loadScreening]);

  const validate = useCallback(
    async (validated: boolean) => {
      setBusy(true);
      setError(null);
      try {
        const desc = cargoDescription.trim();
        if (validated && desc.length < 3) {
          setError("Enter a cargo description (at least 3 characters) before verifying.");
          setBusy(false);
          return;
        }
        const updated = await WorkflowApi.validateBookingCargoType(booking.id, {
          validated,
          cargo_type_category: category || null,
          cargo_type_admin_notes: adminNotes.trim() || null,
          cargo_description: desc || null,
        });
        onValidated?.(updated);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Cargo type validation failed.");
      } finally {
        setBusy(false);
      }
    },
    [adminNotes, booking.id, cargoDescription, category, onValidated],
  );

  const activeReasons =
    screening?.reasons?.length ? screening.reasons : booking.cargo_restricted_flag ? storedReasons : [];
  const showWarning = (screening?.restricted_flag ?? booking.cargo_restricted_flag) && activeReasons.length > 0;

  return (
    <div style={{ display: "grid", gap: "0.55rem", fontSize: "0.85rem" }}>
      <p style={{ margin: 0, fontWeight: 600, color: "#374151" }}>
        Cargo type classification {booking.cargo_type_validated ? "· verified" : "· pending review"}
      </p>
      {booking.cargo_description ? (
        <p style={{ margin: 0, color: "#4B5563" }}>
          <strong>Customer description:</strong> {booking.cargo_description}
        </p>
      ) : (
        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span style={{ fontWeight: 600 }}>Cargo description</span>
          <span style={{ fontSize: "0.78rem", color: "#92400E" }}>
            Customer did not provide a description — enter one before verifying.
          </span>
          <textarea
            className="input"
            rows={2}
            value={cargoDescription}
            onChange={(e) => setCargoDescription(e.target.value)}
            maxLength={500}
            placeholder="e.g. Palletized electronics, sealed cartons"
          />
        </label>
      )}
      <label style={{ display: "grid", gap: "0.25rem" }}>
        <span style={{ fontWeight: 600 }}>Cargo type category</span>
        <select
          className="input"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={{ maxWidth: 320 }}
        >
          <option value="">Select category…</option>
          {CARGO_TYPE_CATEGORIES.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
              {opt.restricted ? " ⚠" : ""}
            </option>
          ))}
        </select>
      </label>
      {category && (
        <p style={{ margin: 0, fontSize: "0.8rem", color: "#6B7280" }}>
          Selected: {cargoTypeCategoryLabel(category)}
        </p>
      )}
      {showWarning && (
        <div
          role="status"
          style={{
            padding: "0.65rem 0.75rem",
            borderRadius: 8,
            border: "1px solid #FCD34D",
            background: "#FFFBEB",
            color: "#92400E",
          }}
        >
          <strong style={{ display: "block", marginBottom: 4 }}>Possible restricted / contraband warning</strong>
          <span style={{ fontSize: "0.8rem" }}>
            This is informational only — validation is not blocked automatically.
          </span>
          <ul style={{ margin: "0.45rem 0 0", paddingLeft: "1.1rem" }}>
            {activeReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}
      <label style={{ display: "grid", gap: "0.25rem" }}>
        <span style={{ fontWeight: 600 }}>Admin notes</span>
        <textarea
          className="input"
          rows={2}
          value={adminNotes}
          onChange={(e) => setAdminNotes(e.target.value)}
          maxLength={2000}
          placeholder="Optional verification notes"
        />
      </label>
      {error && (
        <p role="alert" style={{ margin: 0, color: "#B91C1C" }}>
          {error}
        </p>
      )}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button type="button" className="button" disabled={busy || !category} onClick={() => void validate(true)}>
          {busy ? "…" : "Verify cargo type"}
        </button>
        {booking.cargo_type_validated && (
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
            Revoke verification
          </button>
        )}
      </div>
    </div>
  );
}
