"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import BookingCargoTypeAdminReview from "@/components/BookingCargoTypeAdminReview";
import { formatDateTime } from "@/lib/appLocale";
import { formatBookingWeightTons } from "@/lib/bookingWeightOptions";
import { cargoTypeCategoryLabel } from "@/lib/cargoTypeCategories";
import type { CargoTypeValidationAdminRow } from "@/lib/cargoTypeCategories";
import type { Booking } from "@/lib/workflowApi";
import { WorkflowApi } from "@/lib/workflowApi";
import { useRoleGuard } from "@/lib/useRoleGuard";

type Filter = "all" | "pending" | "validated" | "flagged";

function StatusBadge({ validated, flagged }: { validated: boolean; flagged: boolean }) {
  if (validated && flagged) {
    return (
      <span style={{ padding: "0.35rem 0.65rem", borderRadius: 999, fontSize: "0.8rem", fontWeight: 700, background: "#FFEDD5", color: "#9A3412" }}>
        Verified · flagged
      </span>
    );
  }
  if (validated) {
    return (
      <span style={{ padding: "0.35rem 0.65rem", borderRadius: 999, fontSize: "0.8rem", fontWeight: 700, background: "#DCFCE7", color: "#166534" }}>
        Verified
      </span>
    );
  }
  if (flagged) {
    return (
      <span style={{ padding: "0.35rem 0.65rem", borderRadius: 999, fontSize: "0.8rem", fontWeight: 700, background: "#FEF3C7", color: "#92400E" }}>
        Pending · flagged
      </span>
    );
  }
  return (
    <span style={{ padding: "0.35rem 0.65rem", borderRadius: 999, fontSize: "0.8rem", fontWeight: 700, background: "#F3F4F6", color: "#374151" }}>
      Pending review
    </span>
  );
}

function rowToBooking(row: CargoTypeValidationAdminRow): Booking {
  return {
    id: row.booking_id,
    customer_id: row.customer_id,
    pickup_location: row.pickup_location,
    dropoff_location: row.dropoff_location,
    service_type: "fixed",
    scheduled_date: "",
    scheduled_time_slot: "",
    cargo_weight_tons: row.cargo_weight_tons,
    required_truck_count: 1,
    cargo_description: row.cargo_description,
    estimated_cost: 0,
    actual_cost: null,
    status: row.status as Booking["status"],
    approved_by_id: null,
    approved_at: null,
    rejection_reason: null,
    created_at: "",
    updated_at: "",
    cargo_type_category: row.cargo_type_category,
    cargo_type_validated: row.cargo_type_validated,
    cargo_type_admin_notes: row.cargo_type_admin_notes,
    cargo_restricted_flag: row.cargo_restricted_flag,
    cargo_restricted_reasons: row.cargo_restricted_reasons.length
      ? JSON.stringify(row.cargo_restricted_reasons)
      : null,
    cargo_type_validated_at: row.cargo_type_validated_at,
    cargo_type_validated_by_id: row.cargo_type_validated_by_id,
  };
}

export default function AdminCargoTypeValidationPage() {
  useRoleGuard(["admin", "manager"]);
  const [rows, setRows] = useState<CargoTypeValidationAdminRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("pending");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      setRows(await WorkflowApi.listCargoTypeValidations());
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load cargo type validations.");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (filter === "pending") return !row.cargo_type_validated;
      if (filter === "validated") return row.cargo_type_validated;
      if (filter === "flagged") return row.cargo_restricted_flag;
      return true;
    });
  }, [filter, rows]);

  const onValidated = (updated: Booking) => {
    setRows((prev) =>
      prev.map((row) =>
        row.booking_id === updated.id
          ? {
              ...row,
              cargo_type_category: updated.cargo_type_category ?? row.cargo_type_category,
              cargo_type_category_label: cargoTypeCategoryLabel(updated.cargo_type_category),
              cargo_type_validated: !!updated.cargo_type_validated,
              cargo_type_admin_notes: updated.cargo_type_admin_notes ?? null,
              cargo_restricted_flag: !!updated.cargo_restricted_flag,
              cargo_restricted_reasons: updated.cargo_restricted_reasons
                ? (JSON.parse(updated.cargo_restricted_reasons) as string[])
                : [],
              cargo_type_validated_at: updated.cargo_type_validated_at ?? null,
              cargo_type_validated_by_id: updated.cargo_type_validated_by_id ?? null,
              cargo_description: updated.cargo_description ?? row.cargo_description,
            }
          : row,
      ),
    );
  };

  return (
    <main style={{ padding: "var(--page-main-padding)", background: "#FAFAFA", minHeight: "100vh" }}>
      <div className="container" style={{ maxWidth: "1200px", margin: "0 auto", display: "grid", gap: "1.2rem" }}>
        <div>
          <Link href="/admin/dashboard" style={{ color: "#0EA5E9", textDecoration: "none" }}>
            ← Admin Dashboard
          </Link>
          <h1 style={{ margin: "0.75rem 0 0.25rem", fontSize: "2rem" }}>Cargo type validation</h1>
          <p style={{ margin: 0, color: "#6B7280", fontSize: "0.95rem" }}>
            Classify and verify cargo type per booking. Restricted or contraband warnings are informational only and
            do not auto-reject bookings.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}>
            <span style={{ fontWeight: 600, color: "#374151" }}>Filter</span>
            <select className="input" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
              <option value="all">All</option>
              <option value="pending">Pending review</option>
              <option value="validated">Verified</option>
              <option value="flagged">Flagged warnings</option>
            </select>
          </label>
          <button type="button" className="button" onClick={() => void refresh()}>
            Refresh
          </button>
          <span style={{ fontSize: "0.85rem", color: "#6B7280" }}>
            {rows.length} loaded · {filtered.length} shown
          </span>
        </div>

        {loadError && (
          <p role="alert" style={{ margin: 0, color: "#B91C1C" }}>
            {loadError}
          </p>
        )}

        <div style={{ overflowX: "auto", background: "#fff", borderRadius: 8, border: "1px solid #E5E7EB" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
            <thead>
              <tr style={{ background: "#F9FAFB", textAlign: "left" }}>
                <th style={{ padding: "0.75rem", borderBottom: "1px solid #E5E7EB" }}>Booking</th>
                <th style={{ padding: "0.75rem", borderBottom: "1px solid #E5E7EB" }}>Cargo</th>
                <th style={{ padding: "0.75rem", borderBottom: "1px solid #E5E7EB" }}>Category</th>
                <th style={{ padding: "0.75rem", borderBottom: "1px solid #E5E7EB" }}>Status</th>
                <th style={{ padding: "0.75rem", borderBottom: "1px solid #E5E7EB" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: "1.25rem", color: "#6B7280", textAlign: "center" }}>
                    {rows.length === 0
                      ? "No bookings ready for cargo validation yet. Complete payment verification and goods declaration approval first — those queues are separate."
                      : "No bookings match this filter."}
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <Fragment key={row.booking_id}>
                    <tr
                      style={{
                        borderBottom: "1px solid #F3F4F6",
                        verticalAlign: "top",
                        background: row.dispatch_integrity_warning ? "#FEF2F2" : undefined,
                      }}
                    >
                      <td style={{ padding: "0.75rem" }}>
                        <strong>#{row.booking_id}</strong>
                        <div style={{ color: "#6B7280", fontSize: "0.8rem", marginTop: 4 }}>
                          Customer #{row.customer_id}
                          <br />
                          {row.status.replace(/_/g, " ")}
                        </div>
                        {row.dispatch_integrity_warning ? (
                          <div style={{ fontSize: "0.78rem", color: "#B91C1C", marginTop: 4, fontWeight: 700 }}>
                            Active trip assigned — validate cargo for Booking #{row.booking_id} (trips{" "}
                            {row.active_trip_ids?.map((id) => `#${id}`).join(", ")})
                          </div>
                        ) : (row.active_trip_ids?.length ?? 0) > 0 ? (
                          <div style={{ fontSize: "0.78rem", color: "#B45309", marginTop: 4, fontWeight: 600 }}>
                            Active trips: {row.active_trip_ids!.map((id) => `#${id}`).join(", ")}
                          </div>
                        ) : row.ready_for_dispatch_assignment ? (
                          <div style={{ fontSize: "0.78rem", color: "#047857", marginTop: 4, fontWeight: 600 }}>
                            Ready for dispatch
                          </div>
                        ) : (row.dispatch_blockers?.length ?? 0) > 0 ? (
                          <div style={{ fontSize: "0.78rem", color: "#B45309", marginTop: 4 }}>
                            {row.dispatch_blockers!.join(" · ")}
                          </div>
                        ) : null}
                      </td>
                      <td style={{ padding: "0.75rem", maxWidth: 280 }}>
                        <div>{row.cargo_description || "—"}</div>
                        <div style={{ fontSize: "0.8rem", color: "#6B7280", marginTop: 4 }}>
                          {formatBookingWeightTons(row.cargo_weight_tons)}
                        </div>
                        <div style={{ fontSize: "0.78rem", color: "#9CA3AF", marginTop: 4 }}>
                          {row.pickup_location.slice(0, 40)} → {row.dropoff_location.slice(0, 40)}
                        </div>
                      </td>
                      <td style={{ padding: "0.75rem" }}>
                        {row.cargo_type_category_label}
                        {row.cargo_restricted_flag && row.cargo_restricted_reasons.length > 0 && (
                          <p style={{ margin: "0.45rem 0 0", fontSize: "0.78rem", color: "#B45309" }}>
                            ⚠ {row.cargo_restricted_reasons[0]}
                          </p>
                        )}
                      </td>
                      <td style={{ padding: "0.75rem" }}>
                        <StatusBadge validated={row.cargo_type_validated} flagged={row.cargo_restricted_flag} />
                        {row.cargo_type_validated_at && (
                          <p style={{ margin: "0.45rem 0 0", fontSize: "0.75rem", color: "#9CA3AF" }}>
                            {formatDateTime(row.cargo_type_validated_at)}
                          </p>
                        )}
                      </td>
                      <td style={{ padding: "0.75rem" }}>
                        <button
                          type="button"
                          onClick={() => setExpandedId(expandedId === row.booking_id ? null : row.booking_id)}
                          style={{
                            padding: "0.4rem 0.7rem",
                            borderRadius: 6,
                            border: "1px solid #D1D5DB",
                            background: "#fff",
                            cursor: "pointer",
                            fontSize: "0.8rem",
                          }}
                        >
                          {expandedId === row.booking_id ? "Close" : "Review"}
                        </button>
                      </td>
                    </tr>
                    {expandedId === row.booking_id && (
                      <tr>
                        <td colSpan={5} style={{ padding: "0.75rem 1rem 1rem", background: "#F9FAFB" }}>
                          <BookingCargoTypeAdminReview booking={rowToBooking(row)} onValidated={onValidated} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
