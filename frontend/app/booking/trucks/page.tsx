"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import { formatPhp } from "@/lib/appLocale";

type TruckOption = {
  id: number;
  name: string;
  capacity_tons: number;
  type: "small" | "medium" | "large";
  price_per_km: number;
  availability: "available" | "limited" | "unavailable";
};

export default function TruckSelectionPage() {
  useRoleGuard(["customer"]);
  const router = useRouter();

  const [trucks] = useState<TruckOption[]>([
    {
      id: 1,
      name: "Small Pickup Truck",
      capacity_tons: 2.5,
      type: "small",
      price_per_km: 1.5,
      availability: "available",
    },
    {
      id: 2,
      name: "Medium Box Truck",
      capacity_tons: 8,
      type: "medium",
      price_per_km: 2.5,
      availability: "available",
    },
    {
      id: 3,
      name: "Large 18-Wheeler",
      capacity_tons: 25,
      type: "large",
      price_per_km: 4.0,
      availability: "limited",
    },
  ]);

  const [selectedTruck, setSelectedTruck] = useState<number | null>(null);

  const getTypeColor = (type: string) => {
    switch (type) {
      case "small":
        return "#4CAF50";
      case "medium":
        return "#FF9800";
      case "large":
        return "#2196F3";
      default:
        return "#999";
    }
  };

  const getAvailabilityColor = (availability: string) => {
    switch (availability) {
      case "available":
        return "#4CAF50";
      case "limited":
        return "#FF9800";
      case "unavailable":
        return "#F44336";
      default:
        return "#999";
    }
  };

  const handleContinue = () => {
    if (selectedTruck) {
      const truck = trucks.find((t) => t.id === selectedTruck);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("selectedTruck", JSON.stringify(truck));
      }
      router.push("/booking/services");
    }
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "900px", margin: "0 auto" }}>
      <div style={{ marginBottom: "2rem" }}>
        <Link href="/dashboard" style={{ color: "#FF9800", textDecoration: "none", fontWeight: 600 }}>
          ← Back to Dashboard
        </Link>
      </div>

      <h1 style={{ color: "#1A1A1A", marginBottom: "1rem" }}> Select Your Truck</h1>
      <p style={{ color: "#666666", marginBottom: "2rem" }}>
        Choose the right truck for your shipping needs
      </p>

      <div style={{ display: "grid", gap: "1rem", marginBottom: "2rem" }}>
        {trucks.map((truck) => (
          <div
            key={truck.id}
            onClick={() => setSelectedTruck(truck.id)}
            style={{
              padding: "1.5rem",
              border:
                selectedTruck === truck.id ? "2px solid #FF9800" : "1px solid #E8E8E8",
              borderRadius: "8px",
              background:
                selectedTruck === truck.id ? "rgba(255, 152, 0, 0.1)" : "#FFFFFF",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "1rem" }}>
              <div>
                <h3 style={{ color: "#1A1A1A", margin: "0 0 0.5rem 0" }}>
                  {truck.name}
                </h3>
                <p style={{ color: "#666666", margin: "0.25rem 0", fontSize: "0.9rem" }}>
                  Capacity: <strong>{truck.capacity_tons} tons</strong>
                </p>
                <p style={{ color: "#666666", margin: "0.25rem 0", fontSize: "0.9rem" }}>
                  Rate: <strong>{formatPhp(truck.price_per_km)}/km</strong>
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <span
                  style={{
                    display: "inline-block",
                    padding: "0.5rem 1rem",
                    background: getTypeColor(truck.type),
                    color: "white",
                    borderRadius: "6px",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    marginBottom: "0.5rem",
                    textTransform: "capitalize",
                  }}
                >
                  {truck.type}
                </span>
                <br />
                <span
                  style={{
                    display: "inline-block",
                    padding: "0.5rem 1rem",
                    background: getAvailabilityColor(truck.availability),
                    color: "white",
                    borderRadius: "6px",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    textTransform: "capitalize",
                  }}
                >
                  {truck.availability.replace("_", " ")}
                </span>
              </div>
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
          disabled={!selectedTruck}
          style={{
            flex: 1,
            padding: "0.75rem",
            background: selectedTruck ? "#FF9800" : "#CCC",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: selectedTruck ? "pointer" : "not-allowed",
            fontWeight: 600,
          }}
        >
          Continue to Services →
        </button>
      </div>
    </div>
  );
}
