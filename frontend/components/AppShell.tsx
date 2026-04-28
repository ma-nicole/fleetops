"use client";

import { useState } from "react";

import NavBar from "./NavBar";
import Sidebar from "./Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <>
      <NavBar
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((current) => !current)}
        onOpenSidebar={() => setIsSidebarOpen(true)}
      />
      <Sidebar
        isOpen={isSidebarOpen}
        onCloseSidebar={() => setIsSidebarOpen(false)}
        onOpenSidebar={() => setIsSidebarOpen(true)}
      />
      <main style={{ marginLeft: isSidebarOpen ? "240px" : "0", marginTop: "76px", transition: "margin-left 0.3s ease" }}>
        {children}
      </main>
    </>
  );
}