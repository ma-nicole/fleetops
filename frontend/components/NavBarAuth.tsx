"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import SignOutConfirmDialog from "@/components/auth/SignOutConfirmDialog";
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
  const { isLoggedIn, isReady } = useAuthStatus();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleSignOut = () => {
    if (typeof window !== "undefined") {
      BOOKING_FLOW_KEYS.forEach((key) => window.localStorage.removeItem(key));
    }
    clearAuth();
    setConfirmOpen(false);
    router.push("/sign-in");
  };

  if (!isReady) {
    // Session still restoring — avoid flashing the wrong CTA.
    return <span aria-hidden="true" style={{ minHeight: 44, display: "inline-block" }} />;
  }

  return (
    <>
      {isLoggedIn ? (
        <button type="button" className="sign-in-button" onClick={() => setConfirmOpen(true)}>
          Sign Out
        </button>
      ) : (
        <Link href="/sign-in" className="sign-in-button">
          Login
        </Link>
      )}
      <SignOutConfirmDialog
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleSignOut}
      />
    </>
  );
}
