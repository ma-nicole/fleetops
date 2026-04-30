"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Breadcrumbs from "@/components/Breadcrumbs";

export default function AccountManagementPage() {
  useRoleGuard(["admin", "manager"]);
  
  return (
    <div className="container" style={{ paddingTop: "2rem" }}>
      <Breadcrumbs items={[
        { label: "Modules", href: "/dashboard/admin" },
        { label: "System Administration" },
        { label: "Account Management" }
      ]} />
      
      <div style={{ marginTop: "2rem" }}>
        <h1 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Account Management</h1>
        <p style={{ color: "#666666", marginBottom: "1.5rem" }}>
          Module: System Administration & Access → Account Management
        </p>

        <div className="card" style={{ marginBottom: "2rem" }}>
          <h2 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Overview</h2>
          <p style={{ color: "#666666", marginBottom: "1rem" }}>
            The Account Management submodule allows administrators to manage user accounts, profiles, and account settings.
          </p>
          <p style={{ color: "#666666" }}>
            Admins can create, modify, deactivate, and monitor user accounts across the system.
          </p>
        </div>

        <div className="card">
          <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Features</h3>
          <ul style={{ color: "#666666", paddingLeft: "1.5rem" }}>
            <li>Create and manage user accounts</li>
            <li>Assign roles and permissions to users</li>
            <li>View and edit user profiles</li>
            <li>Reset passwords and manage credentials</li>
            <li>Activate and deactivate accounts</li>
            <li>Track user activity and login history</li>
            <li>Manage user contact information</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
