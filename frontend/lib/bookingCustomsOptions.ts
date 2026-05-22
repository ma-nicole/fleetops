export const CUSTOMS_CLEARANCE_STATUSES = [
  { value: "not_started", label: "Not started" },
  { value: "documents_prepared", label: "Documents prepared" },
  { value: "submitted", label: "Submitted for clearance" },
  { value: "under_review", label: "Under customs review" },
  { value: "cleared", label: "Cleared" },
  { value: "held", label: "Held / pending action" },
] as const;

export type CustomsClearanceStatus = (typeof CUSTOMS_CLEARANCE_STATUSES)[number]["value"];

export function customsStatusLabel(status: string | null | undefined): string {
  if (!status) return "Not set";
  return CUSTOMS_CLEARANCE_STATUSES.find((s) => s.value === status)?.label ?? status.replace(/_/g, " ");
}
