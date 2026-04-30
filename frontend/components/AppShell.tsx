"use client";

import { useEffect, useState } from "react";

import NavBar from "./NavBar";
import Sidebar from "./Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsLoggedIn(!!token);
  }, []);

  return (
    <>
      <NavBar
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((current) => !current)}
        onOpenSidebar={() => setIsSidebarOpen(true)}
      />
      {isLoggedIn && (
        <Sidebar
          isOpen={isSidebarOpen}
          onCloseSidebar={() => setIsSidebarOpen(false)}
          onOpenSidebar={() => setIsSidebarOpen(true)}
        />
      )}
      <main style={{ marginLeft: isLoggedIn && isSidebarOpen ? "280px" : "0", marginTop: "76px", transition: "margin-left 0.3s ease" }}>
        {children}
      </main>
    </>
  );
}