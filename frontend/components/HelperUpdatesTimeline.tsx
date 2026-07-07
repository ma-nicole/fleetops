"use client";

import type { CSSProperties } from "react";
import EvidenceVerificationBadge from "@/components/EvidenceVerificationBadge";
import type { CrewTimelineEvent } from "@/lib/workflowApi";

export type HelperTimelineTone = "success" | "warning" | "danger";

export type HelperTimelineRow = {
  key: string;
  at: string | null;
  status: string;
  remarks: string;
  tone: HelperTimelineTone;
  photo_url?: string | null;
  pending?: boolean;
  evidence_verification_label?: string | null;
  evidence_review_required?: boolean;
};

const PHASES = ["for_pickup", "picked_up", "en_route", "dropped_off", "completed"] as const;

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "Pending";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toneForEvent(ev: CrewTimelineEvent): HelperTimelineTone {
  const code = (ev.code || "").toLowerCase();
  const title = (ev.title || "").toLowerCase();
  const blob = `${code} ${title}`;
  if (/cancel|failed|fail|issue|error|reject|problem|incident/.test(blob)) {
    return "danger";
  }
  if (code === "for_pickup" || code === "assigned" || /pending|await/.test(blob)) {
    return "warning";
  }
  return "success";
}

function statusLabelForEvent(ev: CrewTimelineEvent): string {
  if (ev.kind === "location") {
    return "Location update";
  }
  const code = (ev.code || ev.title || "").trim();
  return code.replace(/_/g, " ") || "Status update";
}

function remarksForEvent(ev: CrewTimelineEvent): string {
  const parts = [(ev.detail || "").trim(), (ev.remarks || "").trim()].filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
}

function nextPhase(current: string): string | null {
  const idx = PHASES.indexOf(current as (typeof PHASES)[number]);
  if (idx < 0 || idx >= PHASES.length - 1) return null;
  return PHASES[idx + 1];
}

function toneStyles(tone: HelperTimelineTone): {
  row: CSSProperties;
  dot: CSSProperties;
  status: CSSProperties;
} {
  switch (tone) {
    case "danger":
      return {
        row: { borderColor: "#FCA5A5", background: "#FEF2F2" },
        dot: { background: "#EF4444", boxShadow: "0 0 0 3px rgba(239,68,68,0.2)" },
        status: { background: "#FEE2E2", color: "#991B1B", border: "1px solid #FCA5A5" },
      };
    case "warning":
      return {
        row: { borderColor: "#FCD34D", background: "#FFFBEB" },
        dot: { background: "#F59E0B", boxShadow: "0 0 0 3px rgba(245,158,11,0.2)" },
        status: { background: "#FEF3C7", color: "#92400E", border: "1px solid #FCD34D" },
      };
    default:
      return {
        row: { borderColor: "#86EFAC", background: "#ECFDF5" },
        dot: { background: "#22C55E", boxShadow: "0 0 0 3px rgba(34,197,94,0.2)" },
        status: { background: "#DCFCE7", color: "#166534", border: "1px solid #86EFAC" },
      };
  }
}

export function buildHelperTimelineRows(
  events: CrewTimelineEvent[],
  opts?: {
    operationalStatus?: string;
    locationUpdatesSubmitted?: number;
    requiredLocationUpdates?: number;
    includePending?: boolean;
  },
): HelperTimelineRow[] {
  const sorted = [...events].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  const rows: HelperTimelineRow[] = sorted.map((ev, i) => ({
    key: `${ev.at}-${ev.kind}-${ev.code}-${i}`,
    at: ev.at,
    status: statusLabelForEvent(ev),
    remarks: remarksForEvent(ev),
    tone: toneForEvent(ev),
    photo_url: ev.photo_url,
    pending: false,
    evidence_verification_label: ev.evidence_verification_label,
    evidence_review_required: ev.evidence_review_required,
  }));

  if (!opts?.includePending) {
    return rows;
  }

  const op = (opts.operationalStatus || "for_pickup").toLowerCase();
  if (op === "completed") {
    return rows;
  }

  if (op === "en_route") {
    const submitted = opts.locationUpdatesSubmitted ?? 0;
    const required = opts.requiredLocationUpdates ?? 3;
    if (submitted < required) {
      rows.push({
        key: "pending-location-updates",
        at: null,
        status: "Location updates pending",
        remarks: `Submit ${required - submitted} more location update${required - submitted === 1 ? "" : "s"} before drop-off (${submitted}/${required} done).`,
        tone: "warning",
        pending: true,
      });
    }
  }

  const allowed = nextPhase(op === "assigned" ? "for_pickup" : op);
  if (allowed && op !== "en_route") {
    rows.push({
      key: `pending-${allowed}`,
      at: null,
      status: `Next: ${allowed.replace(/_/g, " ")}`,
      remarks:
        allowed === "picked_up" || allowed === "dropped_off"
          ? "Camera photo proof required when you submit this milestone."
          : "Submit the next milestone when this leg is complete.",
      tone: "warning",
      pending: true,
    });
  } else if (op === "en_route" && (opts.locationUpdatesSubmitted ?? 0) >= (opts.requiredLocationUpdates ?? 3)) {
    rows.push({
      key: "pending-dropped_off",
      at: null,
      status: "Next: dropped off",
      remarks: "Camera photo proof required when marking dropped off.",
      tone: "warning",
      pending: true,
    });
  }

  return rows;
}

type HelperUpdatesTimelineProps = {
  events: CrewTimelineEvent[];
  operationalStatus?: string;
  locationUpdatesSubmitted?: number;
  requiredLocationUpdates?: number;
  mediaSrc?: (url: string) => string;
  title?: string;
};

export default function HelperUpdatesTimeline({
  events,
  operationalStatus,
  locationUpdatesSubmitted,
  requiredLocationUpdates,
  mediaSrc,
  title = "Helper updates timeline",
}: HelperUpdatesTimelineProps) {
  const rows = buildHelperTimelineRows(events, {
    operationalStatus,
    locationUpdatesSubmitted,
    requiredLocationUpdates,
    includePending: true,
  });

  if (rows.length === 0) {
    return (
      <p style={{ margin: "0 0 1rem", color: "#64748B", fontSize: "0.88rem" }}>
        No helper updates yet. Submit your first milestone below when ready.
      </p>
    );
  }

  return (
    <div style={{ marginBottom: "1rem" }} aria-label={title}>
      <div style={{ display: "grid", gap: "0.55rem" }}>
        {rows.map((row, idx) => {
          const styles = toneStyles(row.tone);
          const isLast = idx === rows.length - 1;
          return (
            <div key={row.key} style={{ display: "flex", gap: "0.75rem", alignItems: "stretch" }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  width: 14,
                  flexShrink: 0,
                  paddingTop: 6,
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    flexShrink: 0,
                    ...styles.dot,
                  }}
                />
                {!isLast ? (
                  <div
                    style={{
                      width: 2,
                      flex: 1,
                      minHeight: 16,
                      marginTop: 4,
                      background: row.tone === "danger" ? "#FECACA" : row.tone === "warning" ? "#FDE68A" : "#BBF7D0",
                    }}
                  />
                ) : null}
              </div>
              <div
                style={{
                  flex: 1,
                  padding: "0.65rem 0.85rem",
                  borderRadius: 10,
                  border: "1px solid",
                  fontSize: "0.86rem",
                  lineHeight: 1.45,
                  marginBottom: isLast ? 0 : 2,
                  ...styles.row,
                }}
              >
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#475569" }}>{formatWhen(row.at)}</span>
                  <span
                    style={{
                      fontSize: "0.68rem",
                      fontWeight: 800,
                      padding: "0.15rem 0.45rem",
                      borderRadius: 999,
                      textTransform: "lowercase",
                      ...styles.status,
                    }}
                  >
                    {row.status}
                  </span>
                  {row.pending ? (
                    <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#92400E", letterSpacing: "0.04em" }}>
                      AWAITING
                    </span>
                  ) : null}
                  {row.evidence_verification_label ? (
                    <EvidenceVerificationBadge
                      label={row.evidence_verification_label}
                      reviewRequired={row.evidence_review_required}
                      compact
                    />
                  ) : null}
                </div>
                <div style={{ color: "#1e293b" }}>
                  <strong>Remarks:</strong> {row.remarks}
                </div>
                {row.photo_url && mediaSrc ? (
                  <a
                    href={mediaSrc(row.photo_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: "inline-block", marginTop: 6, color: "var(--brand-text)", fontWeight: 600, fontSize: "0.82rem" }}
                  >
                    View attached photo
                  </a>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <p style={{ margin: "0.65rem 0 0", fontSize: "0.75rem", color: "#64748B" }}>
        <span style={{ color: "#166534" }}>●</span> Completed / normal ·{" "}
        <span style={{ color: "#92400E" }}>●</span> Pending / warning ·{" "}
        <span style={{ color: "#991B1B" }}>●</span> Issue / failed
      </p>
    </div>
  );
}
