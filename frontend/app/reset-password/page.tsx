"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ApiError, apiResetPassword } from "@/lib/api";
import PasswordRequirements from "@/components/auth/PasswordRequirements";
import {
  AUTH_PASSWORD_MAX_LENGTH,
  sanitizeAuthPassword,
  validateConfirmPassword,
  validateCustomerPassword,
} from "@/lib/formValidation";

function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ newPassword?: string; confirmPassword?: string }>({});
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const nextFieldErrors: { newPassword?: string; confirmPassword?: string } = {};

    if (!token.trim()) {
      setError("Reset token is missing. Open the reset link from your email.");
      return;
    }

    const safePassword = sanitizeAuthPassword(newPassword);
    const pwErr = validateCustomerPassword(safePassword);
    if (pwErr) nextFieldErrors.newPassword = pwErr;

    const confirmErr = validateConfirmPassword(safePassword, sanitizeAuthPassword(confirmPassword));
    if (confirmErr) nextFieldErrors.confirmPassword = confirmErr;

    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      const res = await apiResetPassword(token.trim(), safePassword);
      setMessage(res.message || "Password updated successfully.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      if (err instanceof ApiError) setError(err.message || "Unable to reset password. Please try again.");
      else setError("Unable to reset password. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      style={{
        maxWidth: "460px",
        margin: "0 auto",
        background: "#FFFFFF",
        border: "1px solid #E8E8E8",
        borderRadius: "10px",
        padding: "1.2rem",
        display: "grid",
        gap: "0.8rem",
      }}
    >
      <h1 style={{ margin: 0 }}>Set new password</h1>
      <p style={{ margin: 0, color: "#4B5563", fontSize: "0.9rem" }}>
        Create a new password for your account.
      </p>

      <label style={{ display: "grid", gap: "0.35rem" }}>
        <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>New password</span>
        <input
          type="password"
          value={newPassword}
          maxLength={AUTH_PASSWORD_MAX_LENGTH}
          autoComplete="new-password"
          aria-invalid={!!fieldErrors.newPassword}
          onChange={(e) => {
            setNewPassword(sanitizeAuthPassword(e.target.value));
            if (fieldErrors.newPassword) setFieldErrors((prev) => ({ ...prev, newPassword: undefined }));
          }}
          placeholder="Create a strong password"
          style={{
            padding: "0.7rem",
            border: fieldErrors.newPassword ? "1px solid #DC2626" : "1px solid #D1D5DB",
            borderRadius: "6px",
          }}
        />
        {fieldErrors.newPassword ? (
          <span role="alert" style={{ color: "#DC2626", fontSize: "0.85rem" }}>
            {fieldErrors.newPassword}
          </span>
        ) : null}
      </label>

      <PasswordRequirements password={newPassword} />

      <label style={{ display: "grid", gap: "0.35rem" }}>
        <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Confirm password</span>
        <input
          type="password"
          value={confirmPassword}
          maxLength={AUTH_PASSWORD_MAX_LENGTH}
          autoComplete="new-password"
          aria-invalid={!!fieldErrors.confirmPassword}
          onChange={(e) => {
            setConfirmPassword(sanitizeAuthPassword(e.target.value));
            if (fieldErrors.confirmPassword) setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
          }}
          placeholder="Repeat your new password"
          style={{
            padding: "0.7rem",
            border: fieldErrors.confirmPassword ? "1px solid #DC2626" : "1px solid #D1D5DB",
            borderRadius: "6px",
          }}
        />
        {fieldErrors.confirmPassword ? (
          <span role="alert" style={{ color: "#DC2626", fontSize: "0.85rem" }}>
            {fieldErrors.confirmPassword}
          </span>
        ) : null}
      </label>

      {error ? (
        <p role="alert" style={{ margin: 0, color: "#DC2626" }}>
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" style={{ margin: 0, color: "#166534" }}>
          {message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        style={{
          border: "none",
          borderRadius: "6px",
          background: "var(--accent)",
          color: "white",
          fontWeight: 600,
          padding: "0.65rem 1rem",
          cursor: isSubmitting ? "not-allowed" : "pointer",
        }}
      >
        {isSubmitting ? "Updating..." : "Update password"}
      </button>

      <Link href="/sign-in" style={{ color: "var(--brand-text)", textDecoration: "none", fontSize: "0.9rem" }}>
        Back to login
      </Link>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#FAFAFA", padding: "var(--page-main-padding)" }}>
      <Suspense
        fallback={
          <div style={{ maxWidth: "460px", margin: "0 auto", padding: "1.2rem", color: "#6B7280" }}>Loading…</div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}
