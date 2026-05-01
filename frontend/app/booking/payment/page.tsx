"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";

type BookingData = {
  bookingId: number;
  truck: any;
  service: any;
  pickupLocation: string;
  dropoffLocation: string;
  shipmentDate: string;
  cargoWeight: string;
  cargoDescription: string;
  totalCost: number;
  createdAt: string;
};

export default function PaymentPage() {
  useRoleGuard(["customer"]);
  const router = useRouter();

  const [bookingData, setBookingData] = useState<BookingData | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("credit_card");
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [cvv, setCvv] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (typeof window !== "undefined") {
      const data = window.localStorage.getItem("bookingData");
      if (data) {
        setBookingData(JSON.parse(data));
      } else {
        router.push("/dashboard");
      }
    }
  }, [router]);

  const validatePayment = () => {
    const newErrors: { [key: string]: string } = {};

    if (!cardName.trim()) newErrors.cardName = "Name is required";
    if (!cardNumber.replace(/\s/g, "").match(/^\d{13,19}$/)) newErrors.cardNumber = "Invalid card number";
    if (!expiryDate.match(/^\d{2}\/\d{2}$/)) newErrors.expiryDate = "Use MM/YY format";
    if (!cvv.match(/^\d{3,4}$/)) newErrors.cvv = "Invalid CVV";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePayment = async () => {
    if (!validatePayment()) {
      setShowErrors(true);
      return;
    }

    setIsProcessing(true);

    // Simulate payment processing
    setTimeout(() => {
      if (bookingData) {
        const completedBooking = {
          ...bookingData,
          status: "paid",
          paymentMethod,
          paymentDate: new Date().toISOString(),
          paymentId: Math.floor(100000 + Math.random() * 900000),
        };

        if (typeof window !== "undefined") {
          window.localStorage.setItem("completedBooking", JSON.stringify(completedBooking));
          window.localStorage.removeItem("selectedTruck");
          window.localStorage.removeItem("selectedService");
          window.localStorage.removeItem("bookingData");
        }

        // Simulate email feedback
        console.log(" Email sent to customer:", completedBooking.bookingId);

        router.push("/booking/receipt");
      }
      setIsProcessing(false);
    }, 2000);
  };

  if (!bookingData) {
    return <div style={{ padding: "2rem" }}>Loading...</div>;
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "900px", margin: "0 auto" }}>
      <div style={{ marginBottom: "2rem" }}>
        <Link href="/dashboard" style={{ color: "#FF9800", textDecoration: "none", fontWeight: 600 }}>
          ← Back to Dashboard
        </Link>
      </div>

      <h1 style={{ color: "#1A1A1A", marginBottom: "1rem" }}> Payment</h1>
      <p style={{ color: "#666666", marginBottom: "2rem" }}>
        Complete your payment to confirm your booking
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "2rem" }}>
        {/* Payment Form */}
        <div>
          {/* Booking Summary */}
          <div style={{ padding: "1.5rem", border: "1px solid #E8E8E8", borderRadius: "8px", marginBottom: "2rem", background: "#F9F9F9" }}>
            <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Booking Summary</h3>
            <p style={{ color: "#666666", margin: "0.5rem 0" }}>
              <strong>Booking ID:</strong> #{bookingData.bookingId}
            </p>
            <p style={{ color: "#666666", margin: "0.5rem 0" }}>
              <strong>From:</strong> {bookingData.pickupLocation}
            </p>
            <p style={{ color: "#666666", margin: "0.5rem 0" }}>
              <strong>To:</strong> {bookingData.dropoffLocation}
            </p>
            <p style={{ color: "#666666", margin: "0.5rem 0" }}>
              <strong>Date:</strong> {bookingData.shipmentDate}
            </p>
            <p style={{ color: "#FF9800", fontWeight: 600, margin: "1rem 0 0 0" }}>
              Amount: ${bookingData.totalCost.toFixed(2)}
            </p>
          </div>

          {/* Payment Method Selection */}
          <div style={{ marginBottom: "2rem" }}>
            <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Payment Method</h3>
            <div style={{ display: "grid", gap: "1rem" }}>
              <label style={{ display: "flex", alignItems: "center", padding: "1rem", border: "1px solid #E8E8E8", borderRadius: "6px", cursor: "pointer", background: paymentMethod === "credit_card" ? "rgba(255, 152, 0, 0.1)" : "#FFFFFF" }}>
                <input
                  type="radio"
                  name="payment"
                  value="credit_card"
                  checked={paymentMethod === "credit_card"}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  style={{ marginRight: "1rem" }}
                />
                <div>
                  <strong style={{ color: "#1A1A1A" }}> Credit/Debit Card</strong>
                  <p style={{ color: "#999", fontSize: "0.85rem", margin: "0.25rem 0 0 0" }}>
                    Visa, Mastercard, American Express
                  </p>
                </div>
              </label>

              <label style={{ display: "flex", alignItems: "center", padding: "1rem", border: "1px solid #E8E8E8", borderRadius: "6px", cursor: "pointer", background: paymentMethod === "bank_transfer" ? "rgba(255, 152, 0, 0.1)" : "#FFFFFF" }}>
                <input
                  type="radio"
                  name="payment"
                  value="bank_transfer"
                  checked={paymentMethod === "bank_transfer"}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  style={{ marginRight: "1rem" }}
                />
                <div>
                  <strong style={{ color: "#1A1A1A" }}> Bank Transfer</strong>
                  <p style={{ color: "#999", fontSize: "0.85rem", margin: "0.25rem 0 0 0" }}>
                    Direct bank account transfer
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Card Details Form */}
          {paymentMethod === "credit_card" && (
            <div style={{ display: "grid", gap: "1rem", padding: "1.5rem", border: "1px solid #E8E8E8", borderRadius: "8px", background: "#F9F9F9" }}>
              <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Card Details</h3>

              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem", color: "#1A1A1A" }}>
                  Cardholder Name *
                </label>
                <input
                  type="text"
                  placeholder="John Doe"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: errors.cardName ? "2px solid #F44336" : "1px solid #E8E8E8",
                    borderRadius: "6px",
                    boxSizing: "border-box",
                  }}
                />
                {errors.cardName && <p style={{ color: "#F44336", fontSize: "0.85rem", margin: "0.25rem 0 0 0" }}>{errors.cardName}</p>}
              </div>

              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem", color: "#1A1A1A" }}>
                  Card Number *
                </label>
                <input
                  type="text"
                  placeholder="1234 5678 9012 3456"
                  value={cardNumber}
                  onChange={(e) => {
                    let value = e.target.value.replace(/\s/g, "");
                    let formatted = value.match(/.{1,4}/g)?.join(" ") || value;
                    setCardNumber(formatted);
                  }}
                  maxLength={19}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: errors.cardNumber ? "2px solid #F44336" : "1px solid #E8E8E8",
                    borderRadius: "6px",
                    boxSizing: "border-box",
                    fontFamily: "monospace",
                  }}
                />
                {errors.cardNumber && <p style={{ color: "#F44336", fontSize: "0.85rem", margin: "0.25rem 0 0 0" }}>{errors.cardNumber}</p>}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem", color: "#1A1A1A" }}>
                    Expiry Date (MM/YY) *
                  </label>
                  <input
                    type="text"
                    placeholder="12/25"
                    value={expiryDate}
                    onChange={(e) => {
                      let value = e.target.value.replace(/\D/g, "");
                      if (value.length >= 2) {
                        value = value.slice(0, 2) + "/" + value.slice(2, 4);
                      }
                      setExpiryDate(value);
                    }}
                    maxLength={5}
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      border: errors.expiryDate ? "2px solid #F44336" : "1px solid #E8E8E8",
                      borderRadius: "6px",
                      boxSizing: "border-box",
                    }}
                  />
                  {errors.expiryDate && <p style={{ color: "#F44336", fontSize: "0.85rem", margin: "0.25rem 0 0 0" }}>{errors.expiryDate}</p>}
                </div>

                <div>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem", color: "#1A1A1A" }}>
                    CVV *
                  </label>
                  <input
                    type="text"
                    placeholder="123"
                    value={cvv}
                    onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    maxLength={4}
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      border: errors.cvv ? "2px solid #F44336" : "1px solid #E8E8E8",
                      borderRadius: "6px",
                      boxSizing: "border-box",
                      fontFamily: "monospace",
                    }}
                  />
                  {errors.cvv && <p style={{ color: "#F44336", fontSize: "0.85rem", margin: "0.25rem 0 0 0" }}>{errors.cvv}</p>}
                </div>
              </div>
            </div>
          )}

          {paymentMethod === "bank_transfer" && (
            <div style={{ padding: "1.5rem", border: "1px solid #E8E8E8", borderRadius: "8px", background: "#F9F9F9" }}>
              <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Bank Transfer Details</h3>
              <p style={{ color: "#666666", margin: "0.5rem 0" }}>
                <strong>Bank:</strong> FLEETOPS Financial Bank
              </p>
              <p style={{ color: "#666666", margin: "0.5rem 0" }}>
                <strong>Account:</strong> 1234567890
              </p>
              <p style={{ color: "#666666", margin: "0.5rem 0" }}>
                <strong>Routing:</strong> 987654321
              </p>
              <p style={{ color: "#FF9800", fontWeight: 600, margin: "1rem 0 0 0" }}>
                Amount to Transfer: ${bookingData.totalCost.toFixed(2)}
              </p>
            </div>
          )}
        </div>

        {/* Price Summary */}
        <div style={{ position: "sticky", top: "2rem" }}>
          <div style={{ padding: "1.5rem", border: "1px solid #E8E8E8", borderRadius: "8px", background: "#F9F9F9" }}>
            <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Payment Summary</h3>

            <div style={{ marginBottom: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", color: "#666666" }}>
                <span>Service:</span>
                <span>${bookingData.service.base_price}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", color: "#666666" }}>
                <span>Distance Charge:</span>
                <span>${(bookingData.totalCost - bookingData.service.base_price).toFixed(2)}</span>
              </div>
            </div>

            <div style={{ borderTop: "1px solid #E8E8E8", paddingTop: "1rem", marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong style={{ color: "#1A1A1A" }}>Total:</strong>
                <strong style={{ color: "#FF9800", fontSize: "1.5rem" }}>${bookingData.totalCost.toFixed(2)}</strong>
              </div>
            </div>

            <button
              onClick={handlePayment}
              disabled={isProcessing}
              style={{
                width: "100%",
                padding: "0.75rem",
                background: isProcessing ? "#CCC" : "#FF9800",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: isProcessing ? "not-allowed" : "pointer",
                fontWeight: 600,
              }}
            >
              {isProcessing ? "Processing Payment..." : "Complete Payment"}
            </button>

            <div style={{ fontSize: "0.85rem", color: "#999", marginTop: "1rem", textAlign: "center" }}>
               Your payment is secure and encrypted
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
