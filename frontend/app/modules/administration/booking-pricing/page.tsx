"use client";

import { useCallback, useEffect, useState } from "react";

import Breadcrumbs from "@/components/Breadcrumbs";
import { adminApi, type AdminBookingFreightSettings } from "@/lib/adminApi";
import { announce } from "@/lib/useAnnouncer";
import { useRoleGuard } from "@/lib/useRoleGuard";

type FormState = {
  diesel_price_php_per_liter: number;
  toll_fees_php_per_trip: number;
};

const LABELS: { key: keyof FormState; label: string; hint: string }[] = [
  {
    key: "diesel_price_php_per_liter",
    label: "Diesel / fuel price (₱/liter)",
    hint: "Cached retail diesel used as (road km ÷ 4) × this price. Prefer Refresh from source; manual save marks this as an admin override.",
  },
  {
    key: "toll_fees_php_per_trip",
    label: "Flat toll fallback (₱ per trip)",
    hint: "Used only when the Toll Matrix cannot match pickup/dropoff. Matched matrix fees replace this automatically.",
  },
];

export default function BookingPricingAdminPage() {
  useRoleGuard(["admin"]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<Pick<
    AdminBookingFreightSettings,
    "updated_at" | "diesel_price_source" | "diesel_price_fetched_at"
  > | null>(null);
  const [refreshNote, setRefreshNote] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);

  const applySettings = (data: AdminBookingFreightSettings) => {
    setMeta({
      updated_at: data.updated_at,
      diesel_price_source: data.diesel_price_source,
      diesel_price_fetched_at: data.diesel_price_fetched_at,
    });
    setForm({
      diesel_price_php_per_liter: data.diesel_price_php_per_liter,
      toll_fees_php_per_trip: data.toll_fees_php_per_trip,
    });
    if (data.fuel_price_refresh?.message) {
      setRefreshNote(data.fuel_price_refresh.message);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.getBookingFreightSettings();
      applySettings(data);
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
      applySettings(saved);
      announce("Fuel price and toll settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const onRefreshFuel = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const data = await adminApi.refreshFuelPrice();
      applySettings(data);
      announce(data.fuel_price_refresh?.message || "Fuel price refreshed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fuel refresh failed");
    } finally {
      setRefreshing(false);
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
          Quotes use automatic diesel caching and Toll Matrix matching. Net/truck = cargo gross + fuel + driver (10%) +
          helper (4.62%) + toll. Maintenance and service fee are not part of the quote formula.
        </p>
        {meta?.updated_at && (
          <p style={{ margin: "0.5rem 0 0", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
            Last saved: {new Date(meta.updated_at).toLocaleString()}
            {meta.diesel_price_source ? ` · Fuel source: ${meta.diesel_price_source}` : ""}
            {meta.diesel_price_fetched_at
              ? ` · Fuel updated: ${new Date(meta.diesel_price_fetched_at).toLocaleString()}`
              : ""}
          </p>
        )}
        {refreshNote ? (
          <p style={{ margin: "0.35rem 0 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>{refreshNote}</p>
        ) : null}
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
            <button type="submit" className="button" disabled={saving || refreshing} aria-busy={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className="button"
              onClick={() => void onRefreshFuel()}
              disabled={loading || saving || refreshing}
              aria-busy={refreshing}
            >
              {refreshing ? "Refreshing…" : "Refresh fuel price"}
            </button>
            <button
              type="button"
              className="button"
              onClick={load}
              disabled={loading || saving || refreshing}
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
