"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Breadcrumbs from "@/components/Breadcrumbs";
import { useState } from "react";

type SupportTicket = {
  id: number;
  subject: string;
  category: "billing" | "booking" | "vehicle" | "driver" | "other";
  status: "open" | "in-progress" | "resolved";
  created_date: string;
  priority: "low" | "medium" | "high";
  message: string;
};

export default function SupportPage() {
  useRoleGuard(["customer"]);

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    subject: "",
    category: "other",
    priority: "medium",
    message: "",
  });

  const [tickets] = useState<SupportTicket[]>([
    {
      id: 1,
      subject: "Billing discrepancy on invoice #4521",
      category: "billing",
      status: "resolved",
      created_date: "2026-04-20",
      priority: "high",
      message:
        "Charged twice for same shipment. Refund has been processed.",
    },
    {
      id: 2,
      subject: "Truck size selection issue",
      category: "booking",
      status: "in-progress",
      created_date: "2026-04-26",
      priority: "medium",
      message:
        "Unable to select specific truck size during booking. Working on UI fix.",
    },
    {
      id: 3,
      subject: "Need delivery confirmation proof",
      category: "other",
      status: "open",
      created_date: "2026-04-28",
      priority: "medium",
      message:
        "Require signed proof of delivery for shipment to insurance company.",
    },
  ]);

  const [expandedTicket, setExpandedTicket] = useState<number | null>(null);

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "billing":
        return "#FF9800";
      case "booking":
        return "#2196F3";
      case "vehicle":
        return "#F44336";
      case "driver":
        return "#4CAF50";
      case "other":
        return "#999";
      default:
        return "#999";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "#FF9800";
      case "in-progress":
        return "#2196F3";
      case "resolved":
        return "#4CAF50";
      default:
        return "#999";
    }
  };

  return (
    <div className="container" style={{ paddingTop: "2rem" }}>
      <Breadcrumbs
        items={[
          { label: "Modules", href: "/dashboard/customer" },
          { label: "My Bookings" },
          { label: "Support & Contact" },
        ]}
      />

      <div style={{ marginTop: "2rem" }}>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem" }}>
          💬 Support & Contact
        </h1>
        <p style={{ color: "#666666", marginBottom: "1.5rem" }}>
          Get help and submit support tickets. Our team responds within 24 hours.
        </p>

        {/* Quick Support Info */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1rem",
            marginBottom: "2rem",
          }}
        >
          <div className="card" style={{ padding: "1rem" }}>
            <p style={{ color: "#666666", fontSize: "0.9rem", margin: "0 0 0.5rem 0" }}>
              📞 Phone Support
            </p>
            <p style={{ color: "#1A1A1A", fontWeight: 700, margin: "0" }}>
              1-800-FLEETOPS
            </p>
            <p style={{ color: "#999", fontSize: "0.85rem", margin: "0.25rem 0" }}>
              Mon-Fri 9AM-5PM EST
            </p>
          </div>
          <div className="card" style={{ padding: "1rem" }}>
            <p style={{ color: "#666666", fontSize: "0.9rem", margin: "0 0 0.5rem 0" }}>
              📧 Email Support
            </p>
            <p style={{ color: "#1A1A1A", fontWeight: 700, margin: "0" }}>
              support@fleetops.com
            </p>
            <p style={{ color: "#999", fontSize: "0.85rem", margin: "0.25rem 0" }}>
              24/7 Response
            </p>
          </div>
          <div className="card" style={{ padding: "1rem" }}>
            <p style={{ color: "#666666", fontSize: "0.9rem", margin: "0 0 0.5rem 0" }}>
              💬 Live Chat
            </p>
            <p style={{ color: "#4CAF50", fontWeight: 700, margin: "0" }}>
              Online Now
            </p>
            <p style={{ color: "#999", fontSize: "0.85rem", margin: "0.25rem 0" }}>
              Click to chat with agent
            </p>
          </div>
        </div>

        {/* New Ticket Button */}
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            marginBottom: "1.5rem",
            padding: "0.75rem 1.5rem",
            background: "#2196F3",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {showForm ? "Cancel" : "+ Create New Ticket"}
        </button>

        {/* Ticket Form */}
        {showForm && (
          <div
            className="card"
            style={{
              padding: "1.5rem",
              background: "rgba(33, 150, 243, 0.1)",
              border: "1px solid #BBDEFB",
              marginBottom: "2rem",
            }}
          >
            <h3 style={{ color: "#1A1A1A", margin: "0 0 1rem 0" }}>
              Submit Support Ticket
            </h3>
            <div style={{ display: "grid", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Subject
                </label>
                <input
                  type="text"
                  placeholder="Brief subject of your issue"
                  value={formData.subject}
                  onChange={(e) =>
                    setFormData({ ...formData, subject: e.target.value })
                  }
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #E8E8E8",
                    borderRadius: "6px",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "1rem",
                }}
              >
                <div>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      border: "1px solid #E8E8E8",
                      borderRadius: "6px",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="billing">Billing</option>
                    <option value="booking">Booking</option>
                    <option value="vehicle">Vehicle/Truck</option>
                    <option value="driver">Driver Related</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({ ...formData, priority: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      border: "1px solid #E8E8E8",
                      borderRadius: "6px",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Message
                </label>
                <textarea
                  placeholder="Describe your issue in detail"
                  value={formData.message}
                  onChange={(e) =>
                    setFormData({ ...formData, message: e.target.value })
                  }
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #E8E8E8",
                    borderRadius: "6px",
                    boxSizing: "border-box",
                    minHeight: "120px",
                    fontFamily: "inherit",
                  }}
                />
              </div>
              <button
                style={{
                  padding: "0.75rem",
                  background: "#2196F3",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Submit Ticket
              </button>
            </div>
          </div>
        )}

        {/* Tickets List */}
        <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Your Support Tickets</h3>
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {tickets.map((ticket) => (
            <div
              key={ticket.id}
              className="card"
              onClick={() =>
                setExpandedTicket(expandedTicket === ticket.id ? null : ticket.id)
              }
              style={{
                padding: "1rem",
                cursor: "pointer",
                background:
                  expandedTicket === ticket.id
                    ? "rgba(33, 150, 243, 0.15)"
                    : "#FFFFFF",
                border:
                  expandedTicket === ticket.id
                    ? "2px solid #2196F3"
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
                    <strong style={{ color: "#1A1A1A" }}>
                      #{ticket.id} - {ticket.subject}
                    </strong>
                    <span
                      style={{
                        padding: "0.25rem 0.75rem",
                        background: getStatusColor(ticket.status),
                        color: "white",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        textTransform: "capitalize",
                      }}
                    >
                      {ticket.status.replace("_", " ")}
                    </span>
                  </div>
                  <p style={{ margin: "0.25rem 0", color: "#999", fontSize: "0.85rem" }}>
                    {ticket.category} | Priority: {ticket.priority} | Created: {ticket.created_date}
                  </p>
                </div>
              </div>

              {expandedTicket === ticket.id && (
                <div
                  style={{
                    background: "rgba(33, 150, 243, 0.08)",
                    border: "1px solid #BBDEFB",
                    borderRadius: "8px",
                    padding: "1rem",
                    marginTop: "1rem",
                  }}
                >
                  <h4 style={{ color: "#1A1A1A", margin: "0 0 1rem 0" }}>
                    Ticket Details
                  </h4>
                  <p style={{ color: "#666666", margin: "0.5rem 0", lineHeight: "1.5" }}>
                    {ticket.message}
                  </p>
                  <button
                    style={{
                      marginTop: "1rem",
                      padding: "0.5rem 1rem",
                      background: "#2196F3",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    Reply to Ticket
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
