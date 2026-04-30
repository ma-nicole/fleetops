"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Breadcrumbs from "@/components/Breadcrumbs";

export default function SystemSettingsPage() {
  useRoleGuard(["admin"]);
  
  return (
    <div className="container" style={{ paddingTop: "2rem" }}>
      <Breadcrumbs items={[
        { label: "Modules", href: "/dashboard/admin" },
        { label: "System Administration" },
        { label: "System Settings" }
      ]} />
      
      <div style={{ marginTop: "2rem" }}>
        <h1 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>System Settings & Configuration</h1>
        <p style={{ color: "#666666", marginBottom: "1.5rem" }}>
          Module: System Administration & Access → System Settings & Configuration
        </p>

        <div className="card" style={{ marginBottom: "2rem" }}>
          <h2 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Overview</h2>
          <p style={{ color: "#666666", marginBottom: "1rem" }}>
            The System Settings & Configuration submodule allows administrators to configure global system parameters, pricing rules, and operational settings.
          </p>
          <p style={{ color: "#666666" }}>
            This is the final step in the System Administration & Access flow and completes the administrative setup.
          </p>
        </div>

        <div className="card">
          <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Configurable Settings</h3>
          <ul style={{ color: "#666666", paddingLeft: "1.5rem" }}>
            <li>Pricing and fare structure</li>
            <li>Fuel cost calculations and rates</li>
            <li>Labor rates and overtime settings</li>
            <li>Toll management and zones</li>
            <li>Booking policies and constraints</li>
            <li>Fleet configuration and capacity</li>
            <li>System notifications and alerts</li>
            <li>Integration settings and API keys</li>
            <li>Reporting and analytics parameters</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
