"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { formatPhp } from "@/lib/appLocale";
import { useRoleGuard } from "@/lib/useRoleGuard";
import { WorkflowApi, type Booking } from "@/lib/workflowApi";

function BookingPaymentInner() {
  useRoleGuard(["customer"]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingIdRaw = searchParams.get("bookingId");

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [method, setMethod] = useState<"gcash" | "bank">("gcash");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const bookingId = bookingIdRaw ? Number.parseInt(bookingIdRaw, 10) : NaN;

  const loadBooking = useCallback(async () => {
    if (!Number.isFinite(bookingId)) {
      setLoadError("Missing booking.");
      return;
    }
    try {
      const b = await WorkflowApi.getBooking(bookingId);
      setBooking(b);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load booking.");
    }
  }, [bookingId]);

  useEffect(() => {
    void loadBooking();
  }, [loadBooking]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const lower = file.name.toLowerCase();
    const extOk =
      lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png") || lower.endsWith(".pdf");
    if (!extOk) {
      setUploadError("Only JPEG, PNG, and PDF files are allowed.");
      setSelectedFile(null);
      setFileName("");
      return;
    }
    if (file.type && !["image/jpeg", "image/png", "application/pdf"].includes(file.type)) {
      setUploadError("Only JPEG, PNG, and PDF files are allowed.");
      setSelectedFile(null);
      setFileName("");
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setUploadError("File size must not exceed 5MB.");
      setSelectedFile(null);
      setFileName("");
      return;
    }

    setSelectedFile(file);
    setFileName(file.name);
    setUploadError("");
  };

  const handleUploadProof = async () => {
    if (!selectedFile || !Number.isFinite(bookingId)) return;

    setIsUploading(true);
    setUploadError("");

    try {
      await WorkflowApi.submitPaymentProof(bookingId, method, selectedFile);
      setUploadSuccess(true);
      setTimeout(() => {
        router.push("/modules/customer/payment");
      }, 1200);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  if (!Number.isFinite(bookingId)) {
    return (
      <div style={{ padding: "var(--page-main-padding)", maxWidth: 560, margin: "0 auto" }}>
        <p style={{ color: "#991B1B" }}>Invalid payment link.</p>
        <Link href="/booking" style={{ color: "#FF9800", fontWeight: 600 }}>
          ← Back to booking
        </Link>
      </div>
    );
  }

  if (loadError || !booking) {
    return (
      <div style={{ padding: "var(--page-main-padding)", maxWidth: 560, margin: "0 auto" }}>
        <p style={{ color: "#6B7280" }}>{loadError || "Loading…"}</p>
        <Link href="/booking" style={{ color: "#FF9800", fontWeight: 600 }}>
          ← Back to booking
        </Link>
      </div>
    );
  }

  const total = booking.estimated_cost;

  return (
    <div style={{ padding: "var(--page-main-padding)", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: "2rem" }}>
        <Link href="/booking" style={{ color: "#FF9800", textDecoration: "none", fontWeight: 600 }}>
          ← Back to booking
        </Link>
      </div>

      <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem" }}>Pay for your booking</h1>
      <p style={{ color: "#666666", marginBottom: "2rem" }}>
        Use the details below, then upload proof of payment (JPEG, PNG, or PDF). An admin will verify your payment.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: "2rem" }}>
        <div style={{ display: "grid", gap: "1.25rem" }}>
          <section
            style={{
              padding: "1.5rem",
              border: "1px solid #E8E8E8",
              borderRadius: "8px",
              background: "#F9F9F9",
            }}
          >
            <h3 style={{ color: "#1A1A1A", marginTop: 0, marginBottom: "1rem" }}>Booking summary</h3>
            <p style={{ color: "#666666", margin: "0.5rem 0" }}>
              <strong>Booking:</strong> #{booking.id}
            </p>
            <p style={{ color: "#666666", margin: "0.5rem 0" }}>
              <strong>From:</strong> {booking.pickup_location}
            </p>
            <p style={{ color: "#666666", margin: "0.5rem 0" }}>
              <strong>To:</strong> {booking.dropoff_location}
            </p>
            <p style={{ color: "#666666", margin: "0.5rem 0" }}>
              <strong>Date:</strong> {String(booking.scheduled_date)}
            </p>
            <p style={{ color: "#FF9800", fontWeight: 700, margin: "1rem 0 0 0" }}>Amount due: {formatPhp(total)}</p>
          </section>

          <section>
            <label style={{ display: "grid", gap: "0.35rem", marginBottom: "1rem" }}>
              <span style={{ fontWeight: 600, color: "#374151" }}>How did you pay?</span>
              <select
                className="select"
                value={method}
                onChange={(e) => setMethod(e.target.value as "gcash" | "bank")}
              >
                <option value="gcash">GCash</option>
                <option value="bank">Bank transfer</option>
              </select>
            </label>

            {method === "gcash" ? (
              <div
                style={{
                  padding: "1.5rem",
                  border: "1px solid #E8E8E8",
                  borderRadius: "8px",
                  marginBottom: "1rem",
                  background: "#FFFBF0",
                }}
              >
                <h4 style={{ margin: "0 0 0.8rem 0", color: "#1A1A1A" }}>GCash</h4>
                <p style={{ color: "#666666", margin: "0.5rem 0", fontSize: "0.95rem" }}>
                  Use the mobile number and merchant name provided by your FleetOps administrator. Do not send payment to
                  any number shown on unofficial channels.
                </p>
                <p style={{ color: "#666666", fontSize: "0.85rem", margin: 0 }}>
                  Send {formatPhp(total)} and use booking #{booking.id} in the payment note when possible.
                </p>
              </div>
            ) : (
              <div style={{ padding: "1.5rem", border: "1px solid #E8E8E8", borderRadius: "8px", background: "#FFFBF0" }}>
                <h4 style={{ margin: "0 0 0.8rem 0", color: "#1A1A1A" }}>Bank transfer</h4>
                <p style={{ color: "#666666", margin: "0.5rem 0", fontSize: "0.95rem" }}>
                  Transfer only to the official bank account issued by FleetOps operations (branch, account name, and
                  number are shared out-of-band or in your contract).
                </p>
                <p style={{ color: "#666666", margin: "0.5rem 0", fontSize: "0.85rem" }}>
                  <strong>Reference:</strong> Booking #{booking.id}
                </p>
                <p style={{ color: "#FF9800", fontWeight: 700, margin: "0.75rem 0 0 0" }}>Amount: {formatPhp(total)}</p>
              </div>
            )}
          </section>

          <section style={{ padding: "1.5rem", border: "2px dashed #3B82F6", borderRadius: "8px", background: "#EFF6FF" }}>
            <h3 style={{ color: "#1A1A1A", marginTop: 0, marginBottom: "1rem" }}>Upload proof of payment</h3>
            <p style={{ color: "#666666", fontSize: "0.9rem", marginBottom: "1rem" }}>
              JPEG, PNG, or PDF only (max 5MB).
            </p>

            {uploadError && (
              <div
                style={{
                  padding: "0.75rem",
                  background: "#FEE2E2",
                  color: "#991B1B",
                  borderRadius: "6px",
                  marginBottom: "1rem",
                  fontSize: "0.9rem",
                }}
              >
                {uploadError}
              </div>
            )}

            {uploadSuccess && (
              <div
                style={{
                  padding: "0.75rem",
                  background: "#D1FAE5",
                  color: "#047857",
                  borderRadius: "6px",
                  marginBottom: "1rem",
                  fontSize: "0.9rem",
                }}
              >
                ✓ Proof submitted. Redirecting to payment history…
              </div>
            )}

            <div
              style={{
                padding: "1.5rem",
                border: "2px dashed #D1D5DB",
                borderRadius: "8px",
                textAlign: "center",
                background: "white",
                marginBottom: "1rem",
              }}
            >
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                onChange={handleFileSelect}
                disabled={isUploading || uploadSuccess}
                style={{ display: "none" }}
                id="file-upload"
              />
              <label htmlFor="file-upload" style={{ display: "block", cursor: "pointer", color: "#3B82F6" }}>
                <p style={{ margin: "0 0 0.25rem 0", fontWeight: 600, color: "#1A1A1A" }}>Choose file</p>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "#666666" }}>{fileName || "No file selected"}</p>
              </label>
            </div>

            {selectedFile && (
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  setFileName("");
                }}
                style={{
                  padding: "0.4rem 0.8rem",
                  background: "#F3F4F6",
                  border: "1px solid #D1D5DB",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  marginBottom: "1rem",
                }}
              >
                Clear selection
              </button>
            )}

            <button
              type="button"
              onClick={() => void handleUploadProof()}
              disabled={!selectedFile || isUploading || uploadSuccess}
              style={{
                width: "100%",
                padding: "0.75rem",
                background: selectedFile && !isUploading && !uploadSuccess ? "#10B981" : "#D1D5DB",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: selectedFile && !isUploading && !uploadSuccess ? "pointer" : "not-allowed",
                fontWeight: 600,
              }}
            >
              {isUploading ? "Uploading…" : "Submit proof"}
            </button>
          </section>
        </div>

        <aside style={{ position: "sticky", top: "2rem", alignSelf: "start" }}>
          <div style={{ padding: "1.5rem", border: "1px solid #E8E8E8", borderRadius: "8px", background: "#F9F9F9" }}>
            <h3 style={{ color: "#1A1A1A", marginTop: 0 }}>Status</h3>
            <p style={{ margin: 0, color: "#6B7280", fontSize: "0.9rem" }}>
              After you submit proof, status will show as <strong>for verification</strong> in payment history until an
              admin reviews it.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function BookingPaymentPage() {
  return (
    <Suspense fallback={<div style={{ padding: "var(--page-main-padding)" }}>Loading…</div>}>
      <BookingPaymentInner />
    </Suspense>
  );
}
