"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";

type SubMenuItem = {
  label: string;
  href: string;
  icon: string;
  roles: string[];
};

type MenuModule = {
  label: string;
  icon: string;
  roles: string[];
  items: SubMenuItem[];
};

const menuModules: MenuModule[] = [
  // DRIVER ONLY
  {
    label: "🚗 Active Operations",
    icon: "🚗",
    roles: ["driver"],
    items: [
      { label: "Dashboard", href: "/driver/dashboard", icon: "📊", roles: ["driver"] },
      { label: "Active Trips", href: "/driver/active-trips", icon: "🚚", roles: ["driver"] },
      { label: "Route Info", href: "/driver/route-info", icon: "🗺️", roles: ["driver"] },
      { label: "Start/End Trip", href: "/driver/active-trips", icon: "▶️", roles: ["driver"] },
    ],
  },
  {
    label: "📋 Schedule & Pay",
    icon: "📋",
    roles: ["driver"],
    items: [
      { label: "Designated Schedule", href: "/driver/schedule", icon: "📅", roles: ["driver"] },
      { label: "Total Pay", href: "/driver/pay", icon: "💵", roles: ["driver"] },
    ],
  },
  {
    label: "🚛 Vehicle",
    icon: "🚛",
    roles: ["driver"],
    items: [
      { label: "Vehicle Status", href: "/driver/vehicle-status", icon: "🔍", roles: ["driver"] },
      { label: "Log Vehicle Status", href: "/driver/vehicle-status", icon: "✏️", roles: ["driver"] },
    ],
  },
  {
    label: "📝 Reports & Ratings",
    icon: "📝",
    roles: ["driver"],
    items: [
      { label: "Accomplishment Report", href: "/driver/accomplishment-report", icon: "✅", roles: ["driver"] },
      { label: "Activity & Ratings", href: "/driver/activity-ratings", icon: "⭐", roles: ["driver"] },
    ],
  },

  // DISPATCHER ONLY
  {
    label: "📊 Dashboard & Operations",
    icon: "📊",
    roles: ["dispatcher"],
    items: [
      { label: "Dashboard", href: "/dispatcher/dashboard", icon: "📊", roles: ["dispatcher"] },
      { label: "Scheduled Bookings", href: "/dispatcher/scheduled-bookings", icon: "📅", roles: ["dispatcher"] },
      { label: "Order Details", href: "/dispatcher/order-details", icon: "📦", roles: ["dispatcher"] },
      { label: "Ongoing Operations", href: "/dispatcher/ongoing-operations", icon: "🚀", roles: ["dispatcher"] },
    ],
  },
  {
    label: "👥 People & Assets",
    icon: "👥",
    roles: ["dispatcher"],
    items: [
      { label: "Driver Activity", href: "/dispatcher/driver-activity", icon: "👨‍✈️", roles: ["dispatcher"] },
      { label: "Assets Management", href: "/dispatcher/assets", icon: "🚛", roles: ["dispatcher"] },
      { label: "Reported Issues", href: "/dispatcher/reported-issues", icon: "⚠️", roles: ["dispatcher"] },
    ],
  },
  {
    label: "📋 Reports & Completion",
    icon: "📋",
    roles: ["dispatcher"],
    items: [
      { label: "Accomplishment Report", href: "/dispatcher/accomplishment-report", icon: "✅", roles: ["dispatcher"] },
      { label: "Log Report", href: "/dispatcher/log-report", icon: "📝", roles: ["dispatcher"] },
      { label: "Confirm Completion", href: "/dispatcher/confirm-completion", icon: "✓", roles: ["dispatcher"] },
    ],
  },

  // MANAGER ONLY
  {
    label: "📈 Analytics",
    icon: "📈",
    roles: ["manager", "admin"],
    items: [
      { label: "Dashboard", href: "/manager/dashboard", icon: "📊", roles: ["manager", "admin"] },
      { label: "Analytics Overview", href: "/manager/analytics", icon: "📊", roles: ["manager", "admin"] },
      { label: "History", href: "/manager/history", icon: "📜", roles: ["manager", "admin"] },
    ],
  },
  {
    label: "📋 Operations",
    icon: "📋",
    roles: ["manager", "admin"],
    items: [
      { label: "Scheduled Bookings", href: "/manager/scheduled-bookings", icon: "📅", roles: ["manager", "admin"] },
      { label: "Order Details", href: "/manager/order-details", icon: "📦", roles: ["manager", "admin"] },
      { label: "Accomplishment Report", href: "/manager/accomplishment-report", icon: "✅", roles: ["manager", "admin"] },
      { label: "Pending Bookings", href: "/manager/pending-bookings", icon: "⏳", roles: ["manager", "admin"] },
      { label: "Accomplished Bookings", href: "/manager/accomplished-bookings", icon: "✓", roles: ["manager", "admin"] },
    ],
  },
  {
    label: "🚛 Management",
    icon: "🚛",
    roles: ["manager", "admin"],
    items: [
      { label: "Truck Management", href: "/manager/truck-management", icon: "🚛", roles: ["manager", "admin"] },
      { label: "Dispatcher Activity", href: "/manager/dispatcher-activity", icon: "👨‍💼", roles: ["manager", "admin"] },
      { label: "Driver Profiles", href: "/manager/driver-profiles", icon: "👨‍✈️", roles: ["manager", "admin"] },
    ],
  },
  {
    label: "👥 People & Finance",
    icon: "👥",
    roles: ["manager", "admin"],
    items: [
      { label: "Customer Profiles", href: "/manager/customer-profiles", icon: "👥", roles: ["manager", "admin"] },
      { label: "Payments", href: "/manager/payments", icon: "💳", roles: ["manager", "admin"] },
      { label: "Customer Reviews", href: "/manager/customer-reviews", icon: "⭐", roles: ["manager", "admin"] },
    ],
  },

  // ADMIN FLOW MODULES
  {
    label: "📅 Scheduling",
    icon: "📅",
    roles: ["admin"],
    items: [
      { label: "Admin Dashboard", href: "/admin/dashboard", icon: "📊", roles: ["admin"] },
      { label: "Scheduling", href: "/admin/scheduling", icon: "🗓️", roles: ["admin"] },
    ],
  },
  {
    label: "🚚 Operations",
    icon: "🚚",
    roles: ["admin"],
    items: [
      { label: "Trip Monitoring", href: "/admin/trip-monitoring", icon: "🛰️", roles: ["admin"] },
    ],
  },
  {
    label: "📈 Analytics",
    icon: "📈",
    roles: ["admin"],
    items: [
      { label: "Analytics Overview", href: "/admin/analytics", icon: "📉", roles: ["admin"] },
    ],
  },
  {
    label: "📦 Orders",
    icon: "📦",
    roles: ["admin"],
    items: [
      { label: "Order Details", href: "/admin/orders", icon: "📋", roles: ["admin"] },
    ],
  },
  {
    label: "💳 Finance",
    icon: "💳",
    roles: ["admin"],
    items: [
      { label: "Finance View", href: "/admin/finance", icon: "💰", roles: ["admin"] },
    ],
  },

  // ADMIN ONLY (existing tools)
  {
    label: "🔐 System Administration",
    icon: "🔐",
    roles: ["admin"],
    items: [
      { label: "Authentication", href: "/modules/administration/authentication", icon: "🔑", roles: ["admin"] },
      { label: "Access Control", href: "/modules/administration/access-control", icon: "👥", roles: ["admin"] },
      { label: "Account Management", href: "/modules/administration/accounts", icon: "👤", roles: ["admin"] },
      { label: "System Settings", href: "/modules/administration/settings", icon: "⚙️", roles: ["admin"] },
    ],
  },

  // CUSTOMER ONLY
  {
    label: "🛒 Booking",
    icon: "🛒",
    roles: ["customer"],
    items: [
      { label: "My Profile", href: "/modules/customer/profile", icon: "👤", roles: ["customer"] },
      { label: "Select Truck", href: "/modules/customer/booking/trucks", icon: "🚚", roles: ["customer"] },
      { label: "Select Service", href: "/modules/customer/booking/services", icon: "🔧", roles: ["customer"] },
      { label: "Checkout", href: "/modules/customer/booking/checkout", icon: "🛍️", roles: ["customer"] },
      { label: "Payment", href: "/modules/customer/payment", icon: "💳", roles: ["customer"] },
    ],
  },
  {
    label: "📦 My Bookings",
    icon: "📦",
    roles: ["customer"],
    items: [
      { label: "Current Bookings", href: "/modules/operations/trips", icon: "📋", roles: ["customer"] },
      { label: "Booking History", href: "/modules/customer/booking-history", icon: "📜", roles: ["customer"] },
      { label: "Cost Summary", href: "/modules/operations/cost-summary", icon: "💵", roles: ["customer"] },
      { label: "Support", href: "/modules/customer/support", icon: "💬", roles: ["customer"] },
    ],
  },
];

type SidebarProps = {
  isOpen: boolean;
  onCloseSidebar: () => void;
  onOpenSidebar: () => void;
};

export default function Sidebar({ isOpen, onCloseSidebar, onOpenSidebar }: SidebarProps) {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [expandedModules, setExpandedModules] = useState<string[]>([]);
  const pathname = usePathname();

  useEffect(() => {
      if (typeof window !== "undefined") {
        if (isAuthenticated()) {
          const role = window.localStorage.getItem("userRole") || "customer";
          setUserRole(role);
        } else {
          setUserRole(null);
        }
        // Auto-expand first module on page load
        setExpandedModules([]);
      }
    }, []);

  const visibleModules = menuModules.filter((module) => userRole && module.roles.includes(userRole));

  // If user is not authenticated, show a small sign-in CTA instead of sidebar
  if (!userRole) {
    return (
      <div>
        <Link href="/sign-in">
          <button
            aria-label="Sign in"
            style={{
              position: "fixed",
              top: "1rem",
              left: "1rem",
              zIndex: 1001,
              background: "var(--primary)",
              border: "none",
              color: "white",
              padding: "0.5rem 0.75rem",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "0.95rem",
            }}
          >
            Sign in
          </button>
        </Link>
      </div>
    );
  }

  const toggleModule = (moduleLabel: string) => {
    setExpandedModules((prev) =>
      prev.includes(moduleLabel) ? prev.filter((m) => m !== moduleLabel) : [...prev, moduleLabel]
    );
  };

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
          width: isOpen ? "280px" : "0",
          height: "calc(100vh - 76px)",
          background: "#FFFFFF",
          borderRight: "1px solid #E8E8E8",
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
            borderBottom: "1px solid #E8E8E8",
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
            FleetOpt
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
              borderRadius: "6px",
              border: "1px solid #E8E8E8",
              background: "transparent",
              color: "var(--text)",
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>

        {/* Hierarchical Menu Items */}
        <nav style={{ padding: "0 0.5rem" }}>
          {visibleModules.map((module) => {
            const isExpanded = expandedModules.includes(module.label);
            const hasVisibleItems = module.items.some((item) => userRole && item.roles.includes(userRole));

            return (
              <div key={module.label}>
                <button
                  onClick={() => toggleModule(module.label)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.75rem",
                    padding: "0.75rem 1rem",
                    margin: "0.25rem 0",
                    borderRadius: "8px",
                    border: "none",
                    background: "rgba(255, 152, 0, 0.08)",
                    color: "var(--text)",
                    textDecoration: "none",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    fontSize: "0.95rem",
                    fontWeight: 600,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "rgba(255, 152, 0, 0.15)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "rgba(255, 152, 0, 0.08)";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <span style={{ fontSize: "1.2rem" }}>{module.icon}</span>
                    <span>{module.label}</span>
                  </div>
                  <span
                    style={{
                      fontSize: "1rem",
                      transition: "transform 0.2s ease",
                      transform: isExpanded ? "rotate(180deg)" : "rotate(0)",
                    }}
                  >
                    ▼
                  </span>
                </button>

                {/* Submodules */}
                {isExpanded &&
                  hasVisibleItems &&
                  module.items
                    .filter((item) => userRole && item.roles.includes(userRole))
                    .map((item) => {
                      const active = isActive(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.75rem",
                            padding: "0.6rem 1rem",
                            marginLeft: "1rem",
                            marginTop: "0.2rem",
                            marginBottom: "0.2rem",
                            borderRadius: "6px",
                            color: active ? "#FF9800" : "var(--text-secondary)",
                            textDecoration: "none",
                            background: active ? "rgba(255, 152, 0, 0.12)" : "transparent",
                            borderLeft: active ? "3px solid #FF9800" : "3px solid transparent",
                            transition: "all 0.2s ease",
                            fontSize: "0.9rem",
                            fontWeight: active ? 600 : 500,
                          }}
                          onMouseEnter={(e) => {
                            if (!active) {
                              (e.currentTarget as HTMLElement).style.background = "rgba(255, 152, 0, 0.08)";
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
                          <span style={{ fontSize: "1rem" }}>{item.icon}</span>
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
              </div>
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
              background: "rgba(255, 152, 0, 0.1)",
              border: "1px solid rgba(255, 152, 0, 0.2)",
              borderRadius: "8px",
              textAlign: "center",
              fontSize: "0.85rem",
              color: "var(--primary)",
              fontWeight: 600,
              textTransform: "capitalize",
            }}
          >
            {userRole.toUpperCase()}
          </div>
        )}
      </aside>

      {/* Overlay for mobile when open */}
      {isOpen && (
        <div
          onClick={onCloseSidebar}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.3)",
            zIndex: 999,
            display: isOpen ? "block" : "none",
          }}
        />
      )}
    </>
  );
}
