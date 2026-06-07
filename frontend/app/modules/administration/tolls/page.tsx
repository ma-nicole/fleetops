"use client";

import { useCallback, useEffect, useState } from "react";
import Breadcrumbs from "@/components/Breadcrumbs";
import { formatPhp } from "@/lib/appLocale";
import { TollMatrixApi, type TollMatrixPayload, type TollMatrixRow } from "@/lib/tollMatrixApi";
import { useRoleGuard } from "@/lib/useRoleGuard";
import TollPlazaAliasesPanel from "@/components/admin/TollPlazaAliasesPanel";
import AdminBookingTollOverridePanel from "@/components/admin/AdminBookingTollOverridePanel";

type AdminTab = "matrix" | "plazas" | "override";

const NLEX_EFFECTIVE_DATE = "2026-01-20";

const EMPTY_FORM: TollMatrixPayload = {
  entry_point: "",
  exit_point: "",
  vehicle_class: "Class 3",
  toll_fee: 0,
  effective_date: NLEX_EFFECTIVE_DATE,
  status: "active",
};

export default function TollMatrixAdminPage() {
  useRoleGuard(["admin"]);
  const [tab, setTab] = useState<AdminTab>("matrix");

  const [rows, setRows] = useState<TollMatrixRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<TollMatrixPayload>(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await TollMatrixApi.list(statusFilter === "all" ? undefined : statusFilter);
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load toll matrix");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (row: TollMatrixRow) => {
    setEditingId(row.id);
    setForm({
      entry_point: row.entry_point,
      exit_point: row.exit_point,
      vehicle_class: row.vehicle_class,
      toll_fee: row.toll_fee,
      effective_date: row.effective_date.slice(0, 10),
      status: row.status,
    });
    setShowForm(true);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.entry_point.trim() || !form.exit_point.trim()) {
      setError("Entry point and exit point are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await TollMatrixApi.update(editingId, form);
      } else {
        await TollMatrixApi.create(form);
      }
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: number) => {
    if (!window.confirm("Delete this toll matrix row?")) return;
    setError(null);
    try {
      await TollMatrixApi.remove(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <div className="container" style={{ paddingTop: "var(--space-3)", paddingBottom: "2rem" }}>
      <Breadcrumbs
        items={[
          { label: "Modules", href: "/dashboard/admin" },
          { label: "System Administration" },
          { label: "Toll Matrix" },
        ]}
      />

      <div style={{ marginTop: "1.5rem", marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0 }}>NLEX-SCTEX Toll Management</h1>
        <p style={{ margin: "0.25rem 0 0", color: "var(--text-secondary)", maxWidth: "52rem" }}>
          Toll matrix fares, plaza alias mapping, and admin booking toll overrides. No external toll API detection.
        </p>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        {(
          [
            ["matrix", "Toll matrix"],
            ["plazas", "Plaza aliases"],
            ["override", "Booking override"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: 6,
              border: tab === id ? "2px solid #7C3AED" : "1px solid #E5E7EB",
              background: tab === id ? "rgba(124, 58, 237, 0.08)" : "white",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "plazas" && <TollPlazaAliasesPanel />}
      {tab === "override" && <AdminBookingTollOverridePanel />}
      {tab === "matrix" && (
        <>
      <div style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Toll matrix rows</h2>
        <p style={{ margin: "0.25rem 0 0", color: "var(--text-secondary)", maxWidth: "52rem" }}>
          Entry plaza → exit plaza fares by vehicle class and effective date.
        </p>
      </div>

      {error && (
        <div role="alert" style={{ background: "var(--bg-error)", color: "var(--text-error)", padding: "1rem", borderRadius: 6, marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center", marginBottom: "1.5rem" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontWeight: 600 }}>Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: "0.5rem 0.75rem", borderRadius: 6, border: "1px solid #E5E7EB" }}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
        <button type="button" onClick={openCreate} className="quick-action-btn">
          Add matrix row
        </button>
      </div>

      {showForm && (
        <form className="card" onSubmit={onSubmit} style={{ padding: "1.25rem", marginBottom: "1.5rem", maxWidth: "40rem" }}>
          <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>{editingId ? "Edit row" : "New row"}</h2>
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <Field label="Entry point" value={form.entry_point} onChange={(v) => setForm((p) => ({ ...p, entry_point: v }))} />
            <Field label="Exit point" value={form.exit_point} onChange={(v) => setForm((p) => ({ ...p, exit_point: v }))} />
            <Field label="Vehicle class" value={form.vehicle_class} onChange={(v) => setForm((p) => ({ ...p, vehicle_class: v }))} />
            <NumField label="Toll fee (VAT-inclusive, PHP)" value={form.toll_fee} onChange={(v) => setForm((p) => ({ ...p, toll_fee: v }))} />
            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ fontWeight: 600 }}>Effective date</span>
              <input
                type="date"
                value={form.effective_date}
                onChange={(e) => setForm((p) => ({ ...p, effective_date: e.target.value }))}
                style={{ padding: "0.5rem", borderRadius: 6, border: "1px solid #E5E7EB" }}
              />
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ fontWeight: 600 }}>Status</span>
              <select
                value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                style={{ padding: "0.5rem", borderRadius: 6, border: "1px solid #E5E7EB" }}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
            <button type="submit" disabled={saving} style={primaryBtn}>
              {saving ? "Saving…" : editingId ? "Update" : "Create"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} style={secondaryBtn}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p style={{ color: "var(--text-secondary)" }}>Loading toll matrix…</p>
      ) : rows.length === 0 ? (
        <div className="card" style={{ padding: "1.5rem", color: "var(--text-secondary)" }}>
          No toll matrix rows yet. Add NLEX-SCTEX entry/exit pairs (e.g. Mindanao Ave. → Tarlac, Class 3).
        </div>
      ) : (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {rows.map((row) => (
            <div key={row.id} className="card" style={{ padding: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                <div>
                  <strong>
                    {row.entry_point} → {row.exit_point}
                  </strong>
                  <span
                    style={{
                      marginLeft: "0.75rem",
                      padding: "0.15rem 0.5rem",
                      borderRadius: 4,
                      fontSize: "0.8rem",
                      background: row.status === "active" ? "#D1FAE5" : "#F3F4F6",
                      color: row.status === "active" ? "#047857" : "#6B7280",
                    }}
                  >
                    {row.status}
                  </span>
                  <p style={{ margin: "0.35rem 0 0", color: "#6B7280", fontSize: "0.9rem" }}>
                    {row.vehicle_class} · Effective {row.effective_date.slice(0, 10)}
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700, color: "#7C3AED", fontSize: "1.15rem" }}>{formatPhp(row.toll_fee)}</div>
                  <div style={{ fontSize: "0.8rem", color: "#6B7280" }}>Toll fee</div>
                  <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                    <button type="button" onClick={() => openEdit(row)} style={secondaryBtn}>
                      Edit
                    </button>
                    <button type="button" onClick={() => void onDelete(row.id)} style={{ ...secondaryBtn, color: "#B91C1C" }}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
        </>
      )}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: "grid", gap: 4 }}>
      <span style={{ fontWeight: 600 }}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ padding: "0.5rem", borderRadius: 6, border: "1px solid #E5E7EB" }}
      />
    </label>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label style={{ display: "grid", gap: 4 }}>
      <span style={{ fontWeight: 600 }}>{label}</span>
      <input
        type="number"
        min={0}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ padding: "0.5rem", borderRadius: 6, border: "1px solid #E5E7EB" }}
      />
    </label>
  );
}

const primaryBtn: React.CSSProperties = {
  padding: "0.5rem 1rem",
  background: "#7C3AED",
  color: "white",
  border: "none",
  borderRadius: 6,
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  padding: "0.5rem 1rem",
  background: "white",
  color: "#374151",
  border: "1px solid #E5E7EB",
  borderRadius: 6,
  fontWeight: 600,
  cursor: "pointer",
};
