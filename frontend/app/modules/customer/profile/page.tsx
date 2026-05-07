"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Breadcrumbs from "@/components/Breadcrumbs";
import PhoneInputRow from "@/components/PhoneInputRow";
import { apiChangePassword } from "@/lib/api";
import { useState } from "react";
import { DEFAULT_DIAL_CODE } from "@/lib/dialCodes";
import {
  buildInternationalPhone,
  isValidEmail,
  splitInternationalPhone,
  validateFullName,
  validateRequiredInternationalPhone,
} from "@/lib/formValidation";

type CustomerProfile = {
  name: string;
  email: string;
  phone: string;
  company: string;
  business_type: string;
};

type FieldKey = "name" | "email" | "phone" | "company" | "business_type";

type FieldErrors = Partial<Record<FieldKey, string>>;

export default function CustomerProfilePage() {
  useRoleGuard(["customer"]);

  const [profile, setProfile] = useState<CustomerProfile>({
    name: "John Smith",
    email: "john@example.com",
    phone: "+639171234567",
    company: "Smith Logistics",
    business_type: "Logistics Company",
  });

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(profile);
  const [phoneDial, setPhoneDial] = useState(DEFAULT_DIAL_CODE);
  const [phoneNational, setPhoneNational] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);

  const gridCols = {
    display: "grid",
    gap: "1rem",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
  };

  const border = (key: FieldKey) =>
    fieldErrors[key] ? "2px solid #DC2626" : "1px solid #E8E8E8";

  const validate = (): boolean => {
    const next: FieldErrors = {};

    const nameErr = validateFullName(formData.name);
    if (nameErr) next.name = nameErr;

    const mail = formData.email.trim();
    if (!mail) next.email = "Email is required.";
    else if (!isValidEmail(mail)) next.email = "Enter a valid email address.";

    const phoneErr = validateRequiredInternationalPhone(phoneDial, phoneNational);
    if (phoneErr) next.phone = phoneErr;

    if (formData.company.trim().length < 2) next.company = "Company must be at least 2 characters.";
    if (formData.business_type.trim().length < 2) next.business_type = "Business type is required.";

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const phoneStr = buildInternationalPhone(phoneDial, phoneNational);
    setProfile({ ...formData, email: formData.email.trim(), phone: phoneStr });
    setIsEditing(false);
    setFieldErrors({});
  };

  const toggleEdit = () => {
    if (isEditing) {
      setIsEditing(false);
      setFieldErrors({});
      return;
    }
    setFormData(profile);
    const sp = splitInternationalPhone(profile.phone);
    setPhoneDial(sp.dial);
    setPhoneNational(sp.national);
    setFieldErrors({});
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
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem" }}>
           My Profile
        </h1>
        <p style={{ color: "#666666", marginBottom: "1.5rem" }}>
          Manage your account information and preferences.
        </p>

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

        {isEditing ? (
          <div
            className="card"
            style={{
              padding: "1.5rem",
              background: "rgba(255, 152, 0, 0.05)",
              border: "1px solid #FFE0B2",
            }}
          >
            <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>
              Edit Profile
            </h3>
            <div style={gridCols}>
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    clearFieldError("name");
                  }}
                  aria-invalid={!!fieldErrors.name}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: border("name"),
                    borderRadius: "6px",
                    boxSizing: "border-box",
                  }}
                />
                {fieldErrors.name && (
                  <p role="alert" style={{ color: "#DC2626", fontSize: "0.85rem", margin: "0.35rem 0 0 0" }}>{fieldErrors.name}</p>
                )}
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    clearFieldError("email");
                  }}
                  aria-invalid={!!fieldErrors.email}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: border("email"),
                    borderRadius: "6px",
                    boxSizing: "border-box",
                  }}
                />
                {fieldErrors.email && (
                  <p role="alert" style={{ color: "#DC2626", fontSize: "0.85rem", margin: "0.35rem 0 0 0" }}>{fieldErrors.email}</p>
                )}
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Phone
                </label>
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

              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Company
                </label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => {
                    setFormData({ ...formData, company: e.target.value });
                    clearFieldError("company");
                  }}
                  aria-invalid={!!fieldErrors.company}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: border("company"),
                    borderRadius: "6px",
                    boxSizing: "border-box",
                  }}
                />
                {fieldErrors.company && (
                  <p role="alert" style={{ color: "#DC2626", fontSize: "0.85rem", margin: "0.35rem 0 0 0" }}>{fieldErrors.company}</p>
                )}
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Business type
                </label>
                <input
                  type="text"
                  value={formData.business_type}
                  onChange={(e) => {
                    setFormData({ ...formData, business_type: e.target.value });
                    clearFieldError("business_type");
                  }}
                  aria-invalid={!!fieldErrors.business_type}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: border("business_type"),
                    borderRadius: "6px",
                    boxSizing: "border-box",
                  }}
                />
                {fieldErrors.business_type && (
                  <p role="alert" style={{ color: "#DC2626", fontSize: "0.85rem", margin: "0.35rem 0 0 0" }}>{fieldErrors.business_type}</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={handleSave}
              style={{
                width: "100%",
                marginTop: "1rem",
                padding: "0.75rem",
                background: "#FF9800",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Save changes
            </button>
          </div>
        ) : (
          <div className="card" style={{ padding: "1.5rem" }}>
            <div style={gridCols}>
              <div>
                <p style={{ color: "#666666", fontSize: "0.9rem", margin: "1rem 0 0.5rem 0" }}>
                  <strong>Name</strong>
                </p>
                <p style={{ color: "#1A1A1A", margin: "0 0 1rem 0" }}>
                  {profile.name}
                </p>

                <p style={{ color: "#666666", fontSize: "0.9rem", margin: "1rem 0 0.5rem 0" }}>
                  <strong>Email</strong>
                </p>
                <p style={{ color: "#1A1A1A", margin: "0 0 1rem 0" }}>
                  {profile.email}
                </p>

                <p style={{ color: "#666666", fontSize: "0.9rem", margin: "1rem 0 0.5rem 0" }}>
                  <strong>Phone</strong>
                </p>
                <p style={{ color: "#1A1A1A", margin: "0 0 1rem 0" }}>
                  {profile.phone}
                </p>
              </div>

              <div>
                <p style={{ color: "#666666", fontSize: "0.9rem", margin: "1rem 0 0.5rem 0" }}>
                  <strong>Company</strong>
                </p>
                <p style={{ color: "#1A1A1A", margin: "0 0 1rem 0" }}>
                  {profile.company}
                </p>

                <p style={{ color: "#666666", fontSize: "0.9rem", margin: "1rem 0 0.5rem 0" }}>
                  <strong>Business type</strong>
                </p>
                <p style={{ color: "#1A1A1A", margin: 0 }}>
                  {profile.business_type}
                </p>
              </div>
            </div>
          </div>
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
              onClick={handleChangePassword}
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
