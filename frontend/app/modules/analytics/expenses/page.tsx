"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import Breadcrumbs from "@/components/Breadcrumbs";
import ExpenseAnalyticsSummary from "@/components/ExpenseAnalyticsSummary";
import { AnalyticsApi, type ExpenseAnalyticsPayload } from "@/lib/analyticsApi";
import { useRoleGuard } from "@/lib/useRoleGuard";

function modulesHomeHref(): string {
  if (typeof window === "undefined") return "/dispatcher/dashboard";
  const r = localStorage.getItem("userRole");
  if (r === "admin") return "/admin/dashboard";
  if (r === "manager") return "/manager/dashboard";
  return "/dispatcher/dashboard";
}

export default function ExpenseAnalyticsPage() {
  useRoleGuard(["dispatcher", "manager", "admin"]);

  const [home, setHome] = useState("/dispatcher/dashboard");
  const [data, setData] = useState<ExpenseAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setHome(modulesHomeHref());
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const d = await AnalyticsApi.expenseAnalytics();
        if (!alive) return;
        setData(d);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Failed to load expense analytics.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="container" style={{ paddingTop: "var(--space-3)", paddingBottom: "2rem" }}>
      <Breadcrumbs
        items={[
          { label: "Modules", href: home },
          { label: "Analytics" },
          { label: "Expense summary" },
        ]}
      />

      <header style={{ marginTop: "1.5rem", marginBottom: "1.25rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800 }}>Expense analytics</h1>
        <p style={{ margin: "0.4rem 0 0", color: "#6B7280", maxWidth: "46rem" }}>
          Summary cards and charts from existing trip, fuel, toll, allowance, and operational cost data via{" "}
          <code>/api/analytics/expenses</code>. Does not replace predictive or prescriptive analytics modules.
        </p>
      </header>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
        <Link href="/modules/analytics/operations-snapshot" style={pillLink}>
          Live data snapshot
        </Link>
        <Link href="/modules/analytics/predictions" style={pillLink}>
          Predictions
        </Link>
        <Link href="/dispatcher/trip-cost-ledger" style={pillLink}>
          Trip cost ledger
        </Link>
      </div>

      {error ? (
        <div role="alert" style={{ padding: "1rem", background: "#FEE2E2", color: "#991B1B", borderRadius: 8, marginBottom: "1rem" }}>
          {error}
        </div>
      ) : null}

      {loading ? <p style={{ color: "#6B7280" }}>Loading expense analytics…</p> : null}

      {data && !loading ? <ExpenseAnalyticsSummary data={data} /> : null}
    </div>
  );
}

const pillLink: React.CSSProperties = {
  display: "inline-block",
  padding: "0.4rem 0.85rem",
  borderRadius: 8,
  background: "#EEF2FF",
  color: "#3730A3",
  fontWeight: 600,
  fontSize: "0.85rem",
  textDecoration: "none",
};
