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
      window.localStorage.removeItem("authToken");
      setToken(null);
      router.refresh();
    }
  };

  return token ? (
    <button className="sign-in-button" onClick={handleSignOut}>
      Sign Out
    </button>
  ) : (
    <Link href="/sign-in" className="sign-in-button">
      Sign In
    </Link>
  );
}
