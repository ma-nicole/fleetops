"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Breadcrumbs from "@/components/Breadcrumbs";

export default function TripRecordsPage() {
  useRoleGuard(["customer", "dispatcher", "manager", "admin"]);
  
  return (
    <div className="container" style={{ paddingTop: "2rem" }}>
      <Breadcrumbs items={[
        { label: "Modules", href: "/dashboard/manager" },
        { label: "Trip Processing" },
        { label: "Trip Records" }
      ]} />
      
      <div style={{ marginTop: "2rem" }}>
        <h1 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Trip Records</h1>
        <p style={{ color: "#666666", marginBottom: "1.5rem" }}>
          Module: Trip Processing & Cost Computation for Fleet Operations → Trip Records
        </p>

        <div className="card" style={{ marginBottom: "2rem" }}>
          <h2 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Overview</h2>
          <p style={{ color: "#666666", marginBottom: "1rem" }}>
            The Trip Records submodule is the first step in the cost computation flow. It handles the creation, tracking, and management of all trip records in the system.
          </p>
          <p style={{ color: "#666666" }}>
            Each trip record serves as the foundation for fuel logs, labor records, and toll tracking. Without a trip record, no costs can be computed.
          </p>
        </div>

        <div className="card">
          <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Key Functionality</h3>
          <ul style={{ color: "#666666", paddingLeft: "1.5rem" }}>
            <li>Create new trip records with pickup and dropoff locations</li>
            <li>Assign drivers and vehicles to trips</li>
            <li>Track trip status (pending, in-transit, completed, cancelled)</li>
            <li>Record start time, end time, and distance</li>
            <li>View trip history and details</li>
            <li>Edit trip information (if not yet billed)</li>
            <li>Link to associated fuel, labor, and toll records</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
