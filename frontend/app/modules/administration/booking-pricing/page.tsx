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
    label: "Diesel / fuel price (₱/liter)",
    hint: "Used in customer quotes as (road km ÷ 4) × this price — same as your slip’s fuel line. Update when pump prices change.",
  },
  {
    key: "toll_fees_php_per_trip",
    label: "Toll fees (₱ per trip)",
    hint: "Flat toll per truck for the route (each 42 t load uses one truck — multi-truck bookings multiply toll by number of trucks).",
  },
];

export default function BookingPricingAdminPage() {
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
      announce("Fuel price and toll settings saved.");
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
          { label: "Calculations — fuel & toll" },
        ]}
      />

      <div style={{ marginTop: "1.5rem", marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0 }}>Calculations — fuel price &amp; toll</h1>
        <p style={{ margin: "0.25rem 0 0", color: "var(--text-secondary)", maxWidth: "46rem" }}>
          Customer <strong>tons</strong> and <strong>distance</strong> come from their booking. Loads over <strong>42 t</strong> are split
          across multiple trucks; fuel and toll apply per truck. Net/truck = cargo gross + fuel + driver (10%) + helper
          (4.62%) + toll (additive). This page only stores diesel ₱/L and toll ₱.
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
