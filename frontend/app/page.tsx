"use client";

import Link from "next/link";
import { useMemo } from "react";

import { getDashboardPath, type UserRole } from "@/lib/auth";
import { useAuthStatus } from "@/lib/useAuthStatus";

const modules = [
  { icon: "", title: "Booking Workflow", desc: "Create trips with real-time cost estimation" },
  { icon: "", title: "Route Optimization", desc: "A* algorithm optimizes by distance, time, or cost" },
  { icon: "", title: "Dispatcher Console", desc: "Assign drivers and manage schedules" },
  { icon: "", title: "Manager Analytics", desc: "Predict demand and maintenance needs" },
  { icon: "", title: "Admin Control", desc: "Configure fleet, roles, and pricing" },
];

/** Customer-only booking CTA; all other roles get their dashboard (same source as NavBar). */
function homePrimaryCta(
  isLoggedIn: boolean | null,
  role: UserRole | null,
): { href: string; label: string; kind: "link" | "placeholder" } {
  if (isLoggedIn === null) {
    return { href: "/", label: "Checking session…", kind: "placeholder" };
  }
  if (!isLoggedIn) {
    return { href: "/sign-in", label: "Login to Book", kind: "link" };
  }
  if (role === "customer") {
    return { href: "/booking", label: "Create Booking", kind: "link" };
  }
  if (role === "admin") {
    return { href: getDashboardPath("admin"), label: "Open admin dashboard", kind: "link" };
  }
  if (role === "manager") {
    return { href: getDashboardPath("manager"), label: "Open manager dashboard", kind: "link" };
  }
  if (role === "dispatcher") {
    return { href: getDashboardPath("dispatcher"), label: "Open dispatcher console", kind: "link" };
  }
  if (role === "driver" || role === "helper") {
    return { href: getDashboardPath("driver"), label: "Open driver dashboard", kind: "link" };
  }
  return { href: "/sign-in", label: "Sign in", kind: "link" };
}

export default function Home() {
  const { isLoggedIn, role } = useAuthStatus();

  const primary = useMemo(() => homePrimaryCta(isLoggedIn, role), [isLoggedIn, role]);

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
              FleetOpt — Philippine fleet operations
            </h1>
            <p
              style={{
                margin: "1rem 0 0 0",
                fontSize: "1.1rem",
                lineHeight: 1.6,
                color: "#666666",
              }}
            >
              Bookings through billing in Philippine peso (PHP), with Luzon and nationwide route samples (for example Tarlac–Manila).
              Dispatcher console, analytics, and maintenance insights for trucking teams in the Philippines.
            </p>
          </div>

          {/* CTA Buttons — must match NavBar role (useAuthStatus), never show Create Booking for staff */}
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "1rem" }}>
            {primary.kind === "placeholder" ? (
              <span
                className="cta-button-primary"
                style={{ opacity: 0.72, cursor: "default", pointerEvents: "none" }}
                aria-busy="true"
              >
                {primary.label}
              </span>
            ) : (
              <Link className="cta-button-primary" href={primary.href}>
                {primary.label}
              </Link>
            )}
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
        <p style={{ margin: "0 0 2rem 0", color: "#666666" }}>
          {isLoggedIn !== true
            ? "Sign in to book a shipment or open your company workspace."
            : role === "customer"
              ? "Continue with a new booking or manage your trips."
              : "Open your dashboard to run dispatch, analytics, or administration."}
        </p>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
          {primary.kind === "placeholder" ? (
            <span
              className="cta-button-primary"
              style={{ opacity: 0.72, cursor: "default", pointerEvents: "none" }}
              aria-busy="true"
            >
              Checking session…
            </span>
          ) : (
            <Link href={primary.href} className="cta-button-primary">
              {!isLoggedIn ? "Login to Start" : primary.label}
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}
