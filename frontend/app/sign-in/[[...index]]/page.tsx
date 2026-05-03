"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ApiError, apiLogin } from "@/lib/api";
import { setAuthSession, type UserRole as AuthUserRole, getDashboardPath } from "@/lib/auth";
import { announce } from "@/lib/useAnnouncer";
import AuthSplitLayout from "@/components/auth/AuthSplitLayout";
import FloatingField from "@/components/auth/FloatingField";

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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    if (!validateForm()) return;
    setIsSubmitting(true);

    try {
      const data = await apiLogin(email.trim(), password).catch((err) => {
        if (err instanceof ApiError) {
          if (err.status === 423) {
            throw new Error(err.message || "This account is temporarily locked. Please try again later.");
          }
          if (err.status === 429) {
            throw new Error("Too many attempts. Please wait a few minutes before trying again.");
          }
          if (err.status === 401) {
            throw new Error(err.message || GENERIC_AUTH_ERROR);
          }
          throw new Error(err.message || `Request failed (${err.status}).`);
        }
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
          throw new Error(
            "Cannot connect to the API. Make sure the backend is running and NEXT_PUBLIC_API_URL is set correctly (include /api at the end of a direct URL, e.g. http://127.0.0.1:8000/api, or use /api-proxy with rewrites).",
          );
        }
        throw new Error(GENERIC_AUTH_ERROR);
      });

      const resolvedRole = setAuthSession(data.access_token, data.role) ?? "customer";
      announce("Signed in. Redirecting to your dashboard.");
      router.push(getDashboardPath(resolvedRole as AuthUserRole));
    } catch (err) {
      setError(err instanceof Error ? err.message : GENERIC_AUTH_ERROR);
      setIsSubmitting(false);
    }
  };

  return (
    <AuthSplitLayout
      ctaHeading={
        <>
          Welcome back to
          <span className="auth-cta-title-accent auth-cta-title-accent-block">FleetOpt</span>
        </>
      }
      ctaSubtitle="Need a customer account? Register in a minute."
      ctaHref="/sign-up"
      ctaButtonLabel="Sign up"
    >
      <h1 className="auth-page-title" id="signin-title">
        Log in
      </h1>
      <p className="auth-page-lede">
        Sign in with the email your admin or team uses for FleetOpt. Same account across web and dashboards.
      </p>
      <p className="auth-trust-note" role="note">
        <span className="auth-trust-dot" aria-hidden="true" />
        Secured session — your password is never shown in plain text on screen after you submit.
      </p>

      <form className="auth-form-stack" onSubmit={handleSubmit} noValidate aria-labelledby="signin-title">
        {error ? (
          <div
            ref={errorBannerRef}
            className="auth-banner auth-banner--error"
            role="alert"
            tabIndex={-1}
          >
            <span className="auth-banner-icon" aria-hidden="true">
              !
            </span>
            <div className="auth-banner-text">
              <p className="auth-banner-title">Couldn&apos;t sign you in</p>
              <p className="auth-banner-body">{error}</p>
            </div>
          </div>
        ) : null}

        <FloatingField
          id="signin-email"
          label="Work email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
          }}
          error={fieldErrors.email}
          hint={!fieldErrors.email ? "Use the email tied to your FleetOpt profile." : undefined}
        />

        <div className="auth-password-block">
          <FloatingField
            id="signin-password"
            label="Password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
            }}
            error={fieldErrors.password}
            endSlot={
              <button
                type="button"
                className="auth-icon-btn"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-pressed={showPassword}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            }
          />
          <div className="auth-password-meta">
            <Link href="/support" className="auth-forgot-link">
              Forgot password?
            </Link>
          </div>
        </div>

        <button type="submit" className="auth-primary-btn" disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting ? "Signing in…" : "Log in"}
        </button>
      </form>

      <footer className="auth-form-footer">
        <p className="auth-footnote">
          Trouble signing in?{" "}
          <Link href="/support" className="auth-text-link">
            Contact support
          </Link>
        </p>
      </footer>
    </AuthSplitLayout>
  );
}
