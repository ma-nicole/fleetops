"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Breadcrumbs from "@/components/Breadcrumbs";

export default function AuthenticationPage() {
  useRoleGuard(["admin"]);
  
  return (
    <div className="container" style={{ paddingTop: "2rem" }}>
      <Breadcrumbs items={[
        { label: "Modules", href: "/dashboard/admin" },
        { label: "System Administration" },
        { label: "Authentication" }
      ]} />
      
      <div style={{ marginTop: "2rem" }}>
        <h1 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Authentication</h1>
        <p style={{ color: "#666666", marginBottom: "1.5rem" }}>
          Module: System Administration & Access → Authentication
        </p>

        <div className="card" style={{ marginBottom: "2rem" }}>
          <h2 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Overview</h2>
          <p style={{ color: "#666666", marginBottom: "1rem" }}>
            The Authentication submodule handles user login, registration, password management, and session management.
          </p>
          <p style={{ color: "#666666" }}>
            This is the first step in the System Administration & Access flow and is required before users can access any other features.
          </p>
        </div>

        <div className="card">
          <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Features</h3>
          <ul style={{ color: "#666666", paddingLeft: "1.5rem" }}>
            <li>User registration and sign-up</li>
            <li>Secure login with password verification</li>
            <li>Password reset and recovery</li>
            <li>Session management and token handling</li>
            <li>Multi-factor authentication support</li>
            <li>Account security and encryption</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
