"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

import NavBarAuth from "./NavBarAuth";
import { getDashboardPath, type UserRole as AuthUserRole } from "@/lib/auth";
import { useAuthStatus } from "@/lib/useAuthStatus";

const ROLE_LABELS: Record<string, string> = {
  driver: "Driver dashboard",
  dispatcher: "Dispatcher dashboard",
  manager: "Manager dashboard",
  admin: "Admin dashboard",
  customer: "Customer dashboard",
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
    <nav
      className="navbar"
      aria-label="Top navigation"
      style={{
        display: "grid",
        gridTemplateColumns: showAuthedChrome ? "auto auto 1fr auto" : "auto 1fr auto",
        alignItems: "center",
        gap: "1rem",
        padding: "1rem",
        background: "#FFFFFF",
        borderBottom: "1px solid #ECF0F1",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      <Link href="/" className="navbar-logo">
        FleetOpt
      </Link>

      {showAuthedChrome && (
        <button
          type="button"
          className="navbar-hamburger"
          onClick={onToggleSidebar}
          aria-expanded={isSidebarOpen}
          aria-controls="primary-nav"
          aria-label={isSidebarOpen ? "Close navigation menu" : "Open navigation menu"}
          title={isSidebarOpen ? "Close navigation" : "Open navigation"}
        >
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="5" x2="17" y2="5" />
            <line x1="3" y1="10" x2="17" y2="10" />
            <line x1="3" y1="15" x2="17" y2="15" />
          </svg>
        </button>
      )}

      {showAuthedChrome ? <div style={{ minWidth: 0 }} aria-hidden="true" /> : <span aria-hidden="true" />}

      <div className="navbar-links" style={{ justifySelf: "end" }}>
        {showAuthedChrome && (
          <>
            {isCustomer && (
              <Link href="/booking" className="navbar-link">
                Booking
              </Link>
            )}
            {userRole && (
              <Link href={getDashboardPath(userRole as AuthUserRole)} className="navbar-link">
                {ROLE_LABELS[userRole] || `${userRole} dashboard`}
              </Link>
            )}
          </>
        )}

        <div style={{ marginLeft: "0.5rem" }}>
          <NavBarAuth />
        </div>
      </div>
    </nav>
  );
}
