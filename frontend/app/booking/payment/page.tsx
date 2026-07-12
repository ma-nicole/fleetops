"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import PaymentMethodInstructions from "@/components/PaymentMethodInstructions";
import CustomerDocumentReviewSection from "@/components/CustomerDocumentReviewSection";
import XenditPaymentCard from "@/components/XenditPaymentCard";
import LoadingMessage from "@/components/ui/LoadingMessage";
import SubmitButton from "@/components/ui/SubmitButton";
import ErrorState from "@/components/ui/ErrorState";
import { ApiError } from "@/lib/api";
import { ERROR_LOAD_DATA, LOADING_AUTH_RESTORE } from "@/lib/loadingMessages";
import { formatPhp } from "@/lib/appLocale";
import {
  formatPaymentMethodLabel,
  getBookingPaymentOptions,
  isXenditMethod,
  paymentMethodRequiresProof,
  type CustomerPaymentMethod,
} from "@/lib/paymentMethodOptions";
import { paymentDisplayStatus, transactionReference } from "@/lib/paymentDisplayStatus";
import {
  GCASH_MAX_TRANSACTION_PHP,
  gcashAmountExceedsLimit,
} from "@/lib/paymentLimits";
import { useRoleGuard } from "@/lib/useRoleGuard";
import { WorkflowApi, type Booking, type Payment, type XenditPaymentSession } from "@/lib/workflowApi";

function applyXenditSession(
  session: XenditPaymentSession,
  setters: {
    setXenditQrString: (v: string | null) => void;
    setXenditStatus: (v: string | null) => void;
    setXenditPayment: (v: Payment | null) => void;
    setExistingPayments: (v: Payment[]) => void;
  },
) {
  setters.setXenditQrString(session.qr_string ?? session.payment.xendit_qr_string ?? null);
  setters.setXenditStatus(session.xendit_status ?? session.payment.xendit_status ?? "PENDING");
  setters.setXenditPayment(session.payment);
  setters.setExistingPayments([session.payment]);
}

const PAYMENT_FLOW_STEPS = [
  "Booking Created",
  "Review Booking",
  "Proceed to Payment",
  "Xendit Payment",
  "Payment Verification",
  "Booking Cleared For Dispatch",
];

function paymentProgressIndex({
  booking,
  latestPayment,
  xenditCheckout,
  xenditStatus,
}: {
  booking: Booking | null;
  latestPayment: Payment | null;
  xenditCheckout: boolean;
  xenditStatus: string | null;
}): number {
  if (!booking) return 0;
  if (booking.status === "payment_verified" || latestPayment?.status === "verified") return 5;
  if (xenditCheckout && (xenditStatus || "").toUpperCase() === "PENDING") return 3;
  if (latestPayment?.status === "for_verification") return 4;
  if (latestPayment?.status === "rejected") return 2;
  if (xenditCheckout || latestPayment) return 3;
  return 2;
}

function PaymentProgress({
  booking,
  latestPayment,
  xenditCheckout,
  xenditStatus,
}: {
  booking: Booking | null;
  latestPayment: Payment | null;
  xenditCheckout: boolean;
  xenditStatus: string | null;
}) {
  const currentIndex = paymentProgressIndex({ booking, latestPayment, xenditCheckout, xenditStatus });
  return (
    <div style={{ padding: "1rem", border: "1px solid #DBEAFE", borderRadius: 8, background: "#EFF6FF" }}>
      <h3 style={{ color: "#1A1A1A", margin: "0 0 0.75rem" }}>Payment progress</h3>
      <div style={{ display: "grid", gap: "0.5rem" }}>
        {PAYMENT_FLOW_STEPS.map((step, index) => {
          const done = index < currentIndex || (currentIndex === PAYMENT_FLOW_STEPS.length - 1 && index === currentIndex);
          const current = index === currentIndex && !done;
          return (
            <div key={step} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.86rem" }}>
              <span
                aria-hidden="true"
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  display: "inline-grid",
                  placeItems: "center",
                  flexShrink: 0,
                  fontSize: "0.72rem",
                  fontWeight: 800,
                  background: done ? "#16A34A" : current ? "#2563EB" : "#DBEAFE",
                  color: done || current ? "white" : "#1E40AF",
                }}
              >
                {done ? "OK" : index + 1}
              </span>
              <span style={{ fontWeight: current ? 700 : 500, color: done ? "#166534" : "#1E3A8A" }}>{step}</span>
            </div>
          );
        })}
      </div>
      <p style={{ margin: "0.75rem 0 0", fontSize: "0.82rem", color: "#1E40AF", lineHeight: 1.45 }}>
        Xendit online payments verify automatically via webhook. Cash payments are confirmed by admin when received.
        Legacy manual methods stay for verification until an admin approves the proof.
      </p>
    </div>
  );
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
  const [xenditPayment, setXenditPayment] = useState<Payment | null>(null);
  const [xenditLoading, setXenditLoading] = useState(false);
  const [xenditError, setXenditError] = useState<string | null>(null);

  const bookingId = bookingIdRaw ? Number.parseInt(bookingIdRaw, 10) : NaN;

  const latestPayment = useMemo(() => {
    if (!existingPayments.length) return null;
    return [...existingPayments].sort((a, b) => b.id - a.id)[0];
  }, [existingPayments]);

  const paymentVerified =
    latestPayment?.status === "verified" || booking?.status === "payment_verified";
  const pendingCash =
    latestPayment?.method === "cash" && latestPayment.status === "for_verification";

  /** Proof/manual upload path: block when any non-rejected payment exists. */
  const canSubmitPayment = !latestPayment || latestPayment.status === "rejected";
  /** Cash can supersede a pending Xendit session; block only when verified or cash already pending. */
  const canSubmitCash = !paymentVerified && !pendingCash;
  /** Xendit must not start when cash is awaiting admin confirmation. */
  const canStartXendit = !paymentVerified && !pendingCash;

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
  const paymentOptions = useMemo(
    () => getBookingPaymentOptions(xenditEnabled, gcashBlocked),
    [xenditEnabled, gcashBlocked],
  );
  const isXenditCheckout = xenditEnabled && isXenditMethod(method);
  const isCashMethod = method === "cash";
  const requiresProof = paymentMethodRequiresProof(method, xenditEnabled);
  const canSubmit = canSubmitPayment && (requiresProof ? !!selectedFile : true);
  const xenditPaid =
    (xenditStatus || "").toUpperCase() === "PAID" ||
    latestPayment?.status === "verified" ||
    booking?.status === "payment_verified";

  const sessionSetters = useMemo(
    () => ({
      setXenditQrString,
      setXenditStatus,
      setXenditPayment,
      setExistingPayments,
    }),
    [],
  );

  const handlePaymentVerified = useCallback(() => {
    setUploadSuccess(true);
    window.setTimeout(
      () => router.push(`/modules/operations/trips?booking=${bookingId}`),
      1500,
    );
  }, [router, bookingId]);

  const refreshXenditSession = useCallback(async () => {
    if (!Number.isFinite(bookingId) || bookingId <= 0 || !isXenditMethod(method)) return;
    setXenditLoading(true);
    setXenditError(null);
    try {
      const session = await WorkflowApi.createXenditSession(bookingId, method);
      applyXenditSession(session, sessionSetters);
      const pays = await WorkflowApi.bookingPayments(bookingId).catch(() => [] as Payment[]);
      if (pays.length) setExistingPayments(pays);
      if ((session.xendit_status || "").toUpperCase() === "PAID" || session.payment.status === "verified") {
        handlePaymentVerified();
      }
    } catch (e) {
      setXenditError(e instanceof Error ? e.message : "Unable to start Xendit payment.");
    } finally {
      setXenditLoading(false);
    }
  }, [bookingId, method, sessionSetters, handlePaymentVerified]);

  const pollXenditSession = useCallback(async () => {
    if (!Number.isFinite(bookingId) || bookingId <= 0) return;
    try {
      const session = await WorkflowApi.getXenditSession(bookingId);
      applyXenditSession(session, sessionSetters);
      const pays = await WorkflowApi.bookingPayments(bookingId).catch(() => [] as Payment[]);
      if (pays.length) setExistingPayments(pays);
      if ((session.xendit_status || "").toUpperCase() === "PAID" || session.payment.status === "verified") {
        handlePaymentVerified();
      }
    } catch {
      /* session may not exist yet */
    }
  }, [bookingId, sessionSetters, handlePaymentVerified]);

  useEffect(() => {
    if (!ready || !allowed) return;
    void loadBooking();
    void WorkflowApi.xenditConfig()
      .then((cfg) => {
        setXenditEnabled(cfg.enabled);
        // Keep customer method choice (including cash). Default state is already gcash.
      })
      .catch(() => setXenditEnabled(false));
  }, [ready, allowed, loadBooking]);

  useEffect(() => {
    if (pendingCash && method !== "cash") {
      setMethod("cash");
    }
  }, [pendingCash, method]);

  useEffect(() => {
    if (!isXenditCheckout || !booking || pageLoading) return;
    if (!canStartXendit) return;
    if (latestPayment?.status === "verified" || booking.status === "payment_verified") return;
    void refreshXenditSession();
  }, [
    isXenditCheckout,
    method,
    booking,
    pageLoading,
    canStartXendit,
    latestPayment?.status,
    booking?.status,
    refreshXenditSession,
  ]);

  useEffect(() => {
    if (!isXenditCheckout || xenditPaid || !canStartXendit) return;
    const timer = window.setInterval(() => {
      void pollXenditSession();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [isXenditCheckout, xenditPaid, canStartXendit, pollXenditSession]);

  useEffect(() => {
    if (pendingCash) return;
    if (gcashBlocked && method === "gcash") {
      setMethod(xenditEnabled ? "card" : "bank");
    }
  }, [gcashBlocked, method, xenditEnabled, pendingCash]);

  const handleConfirmCash = async () => {
    if (!Number.isFinite(bookingId)) return;
    if (!window.confirm("Confirm cash payment for this booking? An admin will mark the payment as received when you pay in cash.")) {
      return;
    }
    setIsUploading(true);
    setUploadError("");
    try {
      const payment = await WorkflowApi.createCashSession(bookingId);
      setExistingPayments([payment]);
      setXenditQrString(null);
      setXenditStatus(null);
      setXenditPayment(null);
      setXenditError(null);
      setUploadSuccess(true);
      window.setTimeout(
        () => router.push(`/modules/operations/trips?booking=${bookingId}`),
        1200,
      );
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Unable to record cash payment.");
    } finally {
      setIsUploading(false);
    }
  };

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
    if (isXenditMethod(method) && xenditEnabled) {
      setUploadError("Online payments are processed through Xendit on this page — proof upload is not required.");
      return;
    }
    if (requiresProof && !selectedFile) {
      setUploadError("Please upload a proof file for this payment method.");
      return;
    }

    const confirmMessage = requiresProof
      ? "Submit this payment proof for verification? You cannot submit another proof unless this one is rejected."
      : "Confirm this COD request? FleetOps will send the payment request for admin review before dispatch.";
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setIsUploading(true);
    setUploadError("");

    try {
      await WorkflowApi.submitPaymentProof(bookingId, method, selectedFile);
      setUploadSuccess(true);
      const pays = await WorkflowApi.bookingPayments(bookingId).catch(() => [] as Payment[]);
      setExistingPayments(pays);
      window.setTimeout(() => {
        router.push(`/modules/operations/trips?booking=${bookingId}`);
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
        Choose how you want to pay. Online methods use Xendit checkout and verify automatically. Cash payments are
        confirmed by FleetOps staff — no proof upload required.
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
            <CustomerDocumentReviewSection booking={booking} onUpdated={(updated) => setBooking(updated)} />
          </section>

          <section>
            {gcashBlocked && xenditEnabled && (
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
                maximum of {formatPhp(GCASH_MAX_TRANSACTION_PHP)} per transaction. Please use card or bank transfer
                instead.
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
                  setXenditError(null);
                }}
                disabled={paymentVerified || pendingCash}
              >
                {paymentOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            {paymentOptions.find((o) => o.value === method)?.description ? (
              <p style={{ margin: "0 0 1rem", fontSize: "0.88rem", color: "#6B7280", lineHeight: 1.45 }}>
                {paymentOptions.find((o) => o.value === method)?.description}
              </p>
            ) : null}
          </section>

          {isXenditCheckout && canStartXendit ? (
            <XenditPaymentCard
              bookingId={booking.id}
              amount={total}
              pickup={booking.pickup_location}
              dropoff={booking.dropoff_location}
              scheduledDate={String(booking.scheduled_date)}
              qrString={xenditQrString}
              xenditStatus={xenditStatus}
              payment={xenditPayment ?? latestPayment}
              checkoutMethod={method}
              loading={xenditLoading}
              error={xenditError}
              onRetry={() => void refreshXenditSession()}
            />
          ) : null}

          {isXenditCheckout && !canStartXendit ? (
            <section style={{ padding: "1rem", border: "1px solid #FCD34D", borderRadius: 8, background: "#FFFBEB" }}>
              <p style={{ margin: 0, color: "#92400E", fontSize: "0.9rem" }}>
                {pendingCash
                  ? "Cash payment is awaiting admin confirmation. Online Xendit checkout is paused for this booking."
                  : "Payment is already verified for this booking."}
              </p>
            </section>
          ) : null}

          {isCashMethod ? (
            <section style={{ padding: "1.5rem", border: "2px dashed var(--accent)", borderRadius: "8px", background: "#FFFBF0" }}>
              <h3 style={{ color: "#1A1A1A", marginTop: 0, marginBottom: "1rem" }}>Cash payment</h3>
              {pendingCash && latestPayment ? (
                <p style={{ color: "#047857", fontSize: "0.9rem", marginBottom: "1rem", fontWeight: 600 }}>
                  Cash payment recorded ({paymentDisplayStatus(latestPayment)}). Waiting for admin to mark cash as
                  received — Xendit is not used for cash.
                </p>
              ) : paymentVerified ? (
                <p style={{ color: "#047857", fontSize: "0.9rem", marginBottom: "1rem", fontWeight: 600 }}>
                  Payment already verified for this booking.
                </p>
              ) : (
                <p style={{ margin: "0 0 1rem", fontSize: "0.9rem", color: "#374151", lineHeight: 1.5 }}>
                  Pay the exact amount in cash to FleetOps staff. Your booking stays in{" "}
                  <strong>Awaiting Cash Payment</strong> until an authorized admin marks it as received. Selecting cash
                  does not open Xendit.
                </p>
              )}
              {uploadError ? (
                <div style={{ padding: "0.75rem", background: "#FEE2E2", color: "#991B1B", borderRadius: "6px", marginBottom: "1rem", fontSize: "0.9rem" }}>
                  {uploadError}
                </div>
              ) : null}
              {uploadSuccess ? (
                <div style={{ padding: "0.75rem", background: "#D1FAE5", color: "#047857", borderRadius: "6px", marginBottom: "1rem", fontSize: "0.9rem" }}>
                  ✓ Cash payment recorded. Taking you to booking progress tracking…
                </div>
              ) : null}
              <SubmitButton
                type="button"
                className=""
                onClick={() => void handleConfirmCash()}
                busy={isUploading}
                busyLabel="Recording…"
                label="Confirm cash payment"
                disabled={!canSubmitCash || uploadSuccess}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  background: canSubmitCash && !isUploading && !uploadSuccess ? "#10B981" : "#D1D5DB",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: 600,
                }}
              />
            </section>
          ) : null}

          {!isXenditCheckout && !isCashMethod ? (
            <>
              <PaymentMethodInstructions
                method={method}
                bookingId={booking.id}
                total={total}
                gcashBlocked={gcashBlocked}
                xenditEnabled={false}
              />

              <section style={{ padding: "1.5rem", border: "2px dashed var(--accent)", borderRadius: "8px", background: "#EFF6FF" }}>
                <h3 style={{ color: "#1A1A1A", marginTop: 0, marginBottom: "1rem" }}>
                  {requiresProof ? "Upload proof of payment" : "Confirm payment request"}
                </h3>
                {!canSubmitPayment && latestPayment ? (
                  <p style={{ color: "#047857", fontSize: "0.9rem", marginBottom: "1rem", fontWeight: 600 }}>
                    Payment already submitted ({paymentDisplayStatus(latestPayment)}).
                  </p>
                ) : null}

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
                    ✓ Proof submitted. Taking you to booking progress tracking…
                  </div>
                )}

                {requiresProof ? (
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
                      disabled={isUploading || uploadSuccess || !canSubmitPayment}
                      style={{ display: "none" }}
                      id="file-upload"
                    />
                    <label htmlFor="file-upload" style={{ display: "block", cursor: "pointer", color: "var(--accent)" }}>
                      <p style={{ margin: "0 0 0.25rem 0", fontWeight: 600, color: "#1A1A1A" }}>Choose file</p>
                      <p style={{ margin: 0, fontSize: "0.85rem", color: "#666666" }}>{fileName || "No file selected"}</p>
                    </label>
                  </div>
                ) : null}

                <SubmitButton
                  type="button"
                  className=""
                  onClick={() => void handleUploadProof()}
                  busy={isUploading}
                  busyLabel="Submitting…"
                  label={requiresProof ? "Submit proof" : "Confirm COD request"}
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
              </section>
            </>
          ) : null}

          {isXenditCheckout && uploadSuccess ? (
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
              ✓ Payment received. Taking you to booking progress tracking…
            </div>
          ) : null}
        </div>

        <aside style={{ position: "sticky", top: "2rem", alignSelf: "start" }}>
          <div style={{ display: "grid", gap: "1rem" }}>
          <PaymentProgress
            booking={booking}
            latestPayment={xenditPayment ?? latestPayment}
            xenditCheckout={isXenditCheckout}
            xenditStatus={xenditStatus}
          />
          <div style={{ padding: "1.5rem", border: "1px solid #E8E8E8", borderRadius: "8px", background: "#F9F9F9" }}>
            <h3 style={{ color: "#1A1A1A", marginTop: 0 }}>Status</h3>
            {(xenditPayment ?? latestPayment) ? (
              <div style={{ marginBottom: "0.85rem", fontSize: "0.88rem", color: "#374151", display: "grid", gap: "0.35rem" }}>
                <p style={{ margin: 0 }}>
                  <strong>Payment reference:</strong> {transactionReference(xenditPayment ?? latestPayment!)}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Method:</strong> {formatPaymentMethodLabel((xenditPayment ?? latestPayment)!.method)}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Amount:</strong> {formatPhp((xenditPayment ?? latestPayment)!.amount)}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Status:</strong>{" "}
                  {paymentDisplayStatus(xenditPayment ?? latestPayment!)}
                </p>
                {(xenditPayment ?? latestPayment)?.verified_by_name ? (
                  <p style={{ margin: 0 }}>
                    <strong>Verified by:</strong> {(xenditPayment ?? latestPayment)!.verified_by_name}
                  </p>
                ) : null}
              </div>
            ) : null}
            <p style={{ margin: 0, color: "#6B7280", fontSize: "0.9rem" }}>
              {isXenditCheckout ? (
                <>
                  Xendit payments are confirmed automatically via webhook. Your booking moves to{" "}
                  <strong>payment verified</strong> once paid.
                </>
              ) : isCashMethod ? (
                <>
                  Cash payments stay in <strong>Awaiting Cash Payment</strong> until an admin marks cash as received.
                </>
              ) : (
                <>
                  After you submit, status shows as <strong>for verification</strong> until an admin reviews it.
                </>
              )}
            </p>
            {booking ? (
              <p style={{ margin: "0.85rem 0 0" }}>
                <Link
                  href={`/modules/operations/trips?booking=${booking.id}`}
                  style={{ color: "#92400E", fontWeight: 700, fontSize: "0.9rem" }}
                >
                  Monitor booking progress →
                </Link>
              </p>
            ) : null}
          </div>
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
