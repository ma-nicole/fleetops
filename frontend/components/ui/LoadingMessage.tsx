"use client";

import { useEffect, useState } from "react";
import { LOADING_DEFAULT, LOADING_SLOW } from "@/lib/loadingMessages";
import Spinner from "@/components/ui/Spinner";

type LoadingMessageProps = {
  label?: string;
  slowLabel?: string;
  /** Milliseconds before showing the slow-loading message. */
  slowAfterMs?: number;
  className?: string;
  size?: "sm" | "md" | "lg";
};

export default function LoadingMessage({
  label = LOADING_DEFAULT,
  slowLabel = LOADING_SLOW,
  slowAfterMs = 4000,
  className = "",
  size = "md",
}: LoadingMessageProps) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setSlow(true), slowAfterMs);
    return () => window.clearTimeout(id);
  }, [slowAfterMs]);

  return (
    <div className={`loading-message ${className}`.trim()} role="status" aria-live="polite" aria-busy="true">
      <Spinner size={size} />
      <p className="loading-message__text">{slow ? slowLabel : label}</p>
    </div>
  );
}
