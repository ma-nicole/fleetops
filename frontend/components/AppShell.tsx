"use client";

import { useEffect, useRef, useState } from "react";

import NavBar from "./NavBar";
import Sidebar from "./Sidebar";
import { useAnnouncer } from "@/lib/useAnnouncer";
import { useAuthStatus } from "@/lib/useAuthStatus";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const announcer = useAnnouncer();
  const mainRef = useRef<HTMLElement | null>(null);
  const { isLoggedIn } = useAuthStatus();
  const showAuthedChrome = isLoggedIn === true;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setIsMobile(window.innerWidth <= 768);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Auto-close the drawer the moment the user signs out (or signs in on a
  // different tab) so the unauthenticated layout snaps back to a clean state.
  useEffect(() => {
    if (!showAuthedChrome) {
      setIsSidebarOpen(false);
    }
  }, [showAuthedChrome]);

  // Lock body scroll when the drawer is open on mobile.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const shouldLock = showAuthedChrome && isSidebarOpen && isMobile;
    document.body.classList.toggle("has-drawer-open", shouldLock);
    return () => document.body.classList.remove("has-drawer-open");
  }, [showAuthedChrome, isSidebarOpen, isMobile]);

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to main content
      </a>

      <header role="banner">
        <NavBar
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen((current) => !current)}
          onOpenSidebar={() => setIsSidebarOpen(true)}
        />
      </header>

      {showAuthedChrome && (
        <Sidebar
          isOpen={isSidebarOpen}
          onCloseSidebar={() => setIsSidebarOpen(false)}
          onOpenSidebar={() => setIsSidebarOpen(true)}
        />
      )}

      <main
        id="main"
        ref={mainRef}
        tabIndex={-1}
        style={{
          marginLeft: showAuthedChrome && isSidebarOpen && !isMobile ? "280px" : "0",
          marginTop: "76px",
          transition: "margin-left 0.3s ease",
          outline: "none",
        }}
      >
        {children}
      </main>

      {/* Global screen-reader announcer. Components call `announce("...")`. */}
      <div
        role="status"
        aria-live={announcer.politeness}
        aria-atomic="true"
        className="sr-only"
        key={announcer.token}
      >
        {announcer.message}
      </div>
    </>
  );
}
