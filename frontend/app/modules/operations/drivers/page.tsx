"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Breadcrumbs from "@/components/Breadcrumbs";
import { useState } from "react";

type Driver = {
  id: number;
  name: string;
  status: "available" | "on_trip" | "break" | "off_duty";
  phone: string;
  rating: number;
  trips_completed: number;
  current_vehicle?: string;
  compliance_status: "compliant" | "warning" | "violation";
  attendance_today?: boolean;
};

export default function DriversPage() {
  useRoleGuard(["dispatcher"]);

  const [drivers] = useState<Driver[]>([
    {
      id: 1,
      name: "Carlos Rodriguez",
      status: "on_trip",
      phone: "(555) 123-4567",
      rating: 4.8,
      trips_completed: 156,
      current_vehicle: "VOL-2024-001",
      compliance_status: "compliant",
      attendance_today: true,
    },
    {
      id: 2,
      name: "Sarah Williams",
      status: "available",
      phone: "(555) 234-5678",
      rating: 4.9,
      trips_completed: 142,
      compliance_status: "compliant",
      attendance_today: true,
    },
    {
      id: 3,
      name: "James Cooper",
      status: "break",
      phone: "(555) 345-6789",
      rating: 4.6,
      trips_completed: 98,
      current_vehicle: "DAF-2022-003",
      compliance_status: "warning",
      attendance_today: true,
    },
    {
      id: 4,
      name: "Michael Torres",
      status: "off_duty",
      phone: "(555) 456-7890",
      rating: 4.7,
      trips_completed: 132,
      compliance_status: "compliant",
      attendance_today: false,
    },
  ]);

  const [selectedDriver, setSelectedDriver] = useState<number | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "#4CAF50";
      case "on_trip":
        return "#2196F3";
      case "break":
        return "#FF9800";
      case "off_duty":
        return "#F44336";
      default:
        return "#999";
    }
  };

  const getComplianceColor = (compliance: string) => {
    switch (compliance) {
      case "compliant":
        return "#4CAF50";
      case "warning":
        return "#FF9800";
      case "violation":
        return "#F44336";
      default:
        return "#999";
    }
  };

  const availableDrivers = drivers.filter((d) => d.status === "available").length;
  const onTripDrivers = drivers.filter((d) => d.status === "on_trip").length;
  const totalRating = drivers.length > 0 ? (drivers.reduce((sum, d) => sum + d.rating, 0) / drivers.length).toFixed(1) : 0;

  return (
    <div className="container" style={{ paddingTop: "2rem" }}>
      <Breadcrumbs
        items={[
          { label: "Modules", href: "/dashboard/dispatcher" },
          { label: "Dispatcher Operations" },
          { label: "Manage Drivers" },
        ]}
      />

      <div style={{ marginTop: "2rem" }}>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem" }}>
          ‍ Manage Drivers
        </h1>
        <p style={{ color: "#666666", marginBottom: "1.5rem" }}>
          View driver profiles, assignments, attendance, compliance, and ratings. Monitor driver performance and availability.
        </p>

        {/* Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "1rem",
            marginBottom: "2rem",
          }}
        >
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#1A1A1A" }}>
              {drivers.length}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Total Drivers</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#4CAF50" }}>
              {availableDrivers}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Available</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#2196F3" }}>
              {onTripDrivers}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>On Trip</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#FF9800" }}>
              {totalRating}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Avg Rating</div>
          </div>
        </div>

        {/* Drivers List */}
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {drivers.map((driver) => (
            <div
              key={driver.id}
              className="card"
              onClick={() =>
                setSelectedDriver(
                  selectedDriver === driver.id ? null : driver.id
                )
              }
              style={{
                padding: "1rem",
                cursor: "pointer",
                background:
                  selectedDriver === driver.id
                    ? "rgba(255, 152, 0, 0.15)"
                    : "#FFFFFF",
                border:
                  selectedDriver === driver.id
                    ? "2px solid #FF9800"
                    : "1px solid #E8E8E8",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "start",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "1rem",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <strong style={{ color: "#1A1A1A", fontSize: "1.1rem" }}>
                      {driver.name}
                    </strong>
                    <span
                      style={{
                        padding: "0.25rem 0.75rem",
                        background: getStatusColor(driver.status),
                        color: "white",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        textTransform: "capitalize",
                      }}
                    >
                      {driver.status.replace("_", " ")}
                    </span>
                    <span
                      style={{
                        padding: "0.25rem 0.75rem",
                        background: getComplianceColor(driver.compliance_status),
                        color: "white",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        textTransform: "capitalize",
                      }}
                    >
                      {driver.compliance_status}
                    </span>
                  </div>
                  <p style={{ margin: "0.25rem 0", color: "#666666", fontSize: "0.9rem" }}>
                     {driver.phone} | ★ {driver.rating} | Trips: {driver.trips_completed}
                  </p>
                  {driver.current_vehicle && (
                    <p style={{ margin: "0.25rem 0", color: "#666666", fontSize: "0.9rem" }}>
                      Current Vehicle: <strong>{driver.current_vehicle}</strong>
                    </p>
                  )}
                  {driver.attendance_today ? (
                    <p style={{ margin: "0.25rem 0", color: "#4CAF50", fontSize: "0.85rem", fontWeight: 600 }}>
                      ✓ Present Today
                    </p>
                  ) : (
                    <p style={{ margin: "0.25rem 0", color: "#F44336", fontSize: "0.85rem", fontWeight: 600 }}>
                       Absent Today
                    </p>
                  )}
                </div>
              </div>

              {selectedDriver === driver.id && (
                <div
                  style={{
                    background: "rgba(255, 152, 0, 0.08)",
                    border: "1px solid #FFE0B2",
                    borderRadius: "8px",
                    padding: "1rem",
                    marginTop: "1rem",
                  }}
                >
                  <h4 style={{ color: "#1A1A1A", margin: "0 0 1rem 0" }}>
                    Driver Profile
                  </h4>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "1rem",
                    }}
                  >
                    <div>
                      <p style={{ color: "#666666", fontSize: "0.85rem" }}>
                        Rating
                      </p>
                      <p style={{ color: "#FF9800", fontWeight: 700 }}>
                        ★ {driver.rating}
                      </p>
                    </div>
                    <div>
                      <p style={{ color: "#666666", fontSize: "0.85rem" }}>
                        Trips Completed
                      </p>
                      <p style={{ color: "#1A1A1A", fontWeight: 700 }}>
                        {driver.trips_completed}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
