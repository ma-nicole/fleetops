// Role-based authentication utilities

export type UserRole = "driver" | "dispatcher" | "manager" | "admin" | "customer";

export const ROLE_DASHBOARDS: Record<UserRole, string> = {
  driver: "/driver/dashboard",
  dispatcher: "/dispatcher/dashboard",
  manager: "/manager/dashboard",
  admin: "/admin/dashboard",
  customer: "/dashboard/customer",
};

export const ROLE_ERROR_MESSAGES: Record<UserRole, string> = {
  driver: "Invalid Account - Please verify your company account details",
  dispatcher: "Invalid User - Please verify your company account details",
  manager: "Account Not Matched - Please verify your credentials",
  admin: "Account Not Matched - Please verify your credentials",
  customer: "Invalid credentials - Please try again",
};

/**
 * Get the user's role from localStorage
 */
export function getUserRole(): UserRole | null {
  if (typeof window === "undefined") return null;
  const role = localStorage.getItem("userRole");
  return (role as UserRole) || null;
}

/**
 * Set the user's role in localStorage
 */
export function setUserRole(role: UserRole): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("userRole", role);
  }
}

/**
 * Get the dashboard path for a given role
 */
export function getDashboardPath(role: UserRole): string {
  return ROLE_DASHBOARDS[role] || ROLE_DASHBOARDS.customer;
}

/**
 * Get the error message for a given role
 */
export function getErrorMessage(role: UserRole): string {
  return ROLE_ERROR_MESSAGES[role] || ROLE_ERROR_MESSAGES.customer;
}

/**
 * Detect role from email pattern (fallback)
 */
export function detectRoleFromEmail(email: string): UserRole {
  const lowerEmail = email.toLowerCase();
  if (lowerEmail.includes("driver")) return "driver";
  if (lowerEmail.includes("dispatch")) return "dispatcher";
  if (lowerEmail.includes("manager") || lowerEmail.includes("admin")) return "manager";
  return "customer";
}

/**
 * Clear user authentication data
 */
export function clearAuth(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("token");
    localStorage.removeItem("authToken");
    localStorage.removeItem("userRole");
  }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem("token");
}
