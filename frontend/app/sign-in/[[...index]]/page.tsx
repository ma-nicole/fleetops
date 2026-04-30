"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";

type UserRole = "driver" | "dispatcher" | "manager" | "customer" | "admin";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginRole, setLoginRole] = useState<UserRole>("driver");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

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
        const body = await response.text();
        
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
      }

      const dashboardPath = getRoleDashboardPath(data.role || loginRole);
      router.push(dashboardPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in");
      setIsSubmitting(false);
    }
  };

  return (
    <main style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
      <div style={{ width: 360, padding: 24, background: "rgba(255,255,255,0.04)", borderRadius: 16 }}>
        <h1>Sign In</h1>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16, marginTop: 16 }}>
          <label style={{ display: "grid", gap: 8 }}>
            Company Account Role
            <select
              value={loginRole}
              onChange={(event) => setLoginRole(event.target.value as UserRole)}
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid rgba(255,255,255,0.16)", background: "rgba(255,255,255,0.06)", color: "white" }}
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
              onChange={(event) => setEmail(event.target.value)}
              required
              placeholder="you@example.com"
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid rgba(255,255,255,0.16)", background: "rgba(255,255,255,0.06)", color: "white" }}
            />
          </label>
          <label style={{ display: "grid", gap: 8 }}>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              placeholder="••••••••"
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid rgba(255,255,255,0.16)", background: "rgba(255,255,255,0.06)", color: "white" }}
            />
          </label>
          {error && <div style={{ color: "#ff6b6b" }}>{error}</div>}
          <button
            type="submit"
            disabled={isSubmitting}
            style={{ padding: 12, borderRadius: 10, border: "none", background: "#0ea5e9", color: "white", cursor: isSubmitting ? "not-allowed" : "pointer" }}
          >
            {isSubmitting ? "Signing in…" : "Sign In"}
          </button>
        </form>
        <p style={{ marginTop: 16, color: "rgba(255,255,255,0.7)" }}>
          Need an account? <Link href="/sign-up">Sign up</Link>
        </p>
      </div>
    </main>
  );
}
