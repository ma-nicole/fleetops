"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Breadcrumbs from "@/components/Breadcrumbs";
import { useState } from "react";

type CustomerProfile = {
  name: string;
  email: string;
  phone: string;
  company: string;
  address: string;
  city: string;
  postal_code: string;
  business_type: string;
  monthly_volume: number;
};

export default function CustomerProfilePage() {
  useRoleGuard(["customer"]);

  const [profile, setProfile] = useState<CustomerProfile>({
    name: "John Smith",
    email: "john@example.com",
    phone: "(555) 123-4567",
    company: "Smith Logistics",
    address: "123 Business Ave",
    city: "New York, NY",
    postal_code: "10001",
    business_type: "Logistics Company",
    monthly_volume: 45,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(profile);

  const handleSave = () => {
    setProfile(formData);
    setIsEditing(false);
  };

  return (
    <div className="container" style={{ paddingTop: "2rem" }}>
      <Breadcrumbs
        items={[
          { label: "Modules", href: "/dashboard/customer" },
          { label: "Booking & Account" },
          { label: "My Profile" },
        ]}
      />

      <div style={{ marginTop: "2rem" }}>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem" }}>
          👤 My Profile
        </h1>
        <p style={{ color: "#666666", marginBottom: "1.5rem" }}>
          Manage your account information and preferences.
        </p>

        <button
          onClick={() => setIsEditing(!isEditing)}
          style={{
            padding: "0.75rem 1.5rem",
            background: "#FF9800",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: 600,
            marginBottom: "1rem",
          }}
        >
          {isEditing ? "Cancel" : "Edit Profile"}
        </button>

        {isEditing ? (
          <div
            className="card"
            style={{
              padding: "1.5rem",
              background: "rgba(255, 152, 0, 0.05)",
              border: "1px solid #FFE0B2",
            }}
          >
            <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>
              Edit Profile
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1rem",
              }}
            >
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
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
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
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
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
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
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Company
                </label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) =>
                    setFormData({ ...formData, company: e.target.value })
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
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Address
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
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
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                  City
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) =>
                    setFormData({ ...formData, city: e.target.value })
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
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Postal Code
                </label>
                <input
                  type="text"
                  value={formData.postal_code}
                  onChange={(e) =>
                    setFormData({ ...formData, postal_code: e.target.value })
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
              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Business Type
                </label>
                <input
                  type="text"
                  value={formData.business_type}
                  onChange={(e) =>
                    setFormData({ ...formData, business_type: e.target.value })
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
            </div>
            <button
              onClick={handleSave}
              style={{
                width: "100%",
                marginTop: "1rem",
                padding: "0.75rem",
                background: "#FF9800",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Save Changes
            </button>
          </div>
        ) : (
          <div className="card" style={{ padding: "1.5rem" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "2rem",
              }}
            >
              <div>
                <p style={{ color: "#666666", fontSize: "0.9rem", margin: "1rem 0 0.5rem 0" }}>
                  <strong>Name</strong>
                </p>
                <p style={{ color: "#1A1A1A", margin: "0 0 1rem 0" }}>
                  {profile.name}
                </p>

                <p style={{ color: "#666666", fontSize: "0.9rem", margin: "1rem 0 0.5rem 0" }}>
                  <strong>Email</strong>
                </p>
                <p style={{ color: "#1A1A1A", margin: "0 0 1rem 0" }}>
                  {profile.email}
                </p>

                <p style={{ color: "#666666", fontSize: "0.9rem", margin: "1rem 0 0.5rem 0" }}>
                  <strong>Phone</strong>
                </p>
                <p style={{ color: "#1A1A1A", margin: "0 0 1rem 0" }}>
                  {profile.phone}
                </p>

                <p style={{ color: "#666666", fontSize: "0.9rem", margin: "1rem 0 0.5rem 0" }}>
                  <strong>Company</strong>
                </p>
                <p style={{ color: "#1A1A1A", margin: 0 }}>
                  {profile.company}
                </p>
              </div>

              <div>
                <p style={{ color: "#666666", fontSize: "0.9rem", margin: "1rem 0 0.5rem 0" }}>
                  <strong>Address</strong>
                </p>
                <p style={{ color: "#1A1A1A", margin: "0 0 1rem 0" }}>
                  {profile.address}
                </p>

                <p style={{ color: "#666666", fontSize: "0.9rem", margin: "1rem 0 0.5rem 0" }}>
                  <strong>City</strong>
                </p>
                <p style={{ color: "#1A1A1A", margin: "0 0 1rem 0" }}>
                  {profile.city}
                </p>

                <p style={{ color: "#666666", fontSize: "0.9rem", margin: "1rem 0 0.5rem 0" }}>
                  <strong>Postal Code</strong>
                </p>
                <p style={{ color: "#1A1A1A", margin: "0 0 1rem 0" }}>
                  {profile.postal_code}
                </p>

                <p style={{ color: "#666666", fontSize: "0.9rem", margin: "1rem 0 0.5rem 0" }}>
                  <strong>Business Type</strong>
                </p>
                <p style={{ color: "#1A1A1A", margin: 0 }}>
                  {profile.business_type}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
