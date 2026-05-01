"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Breadcrumbs from "@/components/Breadcrumbs";
import { useState } from "react";

type Customer = {
  id: number;
  name: string;
  email: string;
  phone: string;
  company?: string;
  active_bookings: number;
  total_bookings: number;
  status: "active" | "inactive" | "suspended";
  joined_date: string;
};

export default function CustomersPage() {
  useRoleGuard(["dispatcher"]);

  const [customers] = useState<Customer[]>([
    {
      id: 1,
      name: "John Smith",
      email: "john@example.com",
      phone: "(555) 123-4567",
      company: "Smith Logistics",
      active_bookings: 1,
      total_bookings: 24,
      status: "active",
      joined_date: "2024-01-15",
    },
    {
      id: 2,
      name: "Sarah Johnson",
      email: "sarah@example.com",
      phone: "(555) 234-5678",
      company: "Johnson Distribution",
      active_bookings: 0,
      total_bookings: 18,
      status: "active",
      joined_date: "2024-02-20",
    },
    {
      id: 3,
      name: "Michael Chen",
      email: "michael@example.com",
      phone: "(555) 345-6789",
      company: "Chen Supply Co.",
      active_bookings: 2,
      total_bookings: 12,
      status: "active",
      joined_date: "2024-03-10",
    },
    {
      id: 4,
      name: "Emma Wilson",
      email: "emma@example.com",
      phone: "(555) 456-7890",
      company: "Wilson Transport",
      active_bookings: 0,
      total_bookings: 3,
      status: "inactive",
      joined_date: "2024-04-05",
    },
  ]);

  const [selectedCustomer, setSelectedCustomer] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const filteredCustomers =
    filterStatus === "all"
      ? customers
      : customers.filter((c) => c.status === filterStatus);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "#4CAF50";
      case "inactive":
        return "#999";
      case "suspended":
        return "#F44336";
      default:
        return "#999";
    }
  };

  const stats = {
    total: customers.length,
    active: customers.filter((c) => c.status === "active").length,
    inactive: customers.filter((c) => c.status === "inactive").length,
    totalBookings: customers.reduce((sum, c) => sum + c.total_bookings, 0),
  };

  return (
    <div className="container" style={{ paddingTop: "2rem" }}>
      <Breadcrumbs
        items={[
          { label: "Modules", href: "/dashboard/dispatcher" },
          { label: "Dispatcher Operations" },
          { label: "Manage Customers" },
        ]}
      />

      <div style={{ marginTop: "2rem" }}>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem" }}>
           Manage Customers
        </h1>
        <p style={{ color: "#666666", marginBottom: "1.5rem" }}>
          View and manage customer accounts. Monitor active bookings and customer status.
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
              {stats.total}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>
              Total Customers
            </div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#4CAF50" }}>
              {stats.active}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Active</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#999" }}>
              {stats.inactive}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Inactive</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#FF9800" }}>
              {stats.totalBookings}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>
              Total Bookings
            </div>
          </div>
        </div>

        {/* Filter */}
        <div style={{ marginBottom: "1.5rem" }}>
          <label style={{ color: "#1A1A1A", fontWeight: 600, marginRight: "1rem" }}>
            Filter by Status:
          </label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              padding: "0.5rem 1rem",
              border: "1px solid #E8E8E8",
              borderRadius: "6px",
              color: "#1A1A1A",
              cursor: "pointer",
            }}
          >
            <option value="all">All Customers</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>

        {/* Customers List */}
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {filteredCustomers.map((customer) => (
            <div
              key={customer.id}
              className="card"
              onClick={() =>
                setSelectedCustomer(
                  selectedCustomer === customer.id ? null : customer.id
                )
              }
              style={{
                padding: "1rem",
                cursor: "pointer",
                background:
                  selectedCustomer === customer.id
                    ? "rgba(255, 152, 0, 0.15)"
                    : "#FFFFFF",
                border:
                  selectedCustomer === customer.id
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
                      {customer.name}
                    </strong>
                    <span
                      style={{
                        padding: "0.25rem 0.75rem",
                        background: getStatusColor(customer.status),
                        color: "white",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        textTransform: "capitalize",
                      }}
                    >
                      {customer.status}
                    </span>
                  </div>
                  <p style={{ margin: "0.25rem 0", color: "#666666", fontSize: "0.9rem" }}>
                     {customer.email} |  {customer.phone}
                  </p>
                  {customer.company && (
                    <p style={{ margin: "0.25rem 0", color: "#666666", fontSize: "0.9rem" }}>
                      Company: <strong>{customer.company}</strong>
                    </p>
                  )}
                  <p style={{ margin: "0.25rem 0", color: "#999", fontSize: "0.85rem" }}>
                    Joined: {customer.joined_date} | Active Bookings: {customer.active_bookings} | Total: {customer.total_bookings}
                  </p>
                </div>
              </div>

              {selectedCustomer === customer.id && (
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
                    Customer Summary
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
                        Total Bookings
                      </p>
                      <p style={{ color: "#1A1A1A", fontWeight: 700 }}>
                        {customer.total_bookings}
                      </p>
                    </div>
                    <div>
                      <p style={{ color: "#666666", fontSize: "0.85rem" }}>
                        Active Now
                      </p>
                      <p style={{ color: "#FF9800", fontWeight: 700 }}>
                        {customer.active_bookings}
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
