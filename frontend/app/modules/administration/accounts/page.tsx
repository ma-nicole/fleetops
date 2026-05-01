"use client";

import { useEffect, useState } from "react";

import Breadcrumbs from "@/components/Breadcrumbs";
import { useRoleGuard } from "@/lib/useRoleGuard";
import { announce } from "@/lib/useAnnouncer";
import { adminApi, type AdminUser } from "@/lib/adminApi";

const ROLES: AdminUser["role"][] = ["admin", "manager", "dispatcher", "driver", "helper", "customer"];

export default function AccountsPage() {
  useRoleGuard(["admin"]);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [resetResult, setResetResult] = useState<{ email: string; password: string } | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.listUsers();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const filtered = users.filter((u) => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return (
      u.email.toLowerCase().includes(q) ||
      u.full_name.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  });

  const handleRoleChange = async (user: AdminUser, role: AdminUser["role"]) => {
    try {
      await adminApi.updateUser(user.id, { role });
      announce(`Role updated to ${role} for ${user.email}`);
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Update failed");
    }
  };

  const handleReset = async (user: AdminUser) => {
    if (!confirm(`Reset password for ${user.email}? A new temporary password will be generated.`)) return;
    try {
      const result = await adminApi.resetPassword(user.id);
      setResetResult({ email: result.email, password: result.temporary_password });
      announce("Password reset successfully.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Reset failed");
    }
  };

  const handleLockToggle = async (user: AdminUser) => {
    try {
      if (user.is_locked) {
        await adminApi.unlockUser(user.id);
        announce(`${user.email} unlocked`);
      } else {
        if (!confirm(`Lock ${user.email}? They will not be able to sign in.`)) return;
        await adminApi.lockUser(user.id);
        announce(`${user.email} locked`);
      }
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Action failed");
    }
  };

  const handleDelete = async (user: AdminUser) => {
    if (!confirm(`Permanently delete ${user.email}? This cannot be undone.`)) return;
    try {
      await adminApi.deleteUser(user.id);
      announce(`${user.email} deleted`);
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <div className="container" style={{ paddingTop: "2rem", paddingBottom: "3rem" }}>
      <Breadcrumbs
        items={[
          { label: "Modules", href: "/dashboard/admin" },
          { label: "System" },
          { label: "Accounts" },
        ]}
      />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem", marginTop: "1.5rem", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ margin: 0 }}>Account Management</h1>
          <p style={{ margin: "0.25rem 0 0", color: "var(--text-secondary)" }}>
            {loading ? "Loading…" : `${users.length} total user${users.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <button type="button" className="button" onClick={() => setShowCreate(true)}>
          + New User
        </button>
      </div>

      <div className="card" style={{ marginBottom: "1.5rem", padding: "1rem" }}>
        <label htmlFor="account-filter" className="sr-only">Filter accounts</label>
        <input
          id="account-filter"
          className="input"
          placeholder="Search by name, email, or role…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {error && (
        <div role="alert" style={{ background: "var(--bg-error)", color: "var(--text-error)", padding: "1rem", borderRadius: 6, marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {resetResult && (
        <div role="alert" className="card" style={{ marginBottom: "1.5rem", border: "2px solid var(--text-success)", background: "var(--bg-success)" }}>
          <strong>Temporary password generated for {resetResult.email}</strong>
          <pre style={{ margin: "0.5rem 0", padding: "0.5rem", background: "white", borderRadius: 4, fontSize: "1.1rem", fontFamily: "monospace" }}>
            {resetResult.password}
          </pre>
          <p style={{ margin: 0, fontSize: "0.85rem" }}>Share this securely. The user must change it on next login.</p>
          <button type="button" className="button" style={{ marginTop: "0.75rem" }} onClick={() => setResetResult(null)}>
            Done
          </button>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
            <thead>
              <tr style={{ background: "#FAFAFA", borderBottom: "1px solid var(--border)" }}>
                <th scope="col" style={th}>Name</th>
                <th scope="col" style={th}>Email</th>
                <th scope="col" style={th}>Role</th>
                <th scope="col" style={th}>Status</th>
                <th scope="col" style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} style={{ padding: "2rem", textAlign: "center", color: "var(--text-secondary)" }}>
                    No users match your filter.
                  </td>
                </tr>
              )}
              {filtered.map((user) => (
                <tr key={user.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={td}>{user.full_name}</td>
                  <td style={td}>{user.email}</td>
                  <td style={td}>
                    <label className="sr-only" htmlFor={`role-${user.id}`}>Role for {user.email}</label>
                    <select
                      id={`role-${user.id}`}
                      className="select"
                      value={user.role}
                      onChange={(e) => handleRoleChange(user, e.target.value as AdminUser["role"])}
                      style={{ minWidth: 120 }}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </td>
                  <td style={td}>
                    {user.is_locked ? (
                      <span style={{ ...statusPill, background: "var(--bg-error)", color: "var(--text-error)", border: "1px solid var(--text-error)" }}>
                        Locked
                      </span>
                    ) : (
                      <span style={{ ...statusPill, background: "var(--bg-success)", color: "var(--text-success)", border: "1px solid var(--text-success)" }}>
                        Active
                      </span>
                    )}
                  </td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <button type="button" style={actionBtn} onClick={() => handleReset(user)}>
                        Reset password
                      </button>
                      <button type="button" style={actionBtn} onClick={() => handleLockToggle(user)}>
                        {user.is_locked ? "Unlock" : "Lock"}
                      </button>
                      <button type="button" style={{ ...actionBtn, color: "var(--text-error)", borderColor: "var(--text-error)" }} onClick={() => handleDelete(user)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<AdminUser["role"]>("customer");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await adminApi.createUser({
        email: email.trim(),
        full_name: fullName.trim(),
        role,
        phone: phone.trim() || undefined,
        password,
      });
      announce(`User ${email} created.`);
      onCreated();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create user";
      try {
        const parsed = JSON.parse(message);
        setError(parsed.detail || message);
      } catch {
        setError(message);
      }
      setSubmitting(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="create-user-title"
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
        display: "grid", placeItems: "center", zIndex: 2000, padding: "1rem",
      }}
      onClick={onClose}
    >
      <form onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()}
        style={{ background: "white", borderRadius: 8, padding: "1.5rem", width: "min(480px, 100%)", display: "grid", gap: "1rem" }}
      >
        <h2 id="create-user-title" style={{ margin: 0 }}>Create new user</h2>

        {error && (
          <div role="alert" style={{ background: "var(--bg-error)", color: "var(--text-error)", padding: "0.75rem", borderRadius: 6 }}>
            {error}
          </div>
        )}

        <label style={{ display: "grid", gap: 4 }}>
          <span>Full name <span aria-hidden="true">*</span></span>
          <input className="input" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          <span>Email <span aria-hidden="true">*</span></span>
          <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          <span>Role <span aria-hidden="true">*</span></span>
          <select className="select" value={role} onChange={(e) => setRole(e.target.value as AdminUser["role"])}>
            {ROLES.map((r) => (<option key={r} value={r}>{r}</option>))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          <span>Phone</span>
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+63-917-…" autoComplete="tel" />
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          <span>Initial password <span aria-hidden="true">*</span></span>
          <input className="input" type="text" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
        </label>

        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "0.5rem" }}>
          <button type="button" className="button" onClick={onClose} style={{ background: "#E0E0E0", color: "var(--text)" }}>
            Cancel
          </button>
          <button type="submit" className="button" disabled={submitting} aria-busy={submitting}>
            {submitting ? "Creating…" : "Create user"}
          </button>
        </div>
      </form>
    </div>
  );
}

const th: React.CSSProperties = { padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)" };
const td: React.CSSProperties = { padding: "0.75rem 1rem", fontSize: "0.9rem" };
const actionBtn: React.CSSProperties = { padding: "0.4rem 0.75rem", fontSize: "0.8rem", border: "1px solid var(--border)", background: "white", borderRadius: 4, cursor: "pointer", minHeight: 32 };
const statusPill: React.CSSProperties = { padding: "0.25rem 0.6rem", borderRadius: 999, fontSize: "0.75rem", fontWeight: 600 };
