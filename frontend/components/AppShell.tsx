"use client";

import { useEffect, useRef, useState } from "react";

import NavBar from "./NavBar";
import Sidebar from "./Sidebar";
import DashboardScrollHandler from "./DashboardScrollHandler";
import LoadingMessage from "./ui/LoadingMessage";
import { useAnnouncer } from "@/lib/useAnnouncer";
import { useAuthStatus } from "@/lib/useAuthStatus";
import { LOADING_AUTH_RESTORE } from "@/lib/loadingMessages";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const announcer = useAnnouncer();
  const mainRef = useRef<HTMLElement | null>(null);
  const { isLoggedIn, isReady } = useAuthStatus();
  const showAuthedChrome = isReady && isLoggedIn === true;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile) setIsSidebarOpen(false);
      else setIsSidebarOpen(true);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    if (!showAuthedChrome) {
      setIsSidebarOpen(false);
    }
  }, [showAuthedChrome]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const shouldLock = showAuthedChrome && isSidebarOpen && isMobile;
    document.body.classList.toggle("has-drawer-open", shouldLock);
    return () => document.body.classList.remove("has-drawer-open");
  }, [showAuthedChrome, isSidebarOpen, isMobile]);

  const sidebarVisible = showAuthedChrome && isSidebarOpen && !isMobile;

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
        className={`app-main${sidebarVisible ? " app-main--with-sidebar" : ""}`}
      >
        {!isReady ? (
          <LoadingMessage label={LOADING_AUTH_RESTORE} className="auth-restore-loading" />
        ) : (
          <>
            <DashboardScrollHandler />
            {children}
          </>
        )}
      </main>

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
