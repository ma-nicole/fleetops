"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { useFocusTrap } from "@/lib/useAnnouncer";

type SubMenuItem = {
  label: string;
  href: string;
  roles: string[];
};

type MenuModule = {
  label: string;
  roles: string[];
  items: SubMenuItem[];
};

const menuModules: MenuModule[] = [
  // DRIVER
  {
    label: "Active Operations",
    roles: ["driver"],
    items: [
      { label: "Dashboard", href: "/driver/dashboard", roles: ["driver"] },
      { label: "Scheduled Trips", href: "/driver/scheduled-trips", roles: ["driver"] },
      { label: "Order Details", href: "/driver/order-details", roles: ["driver"] },
      { label: "Update Trip Status", href: "/driver/update-status", roles: ["driver"] },
    ],
  },
  {
    label: "Schedule & Pay",
    roles: ["driver"],
    items: [
      { label: "Designated Schedule", href: "/driver/schedule", roles: ["driver"] },
      { label: "Total Pay", href: "/driver/pay", roles: ["driver"] },
    ],
  },
  {
    label: "Vehicle",
    roles: ["driver"],
    items: [
      { label: "Vehicle Status", href: "/driver/vehicle-status", roles: ["driver"] },
    ],
  },
  {
    label: "Reports & Ratings",
    roles: ["driver"],
    items: [
      { label: "Completion Report", href: "/driver/completion-report", roles: ["driver"] },
      { label: "Activity & Ratings", href: "/driver/activity-ratings", roles: ["driver"] },
    ],
  },

  // DISPATCHER
  {
    label: "Dashboard & Operations",
    roles: ["dispatcher"],
    items: [
      { label: "Dashboard", href: "/dispatcher/dashboard", roles: ["dispatcher"] },
      { label: "Weekly Schedule Board", href: "/dispatcher/week-board", roles: ["dispatcher"] },
      { label: "Job Assignment", href: "/dispatcher/job-assignments", roles: ["dispatcher"] },
      { label: "Route Optimizer", href: "/modules/analytics/route-optimizer", roles: ["dispatcher"] },
      { label: "What-if Simulator", href: "/modules/analytics/whatif", roles: ["dispatcher"] },
      { label: "Schedules", href: "/dispatcher/schedules", roles: ["dispatcher"] },
      { label: "Order Details", href: "/dispatcher/order-details", roles: ["dispatcher"] },
      { label: "Trip Monitoring", href: "/dispatcher/trip-monitoring", roles: ["dispatcher"] },
    ],
  },
  {
    label: "People & Assets",
    roles: ["dispatcher"],
    items: [
      { label: "Assets & Drivers", href: "/dispatcher/assets-drivers", roles: ["dispatcher"] },
      { label: "Reported Issues", href: "/dispatcher/reported-issues", roles: ["dispatcher"] },
    ],
  },
  {
    label: "Reports & Completion",
    roles: ["dispatcher"],
    items: [
      { label: "System Reports", href: "/dispatcher/reports", roles: ["dispatcher"] },
      { label: "Accomplishment Report", href: "/dispatcher/accomplishment-report", roles: ["dispatcher"] },
      { label: "Log Report", href: "/dispatcher/log-report", roles: ["dispatcher"] },
      { label: "Confirm Completion", href: "/dispatcher/confirm-completion", roles: ["dispatcher"] },
    ],
  },

  // MANAGER
  {
    label: "Analytics",
    roles: ["manager"],
    items: [
      { label: "Dashboard", href: "/manager/dashboard", roles: ["manager"] },
      { label: "Predictive (Cost/Fuel/Maint.)", href: "/modules/analytics/predictions", roles: ["manager"] },
      { label: "What-if Simulator", href: "/modules/analytics/whatif", roles: ["manager"] },
      { label: "Route Optimizer (A*)", href: "/modules/analytics/route-optimizer", roles: ["manager"] },
      { label: "Accuracy & Drift", href: "/modules/analytics/accuracy", roles: ["manager"] },
      { label: "Analytics Dashboard", href: "/analytics/dashboard", roles: ["manager"] },
      { label: "Analytics Reports", href: "/analytics/reports", roles: ["manager"] },
      { label: "Trip Monitoring", href: "/manager/trip-monitoring", roles: ["manager"] },
      { label: "History", href: "/manager/history", roles: ["manager"] },
    ],
  },
  {
    label: "Operations",
    roles: ["manager"],
    items: [
      { label: "Scheduling", href: "/manager/scheduling", roles: ["manager"] },
      { label: "Order Details", href: "/manager/orders", roles: ["manager"] },
      { label: "Accomplishment Report", href: "/manager/accomplishment-report", roles: ["manager"] },
      { label: "Pending Bookings", href: "/manager/pending-bookings", roles: ["manager"] },
      { label: "Accomplished Bookings", href: "/manager/accomplished-bookings", roles: ["manager"] },
    ],
  },
  {
    label: "Management",
    roles: ["manager"],
    items: [
      { label: "Truck Management", href: "/manager/truck-management", roles: ["manager"] },
      { label: "Dispatcher Activity", href: "/manager/dispatcher-activity", roles: ["manager"] },
      { label: "Driver Profiles", href: "/manager/driver-profiles", roles: ["manager"] },
    ],
  },
  {
    label: "People & Finance",
    roles: ["manager"],
    items: [
      { label: "Customer Profiles", href: "/manager/customer-profiles", roles: ["manager"] },
      { label: "Finance View", href: "/manager/finance", roles: ["manager"] },
      { label: "Customer Reviews", href: "/manager/customer-reviews", roles: ["manager"] },
    ],
  },

  // ADMIN — compact 2-group layout
  {
    label: "Overview",
    roles: ["admin"],
    items: [
      { label: "Dashboard", href: "/admin/dashboard", roles: ["admin"] },
      { label: "Scheduling", href: "/admin/scheduling", roles: ["admin"] },
      { label: "Trip Monitoring", href: "/admin/trip-monitoring", roles: ["admin"] },
      { label: "Orders", href: "/admin/orders", roles: ["admin"] },
      { label: "Analytics", href: "/admin/analytics", roles: ["admin"] },
      { label: "Finance", href: "/admin/finance", roles: ["admin"] },
    ],
  },
  {
    label: "System",
    roles: ["admin"],
    items: [
      { label: "Authentication", href: "/modules/administration/authentication", roles: ["admin"] },
      { label: "Access Control", href: "/modules/administration/access-control", roles: ["admin"] },
      { label: "Accounts", href: "/modules/administration/accounts", roles: ["admin"] },
      { label: "Settings", href: "/modules/administration/settings", roles: ["admin"] },
    ],
  },

  // CUSTOMER
  {
    label: "Booking",
    roles: ["customer"],
    items: [
      { label: "New booking", href: "/booking", roles: ["customer"] },
      { label: "My Profile", href: "/modules/customer/profile", roles: ["customer"] },
      { label: "Select Truck", href: "/booking/trucks", roles: ["customer"] },
      { label: "Select Service", href: "/booking/services", roles: ["customer"] },
      { label: "Checkout", href: "/booking/checkout", roles: ["customer"] },
      { label: "Payment", href: "/modules/customer/payment", roles: ["customer"] },
    ],
  },
  {
    label: "My Bookings",
    roles: ["customer"],
    items: [
      { label: "Current Bookings", href: "/modules/operations/trips", roles: ["customer"] },
      { label: "Booking History", href: "/modules/customer/booking-history", roles: ["customer"] },
      { label: "Cost Summary", href: "/modules/operations/cost-summary", roles: ["customer"] },
      { label: "Support", href: "/modules/customer/support", roles: ["customer"] },
    ],
  },
];

const moduleId = (label: string) => `sidebar-panel-${label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;

type SidebarProps = {
  isOpen: boolean;
  onCloseSidebar: () => void;
  onOpenSidebar: () => void;
};

export default function Sidebar({ isOpen, onCloseSidebar }: SidebarProps) {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [expandedModules, setExpandedModules] = useState<string[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const pathname = usePathname();

  // For admin (compact 2-group layout) keep both groups expanded by default
  // so navigation is one click instead of two.
  useEffect(() => {
    if (userRole === "admin") {
      setExpandedModules((prev) => {
        const adminGroups = ["Overview", "System"];
        const next = new Set(prev);
        adminGroups.forEach((g) => next.add(g));
        return Array.from(next);
      });
    }
  }, [userRole]);
  const asideRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isAuthenticated()) {
      const role = window.localStorage.getItem("userRole") || "customer";
      setUserRole(role);
    } else {
      setUserRole(null);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setIsMobile(window.innerWidth <= 768);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Close on Escape (only when open).
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseSidebar();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onCloseSidebar]);

  // Trap focus inside the drawer when modal (mobile + open). On desktop the
  // sidebar is non-modal and users can freely tab in and out.
  useFocusTrap(asideRef, isOpen && isMobile);

  const visibleModules = menuModules.filter(
    (module) => userRole && module.roles.includes(userRole)
  );

  // Auto-expand the module that contains the current page so the user can
  // see where they are.
  useEffect(() => {
    if (!userRole) return;
    const containing = menuModules.find((module) =>
      module.items.some(
        (item) => pathname === item.href || pathname.startsWith(item.href + "/")
      )
    );
    if (containing && !expandedModules.includes(containing.label)) {
      setExpandedModules((prev) =>
        prev.includes(containing.label) ? prev : [...prev, containing.label]
      );
    }
  }, [pathname, userRole, expandedModules]);

  if (!userRole) return null;

  const toggleModule = (moduleLabel: string) => {
    setExpandedModules((prev) =>
      prev.includes(moduleLabel)
        ? prev.filter((m) => m !== moduleLabel)
        : [...prev, moduleLabel]
    );
  };

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  // React 19 types `inert` as a proper boolean attribute. Spread it only when
  // the sidebar is closed so React renders the bare attribute (no value) and
  // omits it entirely when open.
  const inertProps = !isOpen ? { inert: true } : {};

  return (
    <>
      <aside
        ref={asideRef}
        id="primary-nav"
        aria-label="Primary navigation"
        aria-hidden={!isOpen}
        {...inertProps}
        style={{
          position: "fixed",
          left: 0,
          top: "76px",
          width: isOpen ? "280px" : "0",
          height: "calc(100vh - 76px)",
          background: "#FFFFFF",
          borderRight: "1px solid #E8E8E8",
          overflowX: "hidden",
          transition: "width 0.3s ease, transform 0.3s ease",
          zIndex: 1000,
          paddingTop: "1rem",
          transform: isOpen ? "translateX(0)" : "translateX(-100%)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Logo + close */}
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
              color: "var(--brand-text)",
              textDecoration: "none",
            }}
          >
            FleetOpt
          </Link>

          <button
            type="button"
            onClick={onCloseSidebar}
            aria-label="Close navigation"
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
              fontSize: "1.25rem",
            }}
          >
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="3" x2="15" y2="15" />
              <line x1="15" y1="3" x2="3" y2="15" />
            </svg>
          </button>
        </div>

        <nav aria-label="Main menu" style={{ padding: "0 0.5rem", flex: 1, overflowY: "auto", minHeight: 0 }}>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {visibleModules.map((module) => {
              const panelId = moduleId(module.label);
              const isExpanded = expandedModules.includes(module.label);
              const visibleItems = module.items.filter(
                (item) => userRole && item.roles.includes(userRole)
              );

              return (
                <li key={module.label}>
                  <button
                    type="button"
                    onClick={() => toggleModule(module.label)}
                    aria-expanded={isExpanded}
                    aria-controls={panelId}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.75rem",
                      padding: "0.75rem 1rem",
                      margin: "0.25rem 0",
                      minHeight: "44px",
                      borderRadius: "8px",
                      border: "none",
                      background: "rgba(255, 152, 0, 0.08)",
                      color: "var(--text)",
                      cursor: "pointer",
                      transition: "background 0.2s ease",
                      fontSize: "0.95rem",
                      fontWeight: 600,
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background =
                        "rgba(255, 152, 0, 0.15)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background =
                        "rgba(255, 152, 0, 0.08)";
                    }}
                  >
                    <span>{module.label}</span>
                    <svg
                      aria-hidden="true"
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{
                        transition: "transform 0.2s ease",
                        transform: isExpanded ? "rotate(180deg)" : "rotate(0)",
                        color: "var(--text-secondary)",
                        flexShrink: 0,
                      }}
                    >
                      <polyline points="2,4 7,10 12,4" />
                    </svg>
                  </button>

                  <ul
                    id={panelId}
                    hidden={!isExpanded}
                    style={{
                      listStyle: "none",
                      margin: 0,
                      padding: 0,
                    }}
                  >
                    {visibleItems.map((item) => {
                      const active = isActive(item.href);
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            aria-current={active ? "page" : undefined}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.75rem",
                              padding: "0.6rem 1rem",
                              marginLeft: "1rem",
                              marginTop: "0.2rem",
                              marginBottom: "0.2rem",
                              minHeight: "44px",
                              borderRadius: "6px",
                              color: active ? "var(--brand-text-strong)" : "var(--text)",
                              textDecoration: "none",
                              background: active ? "rgba(255, 152, 0, 0.18)" : "transparent",
                              borderLeft: active
                                ? "3px solid var(--brand-text)"
                                : "3px solid transparent",
                              transition: "background 0.2s ease, color 0.2s ease",
                              fontSize: "0.9rem",
                              fontWeight: active ? 600 : 500,
                            }}
                            onMouseEnter={(e) => {
                              if (!active) {
                                (e.currentTarget as HTMLElement).style.background =
                                  "rgba(255, 152, 0, 0.08)";
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!active) {
                                (e.currentTarget as HTMLElement).style.background =
                                  "transparent";
                              }
                            }}
                            onClick={() => {
                              if (typeof window !== "undefined" && window.innerWidth <= 768) {
                                onCloseSidebar();
                              }
                            }}
                          >
                            {item.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ul>
        </nav>

        <p
          style={{
            margin: "1rem",
            padding: "0.75rem",
            background: "rgba(255, 152, 0, 0.1)",
            border: "1px solid rgba(255, 152, 0, 0.25)",
            borderRadius: "8px",
            textAlign: "center",
            fontSize: "0.85rem",
            color: "var(--brand-text-strong)",
            fontWeight: 600,
            flexShrink: 0,
          }}
          aria-label={`Signed in as ${userRole}`}
        >
          <span style={{ textTransform: "capitalize" }}>{userRole}</span>
        </p>
      </aside>

      {/* Click-away overlay (mobile only). It's a real button so screen-reader
          users can also dismiss the drawer; visually it sits behind the panel. */}
      {isOpen && isMobile && (
        <button
          type="button"
          onClick={onCloseSidebar}
          aria-label="Close navigation"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.4)",
            border: "none",
            padding: 0,
            cursor: "pointer",
            zIndex: 999,
          }}
        />
      )}
    </>
  );
}
