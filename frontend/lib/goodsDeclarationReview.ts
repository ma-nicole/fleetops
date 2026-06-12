export type GoodsDeclarationReviewStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "revision_requested"
  | "resubmitted";

export function goodsDeclarationReviewLabel(status: string | null | undefined): string {
  if (!status) return "Not submitted";
  const labels: Record<string, string> = {
    pending: "Pending review",
    approved: "Approved",
    rejected: "Rejected",
    revision_requested: "Revision requested",
    resubmitted: "Resubmitted",
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
    case "resubmitted":
      return { bg: "#E0E7FF", color: "#3730A3" };
    case "pending":
      return { bg: "#FEF3C7", color: "#92400E" };
    default:
      return { bg: "#F3F4F6", color: "#374151" };
  }
}

/** Reviewer may approve, reject, or request revision. */
export function canPerformGoodsDeclarationReview(status: string | null | undefined): boolean {
  const normalized = (status ?? "pending").trim().toLowerCase();
  return normalized === "pending" || normalized === "resubmitted";
}

export function isGoodsDeclarationReviewLocked(status: string | null | undefined): boolean {
  return (status ?? "").trim().toLowerCase() === "revision_requested";
}

export function isGoodsDeclarationReviewFinal(status: string | null | undefined): boolean {
  const normalized = (status ?? "").trim().toLowerCase();
  return normalized === "approved" || normalized === "rejected";
}

export function canCustomerResubmitDocuments(status: string | null | undefined): boolean {
  return (status ?? "").trim().toLowerCase() === "revision_requested";
}

/** Customer-facing guidance for document review status (from backend status value). */
export function customerDocumentReviewGuidance(status: string | null | undefined): string | null {
  switch ((status ?? "pending").trim().toLowerCase()) {
    case "revision_requested":
      return "Revision requested. Please update and resubmit the required documents.";
    case "rejected":
      return "Your submission was rejected.";
    case "resubmitted":
      return "Your revised documents were submitted and are awaiting review.";
    case "approved":
      return "Your documents have been approved.";
    case "pending":
      return "Your documents are pending review.";
    default:
      return null;
  }
}

export function customerDocumentReviewStatusLabel(
  status: string | null | undefined,
  backendLabel?: string | null,
): string {
  if (backendLabel?.trim()) return backendLabel;
  return goodsDeclarationReviewLabel(status);
}
