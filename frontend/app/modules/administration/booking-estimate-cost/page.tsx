"use client";

import { useCallback, useEffect, useState } from "react";

import Breadcrumbs from "@/components/Breadcrumbs";
import { adminApi, type AdminBookingFreightSettings } from "@/lib/adminApi";
import { announce } from "@/lib/useAnnouncer";
import { useRoleGuard } from "@/lib/useRoleGuard";

type FormState = Omit<AdminBookingFreightSettings, "id" | "updated_at">;

const LABELS: { key: keyof FormState; label: string; hint: string }[] = [
  {
    key: "diesel_price_php_per_liter",
    label: "Diesel price (₱/liter)",
    hint: "Current pump or budget rate used in the estimate.",
  },
  {
    key: "truck_fuel_efficiency_kmpl",
    label: "Truck efficiency (km/L)",
    hint: "Used to derive liters from distance × weight factor.",
  },
  {
    key: "trip_wear_misc_php_per_km",
    label: "Wear & miscellaneous (₱/km)",
    hint: "Tires, fluids, incidental per kilometer before depreciation.",
  },
  {
    key: "trip_depreciation_rate",
    label: "Depreciation rate",
    hint: "Fraction applied on diesel + wear stack (e.g. 0.12 = 12%).",
  },
  {
    key: "helper_pay_php_per_trip",
    label: "Helper pay (₱ per trip)",
    hint: "Flat allowance per booking leg in the freight base.",
  },
  {
    key: "driver_freight_commission_rate",
    label: "Driver commission on freight",
    hint: "Fraction of freight base added for driver (e.g. 0.15 = 15%).",
  },
  {
    key: "cargo_weight_multiplier_per_ton",
    label: "Weight load factor (per metric ton above 1 t)",
    hint: "Each full metric ton past the first 1 t increases the load factor by this amount (pricing uses cargo weight in metric tons).",
  },
];

export default function BookingEstimateCostAdminPage() {
  useRoleGuard(["admin"]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.getBookingFreightSettings();
      const { updated_at, id: _id, ...formData } = data;
      setUpdatedAt(updated_at);
      setForm(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setField = (key: keyof FormState, value: string) => {
    const n = Number(value);
    setForm((prev) => (prev ? { ...prev, [key]: Number.isFinite(n) ? n : prev[key] } : prev));
  };

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await adminApi.saveBookingFreightSettings(form);
      setUpdatedAt(saved.updated_at);
      announce("Booking estimate pricing saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container" style={{ paddingTop: "var(--space-3)", paddingBottom: "2rem" }}>
      <Breadcrumbs
        items={[
          { label: "Modules", href: "/dashboard/admin" },
          { label: "System" },
          { label: "Diesel & booking estimates" },
        ]}
      />

      <div style={{ marginTop: "1.5rem", marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0 }}>Diesel & booking estimates</h1>
        <p style={{ margin: "0.25rem 0 0", color: "var(--text-secondary)", maxWidth: "42rem" }}>
          Adjust diesel, driver commission, helper pay, and related knobs used for customer route estimates and new
          booking totals. Customer weight is entered in metric tons. Values are stored in the database; you no longer need to change code or deploy for routine
          price updates.
        </p>
        {updatedAt && (
          <p style={{ margin: "0.5rem 0 0", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
            Last saved: {new Date(updatedAt).toLocaleString()}
          </p>
        )}
      </div>

      {error && (
        <div
          role="alert"
          style={{
            background: "var(--bg-error)",
            color: "var(--text-error)",
            padding: "1rem",
            borderRadius: 6,
            marginBottom: "1rem",
          }}
        >
          {error}
        </div>
      )}

      {loading || !form ? (
        <p style={{ color: "var(--text-secondary)" }}>Loading…</p>
      ) : (
        <form className="card" onSubmit={onSave} style={{ padding: "1.25rem", maxWidth: "36rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {LABELS.map(({ key, label, hint }) => (
              <div key={key}>
                <label htmlFor={key} style={{ display: "block", fontWeight: 600, marginBottom: "0.35rem" }}>
                  {label}
                </label>
                <input
                  id={key}
                  className="input"
                  type="number"
                  step="any"
                  required
                  value={form[key]}
                  onChange={(ev) => setField(key, ev.target.value)}
                  aria-describedby={`${key}-hint`}
                />
                <p id={`${key}-hint`} style={{ margin: "0.35rem 0 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                  {hint}
                </p>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.25rem", flexWrap: "wrap" }}>
            <button type="submit" className="button" disabled={saving} aria-busy={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className="button"
              onClick={load}
              disabled={loading || saving}
              style={{ background: "#E0E0E0", color: "var(--text)" }}
            >
              Reload
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
