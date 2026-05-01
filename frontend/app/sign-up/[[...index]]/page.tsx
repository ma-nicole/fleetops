"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
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
          role: "customer",
        }),
        cache: "no-store",
      });

      if (!response.ok) {
        const body = await response.text();
        let message = "Unable to register";
        try {
          const parsed = JSON.parse(body);
          message = parsed.detail || message;
        } catch {
          if (body) message = body;
        }
        throw new Error(message);
      }

      setSuccess("Customer account created. Redirecting to sign in...");
      setTimeout(() => router.push("/sign-in"), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to register");
      setIsSubmitting(false);
    }
  };

  return (
    <main style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
      <div style={{ width: 420, padding: 24, background: "rgba(255,255,255,0.04)", borderRadius: 16 }}>
        <h1 style={{ marginBottom: 4 }}>Create a customer account</h1>
        <p style={{ marginTop: 0, color: "rgba(255,255,255,0.7)", fontSize: "0.9rem" }}>
          Self-registration is for customers only. Drivers, dispatchers, and managers receive their accounts from the administrator.
        </p>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16, marginTop: 16 }}>
          {error && (
            <div role="alert" aria-live="assertive" style={{ color: "#ff6b6b", fontSize: "0.95rem" }}>
              {error}
            </div>
          )}
          {success && (
            <div role="status" aria-live="polite" style={{ color: "#8ce99a", fontSize: "0.95rem" }}>
              {success}
            </div>
          )}
          <label style={{ display: "grid", gap: 8 }}>
            Full Name
            <input
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
              placeholder="Jane Doe"
              autoComplete="name"
              style={{ width: "100%", minHeight: 44, padding: 10, borderRadius: 8, border: "1px solid rgba(255,255,255,0.16)", background: "rgba(255,255,255,0.06)", color: "white", fontSize: "1rem" }}
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
              autoComplete="email"
              style={{ width: "100%", minHeight: 44, padding: 10, borderRadius: 8, border: "1px solid rgba(255,255,255,0.16)", background: "rgba(255,255,255,0.06)", color: "white", fontSize: "1rem" }}
            />
          </label>
          <label style={{ display: "grid", gap: 8 }}>
            Password
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                style={{ width: "100%", minHeight: 44, padding: 10, borderRadius: 8, border: "1px solid rgba(255,255,255,0.16)", background: "rgba(255,255,255,0.06)", color: "white", fontSize: "1rem" }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-pressed={showPassword}
                aria-label={showPassword ? "Hide password" : "Show password"}
                style={{ minHeight: 44, minWidth: 44, padding: "0 0.8rem", borderRadius: 8, border: "1px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.08)", color: "white", cursor: "pointer", fontSize: "0.9rem" }}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>
          <label style={{ display: "grid", gap: 8 }}>
            Phone <span style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.6)" }}>(optional)</span>
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+63-917-…"
              autoComplete="tel"
              style={{ width: "100%", minHeight: 44, padding: 10, borderRadius: 8, border: "1px solid rgba(255,255,255,0.16)", background: "rgba(255,255,255,0.06)", color: "white", fontSize: "1rem" }}
            />
          </label>
          <button
            type="submit"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
            style={{ minHeight: 44, padding: 12, borderRadius: 10, border: "none", background: "#0ea5e9", color: "white", cursor: isSubmitting ? "not-allowed" : "pointer", fontSize: "1rem", fontWeight: 600 }}
          >
            {isSubmitting ? "Registering…" : "Create customer account"}
          </button>
        </form>
        <p style={{ marginTop: 16, color: "rgba(255,255,255,0.7)" }}>
          Already have an account? <Link href="/sign-in">Sign in</Link>
        </p>
        <p style={{ marginTop: 8, color: "rgba(255,255,255,0.55)", fontSize: "0.85rem" }}>
          Are you staff? Ask your administrator to create your account.
        </p>
      </div>
      <style jsx>{`
        :global(input:focus-visible),
        :global(select:focus-visible),
        :global(button:focus-visible),
        :global(a:focus-visible) {
          outline: 3px solid #93c5fd;
          outline-offset: 2px;
        }
      `}</style>
    </main>
  );
}
