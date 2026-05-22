"use client";

import { useCallback, useEffect, useState } from "react";
import { WorkflowApi, type PreDeliveryChecklist } from "@/lib/workflowApi";

type Props = {
  bookingId: number;
  canValidate?: boolean;
  onUpdated?: (checklist: PreDeliveryChecklist) => void;
};

export default function PreDeliveryVerificationChecklist({
  bookingId,
  canValidate = false,
  onUpdated,
}: Props) {
  const [checklist, setChecklist] = useState<PreDeliveryChecklist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await WorkflowApi.preDeliveryChecklist(bookingId);
      setChecklist(data);
      onUpdated?.(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load verification checklist.");
    } finally {
      setLoading(false);
    }
  }, [bookingId, onUpdated]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleValidation = async (
    field: "goods_declaration_validated" | "cargo_type_validated",
    next: boolean,
  ) => {
    setBusyKey(field);
    setError(null);
    try {
      const updated = await WorkflowApi.updatePreDeliveryChecklist(bookingId, { [field]: next });
      setChecklist(updated);
      onUpdated?.(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setBusyKey(null);
    }
  };

  if (loading) {
    return <p style={{ margin: 0, color: "#6B7280", fontSize: "0.9rem" }}>Loading pre-delivery checklist…</p>;
  }

  if (error && !checklist) {
    return (
      <p role="alert" style={{ margin: 0, color: "#B91C1C", fontSize: "0.9rem" }}>
        {error}
      </p>
    );
  }

  if (!checklist) return null;

  return (
    <div style={{ display: "grid", gap: "0.75rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "0.75rem", flexWrap: "wrap" }}>
        <div>
          <h3 style={{ margin: "0 0 0.25rem 0", color: "#1A1A1A", fontSize: "1rem" }}>Pre-delivery verification</h3>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#6B7280", lineHeight: 1.45 }}>
            All checks must pass before the trip can move to delivery (en route and beyond). Dispatch assignment is
            unchanged.
          </p>
        </div>
        <span
          style={{
            padding: "0.25rem 0.6rem",
            borderRadius: 999,
            fontSize: "0.78rem",
            fontWeight: 700,
            background: checklist.all_passed ? "#D1FAE5" : "#FEF3C7",
            color: checklist.all_passed ? "#065F46" : "#92400E",
          }}
        >
          {checklist.all_passed ? "Ready for delivery" : "Incomplete"}
        </span>
      </div>

      {error && (
        <p role="alert" style={{ margin: 0, color: "#B91C1C", fontSize: "0.85rem" }}>
          {error}
        </p>
      )}

      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.55rem" }}>
        {checklist.items.map((item) => (
          <li
            key={item.key}
            style={{
              display: "grid",
              gap: "0.35rem",
              padding: "0.75rem",
              borderRadius: 8,
              border: `1px solid ${item.passed ? "#BBF7D0" : "#FECACA"}`,
              background: item.passed ? "#F0FDF4" : "#FEF2F2",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
              <strong style={{ fontSize: "0.88rem", color: "#111827" }}>
                {item.passed ? "✓" : "○"} {item.label}
              </strong>
              {canValidate && item.key === "cargo_type" && (
                <button
                  type="button"
                  disabled={busyKey === "cargo_type_validated"}
                  onClick={() => void toggleValidation("cargo_type_validated", !item.passed)}
                  style={{
                    padding: "0.3rem 0.55rem",
                    fontSize: "0.75rem",
                    borderRadius: 6,
                    border: "1px solid #D1D5DB",
                    background: "#fff",
                    cursor: busyKey ? "wait" : "pointer",
                  }}
                >
                  {item.passed ? "Revoke" : "Mark validated"}
                </button>
              )}
            </div>
            <span style={{ fontSize: "0.82rem", color: "#4B5563" }}>{item.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
