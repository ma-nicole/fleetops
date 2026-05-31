"use client";

import type { ReactNode } from "react";
import { scrollToSectionById } from "@/lib/scrollToSection";

type SectionJumpLinkProps = {
  targetId: string;
  children: ReactNode;
  className?: string;
  updateHash?: boolean;
};

export default function SectionJumpLink({
  targetId,
  children,
  className = "tab-pill",
  updateHash = true,
}: SectionJumpLinkProps) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        if (updateHash && typeof window !== "undefined") {
          const id = targetId.replace(/^#/, "");
          window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${id}`);
        }
        scrollToSectionById(targetId, { maxAttempts: 10, attemptDelay: 120 });
      }}
    >
      {children}
    </button>
  );
}
