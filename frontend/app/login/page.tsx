"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CustomerDataFlowService } from "@/lib/customerDataFlowService";
import { isValidEmail } from "@/lib/formValidation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const validate = (): boolean => {
    const next: { email?: string; password?: string } = {};
    const mail = email.trim();
    if (!mail) next.email = "Email is required.";
    else if (!isValidEmail(mail)) next.email = "Enter a valid email address.";
    if (!password) next.password = "Password is required.";
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!validate()) return;
    const result = CustomerDataFlowService.login(email.trim(), password);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.push("/booking");
  };

  return (
    <main style={{ padding: "2rem", minHeight: "100vh", background: "#FAFAFA" }}>
      <form
        onSubmit={submit}
        style={{ maxWidth: "460px", margin: "0 auto", background: "white", border: "1px solid #E8E8E8", borderRadius: "10px", padding: "1.2rem", display: "grid", gap: "0.7rem" }}
        noValidate
      >
        <h1 style={{ margin: 0 }}>Login</h1>
        <label style={{ display: "grid", gap: "0.35rem" }}>
          <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined }));
            }}
            placeholder="you@example.com"
            aria-invalid={!!fieldErrors.email}
            style={{
              padding: "0.7rem",
              border: fieldErrors.email ? "2px solid #DC2626" : "1px solid #D1D5DB",
              borderRadius: "6px",
            }}
          />
          {fieldErrors.email && (
            <span role="alert" style={{ color: "#DC2626", fontSize: "0.85rem" }}>{fieldErrors.email}</span>
          )}
        </label>
        <label style={{ display: "grid", gap: "0.35rem" }}>
          <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined }));
            }}
            placeholder="Password"
            aria-invalid={!!fieldErrors.password}
            style={{
              padding: "0.7rem",
              border: fieldErrors.password ? "2px solid #DC2626" : "1px solid #D1D5DB",
              borderRadius: "6px",
            }}
          />
          {fieldErrors.password && (
            <span role="alert" style={{ color: "#DC2626", fontSize: "0.85rem" }}>{fieldErrors.password}</span>
          )}
        </label>
        {error && <p style={{ margin: 0, color: "#DC2626" }} role="alert">{error}</p>}
        <button type="submit" style={{ border: "none", borderRadius: "6px", background: "#3B82F6", color: "white", fontWeight: 600, padding: "0.65rem 1rem", cursor: "pointer" }}>
          Login
        </button>
        <Link href="/register" style={{ color: "#2563EB", textDecoration: "none", fontSize: "0.9rem" }}>No account yet? Register</Link>
      </form>
    </main>
  );
}
