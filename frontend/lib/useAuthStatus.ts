"use client";

import { useEffect, useState } from "react";

import {
  AUTH_CHANGE_EVENT,
  getEffectiveRole,
  isAuthenticated,
  reconcileRoleFromServer,
  type UserRole,
} from "./auth";

/**
 * Notify every `useAuthStatus` listener that auth state has changed.
 * Call after login, logout, or any mutation to the auth localStorage keys.
 */
export function emitAuthChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AUTH_CHANGE_EVENT));
}

export type AuthStatus = {
  /** `null` while we have not yet read localStorage (SSR / first hydration tick). */
  isLoggedIn: boolean | null;
  role: UserRole | null;
  /** `false` until persisted session is read and (when a token exists) validated via `/auth/me`. */
  isReady: boolean;
};

function readLocalAuth(): Pick<AuthStatus, "isLoggedIn" | "role"> {
  if (typeof window === "undefined") {
    return { isLoggedIn: null, role: null };
  }
  const loggedIn = isAuthenticated();
  return {
    isLoggedIn: loggedIn,
    role: loggedIn ? getEffectiveRole() : null,
  };
}

function initialAuthStatus(): AuthStatus {
  return { isLoggedIn: null, role: null, isReady: false };
}

/**
 * Single source of truth for "is the user logged in?" across the app.
 *
 * On first load with a stored JWT, validates the session through `GET /auth/me`
 * before reporting `isReady: true`, so customer pages do not fire API calls with
 * a stale or expired token.
 */
export function useAuthStatus(): AuthStatus {
  const [status, setStatus] = useState<AuthStatus>(initialAuthStatus);

  useEffect(() => {
    let cancelled = false;

    const applyLocal = (isReady = true) => {
      if (cancelled) return;
      const local = readLocalAuth();
      setStatus({
        isLoggedIn: local.isLoggedIn,
        role: local.role,
        isReady,
      });
    };

    const bootstrap = async () => {
      if (!isAuthenticated()) {
        applyLocal(true);
        return;
      }
      applyLocal(false);
      const role = await reconcileRoleFromServer();
      if (cancelled) return;
      if (role) {
        setStatus({ isLoggedIn: true, role, isReady: true });
        return;
      }
      if (!isAuthenticated()) {
        setStatus({ isLoggedIn: false, role: null, isReady: true });
        return;
      }
      applyLocal(true);
    };

    void bootstrap();

    const onAuthChange = () => applyLocal(true);
    window.addEventListener("storage", onAuthChange);
    window.addEventListener(AUTH_CHANGE_EVENT, onAuthChange);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", onAuthChange);
      window.removeEventListener(AUTH_CHANGE_EVENT, onAuthChange);
    };
  }, []);

  return status;
}
