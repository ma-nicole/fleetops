"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRoleGuard } from "@/lib/useRoleGuard";
import LoadingMessage from "@/components/ui/LoadingMessage";

/** Mock booking status — redirect customers to live trip tracking. */
export default function BookingStatusRedirectPage() {
  const { ready, allowed } = useRoleGuard(["customer"]);
  const router = useRouter();

  useEffect(() => {
    if (!ready || !allowed) return;
    router.replace("/modules/operations/trips");
  }, [ready, allowed, router]);

  return <LoadingMessage label="Opening your bookings…" />;
}
