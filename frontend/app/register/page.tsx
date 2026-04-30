"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CustomerDataFlowService } from "@/lib/customerDataFlowService";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    const result = CustomerDataFlowService.register(fullName, email, password);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.push("/login");
  };

  return (
    <main style={{ padding: "2rem", minHeight: "100vh", background: "#FAFAFA" }}>
      <div style={{ maxWidth: "460px", margin: "0 auto", background: "white", border: "1px solid #E8E8E8", borderRadius: "10px", padding: "1.2rem", display: "grid", gap: "0.7rem" }}>
        <h1 style={{ margin: 0 }}>Register</h1>
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" style={{ padding: "0.7rem", border: "1px solid #D1D5DB", borderRadius: "6px" }} />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" style={{ padding: "0.7rem", border: "1px solid #D1D5DB", borderRadius: "6px" }} />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" style={{ padding: "0.7rem", border: "1px solid #D1D5DB", borderRadius: "6px" }} />
        {error && <p style={{ margin: 0, color: "#DC2626" }}>{error}</p>}
        <button onClick={submit} style={{ border: "none", borderRadius: "6px", background: "#10B981", color: "white", fontWeight: 600, padding: "0.65rem 1rem", cursor: "pointer" }}>Create Account</button>
        <Link href="/login" style={{ color: "#2563EB", textDecoration: "none", fontSize: "0.9rem" }}>Already registered? Login</Link>
      </div>
    </main>
  );
}

