"use client";

import { useEffect, useState } from "react";
import { useRoleGuard } from "@/lib/useRoleGuard";
import {
  AnalyticsApi,
  type FeedbackSummaryResponse,
  type ModelMetricRead,
} from "@/lib/analyticsApi";
import { formatDateTime } from "@/lib/appLocale";

export default function AccuracyMonitoringPage() {
  useRoleGuard(["manager", "admin"]);

  const [summary, setSummary] = useState<FeedbackSummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retraining, setRetraining] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await AnalyticsApi.feedbackSummary();
      setSummary(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const triggerRetrain = async () => {
    setRetraining(true);
    try {
      await AnalyticsApi.trainCostModel();
      await refresh();
    } finally {
      setRetraining(false);
    }
  };

  const card: React.CSSProperties = {
    background: "white",
    border: "1px solid #E5E7EB",
    borderRadius: 12,
    padding: 20,
  };

  return (
    <main style={{ padding: "2rem", background: "#FAFAFA", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gap: 20 }}>
        <header>
          <h1 style={{ margin: 0 }}>Model Accuracy & Feedback</h1>
          <p style={{ marginTop: 6, color: "#6B7280" }}>
            Paper §3.5.10 + Fig 24 — predicted vs actual feedback loop. MAE/MAPE/RMSE per model with drift detection (MAPE &gt; 25% triggers retraining).
          </p>
        </header>

        <section style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>Status</h2>
            <button
              onClick={triggerRetrain}
              disabled={retraining}
              style={{
                padding: "8px 14px",
                background: "#7C3AED",
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: retraining ? "not-allowed" : "pointer",
                fontWeight: 600,
              }}
            >
              {retraining ? "Retraining…" : "Retrain cost model"}
            </button>
          </div>
          {loading && <p>Loading…</p>}
          {error && <p style={{ color: "#B91C1C" }}>{error}</p>}
          {summary && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              <Stat
                label="Drift detected"
                value={summary.drift_detected ? "YES" : "NO"}
                tone={summary.drift_detected ? "red" : "green"}
              />
              <Stat label="Sample size" value={String(summary.sample_size)} />
              <Stat
                label="Last retrain"
                value={summary.last_retrain_at ? formatDateTime(summary.last_retrain_at) : "—"}
              />
              <Stat label="Models monitored" value={String(Object.keys(summary.metrics_by_model).length)} />
            </div>
          )}
        </section>

        {summary && (
          <section style={card}>
            <h2 style={{ marginTop: 0 }}>Per-model metrics</h2>
            {Object.keys(summary.metrics_by_model).length === 0 ? (
              <p style={{ color: "#6B7280" }}>
                No predictions evaluated yet. Complete a few trips with a stored prediction to populate this view.
              </p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#F3F4F6" }}>
                    <th style={th}>Model</th>
                    <th style={th}>MAE</th>
                    <th style={th}>MAPE %</th>
                    <th style={th}>RMSE</th>
                    <th style={th}>Accuracy %</th>
                    <th style={th}>Samples</th>
                    <th style={th}>Measured</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(summary.metrics_by_model).map(([name, m]: [string, ModelMetricRead]) => (
                    <tr key={name}>
                      <td style={td}>{name}</td>
                      <td style={td}>{m.mae}</td>
                      <td style={td}>
                        {m.mape}
                        {m.mape > 25 && (
                          <span style={{ marginLeft: 6, color: "#B91C1C", fontWeight: 700 }}> drift</span>
                        )}
                      </td>
                      <td style={td}>{m.rmse}</td>
                      <td style={td}>{m.accuracy}</td>
                      <td style={td}>{m.sample_size}</td>
                      <td style={td}>{formatDateTime(m.measured_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

const th: React.CSSProperties = { padding: "10px 8px", borderBottom: "1px solid #E5E7EB", textAlign: "left", fontSize: 13 };
const td: React.CSSProperties = { padding: "8px", borderBottom: "1px solid #F3F4F6", fontSize: 14 };

function Stat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "red" | "green" }) {
  const palette =
    tone === "red"
      ? { background: "#FEE2E2", color: "#991B1B" }
      : tone === "green"
      ? { background: "#D1FAE5", color: "#047857" }
      : { background: "#F3F4F6", color: "#1F2937" };
  return (
    <div style={{ ...palette, padding: 14, borderRadius: 10 }}>
      <div style={{ fontSize: 12, textTransform: "uppercase", opacity: 0.7 }}>{label}</div>
      <div style={{ fontWeight: 800, fontSize: 22 }}>{value}</div>
    </div>
  );
}
