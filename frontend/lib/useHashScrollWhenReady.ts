"use client";

import { useEffect } from "react";
import { scrollFromLocationHash } from "@/lib/scrollToSection";

/** After async dashboard content mounts, honor location hash with header offset. */
export function useHashScrollWhenReady(ready: boolean): void {
  useEffect(() => {
    if (!ready) return;
    requestAnimationFrame(() => {
      window.setTimeout(() => {
        scrollFromLocationHash({ maxAttempts: 10 });
      }, 120);
    });
  }, [ready]);
}
