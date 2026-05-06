"use client";

import { useEffect, useState } from "react";

import Breadcrumbs from "@/components/Breadcrumbs";
import PhoneInputRow from "@/components/PhoneInputRow";
import { useRoleGuard } from "@/lib/useRoleGuard";
import { announce } from "@/lib/useAnnouncer";
import { DEFAULT_DIAL_CODE } from "@/lib/dialCodes";
import {
  buildInternationalPhone,
  isValidEmail,
  validateAdminInitialPassword,
  validateOptionalInternationalPhone,
  validatePersonNameLoose,
} from "@/lib/formValidation";
import { adminApi, type AdminUser } from "@/lib/adminApi";

const ROLES: AdminUser["role"][] = ["admin", "manager", "dispatcher", "driver", "helper", "customer"];

export default function AccountsPage() {
  useRoleGuard(["admin"]);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [detailUser, setDetailUser] = useState<AdminUser | null>(null);
  const [knownInitialPasswords, setKnownInitialPasswords] = useState<Record<number, string>>({});

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.listUsers();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
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

  const openDetails = (user: AdminUser) => setDetailUser(user);

  const detailUserFresh = detailUser ? users.find((u) => u.id === detailUser.id) ?? detailUser : null;

  return (
    <div className="container" style={{ paddingTop: "var(--space-3)", paddingBottom: "2rem" }}>
      <Breadcrumbs
        items={[
          { label: "Modules", href: "/dashboard/admin" },
          { label: "System" },
          { label: "User Management" },
        ]}
      />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem", marginTop: "1.5rem", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ margin: 0 }}>User Management</h1>
          <p style={{ margin: "0.25rem 0 0", color: "var(--text-secondary)" }}>
            {loading ? "Loading…" : `${users.length} total user${users.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button type="button" className="button" onClick={refresh} disabled={loading} aria-busy={loading} style={{ background: "#E0E0E0", color: "var(--text)" }}>
            Refresh
          </button>
          <button type="button" className="button" onClick={() => setShowCreate(true)}>
            + New User
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" style={{ background: "var(--bg-error)", color: "var(--text-error)", padding: "1rem", borderRadius: 6, marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      <div className="card" style={{ marginBottom: "1.5rem", padding: "1rem" }}>
        <label htmlFor="user-filter" className="sr-only">Filter users</label>
        <input
          id="user-filter"
          className="input"
          placeholder="Search by name, email, or role…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
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
                  <td style={td}>{user.role}</td>
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
                    <button type="button" style={actionBtn} onClick={() => openDetails(user)}>
                      View details
                    </button>
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
          onCreated={(user, initialPassword) => {
            setKnownInitialPasswords((prev) => ({ ...prev, [user.id]: initialPassword }));
            setShowCreate(false);
            refresh();
            announce(`User ${user.email} created. Open their details to see the initial password.`);
          }}
        />
      )}

      {detailUserFresh && (
        <UserDetailsModal
          user={detailUserFresh}
          initialPassword={knownInitialPasswords[detailUserFresh.id]}
          onClose={() => setDetailUser(null)}
        />
      )}
    </div>
  );
}

function UserDetailsModal({
  user,
  initialPassword,
  onClose,
}: {
  user: AdminUser;
  initialPassword: string | undefined;
  onClose: () => void;
}) {
  const created = user.created_at ? formatDateTime(user.created_at) : "—";
  const lockedUntil = user.locked_until ? formatDateTime(user.locked_until) : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-details-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "grid",
        placeItems: "center",
        zIndex: 2000,
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(480px, 100%)", padding: "1.5rem", display: "grid", gap: "1rem" }}
      >
        <h2 id="user-details-title" style={{ margin: 0 }}>
          User details
        </h2>
        <dl style={{ margin: 0, display: "grid", gap: "0.75rem" }}>
          <DetailRow label="Full name" value={user.full_name} />
          <DetailRow label="Email" value={user.email} />
          <DetailRow label="Role" value={user.role} />
          <DetailRow label="Phone" value={user.phone || "—"} />
          <DetailRow
            label="Status"
            value={user.is_locked ? `Locked${lockedUntil ? ` until ${lockedUntil}` : ""}` : "Active"}
          />
          <DetailRow label="Failed sign-in attempts" value={String(user.failed_login_count)} />
          <DetailRow label="Account created" value={created} />
          <div style={{ display: "grid", gap: 4 }}>
            <dt style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)" }}>Password</dt>
            <dd style={{ margin: 0 }}>
              {initialPassword !== undefined ? (
                <code
                  style={{
                    display: "block",
                    padding: "0.5rem 0.75rem",
                    background: "var(--bg-muted, #f4f4f4)",
                    borderRadius: 4,
                    fontSize: "0.95rem",
                    wordBreak: "break-all",
                  }}
                >
                  {initialPassword}
                </code>
              ) : (
                <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                  Login passwords are stored securely and cannot be shown for existing accounts. If you created this user
                  in this session, the initial password appears here only for users you just added; refresh the page and
                  it will no longer be available.
                </span>
              )}
            </dd>
          </div>
        </dl>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="button" className="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <dt style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)" }}>{label}</dt>
      <dd style={{ margin: 0, fontSize: "0.95rem" }}>{value}</dd>
    </div>
  );
}

function formatDateTime(iso: string) {
  try {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
  } catch {
    return iso;
  }
}

function CreateUserModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (user: AdminUser, initialPassword: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<AdminUser["role"]>("customer");
  const [phoneDial, setPhoneDial] = useState(DEFAULT_DIAL_CODE);
  const [phoneNational, setPhoneNational] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    fullName?: string;
    email?: string;
    phone?: string;
    password?: string;
  }>({});

  const validate = (): boolean => {
    const next: typeof fieldErrors = {};
    const nameErr = validatePersonNameLoose(fullName);
    if (nameErr) next.fullName = nameErr;

    const mail = email.trim();
    if (!mail) next.email = "Email is required.";
    else if (!isValidEmail(mail)) next.email = "Enter a valid email address.";

    const phoneErr = validateOptionalInternationalPhone(phoneDial, phoneNational);
    if (phoneErr) next.phone = phoneErr;

    const pwErr = validateAdminInitialPassword(password);
    if (pwErr) next.password = pwErr;

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validate()) return;
    setSubmitting(true);
    const combinedPhone = buildInternationalPhone(phoneDial, phoneNational);
    const initialPassword = password;
    try {
      const created = await adminApi.createUser({
        email: email.trim(),
        full_name: fullName.trim(),
        role,
        phone: combinedPhone || undefined,
        password: initialPassword,
      });
      announce(`User ${email.trim()} created.`);
      onCreated(created, initialPassword);
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
      <form onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()} noValidate
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
          <input
            className="input"
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              if (fieldErrors.fullName) setFieldErrors((p) => ({ ...p, fullName: undefined }));
            }}
            aria-invalid={!!fieldErrors.fullName}
          />
          {fieldErrors.fullName && (
            <span role="alert" style={{ color: "var(--text-error)", fontSize: "0.85rem" }}>{fieldErrors.fullName}</span>
          )}
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          <span>Email <span aria-hidden="true">*</span></span>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined }));
            }}
            autoComplete="email"
            aria-invalid={!!fieldErrors.email}
          />
          {fieldErrors.email && (
            <span role="alert" style={{ color: "var(--text-error)", fontSize: "0.85rem" }}>{fieldErrors.email}</span>
          )}
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          <span>Role <span aria-hidden="true">*</span></span>
          <select className="select" value={role} onChange={(e) => setRole(e.target.value as AdminUser["role"])}>
            {ROLES.map((r) => (<option key={r} value={r}>{r}</option>))}
          </select>
        </label>

        <div style={{ display: "grid", gap: 4 }}>
          <span>Phone <span style={{ fontWeight: 400, color: "var(--text-secondary)" }}>(optional)</span></span>
          <PhoneInputRow
            dialCode={phoneDial}
            nationalNumber={phoneNational}
            onDialCodeChange={(d) => {
              setPhoneDial(d);
              if (fieldErrors.phone) setFieldErrors((p) => ({ ...p, phone: undefined }));
            }}
            onNationalChange={(n) => {
              setPhoneNational(n);
              if (fieldErrors.phone) setFieldErrors((p) => ({ ...p, phone: undefined }));
            }}
            optional
            error={fieldErrors.phone}
            nationalPlaceholder="9171234567"
            selectId="admin-user-phone-cc"
            nationalId="admin-user-phone-national"
          />
        </div>

        <label style={{ display: "grid", gap: 4 }}>
          <span>Initial password <span aria-hidden="true">*</span></span>
          <input
            className="input"
            type="text"
            maxLength={72}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined }));
            }}
            placeholder="6–72 characters"
            autoComplete="new-password"
            aria-invalid={!!fieldErrors.password}
          />
          {fieldErrors.password && (
            <span role="alert" style={{ color: "var(--text-error)", fontSize: "0.85rem" }}>{fieldErrors.password}</span>
          )}
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
