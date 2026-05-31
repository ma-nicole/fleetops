"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

import NavBarAuth from "./NavBarAuth";
import { getDashboardPath, type UserRole as AuthUserRole } from "@/lib/auth";
import { useAuthStatus } from "@/lib/useAuthStatus";

const QUICK_ACTIONS: Record<string, { label: string; href: string }[]> = {
  admin: [
    { label: "Analytics", href: "/admin/dashboard" },
    { label: "Payments", href: "/admin/payment-approval" },
    { label: "Trips", href: "/admin/trip-monitoring" },
  ],
  manager: [
    { label: "Dashboard", href: "/manager/dashboard" },
    { label: "Pending", href: "/manager/pending-bookings" },
    { label: "Finance", href: "/manager/finance" },
  ],
  dispatcher: [
    { label: "Assign", href: "/dispatcher/job-assignments" },
    { label: "Schedule", href: "/dispatcher/week-board" },
    { label: "Monitor", href: "/dispatcher/trip-monitoring" },
  ],
  driver: [
    { label: "Trips", href: "/driver/scheduled-trips" },
    { label: "Pay", href: "/driver/pay" },
  ],
  helper: [
    { label: "Bookings", href: "/helper/bookings" },
    { label: "Schedule", href: "/helper/designated-schedule" },
  ],
  customer: [{ label: "New Booking", href: "/booking" }],
};

export default function NavBar({
  isSidebarOpen,
  onToggleSidebar,
}: {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onOpenSidebar: () => void;
}) {
  const router = useRouter();
  const { isLoggedIn, role: userRole } = useAuthStatus();
  const showAuthedChrome = isLoggedIn === true;
  const isCustomer = userRole === "customer";
  const quickActions = userRole ? QUICK_ACTIONS[userRole] ?? [] : [];

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!showAuthedChrome) return;
      const isBookingShortcut = event.key.toLowerCase() === "b" && (event.metaKey || event.ctrlKey);
      if (isBookingShortcut && isCustomer) {
        event.preventDefault();
        router.push("/booking");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router, showAuthedChrome, isCustomer]);

  return (
    <nav className="app-navbar" aria-label="Top navigation">
      {showAuthedChrome && (
        <button
          type="button"
          className="app-navbar__menu-btn"
          onClick={onToggleSidebar}
          aria-expanded={isSidebarOpen}
          aria-controls="primary-nav"
          aria-label={isSidebarOpen ? "Close navigation menu" : "Open navigation menu"}
        >
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="5" x2="17" y2="5" />
            <line x1="3" y1="10" x2="17" y2="10" />
            <line x1="3" y1="15" x2="17" y2="15" />
          </svg>
        </button>
      )}

      <Link href="/" className="app-navbar__brand">
        Fleet<span>Opt</span>
      </Link>

      <div className="app-navbar__spacer" aria-hidden="true" />

      <div className="app-navbar__actions">
        {showAuthedChrome && quickActions.map((action) => (
          <Link key={action.href} href={action.href} className="app-navbar__quick-link">
            {action.label}
          </Link>
        ))}

        {showAuthedChrome && userRole && (
          <Link href={getDashboardPath(userRole as AuthUserRole)} className="app-navbar__quick-link">
            Home
          </Link>
        )}

        <NavBarAuth />
      </div>
    </nav>
  );
}
