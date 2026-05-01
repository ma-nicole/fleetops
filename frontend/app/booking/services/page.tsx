"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";

type Service = {
  id: number;
  name: string;
  type: "fixed" | "customized";
  description: string;
  base_price: number;
  includes: string[];
};

export default function ServiceSelectionPage() {
  useRoleGuard(["customer"]);
  const router = useRouter();

  const [services] = useState<Service[]>([
    {
      id: 1,
      name: "Standard Shipping",
      type: "fixed",
      description: "Standard point-to-point delivery",
      base_price: 150,
      includes: ["Basic insurance", "Standard pickup", "Standard delivery", "Tracking"],
    },
    {
      id: 2,
      name: "Express Delivery",
      type: "fixed",
      description: "Fast delivery within 24 hours",
      base_price: 300,
      includes: ["Premium insurance", "Priority pickup", "Express delivery", "Real-time tracking", "Driver notification"],
    },
    {
      id: 3,
      name: "Customized Service",
      type: "customized",
      description: "Build your own service package",
      base_price: 0,
      includes: ["Flexible scheduling", "Custom pricing", "Special handling", "Premium support"],
    },
  ]);

  const [selectedService, setSelectedService] = useState<number | null>(null);

  const handleContinue = () => {
    if (selectedService) {
      const service = services.find((s) => s.id === selectedService);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("selectedService", JSON.stringify(service));
      }
      router.push("/booking/checkout");
    }
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "900px", margin: "0 auto" }}>
      <div style={{ marginBottom: "2rem" }}>
        <Link href="/dashboard" style={{ color: "#FF9800", textDecoration: "none", fontWeight: 600 }}>
          ← Back to Dashboard
        </Link>
      </div>

      <h1 style={{ color: "#1A1A1A", marginBottom: "1rem" }}> Select Service Type</h1>
      <p style={{ color: "#666666", marginBottom: "2rem" }}>
        Choose a service package that fits your needs
      </p>

      <div style={{ display: "grid", gap: "1rem", marginBottom: "2rem" }}>
        {services.map((service) => (
          <div
            key={service.id}
            onClick={() => setSelectedService(service.id)}
            style={{
              padding: "1.5rem",
              border:
                selectedService === service.id ? "2px solid #FF9800" : "1px solid #E8E8E8",
              borderRadius: "8px",
              background:
                selectedService === service.id ? "rgba(255, 152, 0, 0.1)" : "#FFFFFF",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "1rem" }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ color: "#1A1A1A", margin: "0 0 0.25rem 0" }}>
                  {service.name}
                </h3>
                <p style={{ color: "#999", margin: "0", fontSize: "0.85rem" }}>
                  {service.description}
                </p>
              </div>
              <div style={{ textAlign: "right", marginLeft: "2rem", whiteSpace: "nowrap" }}>
                <span
                  style={{
                    display: "inline-block",
                    padding: "0.5rem 1rem",
                    background: service.type === "fixed" ? "#4CAF50" : "#2196F3",
                    color: "white",
                    borderRadius: "6px",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    marginBottom: "0.75rem",
                    textTransform: "capitalize",
                  }}
                >
                  {service.type}
                </span>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#FF9800" }}>
                  {service.base_price > 0 ? `$${service.base_price}` : "Custom"}
                </div>
              </div>
            </div>

            <div style={{ marginTop: "1rem" }}>
              <p style={{ color: "#666666", fontSize: "0.85rem", margin: "0 0 0.5rem 0", fontWeight: 600 }}>
                Includes:
              </p>
              <ul style={{ margin: "0", paddingLeft: "1rem", color: "#666666", fontSize: "0.85rem" }}>
                {service.includes.map((item, idx) => (
                  <li key={idx} style={{ marginBottom: "0.25rem" }}>
                    ✓ {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: "1rem" }}>
        <button
          onClick={() => router.back()}
          style={{
            flex: 1,
            padding: "0.75rem",
            background: "#F5F5F5",
            color: "#1A1A1A",
            border: "1px solid #E8E8E8",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Back
        </button>
        <button
          onClick={handleContinue}
          disabled={!selectedService}
          style={{
            flex: 1,
            padding: "0.75rem",
            background: selectedService ? "#FF9800" : "#CCC",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: selectedService ? "pointer" : "not-allowed",
            fontWeight: 600,
          }}
        >
          Continue to Checkout →
        </button>
      </div>
    </div>
  );
}
