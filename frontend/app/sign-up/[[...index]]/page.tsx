"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";

const roles = [
  { value: "customer", label: "Customer" },
  { value: "dispatcher", label: "Dispatcher" },
  { value: "driver", label: "Driver" },
  { value: "manager", label: "Manager" },
];

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("customer");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          full_name: fullName,
          phone: phone || undefined,
          role,
        }),
        cache: "no-store",
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || "Unable to register");
      }

      setSuccess("Account created successfully. Redirecting to sign in...");
      setTimeout(() => router.push("/sign-in"), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to register");
      setIsSubmitting(false);
    }
  };

  return (
    <main style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
      <div style={{ width: 420, padding: 24, background: "rgba(255,255,255,0.04)", borderRadius: 16 }}>
        <h1>Sign Up</h1>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16, marginTop: 16 }}>
          <label style={{ display: "grid", gap: 8 }}>
            Full Name
            <input
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
              placeholder="Jane Doe"
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid rgba(255,255,255,0.16)", background: "rgba(255,255,255,0.06)", color: "white" }}
            />
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
          <label style={{ display: "grid", gap: 8 }}>
            Phone
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Optional"
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid rgba(255,255,255,0.16)", background: "rgba(255,255,255,0.06)", color: "white" }}
            />
          </label>
          <label style={{ display: "grid", gap: 8 }}>
            Role
            <select
              value={role}
              onChange={(event) => setRole(event.target.value)}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.16)",
                background: "#ffffff",
                color: "#000000",
                WebkitAppearance: "menulist",
                MozAppearance: "menulist",
              }}
            >
              {roles.map((option) => (
                <option key={option.value} value={option.value} style={{ color: "#000000" }}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {error && <div style={{ color: "#ff6b6b" }}>{error}</div>}
          {success && <div style={{ color: "#8ce99a" }}>{success}</div>}
          <button
            type="submit"
            disabled={isSubmitting}
            style={{ padding: 12, borderRadius: 10, border: "none", background: "#0ea5e9", color: "white", cursor: isSubmitting ? "not-allowed" : "pointer" }}
          >
            {isSubmitting ? "Registering…" : "Sign Up"}
          </button>
        </form>
        <p style={{ marginTop: 16, color: "rgba(255,255,255,0.7)" }}>
          Already have an account? <Link href="/sign-in">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
