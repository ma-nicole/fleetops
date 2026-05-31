"use client";

import type { ReactNode } from "react";
import { EmptyState } from "@/components/StatusBadge";
import {
  SkeletonDashboard,
  SkeletonKpiGrid,
  SkeletonTable,
} from "@/components/Skeleton";
import ErrorState from "@/components/ui/ErrorState";
import LoadingMessage from "@/components/ui/LoadingMessage";
import { ERROR_LOAD_DATA } from "@/lib/loadingMessages";

export type AsyncDataVariant = "page" | "dashboard" | "table" | "inline" | "kpi";

type AsyncDataViewProps = {
  loading: boolean;
  error?: string | null;
  empty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: { label: string; href?: string; onClick?: () => void };
  loadingLabel?: string;
  variant?: AsyncDataVariant;
  onRetry?: () => void;
  children: ReactNode;
};

function LoadingSkeleton({ variant }: { variant: AsyncDataVariant }) {
  switch (variant) {
    case "dashboard":
      return <SkeletonDashboard />;
    case "table":
      return <SkeletonTable rows={6} cols={5} />;
    case "kpi":
      return <SkeletonKpiGrid count={4} />;
    case "inline":
      return <LoadingMessage size="sm" />;
    case "page":
    default:
      return (
        <div style={{ display: "grid", gap: "1.5rem" }}>
          <LoadingMessage />
          <SkeletonKpiGrid count={4} />
        </div>
      );
  }
}

export default function AsyncDataView({
  loading,
  error,
  empty = false,
  emptyTitle = "Nothing here yet",
  emptyDescription = "Data will appear here once available.",
  emptyAction,
  loadingLabel,
  variant = "page",
  onRetry,
  children,
}: AsyncDataViewProps) {
  if (loading) {
    return (
      <div aria-busy="true" aria-live="polite">
        {variant === "inline" ? (
          <LoadingMessage label={loadingLabel} size="sm" />
        ) : (
          <>
            {loadingLabel ? <LoadingMessage label={loadingLabel} /> : null}
            <LoadingSkeleton variant={variant} />
          </>
        )}
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error || ERROR_LOAD_DATA} onRetry={onRetry} compact={variant === "inline"} />;
  }

  if (empty) {
    return (
      <EmptyState
        icon=""
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return <>{children}</>;
}
