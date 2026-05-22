"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AUTH_CHANGE_EVENT, getEffectiveRole, isAuthenticated } from "@/lib/auth";
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

/**
 * Nav-only: hide academic / stub analytics modules from the sidebar. Routes and files stay available
 * (bookmarks, direct URLs). Roles listed in ops policy: admin + dispatcher. Lab links under Manager →
 * Analytics are unchanged here; add `"manager"` to this set to hide those too.
 */
const SIDEBAR_NAV_ROLES_HIDING_ANALYTICS_MODULES = new Set(["admin", "dispatcher"]);

function isSidebarAnalyticsModuleHidden(role: string, href: string): boolean {
  if (!SIDEBAR_NAV_ROLES_HIDING_ANALYTICS_MODULES.has(role)) return false;
  const path = href.split("?")[0] ?? href;
  if (path.startsWith("/modules/analytics")) return true;
  if (path.startsWith("/analytics/")) return true;
  return false;
}

const menuModules: MenuModule[] = [
  // DRIVER
  {
    label: "Active Operations",
    roles: ["driver"],
    items: [
      { label: "Dashboard", href: "/driver/dashboard", roles: ["driver"] },
      { label: "Scheduled Bookings", href: "/driver/scheduled-trips", roles: ["driver"] },
    ],
  },
  {
    label: "Schedule & Pay",
    roles: ["driver"],
    items: [
      { label: "Total Pay", href: "/driver/pay", roles: ["driver"] },
    ],
  },
  {
    label: "Vehicle",
    roles: ["driver"],
    items: [
      { label: "Report Vehicle Issue", href: "/driver/vehicle-status", roles: ["driver"] },
    ],
  },
  {
    label: "Reports",
    roles: ["driver"],
    items: [
      { label: "General Form", href: "/driver/general-form", roles: ["driver"] },
      /* Hidden (not removed): Activity & Ratings — `/driver/activity-ratings` still works via direct URL. */
    ],
  },

  {
    label: "Active Operations",
    roles: ["helper"],
    items: [
      { label: "Dashboard", href: "/driver/dashboard", roles: ["helper"] },
      { label: "Bookings", href: "/helper/bookings", roles: ["helper"] },
    ],
  },
  {
    label: "Schedule & Pay",
    roles: ["helper"],
    items: [
      { label: "Designated Schedule", href: "/helper/designated-schedule", roles: ["helper"] },
      { label: "Total Pay", href: "/helper/total-pay", roles: ["helper"] },
    ],
  },
  {
    label: "Vehicle",
    roles: ["helper"],
    items: [{ label: "Vehicle Status", href: "/helper/vehicle-status", roles: ["helper"] }],
  },
  {
    label: "Reports & Ratings",
    roles: ["helper"],
    items: [
      { label: "Completion Report", href: "/helper/completion-report", roles: ["helper"] },
      { label: "Activity & Ratings", href: "/helper/activity-ratings", roles: ["helper"] },
    ],
  },

  // DISPATCHER
  {
    label: "Dashboard & Operations",
    roles: ["dispatcher"],
    items: [
      { label: "Dashboard", href: "/dispatcher/dashboard", roles: ["dispatcher"] },
      { label: "Job assignment", href: "/dispatcher/job-assignments", roles: ["dispatcher"] },
      { label: "Weekly Schedule Board", href: "/dispatcher/week-board", roles: ["dispatcher"] },
      { label: "Trip monitoring", href: "/dispatcher/trip-monitoring", roles: ["dispatcher"] },
      { label: "Resource Availability", href: "/dispatcher/assets-drivers", roles: ["dispatcher"] },
      { label: "Order Details", href: "/dispatcher/order-details", roles: ["dispatcher"] },
    ],
  },
  {
    label: "People & Assets",
    roles: ["dispatcher"],
    items: [
      { label: "Assets & Drivers", href: "/dispatcher/assets-drivers", roles: ["dispatcher"] },
      { label: "Reported Issues", href: "/dispatcher/reported-issues", roles: ["dispatcher"] },
      { label: "System Reports", href: "/dispatcher/reports", roles: ["dispatcher"] },
      { label: "Operational Log", href: "/dispatcher/log-report", roles: ["dispatcher"] },
      { label: "Trip cost ledger", href: "/dispatcher/trip-cost-ledger", roles: ["dispatcher"] },
    ],
  },

  // MANAGER
  {
    label: "Analytics",
    roles: ["manager"],
    items: [
      { label: "Dashboard", href: "/manager/dashboard", roles: ["manager"] },
      { label: "Predictive (Cost/Fuel/Maint.)", href: "/modules/analytics/predictions", roles: ["manager"] },
      { label: "Live data marts", href: "/modules/analytics/operations-snapshot", roles: ["manager"] },
      { label: "Expense summary", href: "/modules/analytics/expenses", roles: ["manager"] },
      { label: "What-if Simulator", href: "/modules/analytics/whatif", roles: ["manager"] },
      { label: "Route Optimizer (A*)", href: "/modules/analytics/route-optimizer", roles: ["manager"] },
      { label: "Accuracy & Drift", href: "/modules/analytics/accuracy", roles: ["manager"] },
      { label: "Analytics Reports", href: "/analytics/reports", roles: ["manager"] },
      { label: "Trip Monitoring", href: "/manager/trip-monitoring", roles: ["manager"] },
      { label: "History", href: "/manager/history", roles: ["manager"] },
    ],
  },
  {
    label: "Operations",
    roles: ["manager"],
    items: [
      { label: "Payment approval", href: "/admin/payment-approval", roles: ["manager"] },
      { label: "Goods declarations", href: "/admin/goods-declarations", roles: ["manager"] },
      { label: "Cargo type validation", href: "/admin/cargo-type-validation", roles: ["manager"] },
      { label: "Dispatcher assignments", href: "/admin/dispatcher-assignments", roles: ["manager"] },
      { label: "Order Details", href: "/manager/orders", roles: ["manager"] },
      { label: "General Form", href: "/manager/general-form", roles: ["manager"] },
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
      { label: "Calculations", href: "/modules/administration/booking-pricing", roles: ["admin"] },
      { label: "Payment Approval", href: "/admin/payment-approval", roles: ["admin"] },
      { label: "Goods Declarations", href: "/admin/goods-declarations", roles: ["admin"] },
      { label: "Cargo Type Validation", href: "/admin/cargo-type-validation", roles: ["admin"] },
      { label: "Dispatcher Assignments", href: "/admin/dispatcher-assignments", roles: ["admin"] },
      { label: "Trip Monitoring", href: "/admin/trip-monitoring", roles: ["admin"] },
      { label: "General Form", href: "/manager/general-form", roles: ["admin"] },
    ],
  },
  {
    label: "System",
    roles: ["admin"],
    items: [
      { label: "User Management", href: "/modules/administration/accounts", roles: ["admin"] },
      { label: "Vehicle Management", href: "/modules/administration/vehicles", roles: ["admin"] },
    ],
  },

  // CUSTOMER
  {
    label: "Booking",
    roles: ["customer"],
    items: [
      { label: "New booking", href: "/booking", roles: ["customer"] },
      { label: "My Profile", href: "/modules/customer/profile", roles: ["customer"] },
      { label: "Payment", href: "/modules/customer/payment", roles: ["customer"] },
    ],
  },
  {
    label: "My Bookings",
    roles: ["customer"],
    items: [
      { label: "Current Bookings", href: "/modules/operations/trips", roles: ["customer"] },
      { label: "Booking History", href: "/modules/customer/booking-history", roles: ["customer"] },
      { label: "Feedback", href: "/modules/customer/support", roles: ["customer"] },
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

  // Helpers: expand all nav groups by default so submenu links are not stuck behind collapsed accordions.
  useEffect(() => {
    if (userRole === "helper") {
      setExpandedModules((prev) => {
        const helperGroups = ["Active Operations", "Schedule & Pay", "Vehicle", "Reports & Ratings"];
        const next = new Set(prev);
        helperGroups.forEach((g) => next.add(g));
        return Array.from(next);
      });
    }
  }, [userRole]);
  const asideRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncRole = () => {
      if (!isAuthenticated()) {
        setUserRole(null);
        return;
      }
      // Match NavBar / guards: JWT role first — never default to "customer" or staff lose admin menu (e.g. diesel settings).
      setUserRole(getEffectiveRole());
    };

    syncRole();
    window.addEventListener(AUTH_CHANGE_EVENT, syncRole);
    window.addEventListener("storage", syncRole);
    return () => {
      window.removeEventListener(AUTH_CHANGE_EVENT, syncRole);
      window.removeEventListener("storage", syncRole);
    };
  }, [pathname]);

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

  // Auto-expand the module that contains the current page when the route or
  // role changes. Do not depend on expandedModules — that would re-run after
  // every manual collapse and immediately re-expand the active section.
  useEffect(() => {
    if (!userRole) return;
    const containing = menuModules.find((module) =>
      module.items.some(
        (item) => pathname === item.href || pathname.startsWith(item.href + "/")
      )
    );
    if (!containing) return;
    setExpandedModules((prev) =>
      prev.includes(containing.label) ? prev : [...prev, containing.label]
    );
  }, [pathname, userRole]);

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
          /* When the drawer is closed, do not intercept clicks on the main canvas (inert + hit-testing). */
          pointerEvents: isOpen ? "auto" : "none",
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
                (item) =>
                  userRole &&
                  item.roles.includes(userRole) &&
                  !isSidebarAnalyticsModuleHidden(userRole, item.href)
              );

              if (visibleItems.length === 0) return null;

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
                        <li key={`${module.label}-${item.href}`}>
                          <Link
                            href={item.href}
                            prefetch={false}
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
                              cursor: "pointer",
                              pointerEvents: "auto",
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
