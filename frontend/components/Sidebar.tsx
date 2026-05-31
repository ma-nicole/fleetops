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

const SIDEBAR_NAV_ROLES_HIDING_ANALYTICS_MODULES = new Set(["admin", "dispatcher"]);

function isSidebarAnalyticsModuleHidden(role: string, href: string): boolean {
  if (!SIDEBAR_NAV_ROLES_HIDING_ANALYTICS_MODULES.has(role)) return false;
  const path = href.split("?")[0] ?? href;
  if (path.startsWith("/modules/analytics")) return true;
  if (path.startsWith("/analytics/")) return true;
  return false;
}

const menuModules: MenuModule[] = [
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
    items: [{ label: "Total Pay", href: "/driver/pay", roles: ["driver"] }],
  },
  {
    label: "Vehicle",
    roles: ["driver"],
    items: [{ label: "Report Vehicle Issue", href: "/driver/vehicle-status", roles: ["driver"] }],
  },
  {
    label: "Reports",
    roles: ["driver"],
    items: [{ label: "General Form", href: "/driver/general-form", roles: ["driver"] }],
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
  {
    label: "Overview",
    roles: ["admin"],
    items: [
      { label: "Analytics Center", href: "/admin/dashboard", roles: ["admin"] },
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

  useFocusTrap(asideRef, isOpen && isMobile);

  const visibleModules = menuModules.filter((module) => userRole && module.roles.includes(userRole));

  useEffect(() => {
    if (!userRole) return;
    const containing = menuModules.find((module) =>
      module.items.some((item) => pathname === item.href || pathname.startsWith(item.href + "/")),
    );
    if (!containing) return;
    setExpandedModules((prev) => (prev.includes(containing.label) ? prev : [...prev, containing.label]));
  }, [pathname, userRole]);

  if (!userRole) return null;

  const toggleModule = (moduleLabel: string) => {
    setExpandedModules((prev) =>
      prev.includes(moduleLabel) ? prev.filter((m) => m !== moduleLabel) : [...prev, moduleLabel],
    );
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const inertProps = !isOpen ? { inert: true } : {};

  return (
    <>
      <aside
        ref={asideRef}
        id="primary-nav"
        aria-label="Primary navigation"
        aria-hidden={!isOpen}
        {...inertProps}
        className={`app-sidebar${isOpen ? "" : " app-sidebar--closed"}`}
      >
        <div className="app-sidebar__header">
          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--sidebar-text-active)", letterSpacing: "0.04em" }}>
            NAVIGATION
          </span>
          <button type="button" onClick={onCloseSidebar} aria-label="Close navigation" className="app-sidebar__close">
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="3" x2="15" y2="15" />
              <line x1="15" y1="3" x2="3" y2="15" />
            </svg>
          </button>
        </div>

        <nav aria-label="Main menu" className="app-sidebar__nav">
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {visibleModules.map((module) => {
              const panelId = moduleId(module.label);
              const isExpanded = expandedModules.includes(module.label);
              const visibleItems = module.items.filter(
                (item) =>
                  userRole &&
                  item.roles.includes(userRole) &&
                  !isSidebarAnalyticsModuleHidden(userRole, item.href),
              );
              if (visibleItems.length === 0) return null;

              return (
                <li key={module.label}>
                  <button
                    type="button"
                    onClick={() => toggleModule(module.label)}
                    aria-expanded={isExpanded}
                    aria-controls={panelId}
                    className="app-sidebar__group-btn"
                  >
                    <span>{module.label}</span>
                    <svg aria-hidden="true" width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="2,4 7,10 12,4" />
                    </svg>
                  </button>

                  <ul id={panelId} hidden={!isExpanded} style={{ listStyle: "none", margin: 0, padding: 0 }}>
                    {visibleItems.map((item) => {
                      const active = isActive(item.href);
                      return (
                        <li key={`${module.label}-${item.href}`}>
                          <Link
                            href={item.href}
                            prefetch={false}
                            aria-current={active ? "page" : undefined}
                            className={`app-sidebar__link${active ? " app-sidebar__link--active" : ""}`}
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

        <p className="app-sidebar__role-badge" aria-label={`Signed in as ${userRole}`}>
          {userRole} account
        </p>
      </aside>

      {isOpen && isMobile && (
        <button type="button" onClick={onCloseSidebar} aria-label="Close navigation" className="app-sidebar-overlay" />
      )}
    </>
  );
}
