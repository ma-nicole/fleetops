import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getDashboardPath, type UserRole } from "./auth";

/**
 * Hook to protect pages based on user role
 * Redirects unauthorized users to their role dashboard
 */
export function useRoleGuard(allowedRoles: string[]) {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const userRole = localStorage.getItem("userRole");
    
    // If no role stored, redirect to login
    if (!userRole) {
      router.push("/sign-in");
      return;
    }

    // If user's role is not in allowed roles, redirect to their own dashboard
    if (!allowedRoles.includes(userRole)) {
      router.push(getDashboardPath(userRole as UserRole));
      return;
    }
  }, [allowedRoles, router]);
}
