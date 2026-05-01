"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { UserRole } from "@/lib/auth";

const TABS = [
  { role: "manager" as const, label: "Manager", href: "/manager/dashboard" },
  { role: "dispatcher" as const, label: "Dispatcher", href: "/dispatcher/dashboard" },
  { role: "driver" as const, label: "Driver", href: "/driver/dashboard" },
  { role: "customer" as const, label: "Customer", href: "/dashboard/customer" },
] as const;

export type DashboardRoleTab = (typeof TABS)[number]["role"];

type Props = { active: DashboardRoleTab };

function tabsForSignedInRole(role: string | null): readonly (typeof TABS)[number][] {
  if (!role) return TABS;
  const r = role as UserRole;
  if (r === "manager") return TABS.filter((t) => t.role === "manager");
  if (r === "dispatcher") return TABS.filter((t) => t.role === "dispatcher");
  if (r === "driver" || r === "helper") return TABS.filter((t) => t.role === "driver");
  if (r === "customer") return TABS.filter((t) => t.role === "customer");
  /** Admin sees every dashboard tab for oversight. */
  if (r === "admin") return TABS;
  return TABS;
}

/**
 * Role-scoped pills: each account only sees its own persona (managers → Manager only;
 * admins still see every tab).
 */
export default function DashboardRoleTabs({ active }: Props) {
  const [viewerRole, setViewerRole] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem("userRole") : null,
  );

  useEffect(() => {
    const sync = () => setViewerRole(localStorage.getItem("userRole"));
    sync();
    window.addEventListener("fleetops:auth-change", sync);
    return () => window.removeEventListener("fleetops:auth-change", sync);
  }, []);

  const visible = useMemo(() => tabsForSignedInRole(viewerRole), [viewerRole]);
  const showCrossRoleHint = visible.length > 1;

  return (
    <div style={{ display: "grid", gap: "0.35rem" }}>
      <nav
        aria-label="Dashboards by role"
        style={{
          display: "flex",
          gap: "0.5rem",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {visible.map((t) => {
          const isActive = t.role === active;
          return (
            <Link
              key={t.role}
              href={t.href}
              aria-current={isActive ? "page" : undefined}
              prefetch={false}
              style={{
                padding: "0.55rem 1rem",
                borderRadius: 999,
                fontSize: "0.875rem",
                fontWeight: 600,
                textDecoration: "none",
                whiteSpace: "nowrap",
                minHeight: 40,
                display: "inline-flex",
                alignItems: "center",
                transition: "background 0.15s ease, color 0.15s ease",
                background: isActive ? "var(--text)" : "transparent",
                color: isActive ? "#FFFFFF" : "var(--text-secondary)",
                border: `1px solid ${isActive ? "var(--text)" : "var(--border)"}`,
                boxShadow: isActive ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
              }}
            >
              {t.label} Dashboard
            </Link>
          );
        })}
      </nav>
      {showCrossRoleHint && (
        <p
          style={{
            margin: 0,
            fontSize: "0.75rem",
            lineHeight: 1.35,
            color: "var(--text-secondary)",
            maxWidth: "52rem",
          }}
        >
          Admins can open any dashboard tab. Other roles only see their own console here; dispatch tools stay available to managers from module links when your backend role allows it.
        </p>
      )}
    </div>
  );
}
