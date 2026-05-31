"use client";

import type { ReactNode } from "react";

type PageShellProps = {
  children: ReactNode;
  maxWidth?: number | string;
  className?: string;
};

export default function PageShell({ children, maxWidth = 1400, className = "" }: PageShellProps) {
  return (
    <main className={`app-page ${className}`.trim()}>
      <div className="app-page__inner" style={{ maxWidth }}>
        {children}
      </div>
    </main>
  );
}
