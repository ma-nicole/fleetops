"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";

type UserRole = "driver" | "dispatcher" | "manager" | "customer" | "admin";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginRole, setLoginRole] = useState<UserRole>("customer");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const preferredRole = window.localStorage.getItem("preferredLoginRole");
    if (preferredRole && ["driver", "dispatcher", "manager", "admin", "customer"].includes(preferredRole)) {
      setLoginRole(preferredRole as UserRole);
    }
  }, []);

  const isValidEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const validateForm = (): boolean => {
    const nextFieldErrors: { email?: string; password?: string } = {};
    const cleanedEmail = email.trim();

    if (!cleanedEmail) {
      nextFieldErrors.email = "Email is required.";
    } else if (!isValidEmail(cleanedEmail)) {
      nextFieldErrors.email = "Invalid email format.";
    }

    if (!password.trim()) {
      nextFieldErrors.password = "Password is required.";
    }

    setFieldErrors(nextFieldErrors);
    return Object.keys(nextFieldErrors).length === 0;
  };

  const getErrorMessageByRole = (role: string, statusCode: number): string => {
    if (statusCode === 404) {
      if (role === "driver") return "Invalid Account";
      if (role === "dispatcher") return "Invalid User";
      if (role === "manager" || role === "admin") return "Account Not Matched";
    }
    return "Invalid credentials";
  };

  const getRoleDashboardPath = (role: string): string => {
    const roleMap: Record<string, string> = {
      driver: "/driver/dashboard",
      dispatcher: "/dispatcher/dashboard",
      manager: "/manager/dashboard",
      admin: "/admin/dashboard",
      customer: "/dashboard/customer",
    };
    return roleMap[role] || "/dashboard/customer";
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    if (!validateForm()) return;
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          username: email,
          password,
        }),
        cache: "no-store",
      });

      if (!response.ok) {
        const statusCode = response.status;
        await response.text();
        if (statusCode === 429) {
          throw new Error("Too many attempts. Try again in 5 minutes.");
        }
        const errorMessage = getErrorMessageByRole(loginRole, statusCode);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      if (typeof window !== "undefined") {
        window.localStorage.setItem("authToken", data.access_token);
        window.localStorage.setItem("token", data.access_token);
        
        // Get role from response or default based on email pattern
        let userRole: UserRole = (data.role as UserRole) || "customer";
        
        // Fallback role detection from email if not provided
        if (!data.role) {
          if (email.includes("driver")) userRole = "driver";
          else if (email.includes("dispatch")) userRole = "dispatcher";
          else if (email.includes("manager") || email.includes("admin")) userRole = "manager";
        }
        
        window.localStorage.setItem("userRole", userRole);
        window.localStorage.setItem("preferredLoginRole", userRole);
      }

      const dashboardPath = getRoleDashboardPath(data.role || loginRole);
      router.push(dashboardPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in");
      setIsSubmitting(false);
    }
  };

  return (
    <main
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "calc(100vh - 76px)",
        padding: "2rem 1rem",
        background: "radial-gradient(circle at top right, rgba(14,165,233,0.18), transparent 35%), radial-gradient(circle at bottom left, rgba(99,102,241,0.15), transparent 35%)",
      }}
    >
      <div
        className="floating-login-card"
        style={{
          width: 380,
          padding: 24,
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.25)",
          background: "rgba(255,255,255,0.62)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          boxShadow: "0 16px 40px rgba(15,23,42,0.22)",
          animation: "floating-login 4s ease-in-out infinite",
          color: "#1F2937",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "2rem", color: "#111827" }}>Login</h1>
        <p style={{ margin: "0.5rem 0 0 0", color: "#374151", fontSize: "1rem" }}>
          Access your account to continue booking and operations.
        </p>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16, marginTop: 16 }}>
          {error && (
            <div
              aria-live="polite"
              style={{
                color: "#991B1B",
                background: "#FEE2E2",
                border: "1px solid #FCA5A5",
                borderRadius: 8,
                padding: "0.65rem 0.75rem",
                fontSize: "0.95rem",
              }}
            >
              {error}
            </div>
          )}
          <label style={{ display: "grid", gap: 8 }}>
            Account Role (optional)
            <select
              value={loginRole}
              onChange={(event) => setLoginRole(event.target.value as UserRole)}
              style={{ width: "100%", minHeight: 44, padding: 10, borderRadius: 8, border: "1px solid #9CA3AF", background: "#FFFFFF", color: "#111827" }}
            >
              <option value="driver" style={{ color: "black" }}>Driver / Operator</option>
              <option value="dispatcher" style={{ color: "black" }}>Dispatcher / Warehouse</option>
              <option value="manager" style={{ color: "black" }}>Manager / Executive</option>
              <option value="customer" style={{ color: "black" }}>Customer</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 8 }}>
            Email
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
              style={{ width: "100%", minHeight: 44, padding: 10, borderRadius: 8, border: fieldErrors.email ? "1px solid #DC2626" : "1px solid #9CA3AF", background: "#FFFFFF", color: "#111827", fontSize: "1rem" }}
            />
            {fieldErrors.email && (
              <span id="login-email-error" style={{ color: "#B91C1C", fontSize: "0.9rem" }}>
                {fieldErrors.email}
              </span>
            )}
          </label>
          <label style={{ display: "grid", gap: 8 }}>
            Password
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
                style={{ width: "100%", minHeight: 44, padding: 10, borderRadius: 8, border: fieldErrors.password ? "1px solid #DC2626" : "1px solid #9CA3AF", background: "#FFFFFF", color: "#111827", fontSize: "1rem" }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                style={{ minHeight: 44, minWidth: 44, padding: "0 0.8rem", borderRadius: 8, border: "1px solid #9CA3AF", background: "#FFFFFF", color: "#111827", cursor: "pointer", fontSize: "0.9rem" }}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {fieldErrors.password && (
              <span id="login-password-error" style={{ color: "#B91C1C", fontSize: "0.9rem" }}>
                {fieldErrors.password}
              </span>
            )}
          </label>
          <Link href="/modules/customer/support" style={{ color: "#1D4ED8", textDecoration: "underline", fontSize: "0.95rem", minHeight: 44, display: "inline-flex", alignItems: "center" }}>
            Forgot password?
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            style={{ minHeight: 44, padding: 12, borderRadius: 10, border: "none", background: "#0284C7", color: "white", cursor: isSubmitting ? "not-allowed" : "pointer", fontSize: "1rem", fontWeight: 600 }}
          >
            {isSubmitting ? "Logging in..." : "Log in"}
          </button>
        </form>
        <p style={{ marginTop: 16, color: "#374151", fontSize: "1rem" }}>
          No account? <Link href="/sign-up">Sign up</Link>
        </p>
      </div>
      <style jsx>{`
        @keyframes floating-login {
          0% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-8px);
          }
          100% {
            transform: translateY(0px);
          }
        }
        :global(input:focus-visible),
        :global(select:focus-visible),
        :global(button:focus-visible),
        :global(a:focus-visible) {
          outline: 3px solid #2563eb;
          outline-offset: 2px;
        }
        @media (prefers-reduced-motion: reduce) {
          .floating-login-card {
            animation: none !important;
          }
        }
      `}</style>
    </main>
  );
}
