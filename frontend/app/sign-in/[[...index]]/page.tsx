"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

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
        const body = await response.text();
        throw new Error(body || "Invalid credentials");
      }

      const data = await response.json();
      if (typeof window !== "undefined") {
        window.localStorage.setItem("authToken", data.access_token);
      }

      router.push("/");
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
