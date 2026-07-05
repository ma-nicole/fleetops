"use client";

import { useCallback, useEffect, useState } from "react";
import { TollPlazaApi, type TollPlazaPayload, type TollPlazaRow } from "@/lib/tollPlazaApi";

const EMPTY: TollPlazaPayload = { canonical_name: "", status: "active", aliases: [""] };

export default function TollPlazaAliasesPanel() {
  const [rows, setRows] = useState<TollPlazaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<TollPlazaPayload>(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await TollPlazaApi.list());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load toll plazas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY);
    setShowForm(true);
  };

  const openEdit = (row: TollPlazaRow) => {
    setEditingId(row.id);
    setForm({
      canonical_name: row.canonical_name,
      status: row.status,
      aliases: row.aliases.length ? row.aliases.map((a) => a.alias) : [""],
    });
    setShowForm(true);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.canonical_name.trim()) {
      setError("Canonical plaza name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      ...form,
      aliases: form.aliases.map((a) => a.trim()).filter(Boolean),
    };
    try {
      if (editingId) await TollPlazaApi.update(editingId, payload);
      else await TollPlazaApi.create(payload);
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const removePlaza = async (row: TollPlazaRow) => {
    if (!window.confirm(`Delete toll plaza "${row.canonical_name}" and its aliases? This cannot be undone.`)) {
      return;
    }
    await TollPlazaApi.remove(row.id);
    await load();
  };

  return (
    <div>
      <p style={{ color: "var(--text-secondary)", maxWidth: "48rem", marginBottom: "1rem" }}>
        Define canonical NLEX-SCTEX plaza names and aliases (e.g. San Fernando → &quot;San Fernando Pampanga&quot;, &quot;San Fernando Exit&quot;).
        Booking pickup/dropoff text is matched against these aliases before toll matrix lookup.
      </p>

      {error && (
        <div role="alert" style={{ background: "var(--bg-error)", color: "var(--text-error)", padding: "1rem", borderRadius: 6, marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      <button type="button" onClick={openCreate} className="quick-action-btn" style={{ marginBottom: "1rem" }}>
        Add toll plaza
      </button>

      {showForm && (
        <form className="card" onSubmit={onSubmit} style={{ padding: "1.25rem", marginBottom: "1.5rem", maxWidth: "42rem" }}>
          <h3 style={{ marginTop: 0 }}>{editingId ? "Edit plaza" : "New plaza"}</h3>
          <label style={{ display: "grid", gap: 4, marginBottom: "0.75rem" }}>
            <span style={{ fontWeight: 600 }}>Canonical plaza name</span>
            <input value={form.canonical_name} onChange={(e) => setForm((p) => ({ ...p, canonical_name: e.target.value }))} style={inputStyle} />
          </label>
          <div style={{ marginBottom: "0.75rem" }}>
            <span style={{ fontWeight: 600 }}>Aliases</span>
            {form.aliases.map((alias, idx) => (
              <div key={idx} style={{ display: "flex", gap: "0.5rem", marginTop: "0.35rem" }}>
                <input
                  value={alias}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      aliases: p.aliases.map((a, i) => (i === idx ? e.target.value : a)),
                    }))
                  }
                  placeholder="e.g. San Fernando Pampanga"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button type="button" onClick={() => setForm((p) => ({ ...p, aliases: p.aliases.filter((_, i) => i !== idx) }))}>
                  Remove
                </button>
              </div>
            ))}
            <button type="button" style={{ marginTop: "0.5rem" }} onClick={() => setForm((p) => ({ ...p, aliases: [...p.aliases, ""] }))}>
              Add alias
            </button>
          </div>
          <label style={{ display: "grid", gap: 4, marginBottom: "0.75rem" }}>
            <span style={{ fontWeight: 600 }}>Status</span>
            <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} style={inputStyle}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button type="submit" disabled={saving} style={primaryBtn}>{saving ? "Saving…" : "Save"}</button>
            <button type="button" onClick={() => setShowForm(false)} style={secondaryBtn}>Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <p style={{ color: "var(--text-secondary)" }}>Loading plazas…</p>
      ) : rows.length === 0 ? (
        <div className="card" style={{ padding: "1.25rem", color: "var(--text-secondary)" }}>No toll plazas configured yet.</div>
      ) : (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {rows.map((row) => (
            <div key={row.id} className="card" style={{ padding: "1rem" }}>
              <strong>{row.canonical_name}</strong>
              <span style={{ marginLeft: "0.5rem", fontSize: "0.8rem", color: "#6B7280" }}>{row.status}</span>
              {row.aliases.length > 0 && (
                <p style={{ margin: "0.35rem 0 0", color: "#6B7280", fontSize: "0.9rem" }}>
                  Aliases: {row.aliases.map((a) => a.alias).join(" · ")}
                </p>
              )}
              <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem" }}>
                <button type="button" onClick={() => openEdit(row)} style={secondaryBtn}>Edit</button>
                <button type="button" onClick={() => void removePlaza(row)} style={{ ...secondaryBtn, color: "#B91C1C" }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = { padding: "0.5rem", borderRadius: 6, border: "1px solid #E5E7EB" };
const primaryBtn: React.CSSProperties = { padding: "0.5rem 1rem", background: "#7C3AED", color: "white", border: "none", borderRadius: 6, fontWeight: 600, cursor: "pointer" };
const secondaryBtn: React.CSSProperties = { padding: "0.5rem 1rem", background: "white", border: "1px solid #E5E7EB", borderRadius: 6, fontWeight: 600, cursor: "pointer" };
