"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiLogin } from "@/lib/api";
import { setAuthSession, type UserRole as AuthUserRole, getDashboardPath } from "@/lib/auth";
import { announce } from "@/lib/useAnnouncer";

const GENERIC_AUTH_ERROR = "Email or password is incorrect.";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const errorBannerRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  // When a form-level error appears, move focus to it so screen-reader and
  // keyboard users hear the new context immediately.
  useEffect(() => {
    if (error && errorBannerRef.current) {
      errorBannerRef.current.focus();
      announce(error, "assertive");
    }
  }, [error]);

  const isValidEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const validateForm = (): boolean => {
    const nextFieldErrors: { email?: string; password?: string } = {};
    const cleanedEmail = email.trim();

    if (!cleanedEmail) {
      nextFieldErrors.email = "Email is required.";
    } else if (!isValidEmail(cleanedEmail)) {
      nextFieldErrors.email = "Enter a valid email address (e.g. you@example.com).";
    }

    if (!password.trim()) {
      nextFieldErrors.password = "Password is required.";
    }

    setFieldErrors(nextFieldErrors);
    return Object.keys(nextFieldErrors).length === 0;
  };

  const getRoleDashboardPath = (role: AuthUserRole): string => getDashboardPath(role);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    if (!validateForm()) return;
    setIsSubmitting(true);

    try {
      const data = await apiLogin(email, password).catch((err) => {
        const status = (err as { status?: number })?.status ?? 500;
        const body = (err as { body?: string })?.body || "";
        if (status === 423) {
          throw new Error(body || "This account is temporarily locked. Please try again later.");
        }
        if (status === 429) {
          throw new Error("Too many attempts. Please wait a few minutes before trying again.");
        }
        throw new Error(GENERIC_AUTH_ERROR);
      });

      // Role comes from the JWT — no need for the user to select it.
      const resolvedRole = setAuthSession(data.access_token) || "customer";
      announce("Signed in. Redirecting to your dashboard.");
      router.push(getRoleDashboardPath(resolvedRole as AuthUserRole));
    } catch (err) {
      setError(err instanceof Error ? err.message : GENERIC_AUTH_ERROR);
      setIsSubmitting(false);
    }
  };

  return (
    <section
      aria-labelledby="signin-title"
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "calc(100vh - 76px)",
        padding: "2rem 1rem",
        background:
          "radial-gradient(circle at top right, rgba(14,165,233,0.18), transparent 35%), radial-gradient(circle at bottom left, rgba(99,102,241,0.15), transparent 35%)",
      }}
    >
      <div
        className="floating-login-card"
        style={{
          width: "min(380px, 100%)",
          padding: 24,
          borderRadius: 18,
          border: "1px solid rgba(15,23,42,0.08)",
          background: "rgba(255,255,255,0.96)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          color: "#1F2937",
        }}
      >
        <h1 id="signin-title" style={{ margin: 0, fontSize: "2rem", color: "#111827" }}>
          Log in
        </h1>
        <p style={{ margin: "0.5rem 0 0 0", color: "#374151", fontSize: "1rem" }}>
          Access your account to continue with bookings and operations.
        </p>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16, marginTop: 16 }} noValidate>
          {error && (
            <div
              ref={errorBannerRef}
              role="alert"
              tabIndex={-1}
              style={{
                color: "#991B1B",
                background: "#FEE2E2",
                border: "1px solid #FCA5A5",
                borderRadius: 8,
                padding: "0.65rem 0.75rem",
                fontSize: "0.95rem",
                outline: "none",
              }}
            >
              <strong style={{ display: "block", marginBottom: 2 }}>Couldn&apos;t sign you in</strong>
              {error}
            </div>
          )}

          <label style={{ display: "grid", gap: 8 }}>
            <span>
              Email <span aria-hidden="true">*</span>
              <span className="sr-only"> (required)</span>
            </span>
            <input
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
              }}
              required
              placeholder="you@example.com"
              autoComplete="email"
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? "login-email-error" : undefined}
              style={{
                width: "100%",
                minHeight: 44,
                padding: 10,
                borderRadius: 8,
                border: fieldErrors.email ? "1px solid #B91C1C" : "1px solid #6B7280",
                background: "#FFFFFF",
                color: "#111827",
                fontSize: "1rem",
              }}
            />
            {fieldErrors.email && (
              <span id="login-email-error" role="alert" style={{ color: "#991B1B", fontSize: "0.9rem" }}>
                {fieldErrors.email}
              </span>
            )}
          </label>

          <label style={{ display: "grid", gap: 8 }}>
            <span>
              Password <span aria-hidden="true">*</span>
              <span className="sr-only"> (required)</span>
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
                }}
                required
                placeholder="At least 6 characters"
                autoComplete="current-password"
                aria-invalid={!!fieldErrors.password}
                aria-describedby={fieldErrors.password ? "login-password-error" : undefined}
                style={{
                  width: "100%",
                  minHeight: 44,
                  padding: 10,
                  borderRadius: 8,
                  border: fieldErrors.password ? "1px solid #B91C1C" : "1px solid #6B7280",
                  background: "#FFFFFF",
                  color: "#111827",
                  fontSize: "1rem",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-pressed={showPassword}
                aria-label={showPassword ? "Hide password" : "Show password"}
                style={{
                  minHeight: 44,
                  minWidth: 44,
                  padding: "0 0.8rem",
                  borderRadius: 8,
                  border: "1px solid #6B7280",
                  background: "#FFFFFF",
                  color: "#111827",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                }}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {fieldErrors.password && (
              <span id="login-password-error" role="alert" style={{ color: "#991B1B", fontSize: "0.9rem" }}>
                {fieldErrors.password}
              </span>
            )}
          </label>

          <Link
            href="/modules/customer/support"
            style={{
              color: "#1D4ED8",
              textDecoration: "underline",
              fontSize: "0.95rem",
              minHeight: 44,
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Forgot password?
          </Link>

          <button
            type="submit"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
            style={{
              minHeight: 44,
              padding: 12,
              borderRadius: 10,
              border: "none",
              background: isSubmitting ? "#0369A1" : "#0284C7",
              color: "white",
              cursor: isSubmitting ? "wait" : "pointer",
              fontSize: "1rem",
              fontWeight: 600,
            }}
          >
            {isSubmitting ? "Logging in…" : "Log in"}
          </button>
        </form>
        <p style={{ marginTop: 16, color: "#374151", fontSize: "1rem" }}>
          No account?{" "}
          <Link href="/sign-up" style={{ color: "#1D4ED8", textDecoration: "underline" }}>
            Sign up
          </Link>
        </p>
      </div>
      <style jsx>{`
        :global(input:focus-visible),
        :global(select:focus-visible),
        :global(button:focus-visible),
        :global(a:focus-visible) {
          outline: 3px solid #1D4ED8;
          outline-offset: 2px;
        }
      `}</style>
    </section>
  );
}
