"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatPhpWhole } from "@/lib/appLocale";
import { WorkflowApi } from "@/lib/workflowApi";
import { useRoleGuard } from "@/lib/useRoleGuard";

export default function HelperTotalPayPage() {
  useRoleGuard(["helper"]);

  const [data, setData] = useState<{
    role: string;
    base_salary: number;
    net_salary: number;
    deductions: number;
    rating: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = (await WorkflowApi.driverSalary()) as {
        role: string;
        base_salary: number;
        net_salary: number;
        deductions: number;
        rating: number;
      };
      setData(d);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Could not load pay profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div style={{ padding: "var(--page-main-padding)", display: "grid", gap: "1.5rem", maxWidth: 720 }}>
      <div>
        <Link href="/driver/dashboard" style={{ color: "#FF9800", textDecoration: "none", fontWeight: 600 }}>
          ← Dashboard
        </Link>
        <h1 style={{ margin: "1rem 0 0.25rem", color: "#1A1A1A" }}>Total pay</h1>
        <p style={{ color: "#666", margin: 0, lineHeight: 1.5 }}>
          Profile compensation from your helper record (database). Trip-level payroll accrual is tracked separately for
          drivers.
        </p>
      </div>

      {error ? (
        <div role="alert" style={{ background: "#FEF2F2", color: "#991B1B", padding: 12, borderRadius: 8 }}>
          {error}
        </div>
      ) : null}

      {loading ? (
        <p style={{ color: "#64748B", margin: 0 }}>Loading…</p>
      ) : data ? (
        <div
          style={{
            padding: "1.5rem",
            border: "1px solid #E8E8E8",
            borderRadius: 12,
            background: "#FAFAFA",
            display: "grid",
            gap: "0.75rem",
            fontSize: "0.95rem",
          }}
        >
          <div>
            <strong>Role:</strong> {data.role}
          </div>
          <div>
            <strong>Base salary (profile):</strong> {formatPhpWhole(data.base_salary)}
          </div>
          <div>
            <strong>Deductions:</strong> {formatPhpWhole(data.deductions)}
          </div>
          <div>
            <strong>Net (profile):</strong> {formatPhpWhole(data.net_salary)}
          </div>
          <div>
            <strong>Rating:</strong> {Number(data.rating || 0).toFixed(1)}
          </div>
        </div>
      ) : null}
    </div>
  );
}
