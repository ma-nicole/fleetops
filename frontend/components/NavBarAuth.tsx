"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

function getSavedToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("authToken");
}

export default function NavBarAuth() {
  const [token, setToken] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    setToken(getSavedToken());
  }, []);

  const handleSignOut = () => {
    if (typeof window !== "undefined") {
      // Clear all authentication tokens
      window.localStorage.removeItem("authToken");
      window.localStorage.removeItem("token");
      window.localStorage.removeItem("userRole");
      
      // Clear booking flow data
      window.localStorage.removeItem("selectedTruck");
      window.localStorage.removeItem("selectedService");
      window.localStorage.removeItem("bookingData");
      window.localStorage.removeItem("completedBooking");
      
      setToken(null);
      router.push("/sign-in");
    }
  };

  return token ? (
    <button className="sign-in-button" onClick={handleSignOut}>
      Sign Out
    </button>
  ) : (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <Link href="/sign-in" className="sign-in-button">
        Login
      </Link>
    </div>
  );
}
