// Role-based authentication utilities

import { decodeJwtRole } from "./api";

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
  const role = localStorage.getItem("userRole");
  return (role as UserRole) || null;
}

export function setUserRole(role: UserRole): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("userRole", role);
  }
}

const KNOWN_ROLES: UserRole[] = ["driver", "helper", "dispatcher", "manager", "admin", "customer"];

function coerceRole(value: string | null | undefined): UserRole | null {
  if (!value) return null;
  return KNOWN_ROLES.includes(value as UserRole) ? (value as UserRole) : null;
}

/** Prefer `preferredRole` from API login body; then JWT; default customer. */
export function setAuthSession(token: string, preferredRole?: string | null): UserRole | null {
  if (typeof window === "undefined") return null;
  window.localStorage.setItem("token", token);
  window.localStorage.setItem("authToken", token);
  const fromJwt = coerceRole(decodeJwtRole(token));
  const role: UserRole = coerceRole(preferredRole ?? undefined) ?? fromJwt ?? "customer";
  window.localStorage.setItem("userRole", role);
  window.localStorage.setItem("preferredLoginRole", role);
  window.dispatchEvent(new CustomEvent("fleetops:auth-change"));
  return role;
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
    window.dispatchEvent(new CustomEvent("fleetops:auth-change"));
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
