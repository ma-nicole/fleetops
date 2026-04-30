"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Breadcrumbs from "@/components/Breadcrumbs";

export default function AccessControlPage() {
  useRoleGuard(["admin"]);
  
  return (
    <div className="container" style={{ paddingTop: "2rem" }}>
      <Breadcrumbs items={[
        { label: "Modules", href: "/dashboard/admin" },
        { label: "System Administration" },
        { label: "Access Control" }
      ]} />
      
      <div style={{ marginTop: "2rem" }}>
        <h1 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Role-Based Access Control</h1>
        <p style={{ color: "#666666", marginBottom: "1.5rem" }}>
          Module: System Administration & Access → Access Control
        </p>

        <div className="card" style={{ marginBottom: "2rem" }}>
          <h2 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Overview</h2>
          <p style={{ color: "#666666", marginBottom: "1rem" }}>
            The Role-Based Access Control (RBAC) submodule defines and manages user roles, permissions, and access levels across the FleetOpt system.
          </p>
          <p style={{ color: "#666666" }}>
            This module ensures that users can only access features and data appropriate for their role.
          </p>
        </div>

        <div className="card" style={{ marginBottom: "2rem" }}>
          <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>System Roles</h3>
          <ul style={{ color: "#666666", paddingLeft: "1.5rem" }}>
            <li><strong>Admin</strong> - Full system access and configuration</li>
            <li><strong>Manager</strong> - Analytics, reporting, and fleet oversight</li>
            <li><strong>Dispatcher</strong> - Trip assignment and scheduling</li>
            <li><strong>Driver</strong> - Personal trip and fuel tracking</li>
            <li><strong>Customer</strong> - Booking and shipment tracking</li>
          </ul>
        </div>

        <div className="card">
          <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Features</h3>
          <ul style={{ color: "#666666", paddingLeft: "1.5rem" }}>
            <li>Define and manage user roles</li>
            <li>Assign permissions to roles</li>
            <li>Control module and feature visibility</li>
            <li>Data-level access restrictions</li>
            <li>Activity logging and audit trails</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
