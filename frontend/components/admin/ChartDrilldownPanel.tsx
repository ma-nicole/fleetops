"use client";

import { DrilldownTable, EmptyChart } from "@/components/admin/AnalyticsCharts";

export function ChartDrilldownPanel({
  filterLabel,
  onClear,
  columns,
  rows,
  totalCount,
}: {
  filterLabel: string | null;
  onClear: () => void;
  columns: { key: string; label: string }[];
  rows: Record<string, unknown>[];
  totalCount?: number;
}) {
  const allCount = totalCount ?? rows.length;

  return (
    <div style={{ display: "grid", gap: "0.75rem" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
        }}
      >
        <p style={{ margin: 0, fontSize: "var(--font-size-sm)", color: "var(--text-secondary)" }}>
          {filterLabel ? (
            <>
              Showing records for: <strong style={{ color: "var(--text)" }}>{filterLabel}</strong>
              {" · "}
              {rows.length} of {allCount} record{allCount === 1 ? "" : "s"}
            </>
          ) : (
            <>
              Showing <strong style={{ color: "var(--text)" }}>all records</strong>
              {" · "}
              {allCount} record{allCount === 1 ? "" : "s"}
            </>
          )}
        </p>
        {filterLabel ? (
          <button type="button" className="quick-action-btn" onClick={onClear}>
            Show All Records
          </button>
        ) : null}
      </div>
      {rows.length ? (
        <DrilldownTable columns={columns} rows={rows} />
      ) : filterLabel ? (
        <EmptyChart message="No records found for this selection." />
      ) : (
        <EmptyChart />
      )}
    </div>
  );
}
