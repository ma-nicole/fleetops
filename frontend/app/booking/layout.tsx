"use client";

import { type ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";

import { AUTH_CHANGE_EVENT, getDashboardPath, getEffectiveRole, isAuthenticated } from "@/lib/auth";

/**
 * Customer-only booking funnel. Staff accounts are redirected to their dashboard.
 */
export default function BookingLayout({ children }: { children: ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    function guard() {
      if (typeof window === "undefined") return;

      if (!isAuthenticated()) {
        router.replace("/sign-in");
        return;
      }

      const role = getEffectiveRole();
      if (!role) {
        router.replace("/sign-in");
        return;
      }

      if (role !== "customer") {
        router.replace(getDashboardPath(role));
      }
    }

    guard();
    window.addEventListener(AUTH_CHANGE_EVENT, guard);
    return () => window.removeEventListener(AUTH_CHANGE_EVENT, guard);
  }, [router]);

  return children;
}
