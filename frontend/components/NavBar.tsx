"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import NavBarAuth from "./NavBarAuth";
import { useAuthStatus } from "@/lib/useAuthStatus";

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
  const [query, setQuery] = useState("");
  const [resultsOpen, setResultsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const searchRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const optionId = (index: number) => `${listboxId}-option-${index}`;

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return searchIndex.slice(0, 4);
    return searchIndex.filter((item) => {
      const searchable = [item.label, ...item.keywords].join(" ").toLowerCase();
      return searchable.includes(normalized);
    });
  }, [query]);

  // Reset highlighted option whenever results change.
  useEffect(() => {
    setActiveIndex(results.length > 0 ? 0 : -1);
  }, [results]);

  // Clear search state when the user signs out so nothing lingers in memory.
  useEffect(() => {
    if (!showAuthedChrome) {
      setQuery("");
      setResultsOpen(false);
    }
  }, [showAuthedChrome]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!showAuthedChrome) return;
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
  }, [router, showAuthedChrome]);

  const navigateTo = (href: string) => {
    router.push(href);
    setResultsOpen(false);
    setQuery("");
  };

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (activeIndex >= 0 && results[activeIndex]) {
      navigateTo(results[activeIndex].href);
    } else if (results[0]) {
      navigateTo(results[0].href);
    }
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!resultsOpen && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      setResultsOpen(true);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => (results.length === 0 ? -1 : (prev + 1) % results.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) =>
        results.length === 0 ? -1 : (prev - 1 + results.length) % results.length
      );
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(results.length - 1);
    } else if (event.key === "Escape") {
      if (resultsOpen) {
        event.preventDefault();
        setResultsOpen(false);
      }
    }
  };

  return (
    <nav
      className="navbar"
      aria-label="Top navigation"
      style={{
        display: "grid",
        gridTemplateColumns: showAuthedChrome
          ? "auto auto minmax(0, 1fr) auto"
          : "auto 1fr auto",
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

      {/* Search bar — authenticated users only. */}
      {showAuthedChrome ? (
        <form
          className="nav-search"
          onSubmit={handleSearchSubmit}
          style={{ position: "relative" }}
          role="search"
        >
          <label htmlFor={`${listboxId}-input`} className="sr-only">
            Search bookings, drivers, or trips
          </label>
          <input
            id={`${listboxId}-input`}
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
            onKeyDown={handleSearchKeyDown}
            placeholder="Search bookings, drivers, trips..."
            role="combobox"
            aria-expanded={resultsOpen}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={
              resultsOpen && activeIndex >= 0 ? optionId(activeIndex) : undefined
            }
          />
          <button type="submit" className="nav-search-button">
            Search
          </button>

          {resultsOpen && (
            <ul
              id={listboxId}
              role="listbox"
              aria-label="Quick search results"
              className="nav-search-results"
              style={{ listStyle: "none", margin: 0, padding: 0 }}
            >
              {results.length ? (
                results.map((item, index) => {
                  const isActive = index === activeIndex;
                  return (
                    <li key={item.href} role="presentation">
                      <button
                        id={optionId(index)}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        className="nav-search-result"
                        onMouseDown={(event) => event.preventDefault()}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => navigateTo(item.href)}
                        style={{
                          width: "100%",
                          background: isActive ? "#F5F5F5" : "transparent",
                        }}
                      >
                        <span>{item.label}</span>
                        <span>{item.href}</span>
                      </button>
                    </li>
                  );
                })
              ) : (
                <li role="presentation">
                  <div className="nav-search-empty" role="status">
                    No matches. Try booking, driver, trip, or manager.
                  </div>
                </li>
              )}
            </ul>
          )}
        </form>
      ) : (
        <span aria-hidden="true" />
      )}

      <div className="navbar-links">
        {showAuthedChrome && (
          <>
            <Link href="/booking" className="navbar-link">
              Booking
            </Link>
            {userRole && (
              <Link href={`/dashboard/${userRole}`} className="navbar-link">
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
