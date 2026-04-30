import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Hook to protect pages based on user role
 * Redirects unauthorized users to home page
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

    // If user's role is not in allowed roles, redirect to home
    if (!allowedRoles.includes(userRole)) {
      router.push("/");
      return;
    }
  }, [allowedRoles, router]);
}
