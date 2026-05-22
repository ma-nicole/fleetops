export type GoodsDeclarationReviewStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "revision_requested";

export function goodsDeclarationReviewLabel(status: string | null | undefined): string {
  if (!status) return "Not submitted";
  const labels: Record<string, string> = {
    pending: "Pending review",
    approved: "Approved",
    rejected: "Rejected",
    revision_requested: "Revision requested",
  };
  return labels[status] ?? status.replace(/_/g, " ");
}

export function goodsDeclarationReviewBadgeStyle(
  status: string | null | undefined,
): { bg: string; color: string } {
  switch (status) {
    case "approved":
      return { bg: "#DCFCE7", color: "#166534" };
    case "rejected":
      return { bg: "#FEE2E2", color: "#991B1B" };
    case "revision_requested":
      return { bg: "#FFEDD5", color: "#9A3412" };
    case "pending":
      return { bg: "#FEF3C7", color: "#92400E" };
    default:
      return { bg: "#F3F4F6", color: "#374151" };
  }
}
