"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import NavBarAuth from "./NavBarAuth";

const searchIndex = [
  { label: "Create booking", href: "/booking", keywords: ["booking", "book", "shipment", "cargo"] },
  { label: "Customer dashboard", href: "/dashboard/customer", keywords: ["customer", "bookings", "payments", "ratings"] },
  { label: "Dispatcher console", href: "/dashboard/dispatcher", keywords: ["dispatcher", "assign", "route", "conflict"] },
  { label: "Dispatcher schedules", href: "/dispatcher/schedules", keywords: ["dispatcher", "schedule", "trips"] },
  { label: "Dispatcher trip monitoring", href: "/dispatcher/trip-monitoring", keywords: ["dispatcher", "monitoring", "execution"] },
  { label: "Driver scheduled trips", href: "/driver/scheduled-trips", keywords: ["driver", "schedule", "trips"] },
  { label: "Driver update status", href: "/driver/update-status", keywords: ["driver", "status", "ongoing", "completed", "cancelled"] },
  { label: "Manager analytics", href: "/manager/analytics", keywords: ["manager", "analytics", "overview"] },
  { label: "Analytics dashboard", href: "/analytics/dashboard", keywords: ["analytics", "data pipeline", "dashboard"] },
  { label: "Analytics predictions", href: "/analytics/predictions", keywords: ["prediction", "trip cost", "maintenance risk", "forecast"] },
  { label: "Analytics reports", href: "/analytics/reports", keywords: ["analytics", "reports", "connector ai", "marts"] },
  { label: "Manager finance", href: "/manager/finance", keywords: ["manager", "finance", "payments", "reports"] },
  { label: "Driver app", href: "/dashboard/driver", keywords: ["driver", "trip", "attendance", "earnings"] },
  { label: "Manager dashboard", href: "/dashboard/manager", keywords: ["manager", "kpi", "forecast", "revenue"] },
  { label: "Admin control center", href: "/dashboard/admin", keywords: ["admin", "users", "audit", "fleet"] },
];

export default function NavBar({ isSidebarOpen, onToggleSidebar }: { isSidebarOpen: boolean; onToggleSidebar: () => void; onOpenSidebar: () => void; }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [resultsOpen, setResultsOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Check if user is logged in (client-side only)
  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsLoggedIn(!!token);
    setUserRole(localStorage.getItem("userRole"));
    setIsMounted(true);
  }, []);

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return searchIndex.slice(0, 4);

    return searchIndex.filter((item) => {
      const searchable = [item.label, ...item.keywords].join(" ").toLowerCase();
      return searchable.includes(normalized);
    });
  }, [query]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isLoggedIn) return;

      const isSearchShortcut = event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey);
      const isBookingShortcut = event.key.toLowerCase() === "b" && (event.metaKey || event.ctrlKey);

      if (isSearchShortcut) {
        event.preventDefault();
        searchRef.current?.focus();
      }

      if (isBookingShortcut) {
        event.preventDefault();
        router.push("/booking");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router, isLoggedIn]);

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (results[0]) {
      router.push(results[0].href);
      setResultsOpen(false);
    }
  };

  return (
    <nav
      className="navbar"
      style={{
        display: "grid",
        gridTemplateColumns: "auto auto minmax(0, 1fr) auto",
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

      {isMounted && isLoggedIn && (
        <button type="button" className="navbar-hamburger" onClick={onToggleSidebar} aria-label="Toggle sidebar" title="Toggle sidebar">
          ☰
        </button>
      )}

      {/* Logged in: Show search bar */}
      {isMounted && isLoggedIn && (
        <form className="nav-search" onSubmit={handleSearchSubmit} style={{ position: "relative" }}>
          <input
            ref={searchRef}
            className="input nav-search-input"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setResultsOpen(true);
            }}
            onFocus={() => setResultsOpen(true)}
            onBlur={() => {
              window.setTimeout(() => setResultsOpen(false), 150);
            }}
            placeholder="Search bookings, drivers, trips..."
            aria-label="Search bookings, drivers, or trips"
          />
          <button type="submit" className="nav-search-button">
            Search
          </button>

          {resultsOpen && (
            <div className="nav-search-results" role="listbox" aria-label="Quick search results">
              {results.length ? (
                results.map((item) => (
                  <button
                    key={item.href}
                    type="button"
                    className="nav-search-result"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => router.push(item.href)}
                  >
                    <span>{item.label}</span>
                    <span>{item.href}</span>
                  </button>
                ))
              ) : (
                <div className="nav-search-empty">No matches. Try booking, driver, trip, or manager.</div>
              )}
            </div>
          )}
        </form>
      )}

      <div className="navbar-links">
        {isMounted && isLoggedIn && (
          <>
            <Link href="/booking" className="navbar-link">
              Booking
            </Link>
            {userRole && (
              <Link href={`/dashboard/${userRole}`} className="navbar-link">
                {userRole}
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
