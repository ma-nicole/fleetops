"use client";

import { DrilldownTable, EmptyChart, StatGrid, StatisticsTable } from "@/components/admin/AnalyticsCharts";
import { formatPhp } from "@/lib/appLocale";
import type { AdminAnalyticsEmpty, AdminAnalyticsPayload } from "@/lib/analyticsApi";
import { downloadTollAnalyticsReportPdf } from "@/lib/tollAnalyticsReportPdf";

type TollAnalytics = NonNullable<AdminAnalyticsPayload["toll_analytics"]>;

function isEmptyToll(data: TollAnalytics): data is AdminAnalyticsEmpty {
  return "empty" in data && data.empty === true;
}

export default function TollAnalyticsSection({ data }: { data: TollAnalytics }) {
  if (isEmptyToll(data)) {
    return <EmptyChart message={data.message} />;
  }

  const { summary, statistics, most_expensive_routes, route_trends, drilldown, data_sufficiency } = data;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.75rem" }}>
        <button
          type="button"
          className="quick-action-btn"
          onClick={() => downloadTollAnalyticsReportPdf(data)}
        >
          Export toll report (PDF)
        </button>
      </div>
      {data_sufficiency?.messages && data_sufficiency.messages.length > 0 && (
        <div
          role="status"
          style={{
            marginBottom: "1rem",
            padding: "0.75rem 1rem",
            borderRadius: 8,
            background: "rgba(251, 191, 36, 0.12)",
            border: "1px solid rgba(251, 191, 36, 0.35)",
            color: "#92400E",
            fontSize: "0.9rem",
          }}
        >
          {data_sufficiency.messages.map((msg) => (
            <p key={msg} style={{ margin: "0.25rem 0" }}>
              {msg}
            </p>
          ))}
        </div>
      )}

      <StatGrid
        items={[
          { label: "Historical records", value: summary.record_count },
          { label: "Estimated toll total", value: formatPhp(summary.estimated_toll_total_php) },
          { label: "Actual toll total", value: formatPhp(summary.actual_toll_total_php) },
          {
            label: "Toll variance",
            value: formatPhp(summary.toll_variance_total_php),
          },
        ]}
      />

      <StatisticsTable stats={statistics} />

      {most_expensive_routes.length > 0 && (
        <div style={{ marginTop: "1.25rem" }}>
          <h4 style={{ margin: "0 0 0.75rem" }}>Most expensive routes</h4>
          <div style={{ display: "grid", gap: "0.5rem" }}>
            {most_expensive_routes.map((r) => (
              <div
                key={r.route}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "0.65rem 0.85rem",
                  border: "1px solid #E5E7EB",
                  borderRadius: 8,
                  background: "white",
                }}
              >
                <span>{r.route}</span>
                <strong>{formatPhp(r.actual_toll_php)}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {route_trends.length > 0 && (
        <div style={{ marginTop: "1.25rem" }}>
          <h4 style={{ margin: "0 0 0.75rem" }}>Route toll trends (monthly)</h4>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #E5E7EB", textAlign: "left" }}>
                  <th style={{ padding: "0.5rem" }}>Month</th>
                  <th style={{ padding: "0.5rem" }}>Estimated</th>
                  <th style={{ padding: "0.5rem" }}>Actual</th>
                  <th style={{ padding: "0.5rem" }}>Variance</th>
                  <th style={{ padding: "0.5rem" }}>Trips</th>
                </tr>
              </thead>
              <tbody>
                {route_trends.map((t) => (
                  <tr key={t.month} style={{ borderBottom: "1px solid #F3F4F6" }}>
                    <td style={{ padding: "0.5rem" }}>{t.month}</td>
                    <td style={{ padding: "0.5rem" }}>{formatPhp(t.estimated_toll_php)}</td>
                    <td style={{ padding: "0.5rem" }}>{formatPhp(t.actual_toll_php)}</td>
                    <td style={{ padding: "0.5rem" }}>{formatPhp(t.variance_php)}</td>
                    <td style={{ padding: "0.5rem" }}>{t.trip_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {drilldown.length > 0 && (
        <div style={{ marginTop: "1.25rem" }}>
          <h4 style={{ margin: "0 0 0.75rem" }}>Recent completed trips</h4>
          <DrilldownTable
            columns={[
              { key: "trip_id", label: "Trip" },
              { key: "route", label: "Route" },
              { key: "vehicle_class", label: "Class" },
              { key: "estimated_toll", label: "Estimated" },
              { key: "actual_toll", label: "Actual" },
              { key: "variance", label: "Variance" },
            ]}
            rows={drilldown.slice(0, 20) as unknown as Record<string, unknown>[]}
          />
        </div>
      )}
    </>
  );
}
