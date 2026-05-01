"use client";

import { useEffect, useState } from "react";

import Breadcrumbs from "@/components/Breadcrumbs";
import { useRoleGuard } from "@/lib/useRoleGuard";
import { announce } from "@/lib/useAnnouncer";
import { adminApi, type AdminStats, type AdminUser } from "@/lib/adminApi";

export default function AuthenticationPage() {
  useRoleGuard(["admin"]);

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [lockedUsers, setLockedUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, users] = await Promise.all([adminApi.getStats(), adminApi.listUsers()]);
      setStats(s);
      setLockedUsers(users.filter((u) => u.is_locked || (u.failed_login_count ?? 0) > 0));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleUnlock = async (user: AdminUser) => {
    try {
      await adminApi.unlockUser(user.id);
      announce(`${user.email} unlocked`);
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Unlock failed");
    }
  };

  return (
    <div className="container" style={{ paddingTop: "2rem", paddingBottom: "3rem" }}>
      <Breadcrumbs
        items={[
          { label: "Modules", href: "/dashboard/admin" },
          { label: "System" },
          { label: "Authentication" },
        ]}
      />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", marginTop: "1.5rem", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ margin: 0 }}>Authentication & Security</h1>
          <p style={{ margin: "0.25rem 0 0", color: "var(--text-secondary)" }}>
            Monitor sign-in activity and unlock accounts.
          </p>
        </div>
        <button type="button" className="button" onClick={refresh} disabled={loading} aria-busy={loading}>
          Refresh
        </button>
      </div>

      {error && (
        <div role="alert" style={{ background: "var(--bg-error)", color: "var(--text-error)", padding: "1rem", borderRadius: 6, marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        <StatCard label="Total users" value={stats?.total_users ?? "—"} />
        <StatCard
          label="Locked accounts"
          value={stats?.locked_accounts ?? "—"}
          tone={stats && stats.locked_accounts > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Failed login attempts"
          value={stats?.total_failed_logins ?? "—"}
          tone={stats && stats.total_failed_logins > 5 ? "warning" : "default"}
        />
        <StatCard label="Admins" value={stats?.by_role?.admin ?? 0} />
      </div>

      <section className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Password policy</h2>
        <ul style={{ paddingLeft: "1.25rem", margin: 0, color: "var(--text)" }}>
          <li>Minimum 6 characters; bcrypt hashed at rest.</li>
          <li>Accounts auto-lock after repeated failed login attempts.</li>
          <li>Admins can reset any password to a generated 12-character temporary string.</li>
          <li>JWT tokens expire after the configured backend lifetime.</li>
        </ul>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Accounts needing attention</h2>
        {loading ? (
          <p style={{ color: "var(--text-secondary)" }}>Loading…</p>
        ) : lockedUsers.length === 0 ? (
          <p style={{ color: "var(--text-secondary)" }}>No locked accounts or failed login activity. All clear.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th scope="col" style={th}>User</th>
                  <th scope="col" style={th}>Failed attempts</th>
                  <th scope="col" style={th}>Status</th>
                  <th scope="col" style={th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {lockedUsers.map((user) => (
                  <tr key={user.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{user.full_name}</div>
                      <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{user.email}</div>
                    </td>
                    <td style={td}>{user.failed_login_count}</td>
                    <td style={td}>
                      {user.is_locked ? (
                        <span style={{ ...statusPill, background: "var(--bg-error)", color: "var(--text-error)", border: "1px solid var(--text-error)" }}>
                          Locked
                        </span>
                      ) : (
                        <span style={{ ...statusPill, background: "var(--bg-warning, #FFF3E0)", color: "var(--text-warning, #B25900)", border: "1px solid var(--text-warning, #B25900)" }}>
                          At risk
                        </span>
                      )}
                    </td>
                    <td style={td}>
                      {user.is_locked || user.failed_login_count > 0 ? (
                        <button type="button" style={actionBtn} onClick={() => handleUnlock(user)}>
                          Unlock & reset counter
                        </button>
                      ) : (
                        <span style={{ color: "var(--text-secondary)" }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value, tone = "default" }: { label: string; value: number | string; tone?: "default" | "warning" }) {
  const isWarn = tone === "warning";
  return (
    <article className="card" style={{ padding: "1rem", borderLeft: `4px solid ${isWarn ? "var(--text-warning, #B25900)" : "var(--brand-text)"}` }}>
      <dl style={{ margin: 0 }}>
        <dt style={{ fontSize: "0.8rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</dt>
        <dd style={{ margin: "0.25rem 0 0", fontSize: "1.75rem", fontWeight: 700, color: isWarn ? "var(--text-warning, #B25900)" : "var(--text)" }}>
          {value}
        </dd>
      </dl>
    </article>
  );
}

const th: React.CSSProperties = { padding: "0.6rem 0.75rem", textAlign: "left", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)" };
const td: React.CSSProperties = { padding: "0.75rem", fontSize: "0.9rem" };
const actionBtn: React.CSSProperties = { padding: "0.4rem 0.75rem", fontSize: "0.8rem", border: "1px solid var(--border)", background: "white", borderRadius: 4, cursor: "pointer", minHeight: 32 };
const statusPill: React.CSSProperties = { padding: "0.25rem 0.6rem", borderRadius: 999, fontSize: "0.75rem", fontWeight: 600 };
