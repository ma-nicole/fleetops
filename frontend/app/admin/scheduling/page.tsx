"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Scheduling was removed; bookings use payment proof workflow instead. */
export default function AdminSchedulingRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/payment-approval");
  }, [router]);
  return (
    <main style={{ padding: "var(--page-main-padding)" }}>
      <p style={{ color: "#6B7280" }}>Redirecting to payment approval…</p>
    </main>
  );
}
