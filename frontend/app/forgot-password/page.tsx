"use client";

import Link from "next/link";
import { useState } from "react";
import { ApiError, apiForgotPassword } from "@/lib/api";
import { isValidEmail } from "@/lib/formValidation";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const mail = email.trim();
    if (!mail) {
      setError("Email is required.");
      return;
    }
    if (!isValidEmail(mail)) {
      setError("Enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiForgotPassword(mail);
      setMessage(res.message || "If the email exists, a password reset link has been sent.");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || "Unable to reset password.");
      } else {
        setError("Unable to reset password.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main style={{ minHeight: "100vh", background: "#FAFAFA", padding: "var(--page-main-padding)" }}>
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
        <h1 style={{ margin: 0 }}>Forgot password</h1>
        <p style={{ margin: 0, color: "#4B5563", fontSize: "0.9rem" }}>
          Enter your account email. We will send a password reset link to your inbox.
        </p>

        <label style={{ display: "grid", gap: "0.35rem" }}>
          <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{
              padding: "0.7rem",
              border: "1px solid #D1D5DB",
              borderRadius: "6px",
            }}
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
          {isSubmitting ? "Sending..." : "Send reset link"}
        </button>

        <Link href="/sign-in" style={{ color: "#2563EB", textDecoration: "none", fontSize: "0.9rem" }}>
          Back to login
        </Link>
      </form>
    </main>
  );
}

