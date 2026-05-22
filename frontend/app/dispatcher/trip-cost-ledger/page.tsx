"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatPhp } from "@/lib/appLocale";
import { DispatchApi } from "@/lib/dispatchApi";
import {
  SHOULDER_COST_CATEGORIES,
  shoulderCategoryLabel,
  type TripCostLedgerRow,
} from "@/lib/tripShoulderCosts";
import { useRoleGuard } from "@/lib/useRoleGuard";

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: "1rem",
        borderRadius: 8,
        border: "1px solid #E5E7EB",
        background: "#fff",
      }}
    >
      <p style={{ margin: 0, fontSize: "0.8rem", color: "#6B7280" }}>{label}</p>
      <p style={{ margin: "0.35rem 0 0", fontSize: "1.35rem", fontWeight: 700, color: "#111827" }}>{value}</p>
    </div>
  );
}

function TripLedgerRow({
  row,
  onAdded,
}: {
  row: TripCostLedgerRow;
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("toll");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Enter a valid amount greater than zero.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await DispatchApi.addTripShoulderCost(row.trip_id, {
        category,
        amount_php: parsed,
        notes: notes.trim() || null,
      });
      setAmount("");
      setNotes("");
      setOpen(false);
      onAdded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save expense.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ border: "1px solid #E5E7EB", borderRadius: 8, background: "#fff", overflow: "hidden" }}>
      <div
        style={{
          padding: "0.85rem 1rem",
          display: "grid",
          gap: "0.5rem",
          gridTemplateColumns: "1fr auto",
          alignItems: "start",
        }}
      >
        <div>
          <strong>
            Trip #{row.trip_id} · Booking #{row.booking_id}
          </strong>
          <div style={{ fontSize: "0.85rem", color: "#4B5563", marginTop: 4 }}>
            {row.pickup_location.slice(0, 48)} → {row.dropoff_location.slice(0, 48)}
          </div>
          <div style={{ fontSize: "0.8rem", color: "#6B7280", marginTop: 4 }}>
            {row.driver_name ?? "—"} · {row.truck_code ?? "—"} · {row.trip_status.replace(/_/g, " ")}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={{
            padding: "0.4rem 0.7rem",
            borderRadius: 6,
            border: "1px solid #D1D5DB",
            background: "#fff",
            cursor: "pointer",
            fontSize: "0.8rem",
          }}
        >
          {open ? "Close" : "Add expense"}
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "0.5rem",
          padding: "0 1rem 0.85rem",
          fontSize: "0.82rem",
        }}
      >
        <div>
          <span style={{ color: "#6B7280" }}>System fuel</span>
          <div>{formatPhp(row.system_costs.fuel_cost)}</div>
        </div>
        <div>
          <span style={{ color: "#6B7280" }}>System toll</span>
          <div>{formatPhp(row.system_costs.toll_cost)}</div>
        </div>
        <div>
          <span style={{ color: "#6B7280" }}>System labor</span>
          <div>{formatPhp(row.system_costs.labor_cost)}</div>
        </div>
        <div>
          <span style={{ color: "#6B7280" }}>Driver allowance</span>
          <div>{formatPhp(row.system_costs.driver_allowance_php ?? 0)}</div>
        </div>
        <div>
          <span style={{ color: "#6B7280" }}>Helper allowance</span>
          <div>{formatPhp(row.system_costs.helper_allowance_php ?? 0)}</div>
        </div>
        <div>
          <span style={{ color: "#6B7280" }}>System total</span>
          <div style={{ fontWeight: 700 }}>{formatPhp(row.system_costs.system_total_cost)}</div>
        </div>
        <div>
          <span style={{ color: "#6B7280" }}>Shoulder total</span>
          <div style={{ fontWeight: 700, color: "#B45309" }}>{formatPhp(row.shoulder_grand_total)}</div>
        </div>
      </div>

      {Object.values(row.shoulder_totals).some((v) => v > 0) && (
        <div style={{ padding: "0 1rem 0.85rem", display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
          {SHOULDER_COST_CATEGORIES.map((cat) => {
            const amt = row.shoulder_totals[cat.value] ?? 0;
            if (amt <= 0) return null;
            return (
              <span
                key={cat.value}
                style={{
                  padding: "0.2rem 0.5rem",
                  borderRadius: 999,
                  background: "#FEF3C7",
                  color: "#92400E",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                }}
              >
                {cat.label}: {formatPhp(amt)}
              </span>
            );
          })}
        </div>
      )}

      {row.entries.length > 0 && (
        <div style={{ padding: "0 1rem 0.85rem" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#6B7280" }}>
                <th style={{ padding: "0.35rem 0" }}>Category</th>
                <th style={{ padding: "0.35rem 0" }}>Amount</th>
                <th style={{ padding: "0.35rem 0" }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {row.entries.map((e) => (
                <tr key={e.id} style={{ borderTop: "1px solid #F3F4F6" }}>
                  <td style={{ padding: "0.35rem 0" }}>{e.category_label || shoulderCategoryLabel(e.category)}</td>
                  <td style={{ padding: "0.35rem 0" }}>{formatPhp(e.amount_php)}</td>
                  <td style={{ padding: "0.35rem 0", color: "#6B7280" }}>{e.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <div style={{ padding: "0.85rem 1rem", background: "#F9FAFB", borderTop: "1px solid #E5E7EB" }}>
          <p style={{ margin: "0 0 0.5rem", fontSize: "0.82rem", color: "#6B7280" }}>
            Shoulder costs are tracked separately and do not change system trip cost computation.
          </p>
          <div style={{ display: "grid", gap: "0.5rem", maxWidth: 420 }}>
            <label style={{ display: "grid", gap: "0.25rem" }}>
              <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>Category</span>
              <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                {SHOULDER_COST_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: "0.25rem" }}>
              <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>Amount (PHP)</span>
              <input
                className="input"
                type="number"
                min={0.01}
                step={0.01}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label style={{ display: "grid", gap: "0.25rem" }}>
              <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>Notes</span>
              <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
            </label>
            {error && (
              <p role="alert" style={{ margin: 0, color: "#B91C1C", fontSize: "0.85rem" }}>
                {error}
              </p>
            )}
            <button type="button" className="button" disabled={busy} onClick={() => void submit()}>
              {busy ? "Saving…" : "Save expense"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DispatcherTripCostLedgerPage() {
  useRoleGuard(["dispatcher", "manager", "admin"]);
  const [data, setData] = useState<Awaited<ReturnType<typeof DispatchApi.tripCostLedger>> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bookingFilter, setBookingFilter] = useState("");

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      const bookingId = bookingFilter.trim() === "" ? undefined : Number(bookingFilter);
      const res = await DispatchApi.tripCostLedger({
        booking_id: Number.isFinite(bookingId) && bookingId! > 0 ? bookingId : undefined,
        limit: 100,
      });
      setData(res);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load trip cost ledger.");
    }
  }, [bookingFilter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const categorySummary = useMemo(() => {
    if (!data) return [];
    return SHOULDER_COST_CATEGORIES.map((c) => ({
      ...c,
      total: data.summary.by_category[c.value] ?? 0,
    })).filter((c) => c.total > 0);
  }, [data]);

  return (
    <main style={{ padding: "var(--page-main-padding)", background: "#FAFAFA", minHeight: "100vh" }}>
      <div className="container" style={{ maxWidth: "1100px", margin: "0 auto", display: "grid", gap: "1.2rem" }}>
        <div>
          <Link href="/dispatcher/dashboard" style={{ color: "#FF9800", textDecoration: "none", fontWeight: 600 }}>
            ← Dispatcher Dashboard
          </Link>
          <h1 style={{ margin: "0.75rem 0 0.25rem", fontSize: "2rem", color: "#1A1A1A" }}>Trip cost ledger</h1>
          <p style={{ margin: 0, color: "#6B7280", fontSize: "0.95rem" }}>
            Capture shoulder costs (toll, fuel, parking, allowance, other) per trip leg. System-computed trip costs
            remain unchanged — this ledger is for tracking and analytics only.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "end" }}>
          <label style={{ display: "grid", gap: "0.25rem" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Filter by booking ID</span>
            <input
              className="input"
              type="number"
              min={1}
              placeholder="All bookings"
              value={bookingFilter}
              onChange={(e) => setBookingFilter(e.target.value)}
              style={{ width: 160 }}
            />
          </label>
          <button type="button" className="button" onClick={() => void refresh()}>
            Refresh
          </button>
        </div>

        {loadError && (
          <p role="alert" style={{ margin: 0, color: "#B91C1C" }}>
            {loadError}
          </p>
        )}

        {data && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.75rem" }}>
              <SummaryCard label="Trips in ledger" value={String(data.summary.trip_count)} />
              <SummaryCard label="Shoulder grand total" value={formatPhp(data.summary.shoulder_grand_total)} />
              {categorySummary.map((c) => (
                <SummaryCard key={c.value} label={`Shoulder ${c.label}`} value={formatPhp(c.total)} />
              ))}
            </div>

            <div style={{ display: "grid", gap: "0.75rem" }}>
              {data.trips.length === 0 ? (
                <p style={{ color: "#6B7280" }}>No trip legs match this filter.</p>
              ) : (
                data.trips.map((row) => (
                  <TripLedgerRow key={row.trip_id} row={row} onAdded={() => void refresh()} />
                ))
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
