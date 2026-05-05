"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ApiError, apiResetPassword } from "@/lib/api";
import { validateConfirmPassword, validateCustomerPassword } from "@/lib/formValidation";

export default function ResetPasswordPage() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!token) {
      setError("Reset token is missing. Open the reset link from your email.");
      return;
    }
    const pwErr = validateCustomerPassword(newPassword);
    if (pwErr) {
      setError(pwErr);
      return;
    }
    const confirmErr = validateConfirmPassword(newPassword, confirmPassword);
    if (confirmErr) {
      setError(confirmErr);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiResetPassword(token, newPassword);
      setMessage(res.message || "Password updated successfully.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      if (err instanceof ApiError) setError(err.message || "Unable to reset password.");
      else setError("Unable to reset password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main style={{ minHeight: "100vh", background: "#FAFAFA", padding: "2rem" }}>
      <form
        onSubmit={submit}
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
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 8 characters"
            style={{ padding: "0.7rem", border: "1px solid #D1D5DB", borderRadius: "6px" }}
          />
        </label>

        <label style={{ display: "grid", gap: "0.35rem" }}>
          <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Confirm password</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repeat your new password"
            style={{ padding: "0.7rem", border: "1px solid #D1D5DB", borderRadius: "6px" }}
          />
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
            background: "#3B82F6",
            color: "white",
            fontWeight: 600,
            padding: "0.65rem 1rem",
            cursor: isSubmitting ? "not-allowed" : "pointer",
          }}
        >
          {isSubmitting ? "Updating..." : "Update password"}
        </button>

        <Link href="/sign-in" style={{ color: "#2563EB", textDecoration: "none", fontSize: "0.9rem" }}>
          Back to login
        </Link>
      </form>
    </main>
  );
}

