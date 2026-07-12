"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRoleGuard } from "@/lib/useRoleGuard";
import LoadingMessage from "@/components/ui/LoadingMessage";

/** Legacy mock page — redirects to live goods-declaration review. */
export default function PendingBookingsRedirectPage() {
  const { ready, allowed } = useRoleGuard(["manager", "admin"]);
  const router = useRouter();

  useEffect(() => {
    if (!ready || !allowed) return;
    router.replace("/admin/goods-declarations");
  }, [ready, allowed, router]);

  return <LoadingMessage label="Opening goods declaration review…" />;
}
