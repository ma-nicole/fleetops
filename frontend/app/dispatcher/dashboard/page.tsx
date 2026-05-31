"use client";

import DashboardRoleTabs from "@/components/DashboardRoleTabs";
import PageHeader from "@/components/ui/PageHeader";
import PageShell from "@/components/ui/PageShell";
import SectionJumpLink from "@/components/ui/SectionJumpLink";
import { SkeletonKpiGrid, SkeletonTable } from "@/components/Skeleton";
import LoadingMessage from "@/components/ui/LoadingMessage";
import ErrorState from "@/components/ui/ErrorState";
import { EMPTY_TRIPS, ERROR_LOAD_DATA } from "@/lib/loadingMessages";
import StatusPill from "@/components/ui/StatusPill";
import { scrollToSectionById } from "@/lib/scrollToSection";
import { useHashScrollWhenReady } from "@/lib/useHashScrollWhenReady";
import { formatTimeShort } from "@/lib/appLocale";
import { DispatchApi, type OperationsActiveTripRow, type OperationsCenterResponse } from "@/lib/dispatchApi";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

/** Fleet command center palette — brand orange primary. */
const C = {
  pageBg: "#F1F3F5",
  surface: "#FFFFFF",
  surfaceMuted: "#FAFBFC",
  border: "rgba(15, 23, 42, 0.07)",
  text: "#0F172A",
  textMuted: "#64748B",
  textSubtle: "#94A3B8",
  shadow: "0 1px 2px rgba(15, 23, 42, 0.05), 0 2px 8px rgba(15, 23, 42, 0.04)",
  shadowSm: "0 1px 2px rgba(15, 23, 42, 0.06)",
  accent: "#F59E0B",
  brand: "#F59E0B",
  blue: "#64748B",
  indigo: "#6366F1",
  teal: "#0D9488",
  green: "#059669",
  red: "#DC2626",
  amber: "#D97706",
} as const;

function fmtIso(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return formatTimeShort(iso);
  } catch {
    return iso;
  }
}

function activeLegsTotal(s: OperationsCenterResponse["summary"]): number {
  return (
    s.assigned_trips +
    s.for_pickup +
    s.picked_up +
    s.en_route +
    s.dropped_off
  );
}


function KpiTile({
  label,
  value,
  accentBorder,
  warn,
  scrollTargetId,
}: {
  label: string;
  value: number;
  accentBorder?: "orange" | "blue" | "indigo" | "green" | "slate" | "red";
  warn?: boolean;
  scrollTargetId?: string;
}) {
  const border =
    accentBorder === "orange"
      ? `3px solid ${C.accent}`
      : accentBorder === "blue"
        ? `3px solid ${C.accent}`
        : accentBorder === "indigo"
          ? `3px solid ${C.indigo}`
          : accentBorder === "green"
            ? `3px solid ${C.green}`
            : accentBorder === "red"
              ? `3px solid ${C.red}`
              : `3px solid #94A3B8`;
  const jump = scrollTargetId ? () => scrollToSectionById(scrollTargetId) : undefined;
  return (
    <div
      className={scrollTargetId ? "kpi-card--clickable scroll-section" : undefined}
      role={scrollTargetId ? "button" : undefined}
      tabIndex={scrollTargetId ? 0 : undefined}
      onClick={jump}
      onKeyDown={
        scrollTargetId
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                jump?.();
              }
            }
          : undefined
      }
      style={{
        background: C.surface,
        borderRadius: 10,
        padding: "0.5rem 0.65rem",
        boxShadow: C.shadowSm,
        border: `1px solid ${C.border}`,
        borderLeft: border,
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: "0.625rem",
          fontWeight: 700,
          color: warn ? C.amber : C.textSubtle,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          lineHeight: 1.2,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
        title={label}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 2,
          fontSize: "1.25rem",
          fontWeight: 800,
          color: warn ? C.amber : C.text,
          letterSpacing: "-0.03em",
          lineHeight: 1.15,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
  dense,
  sectionId,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  dense?: boolean;
  sectionId?: string;
}) {
  return (
    <section
      id={sectionId}
      className={sectionId ? "scroll-section" : undefined}
      style={{
        background: C.surface,
        borderRadius: 12,
        boxShadow: C.shadow,
        border: `1px solid ${C.border}`,
        padding: dense ? "0.65rem 0.75rem" : "0.75rem 0.85rem",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ marginBottom: dense ? 6 : 8 }}>
        <h2
          style={{
            margin: 0,
            fontSize: "0.8125rem",
            fontWeight: 800,
            color: C.text,
            letterSpacing: "-0.02em",
          }}
        >
          {title}
        </h2>
        {subtitle ? (
          <p style={{ margin: "3px 0 0", fontSize: "0.6875rem", color: C.textMuted, lineHeight: 1.35 }}>{subtitle}</p>
        ) : null}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </section>
  );
}

function ResourceStack({
  title,
  total,
  segments,
}: {
  title: string;
  total: number;
  segments: { id: string; label: string; value: number; color: string }[];
}) {
  const sum = segments.reduce((a, s) => a + s.value, 0);
  const denom = Math.max(sum, 1);
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: C.text }}>{title}</span>
        <span style={{ fontSize: "0.625rem", fontWeight: 600, color: C.textSubtle, fontVariantNumeric: "tabular-nums" }}>
          {total} roster
        </span>
      </div>
      <div
        style={{
          display: "flex",
          height: 5,
          borderRadius: 4,
          overflow: "hidden",
          background: "rgba(148, 163, 184, 0.25)",
        }}
      >
        {segments.map((s) => (
          <div
            key={s.id}
            title={`${s.label}: ${s.value}`}
            style={{
              width: `${(s.value / denom) * 100}%`,
              background: s.color,
              minWidth: s.value > 0 ? 3 : 0,
              transition: "width 0.2s ease",
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginTop: 8 }}>
        {segments.map((s) => (
          <span
            key={s.id}
            style={{
              fontSize: "0.625rem",
              fontWeight: 700,
              padding: "0.15rem 0.45rem",
              borderRadius: 6,
              background: "rgba(15, 23, 42, 0.04)",
              color: C.textMuted,
              border: `1px solid ${C.border}`,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <span style={{ color: s.color, marginRight: 4 }}>●</span>
            {s.label} {s.value}
          </span>
        ))}
      </div>
    </div>
  );
}

function tripBadgeStatus(row: OperationsActiveTripRow): string {
  if (row.badge_status) return row.badge_status;
  if (row.eta) {
    const t = new Date(row.eta).getTime();
    if (!Number.isNaN(t) && t < Date.now()) return "delayed";
  }
  return row.current_status;
}

const th: React.CSSProperties = {
  textAlign: "left",
  fontSize: "0.625rem",
  fontWeight: 800,
  color: C.textSubtle,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  padding: "0.35rem 0.45rem",
  borderBottom: `1px solid ${C.border}`,
  background: C.surfaceMuted,
  whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  fontSize: "0.8125rem",
  padding: "0.32rem 0.45rem",
  borderBottom: `1px solid ${C.border}`,
  color: C.text,
  verticalAlign: "middle",
  lineHeight: 1.35,
};

export default function DispatcherDashboard() {
  const [data, setData] = useState<OperationsCenterResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const d = await DispatchApi.operationsCenter();
      setData(d);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : ERROR_LOAD_DATA);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 45_000);
    return () => clearInterval(id);
  }, [load]);

  const s = data?.summary;
  const activeTotal = useMemo(() => (s ? activeLegsTotal(s) : 0), [s]);
  const alertCount = data?.alerts?.length ?? 0;

  useHashScrollWhenReady(Boolean(data && !loading));

  return (
    <PageShell maxWidth={1480}>
        <PageHeader
          eyebrow="FleetOpt · Dispatch"
          title="Operations command center"
          subtitle={
            loading && !data
              ? "Syncing live operations data…"
              : data?.generated_at
                ? `Last updated ${fmtIso(data.generated_at)} · auto-refresh every 45s`
                : "Live dispatch operations"
          }
          actions={
            <>
              <Link href="/dispatcher/job-assignments" className="quick-action-btn quick-action-btn--primary">
                Assign jobs
              </Link>
              <Link href="/dispatcher/trip-monitoring" className="quick-action-btn">
                Monitor trips
              </Link>
            </>
          }
        />

        <DashboardRoleTabs active="dispatcher" />

        <nav className="tab-pills" aria-label="Jump to dashboard section">
          <SectionJumpLink targetId="dispatch-kpis">KPIs</SectionJumpLink>
          <SectionJumpLink targetId="dispatch-active-trips">Active trips</SectionJumpLink>
          <SectionJumpLink targetId="dispatch-alerts">Alerts</SectionJumpLink>
          <SectionJumpLink targetId="dispatch-waiting">Queue</SectionJumpLink>
          <SectionJumpLink targetId="dispatch-resources">Resources</SectionJumpLink>
        </nav>

        {loadError ? <ErrorState message={loadError} onRetry={() => void load()} compact /> : null}

        {loading && !data ? (
          <div style={{ display: "grid", gap: "0.75rem" }} aria-busy="true">
            <LoadingMessage label="Syncing live operations data…" size="sm" />
            <SkeletonKpiGrid count={8} />
            <SkeletonTable rows={5} cols={6} />
          </div>
        ) : (
        <>
        {/* KPI strip */}
        <div id="dispatch-kpis" className="dispatch-kpi-strip scroll-section" style={{ display: "grid", gap: "0.45rem" }}>
          {s ? (
            <>
              <KpiTile label="Waiting assign" value={s.waiting_for_assignment} accentBorder="orange" warn={s.waiting_for_assignment > 0} scrollTargetId="dispatch-waiting" />
              <KpiTile label="Active trips" value={activeTotal} accentBorder="indigo" scrollTargetId="dispatch-active-trips" />
              <KpiTile label="En route" value={s.en_route} accentBorder="indigo" scrollTargetId="dispatch-active-trips" />
              <KpiTile label="Done today" value={s.completed_today} accentBorder="green" />
              <KpiTile label="Avail trucks" value={s.available_trucks} accentBorder="blue" scrollTargetId="dispatch-resources" />
              <KpiTile label="Maint trucks" value={s.trucks_under_maintenance} accentBorder="slate" scrollTargetId="dispatch-resources" />
              <KpiTile label="Avail drivers" value={s.available_drivers} accentBorder="blue" scrollTargetId="dispatch-resources" />
              <KpiTile label="Alerts" value={alertCount} accentBorder={alertCount > 0 ? "red" : "slate"} warn={alertCount > 0} scrollTargetId="dispatch-alerts" />
            </>
          ) : (
            <SkeletonKpiGrid count={8} />
          )}
        </div>

        {/* Main + sidebar */}
        <div
          className="dispatch-main-grid"
          style={{
            display: "grid",
            gap: "0.65rem",
            alignItems: "stretch",
          }}
        >
          <Panel
            title="Active trips"
            subtitle="Live legs in execution — primary dispatch board."
            dense
            sectionId="dispatch-active-trips"
          >
            {!data?.active_trips?.length ? (
              <p style={{ margin: 0, fontSize: "0.75rem", color: C.textMuted }} role="status">{EMPTY_TRIPS}</p>
            ) : (
              <div style={{ overflow: "auto", margin: "0 -0.15rem", WebkitOverflowScrolling: "touch" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
                  <thead>
                    <tr>
                      <th style={th}>Trip</th>
                      <th style={th}>Truck</th>
                      <th style={th}>Driver</th>
                      <th style={th}>Helper</th>
                      <th style={th}>Status</th>
                      <th style={th}>Latest location</th>
                      <th style={th}>ETA</th>
                      <th style={th}>Last update</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.active_trips.map((r) => (
                      <tr key={r.trip_id} style={{ background: r.booking_id % 2 === 0 ? "transparent" : "rgba(248,250,252,0.6)" }}>
                        <td style={{ ...td, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>#{r.trip_id}</td>
                        <td style={{ ...td, fontWeight: 600 }}>{r.truck_code}</td>
                        <td style={td}>{r.driver_name}</td>
                        <td style={td}>{r.helper_name}</td>
                        <td style={td}>
                          <StatusPill status={tripBadgeStatus(r)} />
                        </td>
                        <td style={{ ...td, maxWidth: 200, fontSize: "0.75rem", color: C.textMuted }}>{r.latest_location}</td>
                        <td style={{ ...td, whiteSpace: "nowrap", fontSize: "0.75rem", fontVariantNumeric: "tabular-nums" }}>
                          {fmtIso(r.eta ?? null)}
                        </td>
                        <td style={{ ...td, whiteSpace: "nowrap", fontSize: "0.75rem", color: C.textMuted, fontVariantNumeric: "tabular-nums" }}>
                          {fmtIso(r.last_updated)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <div style={{ display: "grid", gap: "0.65rem", minWidth: 0 }}>
            <Panel title="Alerts & exceptions" dense sectionId="dispatch-alerts">
              {!data?.alerts?.length ? (
                <p style={{ margin: 0, fontSize: "0.75rem", color: C.textMuted }}>No active alerts.</p>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    maxHeight: 280,
                    overflowY: "auto",
                  }}
                >
                  {data.alerts.map((a, i) => (
                    <div
                      key={`${a.code}-${a.trip_id ?? "x"}-${i}`}
                      style={{
                        padding: "0.45rem 0.5rem",
                        borderRadius: 8,
                        background: a.severity === "high" ? "rgba(220,38,38,0.06)" : "rgba(217,119,6,0.07)",
                        border: `1px solid ${a.severity === "high" ? "rgba(220,38,38,0.15)" : "rgba(217,119,6,0.15)"}`,
                        fontSize: "0.75rem",
                        lineHeight: 1.4,
                        color: C.text,
                      }}
                    >
                      <span style={{ fontWeight: 800, fontSize: "0.625rem", color: a.severity === "high" ? C.red : C.amber }}>
                        {(a.severity || "info").toUpperCase()}
                      </span>
                      <span style={{ color: C.textSubtle, fontSize: "0.625rem", marginLeft: 6 }}>{a.code}</span>
                      <div style={{ marginTop: 3 }}>{a.message}</div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Recent locations" subtitle="Helper GPS / check-ins." dense>
              {!data?.recent_location_updates?.length ? (
                <p style={{ margin: 0, fontSize: "0.75rem", color: C.textMuted }}>No updates.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 220, overflowY: "auto" }}>
                  {data.recent_location_updates.slice(0, 8).map((u, i) => (
                    <div
                      key={`${u.trip_id}-${u.updated_at}-${i}`}
                      style={{
                        padding: "0.4rem 0.5rem",
                        borderRadius: 8,
                        background: C.surfaceMuted,
                        border: `1px solid ${C.border}`,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                        <span style={{ fontSize: "0.75rem", fontWeight: 800 }}>Trip #{u.trip_id}</span>
                        <span style={{ fontSize: "0.625rem", color: C.textMuted, fontVariantNumeric: "tabular-nums" }}>
                          {fmtIso(u.updated_at)}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.6875rem", color: C.textMuted, marginTop: 2 }}>{u.helper_name}</div>
                      <div style={{ fontSize: "0.6875rem", marginTop: 3, color: C.text }}>
                        <StatusPill status={u.status} />{" "}
                        <span style={{ color: C.textMuted }}>{u.location_text}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </div>

        {/* Queue + resources */}
        <div
          className="dispatch-bottom-grid"
          style={{
            display: "grid",
            gap: "0.65rem",
            alignItems: "stretch",
          }}
        >
          <Panel title="Waiting for assignment" subtitle="Verified / ready — no legs yet." dense sectionId="dispatch-waiting">
            {!data?.waiting_for_assignment?.length ? (
              <p style={{ margin: 0, fontSize: "0.75rem", color: C.textMuted }}>Queue clear.</p>
            ) : (
              <div style={{ overflow: "auto", maxHeight: 320 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={th}>Bk</th>
                      <th style={th}>Route</th>
                      <th style={th}>t</th>
                      <th style={th}>Need</th>
                      <th style={th}>Slot</th>
                      <th style={th}>Paid</th>
                      <th style={th} />
                    </tr>
                  </thead>
                  <tbody>
                    {data.waiting_for_assignment.map((b) => (
                      <tr key={b.booking_id}>
                        <td style={{ ...td, fontWeight: 800 }}>#{b.booking_id}</td>
                        <td style={{ ...td, fontSize: "0.75rem", color: C.textMuted, maxWidth: 220 }}>
                          {(b.pickup_location || "").slice(0, 28)}
                          {(b.pickup_location || "").length > 28 ? "…" : ""} → {(b.dropoff_location || "").slice(0, 28)}
                        </td>
                        <td style={{ ...td, fontVariantNumeric: "tabular-nums" }}>{b.cargo_weight_tons}</td>
                        <td style={{ ...td, fontVariantNumeric: "tabular-nums" }}>{b.required_trucks}</td>
                        <td style={{ ...td, fontSize: "0.75rem", whiteSpace: "nowrap" }}>
                          {b.scheduled_time_slot}
                        </td>
                        <td style={{ ...td, fontSize: "0.6875rem", color: C.textMuted, whiteSpace: "nowrap" }}>
                          {fmtIso(b.payment_verified_at)}
                        </td>
                        <td style={td}>
                          <Link
                            href={`/dispatcher/job-assignments?bookingId=${b.booking_id}`}
                            style={{
                              display: "inline-block",
                              padding: "0.22rem 0.5rem",
                              borderRadius: 6,
                              background: C.text,
                              color: "#fff",
                              fontWeight: 700,
                              fontSize: "0.625rem",
                              textDecoration: "none",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Assign
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title="Resource availability" subtitle="Fleet posture — from live roster & trips." dense sectionId="dispatch-resources">
            {data?.resources ? (
              <div style={{ paddingTop: 4 }}>
                <ResourceStack
                  title="Trucks"
                  total={data.resources.trucks.total_registered}
                  segments={[
                    { id: "av", label: "Avail", value: data.resources.trucks.available, color: C.blue },
                    { id: "as", label: "Busy", value: data.resources.trucks.assigned, color: C.indigo },
                    { id: "hd", label: "Hold", value: data.resources.trucks.on_hold, color: C.amber },
                    { id: "mt", label: "Maint", value: data.resources.trucks.under_maintenance, color: C.textSubtle },
                  ]}
                />
                <ResourceStack
                  title="Drivers"
                  total={data.resources.drivers.total}
                  segments={[
                    { id: "da", label: "Avail", value: data.resources.drivers.available, color: C.green },
                    { id: "ds", label: "Busy", value: data.resources.drivers.assigned, color: C.indigo },
                    { id: "do", label: "Off", value: data.resources.drivers.off_duty, color: C.textSubtle },
                  ]}
                />
                <ResourceStack
                  title="Helpers"
                  total={data.resources.helpers.total}
                  segments={[
                    { id: "ha", label: "Avail", value: data.resources.helpers.available, color: C.teal },
                    { id: "hs", label: "Busy", value: data.resources.helpers.assigned, color: C.indigo },
                    { id: "ho", label: "Off", value: data.resources.helpers.off_duty, color: C.textSubtle },
                  ]}
                />
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: "0.75rem", color: C.textMuted }}>—</p>
            )}
          </Panel>
        </div>

        <nav
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.35rem",
            paddingTop: 2,
          }}
        >
          {[
            ["Week board", "/dispatcher/week-board"],
            ["Jobs", "/dispatcher/job-assignments"],
            ["Trips", "/dispatcher/trip-monitoring"],
            ["Assets", "/dispatcher/assets-drivers"],
            ["Orders", "/dispatcher/order-details"],
            ["Drivers", "/dispatcher/driver-activity"],
          ].map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="dispatch-quicklink"
              style={{
                padding: "0.28rem 0.55rem",
                borderRadius: 6,
                fontSize: "0.6875rem",
                fontWeight: 700,
                textDecoration: "none",
                color: C.textMuted,
                background: C.surface,
                border: `1px solid ${C.border}`,
                boxShadow: C.shadowSm,
              }}
            >
              {label}
            </Link>
          ))}
        </nav>
        </>
        )}

      <style jsx global>{`
        .dispatch-kpi-strip {
          grid-template-columns: repeat(8, minmax(0, 1fr));
        }
        .dispatch-main-grid {
          grid-template-columns: minmax(0, 7fr) minmax(240px, 3fr);
        }
        .dispatch-bottom-grid {
          grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
        }
        @media (max-width: 1280px) {
          .dispatch-kpi-strip {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }
        @media (max-width: 1100px) {
          .dispatch-main-grid {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 960px) {
          .dispatch-bottom-grid {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 720px) {
          .dispatch-kpi-strip {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .dispatch-main-grid {
            grid-template-columns: 1fr;
          }
          .dispatch-bottom-grid {
            grid-template-columns: 1fr;
          }
        }
        a.dispatch-quicklink:hover {
          border-color: rgba(234, 88, 12, 0.45) !important;
          color: #0f172a !important;
        }
      `}</style>
    </PageShell>
  );
}
