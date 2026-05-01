"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { clearAuth } from "@/lib/auth";
import { useAuthStatus } from "@/lib/useAuthStatus";

const BOOKING_FLOW_KEYS = [
  "selectedTruck",
  "selectedService",
  "bookingData",
  "completedBooking",
];

export default function NavBarAuth() {
  const router = useRouter();
  const { isLoggedIn } = useAuthStatus();

  const handleSignOut = () => {
    if (typeof window !== "undefined") {
      BOOKING_FLOW_KEYS.forEach((key) => window.localStorage.removeItem(key));
    }
    clearAuth();
    router.push("/sign-in");
  };

  if (isLoggedIn === null) {
    // First hydration tick — render nothing rather than flashing the wrong CTA.
    return <span aria-hidden="true" style={{ minHeight: 44, display: "inline-block" }} />;
  }

  return isLoggedIn ? (
    <button type="button" className="sign-in-button" onClick={handleSignOut}>
      Sign Out
    </button>
  ) : (
    <Link href="/sign-in" className="sign-in-button">
      Login
    </Link>
  );
}
