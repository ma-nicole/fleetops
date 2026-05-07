import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getDashboardPath, getEffectiveRole, type UserRole } from "./auth";

/** Aligns with `require_roles(DISPATCHER, MANAGER, ADMIN)` on dispatch API routes. */
export const DISPATCH_CONSOLE_ROLES: string[] = ["dispatcher", "manager", "admin"];

/**
 * Hook to protect pages based on user role
 * Redirects unauthorized users to their role dashboard
 */
export function useRoleGuard(allowedRoles: string[]) {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const userRole = getEffectiveRole();

    if (!userRole) {
      router.push("/sign-in");
      return;
    }

    if (!allowedRoles.includes(userRole)) {
      router.push(getDashboardPath(userRole as UserRole));
      return;
    }
  }, [allowedRoles, router]);
}
