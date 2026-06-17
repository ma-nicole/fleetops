"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Breadcrumbs from "@/components/Breadcrumbs";
import PhoneInputRow from "@/components/PhoneInputRow";
import LoadingMessage from "@/components/ui/LoadingMessage";
import { apiChangePassword, apiGetMe, apiUpdateCustomerProfile, type MeUser } from "@/lib/api";
import { LOADING_AUTH_RESTORE } from "@/lib/loadingMessages";
import { useCallback, useEffect, useState } from "react";
import { DEFAULT_DIAL_CODE } from "@/lib/dialCodes";
import {
  buildInternationalPhone,
  isValidEmail,
  splitInternationalPhone,
  validateFullName,
  validateOptionalInternationalPhone,
} from "@/lib/formValidation";

type FieldKey = "full_name" | "phone" | "company_name";
type FieldErrors = Partial<Record<FieldKey, string>>;

export default function CustomerProfilePage() {
  const { ready, allowed } = useRoleGuard(["customer"]);

  const [me, setMe] = useState<MeUser | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);

  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phoneDial, setPhoneDial] = useState(DEFAULT_DIAL_CODE);
  const [phoneNational, setPhoneNational] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);

  const applyMeToForm = useCallback((u: MeUser) => {
    setFullName(u.full_name ?? "");
    setCompanyName(u.company_name ?? "");
    const sp = splitInternationalPhone(u.phone ?? "");
    setPhoneDial(sp.dial);
    setPhoneNational(sp.national);
  }, []);

  useEffect(() => {
    if (!ready || !allowed) return;
    let cancelled = false;
    setLoadingMe(true);
    setLoadError(null);
    void apiGetMe()
      .then((u) => {
        if (cancelled) return;
        setMe(u);
        applyMeToForm(u);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Could not load profile.");
      })
      .finally(() => {
        if (!cancelled) setLoadingMe(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, allowed, applyMeToForm]);

  const gridCols = {
    display: "grid",
    gap: "1rem",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
  };

  const border = (key: FieldKey) => (fieldErrors[key] ? "2px solid #DC2626" : "1px solid #E8E8E8");

  const validate = (): boolean => {
    const next: FieldErrors = {};
    const nameErr = validateFullName(fullName);
    if (nameErr) next.full_name = nameErr;

    const co = companyName.trim();
    if (co.length === 1) next.company_name = "If you enter a company, use at least 2 characters.";

    const phoneErr = validateOptionalInternationalPhone(phoneDial, phoneNational);
    if (phoneErr) next.phone = phoneErr;

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaveBusy(true);
    setSaveError(null);
    setSaveOk(null);
    try {
      const phoneStr = buildInternationalPhone(phoneDial, phoneNational);
      const co = companyName.trim();
      const updated = await apiUpdateCustomerProfile({
        full_name: fullName.trim(),
        company_name: co ? co : null,
        phone: phoneStr || null,
      });
      setMe(updated);
      applyMeToForm(updated);
      setIsEditing(false);
      setFieldErrors({});
      setSaveOk("Profile saved.");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not save profile.");
    } finally {
      setSaveBusy(false);
    }
  };

  const toggleEdit = () => {
    if (isEditing) {
      setIsEditing(false);
      setFieldErrors({});
      setSaveError(null);
      if (me) applyMeToForm(me);
      return;
    }
    if (me) applyMeToForm(me);
    setFieldErrors({});
    setSaveError(null);
    setSaveOk(null);
    setIsEditing(true);
  };

  const clearFieldError = (key: FieldKey) => {
    if (fieldErrors[key]) setFieldErrors((p) => ({ ...p, [key]: undefined }));
  };

  const handleChangePassword = async () => {
    setPwError(null);
    setPwSuccess(null);
    if (!currentPassword.trim()) {
      setPwError("Enter your current password.");
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setPwError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("New password and confirmation do not match.");
      return;
    }
    if (currentPassword === newPassword) {
      setPwError("Choose a new password that is different from your current one.");
      return;
    }
    setPwSubmitting(true);
    try {
      const res = await apiChangePassword(currentPassword, newPassword);
      setPwSuccess(res.message || "Password updated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e) {
      setPwError(e instanceof Error ? e.message : "Could not update password.");
    } finally {
      setPwSubmitting(false);
    }
  };

  const email = me?.email ?? "";
  const emailLooksValid = isValidEmail(email);

  if (!ready) {
    return (
      <div className="container" style={{ paddingTop: "var(--space-3)" }}>
        <LoadingMessage label={LOADING_AUTH_RESTORE} />
      </div>
    );
  }

  if (!allowed) return null;

  return (
    <div className="container" style={{ paddingTop: "var(--space-3)" }}>
      <Breadcrumbs
        items={[
          { label: "Modules", href: "/dashboard/customer" },
          { label: "Booking & Account" },
          { label: "My Profile" },
        ]}
      />

      <div style={{ marginTop: "2rem" }}>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem" }}>My Profile</h1>
        <p style={{ color: "#666666", marginBottom: "1.5rem" }}>
          Your account details from registration. Update your name, company, or phone anytime.
        </p>

        {loadingMe ? (
          <p style={{ color: "#666" }}>Loading your profile…</p>
        ) : loadError ? (
          <div role="alert" style={{ background: "#FEE2E2", color: "#991B1B", padding: 12, borderRadius: 8 }}>
            {loadError}
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={toggleEdit}
              style={{
                padding: "0.75rem 1.5rem",
                background: "#FF9800",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: 600,
                marginBottom: "1rem",
              }}
            >
              {isEditing ? "Cancel" : "Edit Profile"}
            </button>

            {saveOk && (
              <div role="status" style={{ background: "#D1FAE5", color: "#047857", padding: 12, borderRadius: 8, marginBottom: "1rem" }}>
                {saveOk}
              </div>
            )}
            {saveError && (
              <div role="alert" style={{ background: "#FEE2E2", color: "#991B1B", padding: 12, borderRadius: 8, marginBottom: "1rem" }}>
                {saveError}
              </div>
            )}

            {isEditing ? (
              <div
                className="card"
                style={{
                  padding: "1.5rem",
                  background: "rgba(255, 152, 0, 0.05)",
                  border: "1px solid #FFE0B2",
                }}
              >
                <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Edit Profile</h3>
                <div style={gridCols}>
                  <div>
                    <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>Full name</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        clearFieldError("full_name");
                      }}
                      aria-invalid={!!fieldErrors.full_name}
                      style={{
                        width: "100%",
                        padding: "0.75rem",
                        border: border("full_name"),
                        borderRadius: "6px",
                        boxSizing: "border-box",
                      }}
                    />
                    {fieldErrors.full_name && (
                      <p role="alert" style={{ color: "#DC2626", fontSize: "0.85rem", margin: "0.35rem 0 0 0" }}>
                        {fieldErrors.full_name}
                      </p>
                    )}
                  </div>
                  <div>
                    <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>Email</label>
                    <input
                      type="email"
                      value={email}
                      readOnly
                      disabled
                      title="Email cannot be changed here. Contact support if you need to move your account."
                      style={{
                        width: "100%",
                        padding: "0.75rem",
                        border: "1px solid #E8E8E8",
                        borderRadius: "6px",
                        boxSizing: "border-box",
                        background: "#f5f5f5",
                        color: "#555",
                      }}
                    />
                    <p style={{ margin: "0.35rem 0 0", fontSize: "0.8rem", color: "#888" }}>Sign-in email (read-only).</p>
                  </div>

                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>Phone</label>
                    <PhoneInputRow
                      dialCode={phoneDial}
                      nationalNumber={phoneNational}
                      onDialCodeChange={(d) => {
                        setPhoneDial(d);
                        clearFieldError("phone");
                      }}
                      onNationalChange={(n) => {
                        setPhoneNational(n);
                        clearFieldError("phone");
                      }}
                      error={fieldErrors.phone}
                      nationalPlaceholder="9171234567"
                      selectId="profile-phone-cc"
                      nationalId="profile-phone-national"
                    />
                  </div>

                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>Company (optional)</label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => {
                        setCompanyName(e.target.value);
                        clearFieldError("company_name");
                      }}
                      aria-invalid={!!fieldErrors.company_name}
                      placeholder="Leave blank if not applicable"
                      style={{
                        width: "100%",
                        padding: "0.75rem",
                        border: border("company_name"),
                        borderRadius: "6px",
                        boxSizing: "border-box",
                      }}
                    />
                    {fieldErrors.company_name && (
                      <p role="alert" style={{ color: "#DC2626", fontSize: "0.85rem", margin: "0.35rem 0 0 0" }}>
                        {fieldErrors.company_name}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saveBusy}
                  style={{
                    width: "100%",
                    marginTop: "1rem",
                    padding: "0.75rem",
                    background: "#FF9800",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: saveBusy ? "wait" : "pointer",
                    fontWeight: 600,
                    opacity: saveBusy ? 0.85 : 1,
                  }}
                >
                  {saveBusy ? "Saving…" : "Save changes"}
                </button>
              </div>
            ) : (
              <div className="card" style={{ padding: "1.5rem" }}>
                <div style={gridCols}>
                  <div>
                    <p style={{ color: "#666666", fontSize: "0.9rem", margin: "1rem 0 0.5rem 0" }}>
                      <strong>Name</strong>
                    </p>
                    <p style={{ color: "#1A1A1A", margin: "0 0 1rem 0" }}>{me?.full_name ?? "—"}</p>

                    <p style={{ color: "#666666", fontSize: "0.9rem", margin: "1rem 0 0.5rem 0" }}>
                      <strong>Email</strong>
                    </p>
                    <p style={{ color: "#1A1A1A", margin: "0 0 1rem 0" }}>{emailLooksValid ? email : "—"}</p>

                    <p style={{ color: "#666666", fontSize: "0.9rem", margin: "1rem 0 0.5rem 0" }}>
                      <strong>Phone</strong>
                    </p>
                    <p style={{ color: "#1A1A1A", margin: "0 0 1rem 0" }}>{me?.phone?.trim() ? me.phone : "—"}</p>
                  </div>

                  <div>
                    <p style={{ color: "#666666", fontSize: "0.9rem", margin: "1rem 0 0.5rem 0" }}>
                      <strong>Company</strong>
                    </p>
                    <p style={{ color: "#1A1A1A", margin: "0 0 1rem 0" }}>{me?.company_name?.trim() ? me.company_name : "—"}</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <div
          className="card"
          style={{
            marginTop: "1.5rem",
            padding: "1.5rem",
            background: "rgba(255, 152, 0, 0.04)",
            border: "1px solid #FFE0B2",
          }}
        >
          <h3 style={{ color: "#1A1A1A", margin: "0 0 0.35rem 0" }}>Change password</h3>
          <p style={{ color: "#666666", fontSize: "0.9rem", margin: "0 0 1rem 0" }}>
            For your security, enter your current password and choose a new one (at least 8 characters).
          </p>
          {pwSuccess && (
            <div role="status" style={{ background: "#D1FAE5", color: "#047857", padding: 12, borderRadius: 8, marginBottom: "1rem" }}>
              {pwSuccess}
            </div>
          )}
          {pwError && (
            <div role="alert" style={{ background: "#FEE2E2", color: "#991B1B", padding: 12, borderRadius: 8, marginBottom: "1rem" }}>
              {pwError}
            </div>
          )}
          <div style={{ display: "grid", gap: "1rem", maxWidth: 480 }}>
            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>Current password</label>
              <input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  if (pwError) setPwError(null);
                }}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #E8E8E8",
                  borderRadius: "6px",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>New password</label>
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (pwError) setPwError(null);
                }}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #E8E8E8",
                  borderRadius: "6px",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>Confirm new password</label>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (pwError) setPwError(null);
                }}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #E8E8E8",
                  borderRadius: "6px",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => void handleChangePassword()}
              disabled={pwSubmitting}
              style={{
                padding: "0.75rem 1.25rem",
                background: "#FF9800",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: pwSubmitting ? "wait" : "pointer",
                fontWeight: 600,
                opacity: pwSubmitting ? 0.85 : 1,
                width: "fit-content",
              }}
            >
              {pwSubmitting ? "Updating…" : "Update password"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
