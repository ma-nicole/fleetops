"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Breadcrumbs from "@/components/Breadcrumbs";
import { useState } from "react";

type CostBreakdown = {
  item: string;
  category: "fuel" | "toll" | "maintenance" | "labor" | "other";
  amount: number;
  date: string;
};

export default function CostBreakdownPage() {
  useRoleGuard(["driver"]);

  const [costItems] = useState<CostBreakdown[]>([
    {
      item: "Fuel - Premium Diesel",
      category: "fuel",
      amount: 145.5,
      date: "2026-04-28",
    },
    {
      item: "Toll - I-95 Gate 5",
      category: "toll",
      amount: 12.5,
      date: "2026-04-28",
    },
    {
      item: "Maintenance - Oil Change",
      category: "maintenance",
      amount: 65.0,
      date: "2026-04-27",
    },
    {
      item: "Toll - US Route 1",
      category: "toll",
      amount: 8.75,
      date: "2026-04-27",
    },
    {
      item: "Fuel - Premium Diesel",
      category: "fuel",
      amount: 132.75,
      date: "2026-04-26",
    },
  ]);

  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const filteredCosts =
    selectedCategory === "all"
      ? costItems
      : costItems.filter((c) => c.category === selectedCategory);

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "fuel":
        return "#FF9800";
      case "toll":
        return "#2196F3";
      case "maintenance":
        return "#F44336";
      case "labor":
        return "#4CAF50";
      case "other":
        return "#999";
      default:
        return "#999";
    }
  };

  const stats = {
    total: costItems.reduce((sum, c) => sum + c.amount, 0),
    fuel: costItems
      .filter((c) => c.category === "fuel")
      .reduce((sum, c) => sum + c.amount, 0),
    toll: costItems
      .filter((c) => c.category === "toll")
      .reduce((sum, c) => sum + c.amount, 0),
    maintenance: costItems
      .filter((c) => c.category === "maintenance")
      .reduce((sum, c) => sum + c.amount, 0),
  };

  const driverShare = (stats.total * 0.7).toFixed(2);

  return (
    <div className="container" style={{ paddingTop: "2rem" }}>
      <Breadcrumbs
        items={[
          { label: "Modules", href: "/dashboard/driver" },
          { label: "Truck & Costs" },
          { label: "Cost Breakdown" },
        ]}
      />

      <div style={{ marginTop: "2rem" }}>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem" }}>
          💰 Operation Cost & Pay Division
        </h1>
        <p style={{ color: "#666666", marginBottom: "1.5rem" }}>
          View itemized operational costs and your calculated earnings share.
        </p>

        {/* Summary Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "1rem",
            marginBottom: "2rem",
          }}
        >
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#1A1A1A" }}>
              ${stats.total.toFixed(2)}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>
              Total Costs
            </div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#FF9800" }}>
              ${stats.fuel.toFixed(2)}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Fuel</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#2196F3" }}>
              ${stats.toll.toFixed(2)}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>Tolls</div>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#F44336" }}>
              ${stats.maintenance.toFixed(2)}
            </div>
            <div style={{ color: "#666666", fontSize: "0.9rem" }}>
              Maintenance
            </div>
          </div>
        </div>

        {/* Pay Share */}
        <div
          className="card"
          style={{
            padding: "1.5rem",
            background: "rgba(76, 175, 80, 0.1)",
            border: "1px solid #C8E6C9",
            marginBottom: "2rem",
          }}
        >
          <h3 style={{ color: "#1A1A1A", margin: "0 0 1rem 0" }}>
            Your Earnings Share
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "2rem",
            }}
          >
            <div>
              <p style={{ color: "#666666", margin: "0.5rem 0" }}>
                <strong>Total Operational Costs:</strong>
              </p>
              <p style={{ color: "#1A1A1A", fontSize: "1.3rem", fontWeight: 700 }}>
                ${stats.total.toFixed(2)}
              </p>
            </div>
            <div>
              <p style={{ color: "#4CAF50", margin: "0.5rem 0" }}>
                <strong>Your Share (70%):</strong>
              </p>
              <p style={{ color: "#4CAF50", fontSize: "1.3rem", fontWeight: 700 }}>
                ${driverShare}
              </p>
            </div>
          </div>
        </div>

        {/* Filter */}
        <div style={{ marginBottom: "1.5rem" }}>
          <label style={{ color: "#1A1A1A", fontWeight: 600, marginRight: "1rem" }}>
            Filter by Category:
          </label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{
              padding: "0.5rem 1rem",
              border: "1px solid #E8E8E8",
              borderRadius: "6px",
              color: "#1A1A1A",
              cursor: "pointer",
            }}
          >
            <option value="all">All Costs</option>
            <option value="fuel">Fuel</option>
            <option value="toll">Tolls</option>
            <option value="maintenance">Maintenance</option>
            <option value="labor">Labor</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* Cost Items */}
        <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Cost Details</h3>
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {filteredCosts.map((item, index) => (
            <div key={index} className="card" style={{ padding: "1rem" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div style={{ flex: 1 }}>
                  <p style={{ margin: "0 0 0.5rem 0", fontWeight: 600, color: "#1A1A1A" }}>
                    {item.item}
                  </p>
                  <p style={{ margin: "0.25rem 0", color: "#999", fontSize: "0.85rem" }}>
                    {item.date}
                  </p>
                </div>
                <div style={{ textAlign: "right", marginLeft: "1rem" }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "0.25rem 0.75rem",
                      background: getCategoryColor(item.category),
                      color: "white",
                      borderRadius: "4px",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      marginBottom: "0.5rem",
                      marginRight: "1rem",
                    }}
                  >
                    {item.category}
                  </span>
                  <div style={{ color: "#FF9800", fontWeight: 700, fontSize: "1.1rem" }}>
                    ${item.amount.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
