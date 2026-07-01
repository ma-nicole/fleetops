"use client";

import Link from "next/link";
import { useState } from "react";
import { ApiError, apiForgotPassword } from "@/lib/api";
import {
  AUTH_EMAIL_MAX_LENGTH,
  sanitizeAuthEmail,
  validateForgotPasswordEmail,
} from "@/lib/formValidation";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setFieldError(null);
    setMessage(null);

    const emailErr = validateForgotPasswordEmail(email);
    if (emailErr) {
      setFieldError(emailErr);
      return;
    }

    const mail = sanitizeAuthEmail(email);
    setIsSubmitting(true);
    try {
      const res = await apiForgotPassword(mail);
      setMessage(res.message || "If the email exists, a password reset link has been sent.");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || "Unable to send reset link. Please try again.");
      } else {
        setError("Unable to send reset link. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main style={{ minHeight: "100vh", background: "#FAFAFA", padding: "var(--page-main-padding)" }}>
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
        <h1 style={{ margin: 0 }}>Forgot password</h1>
        <p style={{ margin: 0, color: "#4B5563", fontSize: "0.9rem" }}>
          Enter your account email. We will send a password reset link to your inbox.
        </p>

        <label style={{ display: "grid", gap: "0.35rem" }}>
          <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Email</span>
          <input
            type="email"
            value={email}
            maxLength={AUTH_EMAIL_MAX_LENGTH}
            autoComplete="email"
            inputMode="email"
            aria-invalid={!!fieldError}
            onChange={(e) => {
              setEmail(sanitizeAuthEmail(e.target.value));
              if (fieldError) setFieldError(null);
            }}
            placeholder="you@example.com"
            style={{
              padding: "0.7rem",
              border: fieldError ? "1px solid #DC2626" : "1px solid #D1D5DB",
              borderRadius: "6px",
            }}
          />
          {fieldError ? (
            <span role="alert" style={{ color: "#DC2626", fontSize: "0.85rem" }}>
              {fieldError}
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
          {isSubmitting ? "Sending..." : "Send reset link"}
        </button>

        <Link href="/sign-in" style={{ color: "var(--brand-text)", textDecoration: "none", fontSize: "0.9rem" }}>
          Back to login
        </Link>
      </form>
    </main>
  );
}
