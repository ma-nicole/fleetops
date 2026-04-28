"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type MenuItem = {
  label: string;
  href: string;
  icon: string;
  roles: string[];
};

const menuItems: MenuItem[] = [
  { label: "Home", href: "/", icon: "□", roles: ["customer", "dispatcher", "driver", "manager", "admin"] },
  { label: "Create Booking", href: "/booking", icon: "📝", roles: ["customer", "manager", "admin"] },
  { label: "My Bookings", href: "/dashboard/customer", icon: "□", roles: ["customer"] },
  { label: "Dispatcher Console", href: "/dashboard/dispatcher", icon: "□", roles: ["dispatcher", "manager", "admin"] },
  { label: "Driver App", href: "/dashboard/driver", icon: "□", roles: ["driver", "manager", "admin"] },
  { label: "Manager Analytics", href: "/dashboard/manager", icon: "□", roles: ["manager", "admin"] },
  { label: "Admin Panel", href: "/dashboard/admin", icon: "□", roles: ["admin"] },
];

type SidebarProps = {
  isOpen: boolean;
  onCloseSidebar: () => void;
  onOpenSidebar: () => void;
};

export default function Sidebar({ isOpen, onCloseSidebar, onOpenSidebar }: SidebarProps) {
  const [userRole, setUserRole] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const role = window.localStorage.getItem("userRole") || "customer";
      setUserRole(role);
    }
  }, []);

  const visibleItems = menuItems.filter((item) => userRole && item.roles.includes(userRole));
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      {/* Open button when sidebar is collapsed */}
      <button
        onClick={onOpenSidebar}
        aria-label="Open sidebar"
        style={{
          display: isOpen ? "none" : "block",
          position: "fixed",
          top: "1rem",
          left: "1rem",
          zIndex: 1001,
          background: "var(--primary)",
          border: "none",
          color: "white",
          padding: "0.5rem",
          borderRadius: "6px",
          cursor: "pointer",
          fontSize: "1.2rem",
        }}
        className="sidebar-open-button"
      >
        ☰
      </button>

      {/* Sidebar */}
      <aside
        aria-hidden={!isOpen}
        style={{
          position: "fixed",
          left: 0,
          top: "76px",
          width: isOpen ? "240px" : "0",
          height: "calc(100vh - 76px)",
          background: "rgba(26, 35, 50, 0.95)",
          borderRight: "1px solid rgba(0, 180, 216, 0.2)",
          backdropFilter: "blur(10px)",
          overflowX: "hidden",
          overflowY: "auto",
          transition: "width 0.3s ease, transform 0.3s ease",
          zIndex: 1000,
          paddingTop: "1rem",
          transform: isOpen ? "translateX(0)" : "translateX(-100%)",
          pointerEvents: isOpen ? "auto" : "none",
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding: "1rem 1rem 0.75rem",
            borderBottom: "1px solid rgba(0, 180, 216, 0.1)",
            marginBottom: "1rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
          }}
        >
          <Link
            href="/"
            style={{
              fontSize: "1.2rem",
              fontWeight: 800,
              color: "var(--primary)",
              textDecoration: "none",
            }}
          >
            FleetOps
          </Link>

          <button
            type="button"
            onClick={onCloseSidebar}
            aria-label="Close sidebar"
            style={{
              minHeight: "44px",
              minWidth: "44px",
              display: "inline-grid",
              placeItems: "center",
              borderRadius: "10px",
              border: "1px solid rgba(0, 180, 216, 0.25)",
              background: "rgba(255, 255, 255, 0.04)",
              color: "var(--text)",
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>

        {/* Menu Items */}
        <nav style={{ padding: "0 0.5rem" }}>
          {visibleItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.75rem 1rem",
                  margin: "0.25rem 0",
                  borderRadius: "8px",
                  color: active ? "var(--primary)" : "var(--text-secondary)",
                  textDecoration: "none",
                  background: active ? "rgba(0, 180, 216, 0.1)" : "transparent",
                  borderLeft: active ? "3px solid var(--primary)" : "3px solid transparent",
                  transition: "all 0.2s ease",
                  fontSize: "0.95rem",
                  fontWeight: active ? 600 : 500,
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = "rgba(0, 180, 216, 0.05)";
                    (e.currentTarget as HTMLElement).style.color = "var(--text)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                    (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
                  }
                }}
                onClick={() => {
                  if (window.innerWidth <= 768) {
                    onCloseSidebar();
                  }
                }}
              >
                <span style={{ fontSize: "1.2rem" }}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Role Badge */}
        {userRole && (
          <div
            style={{
              position: "absolute",
              bottom: "1rem",
              left: "1rem",
              right: "1rem",
              padding: "0.75rem",
              background: "rgba(0, 180, 216, 0.1)",
              border: "1px solid rgba(0, 180, 216, 0.2)",
              borderRadius: "8px",
              textAlign: "center",
              fontSize: "0.85rem",
              color: "var(--primary)",
              fontWeight: 600,
              textTransform: "capitalize",
            }}
          >
            {userRole}
          </div>
        )}
      </aside>

      {/* Overlay for mobile when open */}
      {isOpen && (
        <div
          onClick={onCloseSidebar}
          style={{
            position: "fixed",
            left: "240px",
            top: "76px",
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            zIndex: 999,
            display: "none",
          }}
          className="sidebar-overlay"
        />
      )}

      <style>{`
        @media (max-width: 768px) {
          .sidebar-overlay { display: block !important; }
          .sidebar-open-button { display: block !important; }
          aside { width: 240px !important; top: 76px !important; height: calc(100vh - 76px) !important; }
          main { margin-left: 0; }
        }

        @media (min-width: 769px) {
          .sidebar-open-button { display: none !important; }
        }
      `}</style>
    </>
  );
}
