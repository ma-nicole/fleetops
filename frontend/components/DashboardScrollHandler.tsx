"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { scrollFromLocationHash } from "@/lib/scrollToSection";

/**
 * On route or hash change, scroll to the target section with header offset.
 * Retries while async dashboard sections mount.
 */
export default function DashboardScrollHandler() {
  const pathname = usePathname();

  useEffect(() => {
    const run = () => {
      requestAnimationFrame(() => {
        window.setTimeout(() => {
          scrollFromLocationHash({ maxAttempts: 15 });
        }, 150);
      });
    };

    run();
    window.addEventListener("hashchange", run);
    return () => window.removeEventListener("hashchange", run);
  }, [pathname]);

  return null;
}
