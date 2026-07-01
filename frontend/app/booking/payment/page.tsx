"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import PaymentMethodInstructions from "@/components/PaymentMethodInstructions";
import CustomerDocumentReviewSection from "@/components/CustomerDocumentReviewSection";
import LoadingMessage from "@/components/ui/LoadingMessage";
import SubmitButton from "@/components/ui/SubmitButton";
import ErrorState from "@/components/ui/ErrorState";
import { ApiError } from "@/lib/api";
import { ERROR_LOAD_DATA, LOADING_AUTH_RESTORE } from "@/lib/loadingMessages";
import { formatPhp } from "@/lib/appLocale";
import {
  CUSTOMER_PAYMENT_METHODS,
  formatPaymentMethodLabel,
  paymentMethodRequiresProof,
  type CustomerPaymentMethod,
} from "@/lib/paymentMethodOptions";
import {
  GCASH_MAX_TRANSACTION_PHP,
  gcashAmountExceedsLimit,
  gcashAllowedForAmount,
} from "@/lib/paymentLimits";
import { useRoleGuard } from "@/lib/useRoleGuard";
import { WorkflowApi, type Booking, type Payment } from "@/lib/workflowApi";

function formatPaymentStatus(status: Payment["status"]): string {
  switch (status) {
    case "for_verification":
      return "for verification";
    case "verified":
      return "verified";
    case "rejected":
      return "rejected";
    case "refunded":
      return "refunded";
    default:
      return status;
  }
}

function BookingPaymentInner() {
  const { ready, allowed } = useRoleGuard(["customer"]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingIdRaw =
    searchParams.get("bookingId") ?? searchParams.get("booking_id") ?? searchParams.get("id");

  const [booking, setBooking] = useState<Booking | null>(null);
  const [existingPayments, setExistingPayments] = useState<Payment[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [method, setMethod] = useState<CustomerPaymentMethod>("gcash");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [xenditEnabled, setXenditEnabled] = useState(false);
  const [xenditQrString, setXenditQrString] = useState<string | null>(null);
  const [xenditStatus, setXenditStatus] = useState<string | null>(null);
  const [xenditLoading, setXenditLoading] = useState(false);
  const [xenditError, setXenditError] = useState<string | null>(null);

  const bookingId = bookingIdRaw ? Number.parseInt(bookingIdRaw, 10) : NaN;

  const latestPayment = useMemo(() => {
    if (!existingPayments.length) return null;
    return [...existingPayments].sort((a, b) => b.id - a.id)[0];
  }, [existingPayments]);

  const canSubmitPayment = !latestPayment || latestPayment.status === "rejected";

  const loadBooking = useCallback(async () => {
    if (!Number.isFinite(bookingId) || bookingId <= 0) {
      setLoadError("Booking not found.");
      setPageLoading(false);
      return;
    }
    setPageLoading(true);
    try {
      const [b, pays] = await Promise.all([
        WorkflowApi.getBooking(bookingId),
        WorkflowApi.bookingPayments(bookingId).catch(() => [] as Payment[]),
      ]);
      setBooking(b);
      setExistingPayments(pays);
      setLoadError(null);
    } catch (e) {
      setBooking(null);
      setExistingPayments([]);
      if (e instanceof ApiError && e.status === 404) {
        setLoadError("Booking not found.");
      } else {
        setLoadError(e instanceof Error ? e.message : ERROR_LOAD_DATA);
      }
    } finally {
      setPageLoading(false);
    }
  }, [bookingId]);

  const total = booking?.estimated_cost ?? 0;
  const gcashBlocked = gcashAmountExceedsLimit(total);
  const requiresProof = paymentMethodRequiresProof(method) && !(method === "gcash" && xenditEnabled);
  const canSubmit = canSubmitPayment && (requiresProof ? !!selectedFile : true);
  const xenditGcashFlow = method === "gcash" && xenditEnabled && !gcashBlocked;
  const xenditPaid = (xenditStatus || "").toUpperCase() === "PAID" || latestPayment?.status === "verified";

  const refreshXenditSession = useCallback(async () => {
    if (!Number.isFinite(bookingId) || bookingId <= 0) return;
    setXenditLoading(true);
    setXenditError(null);
    try {
      const session = await WorkflowApi.createXenditSession(bookingId);
      setXenditQrString(session.qr_string ?? session.payment.xendit_qr_string ?? null);
      setXenditStatus(session.xendit_status ?? session.payment.xendit_status ?? "PENDING");
      const pays = await WorkflowApi.bookingPayments(bookingId).catch(() => [] as Payment[]);
      setExistingPayments(pays);
    } catch (e) {
      setXenditError(e instanceof Error ? e.message : "Unable to start Xendit payment.");
    } finally {
      setXenditLoading(false);
    }
  }, [bookingId]);

  const pollXenditSession = useCallback(async () => {
    if (!Number.isFinite(bookingId) || bookingId <= 0) return;
    try {
      const session = await WorkflowApi.getXenditSession(bookingId);
      setXenditQrString(session.qr_string ?? session.payment.xendit_qr_string ?? null);
      setXenditStatus(session.xendit_status ?? session.payment.xendit_status ?? null);
      const pays = await WorkflowApi.bookingPayments(bookingId).catch(() => [] as Payment[]);
      setExistingPayments(pays);
      if ((session.xendit_status || "").toUpperCase() === "PAID" || session.payment.status === "verified") {
        setUploadSuccess(true);
        setTimeout(() => router.push("/modules/customer/payment"), 1500);
      }
    } catch {
      /* session may not exist yet */
    }
  }, [bookingId, router]);

  useEffect(() => {
    if (!ready || !allowed) return;
    void loadBooking();
    void WorkflowApi.xenditConfig()
      .then((cfg) => setXenditEnabled(cfg.enabled))
      .catch(() => setXenditEnabled(false));
  }, [ready, allowed, loadBooking]);

  useEffect(() => {
    if (!xenditEnabled || method !== "gcash" || gcashBlocked || !booking || pageLoading) return;
    if (latestPayment?.status === "verified") return;
    void refreshXenditSession();
  }, [xenditEnabled, method, gcashBlocked, booking, pageLoading, latestPayment?.status, refreshXenditSession]);

  useEffect(() => {
    if (!xenditGcashFlow || xenditPaid) return;
    const timer = window.setInterval(() => {
      void pollXenditSession();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [xenditGcashFlow, xenditPaid, pollXenditSession]);

  useEffect(() => {
    if (gcashBlocked && method === "gcash") {
      setMethod("bank");
    }
  }, [gcashBlocked, method]);

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
    if (!Number.isFinite(bookingId)) return;
    if (method === "gcash" && gcashBlocked) {
      setUploadError(
        `GCash cannot be used for amounts over ${formatPhp(GCASH_MAX_TRANSACTION_PHP)}. Please select bank transfer.`,
      );
      return;
    }
    if (requiresProof && !selectedFile) {
      setUploadError("Please upload a proof file for this payment method.");
      return;
    }

    setIsUploading(true);
    setUploadError("");

    try {
      await WorkflowApi.submitPaymentProof(bookingId, method, selectedFile);
      setUploadSuccess(true);
      const pays = await WorkflowApi.bookingPayments(bookingId).catch(() => [] as Payment[]);
      setExistingPayments(pays);
      setTimeout(() => {
        router.push("/modules/customer/payment");
      }, 1200);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  if (!ready) {
    return (
      <div style={{ padding: "var(--page-main-padding)", maxWidth: 560, margin: "0 auto" }}>
        <LoadingMessage label={LOADING_AUTH_RESTORE} />
      </div>
    );
  }

  if (!allowed) return null;

  if (!Number.isFinite(bookingId) || bookingId <= 0) {
    return (
      <div style={{ padding: "var(--page-main-padding)", maxWidth: 560, margin: "0 auto" }}>
        <p style={{ color: "#991B1B" }}>Booking not found.</p>
        <Link href="/booking" style={{ color: "#FF9800", fontWeight: 600 }}>
          ← Back to booking
        </Link>
      </div>
    );
  }

  if (pageLoading) {
    return (
      <div style={{ padding: "var(--page-main-padding)", maxWidth: 560, margin: "0 auto" }}>
        <LoadingMessage label="Loading booking…" />
      </div>
    );
  }

  if (loadError || !booking) {
    return (
      <div style={{ padding: "var(--page-main-padding)", maxWidth: 560, margin: "0 auto", display: "grid", gap: "1rem" }}>
        {loadError === "Booking not found." ? (
          <p style={{ margin: 0, color: "#991B1B", fontWeight: 600 }}>Booking not found.</p>
        ) : (
          <ErrorState message={loadError ?? ERROR_LOAD_DATA} onRetry={() => void loadBooking()} />
        )}
        <Link href="/booking" style={{ color: "#FF9800", fontWeight: 600 }}>
          ← Back to booking
        </Link>
      </div>
    );
  }

  return (
    <div style={{ padding: "var(--page-main-padding)", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: "2rem" }}>
        <Link href="/booking" style={{ color: "#FF9800", textDecoration: "none", fontWeight: 600 }}>
          ← Back to booking
        </Link>
      </div>

      <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem" }}>Pay for your booking</h1>
      <p style={{ color: "#666666", marginBottom: "2rem" }}>
        {xenditEnabled
          ? "Pay with GCash using the secure Xendit QR below. Bank transfer and other methods still use proof upload where required."
          : "Use the details below, then upload proof of payment (JPEG, PNG, or PDF). An admin will verify your payment."}
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
            <CustomerDocumentReviewSection
              booking={booking}
              onUpdated={(updated) => setBooking(updated)}
            />
          </section>

          <section>
            {gcashBlocked && (
              <div
                role="alert"
                style={{
                  padding: "0.85rem 1rem",
                  background: "#FEF3C7",
                  border: "1px solid #FCD34D",
                  borderRadius: "8px",
                  marginBottom: "1rem",
                  fontSize: "0.9rem",
                  color: "#92400E",
                  lineHeight: 1.5,
                }}
              >
                <strong>GCash limit exceeded.</strong> Your booking total ({formatPhp(total)}) is above the GCash
                maximum of {formatPhp(GCASH_MAX_TRANSACTION_PHP)} per transaction. GCash has been disabled for this
                payment — please use <strong>bank transfer</strong> instead.
              </div>
            )}

            <label style={{ display: "grid", gap: "0.35rem", marginBottom: "1rem" }}>
              <span style={{ fontWeight: 600, color: "#374151" }}>Payment method</span>
              <select
                className="select"
                value={method}
                onChange={(e) => {
                  setMethod(e.target.value as CustomerPaymentMethod);
                  setUploadError("");
                }}
              >
                {CUSTOMER_PAYMENT_METHODS.map((opt) => {
                  const disabled = opt.value === "gcash" && gcashBlocked;
                  return (
                    <option key={opt.value} value={opt.value} disabled={disabled}>
                      {opt.label}
                      {disabled ? " (over limit — unavailable)" : ""}
                    </option>
                  );
                })}
              </select>
              {!gcashBlocked && (
                <span style={{ fontSize: "0.82rem", color: "#6B7280" }}>
                  GCash maximum per transaction: {formatPhp(GCASH_MAX_TRANSACTION_PHP)}
                  {gcashAllowedForAmount(total) ? " — your amount is within this limit." : ""}
                </span>
              )}
            </label>

            <PaymentMethodInstructions
              method={method}
              bookingId={booking.id}
              total={total}
              gcashBlocked={gcashBlocked}
              xenditEnabled={xenditEnabled}
              xenditQrString={xenditQrString}
              xenditStatus={xenditStatus}
              xenditLoading={xenditLoading}
              xenditError={xenditError}
              onRetryXendit={() => void refreshXenditSession()}
            />
          </section>

          <section style={{ padding: "1.5rem", border: "2px dashed var(--accent)", borderRadius: "8px", background: "#EFF6FF" }}>
            {xenditGcashFlow ? (
              <>
                <h3 style={{ color: "#1A1A1A", marginTop: 0, marginBottom: "1rem" }}>Step 2 — Complete GCash payment</h3>
                <p style={{ color: "#666666", fontSize: "0.9rem", marginBottom: "1rem" }}>
                  Scan the QR code above with GCash. This page updates automatically when payment is received — no
                  screenshot upload is needed.
                </p>
                {uploadSuccess || xenditPaid ? (
                  <div
                    role="status"
                    style={{
                      padding: "0.75rem",
                      background: "#D1FAE5",
                      color: "#047857",
                      borderRadius: "6px",
                      fontSize: "0.9rem",
                    }}
                  >
                    ✓ Payment received. Redirecting to payment history…
                  </div>
                ) : (
                  <p style={{ color: "#374151", fontSize: "0.9rem", margin: 0 }}>
                    Waiting for payment… Status: <strong>{xenditStatus || "PENDING"}</strong>
                  </p>
                )}
              </>
            ) : (
              <>
            <h3 style={{ color: "#1A1A1A", marginTop: 0, marginBottom: "1rem" }}>
              {method === "gcash" && requiresProof
                ? "Step 2 — Upload GCash payment proof"
                : requiresProof
                  ? "Upload proof of payment"
                  : "Confirm payment request"}
            </h3>
            {!canSubmitPayment && latestPayment ? (
              <p style={{ color: "#047857", fontSize: "0.9rem", marginBottom: "1rem", fontWeight: 600 }}>
                Payment already submitted ({formatPaymentStatus(latestPayment.status)}). You can submit again only if
                admin rejects the proof.
              </p>
            ) : null}
            {requiresProof ? (
              <p style={{ color: "#666666", fontSize: "0.9rem", marginBottom: "1rem" }}>
                {method === "gcash"
                  ? "Upload a screenshot or PDF of your GCash receipt. Your payment stays for verification until an admin approves it — it is not auto-confirmed."
                  : "JPEG, PNG, or PDF only (max 5MB)."}
              </p>
            ) : (
              <p style={{ color: "#666666", fontSize: "0.9rem", marginBottom: "1rem" }}>
                No proof upload is needed for cash on delivery. Submit your request so an admin can approve COD before
                dispatch.
              </p>
            )}

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
                ✓{" "}
                {method === "gcash"
                  ? "GCash proof submitted. Wait for admin verification — your payment is not confirmed until approved."
                  : "Proof submitted. Redirecting to payment history…"}
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
                display: requiresProof ? "block" : "none",
              }}
            >
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                onChange={handleFileSelect}
                disabled={isUploading || uploadSuccess || !canSubmitPayment}
                style={{ display: "none" }}
                id="file-upload"
              />
              <label htmlFor="file-upload" style={{ display: "block", cursor: "pointer", color: "var(--accent)" }}>
                <p style={{ margin: "0 0 0.25rem 0", fontWeight: 600, color: "#1A1A1A" }}>Choose file</p>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "#666666" }}>{fileName || "No file selected"}</p>
              </label>
            </div>

            {selectedFile && requiresProof && (
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

            <SubmitButton
              type="button"
              className=""
              onClick={() => void handleUploadProof()}
              busy={isUploading}
              busyLabel="Submitting…"
              label={
                method === "gcash" && requiresProof
                  ? "Submit GCash proof for verification"
                  : requiresProof
                    ? "Submit proof"
                    : "Confirm COD request"
              }
              disabled={!canSubmit || uploadSuccess || !canSubmitPayment}
              style={{
                width: "100%",
                padding: "0.75rem",
                background: canSubmit && !isUploading && !uploadSuccess ? "#10B981" : "#D1D5DB",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontWeight: 600,
              }}
            />
              </>
            )}
          </section>
        </div>

        <aside style={{ position: "sticky", top: "2rem", alignSelf: "start" }}>
          <div style={{ padding: "1.5rem", border: "1px solid #E8E8E8", borderRadius: "8px", background: "#F9F9F9" }}>
            <h3 style={{ color: "#1A1A1A", marginTop: 0 }}>Status</h3>
            {latestPayment ? (
              <div style={{ marginBottom: "0.85rem", fontSize: "0.88rem", color: "#374151", display: "grid", gap: "0.35rem" }}>
                <p style={{ margin: 0 }}>
                  <strong>Payment reference:</strong> {latestPayment.reference}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Method:</strong> {formatPaymentMethodLabel(latestPayment.method)}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Amount:</strong> {formatPhp(latestPayment.amount)}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Status:</strong> {formatPaymentStatus(latestPayment.status)}
                </p>
              </div>
            ) : null}
            <p style={{ margin: 0, color: "#6B7280", fontSize: "0.9rem" }}>
              {xenditGcashFlow ? (
                <>
                  GCash payments through Xendit are confirmed automatically. Your booking moves to{" "}
                  <strong>payment verified</strong> once paid.
                </>
              ) : method === "gcash" ? (
                <>
                  After you upload GCash proof, status shows as <strong>for verification</strong> until an admin reviews
                  and approves it. Your booking is not marked paid until verification completes.
                </>
              ) : (
                <>
                  After you submit, status will show as <strong>for verification</strong> in payment history until an admin
                  reviews it{requiresProof ? "" : " and approves your COD request"}.
                </>
              )}
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
