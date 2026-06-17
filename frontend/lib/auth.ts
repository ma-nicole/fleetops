// Role-based authentication utilities

import { decodeJwtRole } from "./api";

export const AUTH_CHANGE_EVENT = "fleetops:auth-change";
export type UserRole = "driver" | "helper" | "dispatcher" | "manager" | "admin" | "customer";

export const ROLE_DASHBOARDS: Record<UserRole, string> = {
  driver: "/driver/dashboard",
  helper: "/driver/dashboard",
  dispatcher: "/dispatcher/dashboard",
  manager: "/manager/dashboard",
  admin: "/admin/dashboard",
  customer: "/dashboard/customer",
};

export const ROLE_ERROR_MESSAGES: Record<UserRole, string> = {
  driver: "Invalid Account - Please verify your company account details",
  helper: "Invalid Account - Please verify your company account details",
  dispatcher: "Invalid User - Please verify your company account details",
  manager: "Account Not Matched - Please verify your credentials",
  admin: "Account Not Matched - Please verify your credentials",
  customer: "Invalid credentials - Please try again",
};

export function getUserRole(): UserRole | null {
  if (typeof window === "undefined") return null;
  return coerceRole(localStorage.getItem("userRole"));
}

export function setUserRole(role: UserRole): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("userRole", role);
  }
}

const KNOWN_ROLES: UserRole[] = ["driver", "helper", "dispatcher", "manager", "admin", "customer"];

function coerceRole(value: string | null | undefined): UserRole | null {
  if (!value || typeof value !== "string") return null;
  const key = value.trim().toLowerCase();
  return KNOWN_ROLES.includes(key as UserRole) ? (key as UserRole) : null;
}

/** Prefer JWT `role` claim, then persisted `userRole` (fixes stale storage vs token). */
export function getEffectiveRole(): UserRole | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("token") || localStorage.getItem("authToken");
  if (token) {
    const jwtRole = coerceRole(decodeJwtRole(token));
    if (jwtRole) return jwtRole;
  }
  return getUserRole();
}

/** Prefer JWT `role` (authoritative signed claim), then login body echo. Omits persistence until `/auth/me` if both missing. */
export function setAuthSession(token: string, preferredRole?: string | null): UserRole | null {
  if (typeof window === "undefined") return null;
  window.localStorage.setItem("token", token);
  window.localStorage.setItem("authToken", token);
  const fromJwt = coerceRole(decodeJwtRole(token));
  const fromBody = coerceRole(preferredRole ?? undefined);
  const resolved = fromJwt ?? fromBody;
  if (resolved) {
    window.localStorage.setItem("userRole", resolved);
    window.localStorage.setItem("preferredLoginRole", resolved);
  } else {
    window.localStorage.removeItem("userRole");
    window.localStorage.removeItem("preferredLoginRole");
  }
  window.dispatchEvent(new CustomEvent(AUTH_CHANGE_EVENT));
  return resolved;
}

/**
 * After tokens are saved, reconcile `userRole` from `GET /auth/me` so it always matches DB
 * even if proxies or echoes return a mismatched login body.
 */
export async function reconcileRoleFromServer(): Promise<UserRole | null> {
  try {
    const { apiGet } = await import("./api");
    const me = await apiGet<{ role: string }>("/auth/me");
    const r = coerceRole(typeof me.role === "string" ? me.role : null);
    if (!r || typeof window === "undefined") return null;
    window.localStorage.setItem("userRole", r);
    window.localStorage.setItem("preferredLoginRole", r);
    window.dispatchEvent(new CustomEvent(AUTH_CHANGE_EVENT));
    return r;
  } catch {
    if (typeof window !== "undefined" && !isAuthenticated()) {
      clearAuth();
    }
    return null;
  }
}

export function getDashboardPath(role: UserRole): string {
  return ROLE_DASHBOARDS[role] || ROLE_DASHBOARDS.customer;
}

export function getErrorMessage(role: UserRole): string {
  return ROLE_ERROR_MESSAGES[role] || ROLE_ERROR_MESSAGES.customer;
}

export function detectRoleFromEmail(email: string): UserRole {
  const lowerEmail = email.toLowerCase();
  if (lowerEmail.includes("driver")) return "driver";
  if (lowerEmail.includes("helper")) return "helper";
  if (lowerEmail.includes("dispatch")) return "dispatcher";
  if (lowerEmail.includes("manager")) return "manager";
  if (lowerEmail.includes("admin")) return "admin";
  return "customer";
}

export function clearAuth(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("token");
    localStorage.removeItem("authToken");
    localStorage.removeItem("userRole");
    localStorage.removeItem("preferredLoginRole");
    localStorage.removeItem("customer_current_user");
    window.dispatchEvent(new CustomEvent(AUTH_CHANGE_EVENT));
  }
}

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return !!(localStorage.getItem("token") || localStorage.getItem("authToken"));
}

export async function logout(): Promise<void> {
  try {
    const { apiPost } = await import("./api");
    await apiPost("/auth/logout").catch(() => undefined);
  } finally {
    clearAuth();
    if (typeof window !== "undefined") {
      window.location.href = "/sign-in";
    }
  }
}
