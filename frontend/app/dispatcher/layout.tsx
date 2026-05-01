"use client";

import type { ReactNode } from "react";

import { DISPATCH_CONSOLE_ROLES, useRoleGuard } from "@/lib/useRoleGuard";

/**
 * All routes under `/dispatcher/*` inherit this guard — including aliases that
 * re-export other pages — so omissions on individual screens cannot leave gaps.
 */
export default function DispatcherLayout({ children }: { children: ReactNode }) {
  useRoleGuard(DISPATCH_CONSOLE_ROLES);
  return children;
}
