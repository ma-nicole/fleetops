"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const modules = [
  { icon: "", title: "Booking Workflow", desc: "Create trips with real-time cost estimation" },
  { icon: "", title: "Route Optimization", desc: "A* algorithm optimizes by distance, time, or cost" },
  { icon: "", title: "Dispatcher Console", desc: "Assign drivers and manage schedules" },
  { icon: "", title: "Manager Analytics", desc: "Predict demand and maintenance needs" },
  { icon: "", title: "Admin Control", desc: "Configure fleet, roles, and pricing" },
];

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsLoggedIn(!!window.localStorage.getItem("token"));
    }
  }, []);

  const primaryHref = isLoggedIn ? "/booking" : "/sign-in";
  const primaryLabel = isLoggedIn ? "Create Booking" : "Login to Book";

  return (
    <main style={{ minHeight: "100vh", background: "#FAFAFA" }}>
      {/* Hero Section */}
      <section
        className="container"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "3rem",
          alignItems: "center",
          padding: "4rem 2rem",
          maxWidth: "1200px",
          margin: "0 auto",
        }}
      >
        <article style={{ display: "grid", gap: "1.5rem" }}>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: "3rem",
                fontWeight: 900,
                color: "#1A1A1A",
                lineHeight: 1.2,
              }}
            >
              FleetOpt Logistics Command Center
            </h1>
            <p
              style={{
                margin: "1rem 0 0 0",
                fontSize: "1.1rem",
                lineHeight: 1.6,
                color: "#666666",
              }}
            >
              Automate booking, scheduling, fleet operations, and decision-making with predictive analytics. Built for trucking teams to reduce delays, cut costs, and improve reliability.
            </p>
          </div>

          {/* CTA Buttons */}
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "1rem" }}>
            <Link
              className="cta-button-primary"
              href={primaryHref}
            >
              {primaryLabel}
            </Link>
            <Link
              className="cta-button-secondary"
              href="/dashboard/manager"
            >
              Analytics Dashboard
            </Link>
          </div>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginTop: "2rem" }}>
            {[
              { label: "Core Modules", value: "5" },
              { label: "User Roles", value: "5" },
              { label: "API Endpoints", value: "25+" },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #E8E8E8",
                  borderRadius: "8px",
                  padding: "1rem",
                  textAlign: "center",
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
                }}
              >
                <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#FF9800" }}>{stat.value}</div>
                <div style={{ fontSize: "0.85rem", color: "#666666", marginTop: "0.5rem" }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </article>

        {/* Feature Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: "1rem",
          }}
        >
          {modules.slice(0, 3).map((mod) => (
            <div
              key={mod.title}
              style={{
                background: "#FAFAFA",
                border: "1px solid #E8E8E8",
                borderRadius: "8px",
                padding: "1.2rem",
              }}
            >
              <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>{mod.icon}</div>
              <div style={{ fontWeight: 600, color: "#2A2A2A" }}>{mod.title}</div>
              <div style={{ fontSize: "0.9rem", color: "#666666", marginTop: "0.3rem" }}>{mod.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section
        style={{
          background: "#FAFAFA",
          padding: "4rem 2rem",
          borderTop: "1px solid #E8E8E8",
        }}
      >
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <h2
            style={{
              margin: "0 0 3rem 0",
              fontSize: "2rem",
              fontWeight: 800,
              textAlign: "center",
              color: "#1A1A1A",
            }}
          >
            Core Modules
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "2rem" }}>
            {modules.map((mod) => (
              <div key={mod.title} className="module-card">
                <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>{mod.icon}</div>
                <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.2rem", color: "#1A1A1A" }}>{mod.title}</h3>
                <p style={{ margin: "0.5rem 0 0 0", color: "#666666", lineHeight: 1.5 }}>{mod.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quick Access */}
      <section
        style={{
          padding: "2rem 2rem 4rem",
        }}
      >
        <div style={{ maxWidth: "1200px", margin: "0 auto", display: "grid", gap: "1.25rem" }}>
          <div className="card" style={{ display: "grid", gap: "0.75rem" }}>
            <h2 style={{ margin: 0, fontSize: "1.4rem" }}>Recent bookings</h2>
            <div className="timeline">
              <div className="timeline-step">
                <span className="timeline-dot" />
                <span>BK-2034 • Manhattan to Newark • In transit</span>
              </div>
              <div className="timeline-step">
                <span className="timeline-dot" />
                <span>BK-2035 • Brooklyn to Jersey City • Pending payment</span>
              </div>
              <div className="timeline-step">
                <span className="timeline-dot" />
                <span>BK-2036 • Queens to Hartford • Delivered</span>
              </div>
            </div>
          </div>

          <div className="card" style={{ display: "grid", gap: "0.75rem" }}>
            <h2 style={{ margin: 0, fontSize: "1.4rem" }}>Role shortcuts</h2>
            <div className="quick-action-grid">
              {[
                { label: "Customer dashboard", href: "/dashboard/customer", description: "Track bookings and payment history." },
                { label: "Dispatcher console", href: "/dashboard/dispatcher", description: "Assign trips and resolve conflicts." },
                { label: "Manager analytics", href: "/dashboard/manager", description: "Review KPIs, forecasts, and alerts." },
              ].map((item) => (
                <a key={item.href} href={item.href} className="quick-action-card">
                  <strong>{item.label}</strong>
                  <span>{item.description}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section
        style={{
          background: "linear-gradient(135deg, rgba(255,152,0,0.05), rgba(255,152,0,0.02))",
          padding: "3rem 2rem",
          textAlign: "center",
          borderTop: "1px solid #E8E8E8",
        }}
      >
        <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.5rem", color: "#1A1A1A" }}>Ready to optimize your fleet?</h3>
        <p style={{ margin: "0 0 2rem 0", color: "#666666" }}>Start with a booking or explore a role dashboard</p>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
          <Link href={primaryHref} className="cta-button-primary">
            {isLoggedIn ? "Start Now" : "Login to Start"}
          </Link>
        </div>
      </section>
    </main>
  );
}
