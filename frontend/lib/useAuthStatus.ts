"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { isAuthenticated, getUserRole, type UserRole } from "./auth";

const AUTH_CHANGE_EVENT = "fleetops:auth-change";

/**
 * Notify every `useAuthStatus` listener that auth state has changed.
 * Call after login, logout, or any mutation to the auth localStorage keys.
 */
export function emitAuthChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AUTH_CHANGE_EVENT));
}

type AuthStatus = {
  /** `null` while we have not yet read localStorage (first SSR/hydration tick). */
  isLoggedIn: boolean | null;
  role: UserRole | null;
};

/**
 * Single source of truth for "is the user logged in?" across the app.
 *
 * Re-reads localStorage on:
 *   - mount (after hydration)
 *   - pathname change (covers same-tab navigations after login/logout)
 *   - `storage` events (other tabs)
 *   - the in-app `fleetops:auth-change` event (this tab, after sign-in/out)
 */
export function useAuthStatus(): AuthStatus {
  const [status, setStatus] = useState<AuthStatus>({ isLoggedIn: null, role: null });
  const pathname = usePathname();

  useEffect(() => {
    const refresh = () => {
      setStatus({
        isLoggedIn: isAuthenticated(),
        role: getUserRole(),
      });
    };

    refresh();

    window.addEventListener("storage", refresh);
    window.addEventListener(AUTH_CHANGE_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(AUTH_CHANGE_EVENT, refresh);
    };
  }, [pathname]);

  return status;
}
