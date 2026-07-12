"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRoleGuard } from "@/lib/useRoleGuard";
import LoadingMessage from "@/components/ui/LoadingMessage";

/** Legacy assignment UI (hardcoded availability) — use live job assignments. */
export default function LegacyAssignmentRedirectPage() {
  const { ready, allowed } = useRoleGuard(["dispatcher", "admin", "manager"]);
  const router = useRouter();

  useEffect(() => {
    if (!ready || !allowed) return;
    router.replace("/dispatcher/job-assignments");
  }, [ready, allowed, router]);

  return <LoadingMessage label="Opening job assignments…" />;
}
