import { useEffect } from "react";

import { useRouter } from "next/navigation";

import { getDashboardPath, type UserRole } from "./auth";

import { useAuthStatus } from "./useAuthStatus";



/** Aligns with `require_roles(DISPATCHER, MANAGER, ADMIN)` on dispatch API routes. */

export const DISPATCH_CONSOLE_ROLES: string[] = ["dispatcher", "manager", "admin"];



export type RoleGuardState = {

  /** Auth session has been restored from storage (and `/auth/me` when a token exists). */

  ready: boolean;

  /** User is signed in with one of `allowedRoles`. */

  allowed: boolean;

};



/**

 * Hook to protect pages based on user role.

 * Waits for auth bootstrap before redirecting or allowing protected API calls.

 */

export function useRoleGuard(allowedRoles: string[]): RoleGuardState {

  const router = useRouter();

  const { isReady, isLoggedIn, role } = useAuthStatus();



  useEffect(() => {

    if (!isReady) return;



    if (!isLoggedIn) {

      router.push("/sign-in");

      return;

    }



    if (!role) {

      router.push("/sign-in");

      return;

    }



    if (!allowedRoles.includes(role)) {

      router.push(getDashboardPath(role as UserRole));

    }

  }, [isReady, isLoggedIn, role, allowedRoles, router]);



  const allowed =

    isReady && isLoggedIn === true && role !== null && allowedRoles.includes(role);



  return { ready: isReady, allowed };

}

