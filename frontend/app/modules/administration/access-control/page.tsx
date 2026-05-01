"use client";

import { useEffect, useMemo, useState } from "react";

import Breadcrumbs from "@/components/Breadcrumbs";
import { useRoleGuard } from "@/lib/useRoleGuard";
import { announce } from "@/lib/useAnnouncer";
import { adminApi, type AdminUser } from "@/lib/adminApi";

const ROLES: AdminUser["role"][] = ["admin", "manager", "dispatcher", "driver", "helper", "customer"];

const ROLE_PERMISSIONS: Record<AdminUser["role"], string[]> = {
  admin: ["Full system access", "Manage all users & roles", "Edit pricing config", "Lock/unlock accounts"],
  manager: ["Analytics dashboards", "Approve bookings", "Manage drivers/trucks", "Finance reports"],
  dispatcher: ["Assign jobs", "Manage schedules", "Monitor active trips", "Confirm completion"],
  driver: ["View assigned trips", "Update trip status", "Log fuel/tolls", "View own pay"],
  helper: ["Assist on trips", "View own schedule"],
  customer: ["Create bookings", "Track shipments", "View invoices", "Submit feedback"],
};

export default function AccessControlPage() {
  useRoleGuard(["admin"]);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeRole, setActiveRole] = useState<AdminUser["role"]>("admin");

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

  const grouped = useMemo(() => {
    const map: Record<string, AdminUser[]> = {};
    for (const r of ROLES) map[r] = [];
    for (const u of users) {
      if (map[u.role]) map[u.role].push(u);
    }
    return map;
  }, [users]);

  const handleRoleChange = async (user: AdminUser, role: AdminUser["role"]) => {
    try {
      await adminApi.updateUser(user.id, { role });
      announce(`${user.email} reassigned to ${role}`);
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Update failed");
    }
  };

  return (
    <div className="container" style={{ paddingTop: "2rem", paddingBottom: "3rem" }}>
      <Breadcrumbs
        items={[
          { label: "Modules", href: "/dashboard/admin" },
          { label: "System" },
          { label: "Access Control" },
        ]}
      />

      <h1 style={{ marginTop: "1.5rem", marginBottom: "0.25rem" }}>Role-Based Access Control</h1>
      <p style={{ color: "var(--text-secondary)", marginTop: 0, marginBottom: "1.5rem" }}>
        Assign roles to users and review what each role can do.
      </p>

      {error && (
        <div role="alert" style={{ background: "var(--bg-error)", color: "var(--text-error)", padding: "1rem", borderRadius: 6, marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {/* Role count summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
        {ROLES.map((role) => {
          const count = grouped[role]?.length || 0;
          const isActive = role === activeRole;
          return (
            <button
              key={role}
              type="button"
              onClick={() => setActiveRole(role)}
              aria-pressed={isActive}
              style={{
                padding: "0.85rem 1rem",
                border: `1.5px solid ${isActive ? "var(--brand-text)" : "var(--border)"}`,
                background: isActive ? "rgba(178, 89, 0, 0.06)" : "white",
                borderRadius: 8,
                textAlign: "left",
                cursor: "pointer",
                minHeight: 44,
              }}
            >
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{role}</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: isActive ? "var(--brand-text)" : "var(--text)" }}>
                {loading ? "—" : count}
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                user{count === 1 ? "" : "s"}
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", alignItems: "start" }}>
        <section className="card">
          <h2 style={{ marginTop: 0, fontSize: "1.1rem", textTransform: "capitalize" }}>{activeRole} permissions</h2>
          <ul style={{ paddingLeft: "1.25rem", margin: 0, color: "var(--text)" }}>
            {ROLE_PERMISSIONS[activeRole].map((perm) => (
              <li key={perm} style={{ marginBottom: "0.4rem" }}>{perm}</li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h2 style={{ marginTop: 0, fontSize: "1.1rem", textTransform: "capitalize" }}>{activeRole} users</h2>
          {loading ? (
            <p style={{ color: "var(--text-secondary)" }}>Loading…</p>
          ) : grouped[activeRole].length === 0 ? (
            <p style={{ color: "var(--text-secondary)" }}>No users in this role.</p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.5rem" }}>
              {grouped[activeRole].map((user) => (
                <li key={user.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0.75rem", border: "1px solid var(--border)", borderRadius: 6, gap: "0.75rem", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{user.full_name}</div>
                    <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{user.email}</div>
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem" }}>
                    <span className="sr-only">Reassign role for {user.email}</span>
                    <select
                      className="select"
                      value={user.role}
                      onChange={(e) => handleRoleChange(user, e.target.value as AdminUser["role"])}
                      style={{ padding: "0.35rem 0.5rem", minWidth: 110 }}
                    >
                      {ROLES.map((r) => (<option key={r} value={r}>{r}</option>))}
                    </select>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <style jsx>{`
        @media (max-width: 720px) {
          section.card + section.card {
            margin-top: 1rem;
          }
          div[style*="grid-template-columns: 1fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
