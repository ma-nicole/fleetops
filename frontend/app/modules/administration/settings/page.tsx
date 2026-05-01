"use client";

import { useEffect, useState } from "react";

import Breadcrumbs from "@/components/Breadcrumbs";
import { useRoleGuard } from "@/lib/useRoleGuard";
import { announce } from "@/lib/useAnnouncer";
import { adminApi, type PricingConfig } from "@/lib/adminApi";

type Draft = Record<number, { base_rate: string; labor_rate: string; helper_rate: string }>;

export default function SettingsPage() {
  useRoleGuard(["admin"]);

  const [configs, setConfigs] = useState<PricingConfig[]>([]);
  const [drafts, setDrafts] = useState<Draft>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.listPricing();
      setConfigs(data);
      const seed: Draft = {};
      for (const c of data) {
        seed[c.id] = {
          base_rate: String(c.base_rate),
          labor_rate: String(c.labor_rate),
          helper_rate: String(c.helper_rate),
        };
      }
      setDrafts(seed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pricing");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleField = (id: number, field: keyof Draft[number], value: string) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const handleSave = async (config: PricingConfig) => {
    const draft = drafts[config.id];
    if (!draft) return;
    const payload = {
      base_rate: Number(draft.base_rate),
      labor_rate: Number(draft.labor_rate),
      helper_rate: Number(draft.helper_rate),
    };
    if ([payload.base_rate, payload.labor_rate, payload.helper_rate].some((v) => Number.isNaN(v) || v < 0)) {
      setError("All rates must be valid non-negative numbers.");
      return;
    }
    setSaving(config.id);
    setError(null);
    setSuccess(null);
    try {
      await adminApi.updatePricing(config.id, payload);
      setSuccess(`${config.service_type} pricing saved.`);
      announce("Pricing updated.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(null);
    }
  };

  const isDirty = (config: PricingConfig) => {
    const draft = drafts[config.id];
    if (!draft) return false;
    return (
      Number(draft.base_rate) !== config.base_rate ||
      Number(draft.labor_rate) !== config.labor_rate ||
      Number(draft.helper_rate) !== config.helper_rate
    );
  };

  return (
    <div className="container" style={{ paddingTop: "2rem", paddingBottom: "3rem" }}>
      <Breadcrumbs
        items={[
          { label: "Modules", href: "/dashboard/admin" },
          { label: "System" },
          { label: "Settings" },
        ]}
      />

      <h1 style={{ marginTop: "1.5rem", marginBottom: "0.25rem" }}>System Settings</h1>
      <p style={{ color: "var(--text-secondary)", marginTop: 0, marginBottom: "1.5rem" }}>
        Configure pricing applied to bookings and quotes.
      </p>

      {error && (
        <div role="alert" style={{ background: "var(--bg-error)", color: "var(--text-error)", padding: "1rem", borderRadius: 6, marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {success && (
        <div role="status" style={{ background: "var(--bg-success)", color: "var(--text-success)", padding: "1rem", borderRadius: 6, marginBottom: "1rem" }}>
          {success}
        </div>
      )}

      {loading ? (
        <p style={{ color: "var(--text-secondary)" }}>Loading…</p>
      ) : configs.length === 0 ? (
        <p style={{ color: "var(--text-secondary)" }}>No pricing configurations yet.</p>
      ) : (
        <div style={{ display: "grid", gap: "1.25rem" }}>
          {configs.map((config) => {
            const draft = drafts[config.id] ?? { base_rate: "0", labor_rate: "0", helper_rate: "0" };
            const dirty = isDirty(config);
            return (
              <form
                key={config.id}
                className="card"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSave(config);
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
                  <h2 style={{ margin: 0, fontSize: "1.1rem", textTransform: "capitalize" }}>
                    {config.service_type} service
                  </h2>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                    Config ID: {config.id}
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.75rem" }}>
                  <Field
                    id={`base-${config.id}`}
                    label="Base rate (₱)"
                    value={draft.base_rate}
                    onChange={(v) => handleField(config.id, "base_rate", v)}
                  />
                  <Field
                    id={`labor-${config.id}`}
                    label="Labor rate (₱/hr)"
                    value={draft.labor_rate}
                    onChange={(v) => handleField(config.id, "labor_rate", v)}
                  />
                  <Field
                    id={`helper-${config.id}`}
                    label="Helper rate (₱/hr)"
                    value={draft.helper_rate}
                    onChange={(v) => handleField(config.id, "helper_rate", v)}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
                  <button
                    type="button"
                    className="button"
                    style={{ background: "#E0E0E0", color: "var(--text)" }}
                    disabled={!dirty || saving === config.id}
                    onClick={() => {
                      setDrafts((prev) => ({
                        ...prev,
                        [config.id]: {
                          base_rate: String(config.base_rate),
                          labor_rate: String(config.labor_rate),
                          helper_rate: String(config.helper_rate),
                        },
                      }));
                    }}
                  >
                    Reset
                  </button>
                  <button
                    type="submit"
                    className="button"
                    disabled={!dirty || saving === config.id}
                    aria-busy={saving === config.id}
                  >
                    {saving === config.id ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </form>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label htmlFor={id} style={{ display: "grid", gap: 4 }}>
      <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>{label}</span>
      <input
        id={id}
        type="number"
        step="0.01"
        min="0"
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
