"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRoleGuard } from "@/lib/useRoleGuard";
import LoadingMessage from "@/components/ui/LoadingMessage";

/** Mock driver job page — redirect to live accept / execute tasks. */
export default function DriverJobExecutionRedirectPage() {
  const { ready, allowed } = useRoleGuard(["driver"]);
  const router = useRouter();

  useEffect(() => {
    if (!ready || !allowed) return;
    router.replace("/modules/operations/driver-tasks");
  }, [ready, allowed, router]);

  return <LoadingMessage label="Opening job tasks…" />;
}
