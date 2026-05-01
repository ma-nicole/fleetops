"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import BookingService from "@/lib/bookingService";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import { formatPhp } from "@/lib/appLocale";

type BookingDetails = {
  truck?: {
    id?: string;
    name: string;
    capacity_tons: number;
    price_per_km: number;
  };
  service?: {
    id?: string;
    name: string;
    base_price: number;
  };
  pickupLocation?: string;
  dropoffLocation?: string;
  date?: string;
  estimatedDistance?: number;
};

export default function CheckoutPage() {
  useRoleGuard(["customer"]);
  const router = useRouter();

  const [bookingDetails, setBookingDetails] = useState<BookingDetails>({});
  const [pickupLocation, setPickupLocation] = useState("");
  const [dropoffLocation, setDropoffLocation] = useState("");
  const [shipmentDate, setShipmentDate] = useState("");
  const [cargoWeight, setCargoWeight] = useState("");
  const [cargoDescription, setCargoDescription] = useState("");
  const [estimatedDistance, setEstimatedDistance] = useState(100);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<
    "pickup" | "dropoff" | "date" | "weight" | "description" | "distance",
    string
  >>>({});

  useEffect(() => {
    if (typeof window !== "undefined") {
      const truck = window.localStorage.getItem("selectedTruck");
      const service = window.localStorage.getItem("selectedService");

      setBookingDetails({
        truck: truck ? JSON.parse(truck) : undefined,
        service: service ? JSON.parse(service) : undefined,
      });
    }
  }, []);

  const calculateTotal = () => {
    let total = bookingDetails.service?.base_price || 0;
    if (bookingDetails.truck) {
      total += (bookingDetails.truck.price_per_km * estimatedDistance);
    }
    return total.toFixed(2);
  };

  const todayIso = () => new Date().toISOString().split("T")[0];

  const validateForm = (): boolean => {
    const next: typeof fieldErrors = {};
    const p = pickupLocation.trim();
    const d = dropoffLocation.trim();

    if (!p || p.length < 3) next.pickup = "Enter a pickup address (at least 3 characters).";
    if (!d || d.length < 3) next.dropoff = "Enter a dropoff address (at least 3 characters).";
    if (p && d && p.toLowerCase() === d.toLowerCase()) {
      next.dropoff = "Pickup and dropoff must be different.";
    }
    if (!shipmentDate) next.date = "Choose a shipment date.";
    else if (shipmentDate < todayIso()) next.date = "Shipment date cannot be in the past.";

    const w = parseFloat(cargoWeight);
    if (!cargoWeight.trim() || Number.isNaN(w) || w <= 0) next.weight = "Enter cargo weight greater than zero (tons).";
    else if (w > 500) next.weight = "Weight looks too large. Enter a realistic value (tons).";

    if (!cargoDescription.trim() || cargoDescription.trim().length < 3) {
      next.description = "Describe the cargo (at least 3 characters).";
    }

    if (estimatedDistance < 1 || estimatedDistance > 20000) {
      next.distance = "Distance must be between 1 and 20,000 km.";
    }

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleProceedToPayment = () => {
    if (validateForm()) {
      // Get user ID from localStorage
      const userId = typeof window !== "undefined" ? localStorage.getItem("userId") || "customer-001" : "customer-001";
      
      // Create booking using BookingService (saves as "pending_approval")
      const booking = BookingService.createBooking(
        userId,
        pickupLocation,
        dropoffLocation,
        shipmentDate,
        cargoWeight,
        cargoDescription,
        parseFloat(calculateTotal()),
        bookingDetails.truck,
        bookingDetails.service
      );

      // Store booking ID in localStorage for reference
      if (typeof window !== "undefined") {
        localStorage.setItem("currentBookingId", booking.id);
        localStorage.setItem("bookingData", JSON.stringify(booking));
      }

      router.push("/booking/payment");
    }
  };

  const handleCancel = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("selectedTruck");
      window.localStorage.removeItem("selectedService");
    }
    router.push("/dashboard");
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "1000px", margin: "0 auto" }}>
      <div style={{ marginBottom: "2rem" }}>
        <Link href="/dashboard" style={{ color: "#FF9800", textDecoration: "none", fontWeight: 600 }}>
          ← Back to Dashboard
        </Link>
      </div>

      <h1 style={{ color: "#1A1A1A", marginBottom: "1rem" }}> Booking Confirmation</h1>
      <p style={{ color: "#666666", marginBottom: "2rem" }}>
        Review your booking details and enter shipment information
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "2rem" }}>
        {/* Booking Form */}
        <div>
          {/* Booking Summary */}
          <div style={{ padding: "1.5rem", border: "1px solid #E8E8E8", borderRadius: "8px", marginBottom: "2rem", background: "#F9F9F9" }}>
            <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Selected Services</h3>
            {bookingDetails.truck && (
              <p style={{ color: "#666666", margin: "0.5rem 0" }}>
                <strong>Truck:</strong> {bookingDetails.truck.name} ({bookingDetails.truck.capacity_tons}T)
              </p>
            )}
            {bookingDetails.service && (
              <p style={{ color: "#666666", margin: "0.5rem 0" }}>
                <strong>Service:</strong> {bookingDetails.service.name}
              </p>
            )}
          </div>

          {/* Shipment Details Form */}
          <form style={{ display: "grid", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem", color: "#1A1A1A" }}>
                Pickup Location *
              </label>
              <input
                type="text"
                placeholder="e.g., 123 Ayala Ave, Makati City"
                value={pickupLocation}
                onChange={(e) => {
                  setPickupLocation(e.target.value);
                  if (fieldErrors.pickup) setFieldErrors((f) => ({ ...f, pickup: undefined }));
                }}
                aria-invalid={!!fieldErrors.pickup}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: fieldErrors.pickup ? "2px solid #F44336" : "1px solid #E8E8E8",
                  borderRadius: "6px",
                  boxSizing: "border-box",
                }}
              />
              {fieldErrors.pickup && (
                <p role="alert" style={{ color: "#C62828", fontSize: "0.85rem", margin: "0.35rem 0 0 0" }}>{fieldErrors.pickup}</p>
              )}
            </div>

            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem", color: "#1A1A1A" }}>
                Dropoff Location *
              </label>
              <input
                type="text"
                placeholder="e.g., 456 Commonwealth Ave, Quezon City"
                value={dropoffLocation}
                onChange={(e) => {
                  setDropoffLocation(e.target.value);
                  if (fieldErrors.dropoff) setFieldErrors((f) => ({ ...f, dropoff: undefined }));
                }}
                aria-invalid={!!fieldErrors.dropoff}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: fieldErrors.dropoff ? "2px solid #F44336" : "1px solid #E8E8E8",
                  borderRadius: "6px",
                  boxSizing: "border-box",
                }}
              />
              {fieldErrors.dropoff && (
                <p role="alert" style={{ color: "#C62828", fontSize: "0.85rem", margin: "0.35rem 0 0 0" }}>{fieldErrors.dropoff}</p>
              )}
            </div>

            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem", color: "#1A1A1A" }}>
                Estimated Distance (km)
              </label>
              <input
                type="number"
                value={estimatedDistance}
                onChange={(e) => {
                  setEstimatedDistance(parseInt(e.target.value, 10) || 0);
                  if (fieldErrors.distance) setFieldErrors((f) => ({ ...f, distance: undefined }));
                }}
                aria-invalid={!!fieldErrors.distance}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: fieldErrors.distance ? "2px solid #F44336" : "1px solid #E8E8E8",
                  borderRadius: "6px",
                  boxSizing: "border-box",
                }}
              />
              {fieldErrors.distance && (
                <p role="alert" style={{ color: "#C62828", fontSize: "0.85rem", margin: "0.35rem 0 0 0" }}>{fieldErrors.distance}</p>
              )}
            </div>

            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem", color: "#1A1A1A" }}>
                Shipment Date *
              </label>
              <input
                type="date"
                value={shipmentDate}
                onChange={(e) => {
                  setShipmentDate(e.target.value);
                  if (fieldErrors.date) setFieldErrors((f) => ({ ...f, date: undefined }));
                }}
                aria-invalid={!!fieldErrors.date}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: fieldErrors.date ? "2px solid #F44336" : "1px solid #E8E8E8",
                  borderRadius: "6px",
                  boxSizing: "border-box",
                }}
              />
              {fieldErrors.date && (
                <p role="alert" style={{ color: "#C62828", fontSize: "0.85rem", margin: "0.35rem 0 0 0" }}>{fieldErrors.date}</p>
              )}
            </div>

            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem", color: "#1A1A1A" }}>
                Cargo Weight (tons) *
              </label>
              <input
                type="number"
                placeholder="0.0"
                value={cargoWeight}
                onChange={(e) => {
                  setCargoWeight(e.target.value);
                  if (fieldErrors.weight) setFieldErrors((f) => ({ ...f, weight: undefined }));
                }}
                aria-invalid={!!fieldErrors.weight}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: fieldErrors.weight ? "2px solid #F44336" : "1px solid #E8E8E8",
                  borderRadius: "6px",
                  boxSizing: "border-box",
                }}
              />
              {fieldErrors.weight && (
                <p role="alert" style={{ color: "#C62828", fontSize: "0.85rem", margin: "0.35rem 0 0 0" }}>{fieldErrors.weight}</p>
              )}
            </div>

            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem", color: "#1A1A1A" }}>
                Cargo Description *
              </label>
              <textarea
                placeholder="e.g., Electronics, furniture, raw materials, etc."
                value={cargoDescription}
                onChange={(e) => {
                  setCargoDescription(e.target.value);
                  if (fieldErrors.description) setFieldErrors((f) => ({ ...f, description: undefined }));
                }}
                aria-invalid={!!fieldErrors.description}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: fieldErrors.description ? "2px solid #F44336" : "1px solid #E8E8E8",
                  borderRadius: "6px",
                  boxSizing: "border-box",
                  minHeight: "80px",
                  fontFamily: "inherit",
                }}
              />
              {fieldErrors.description && (
                <p role="alert" style={{ color: "#C62828", fontSize: "0.85rem", margin: "0.35rem 0 0 0" }}>{fieldErrors.description}</p>
              )}
            </div>
          </form>

          {Object.keys(fieldErrors).length > 0 && (
            <div role="alert" style={{ padding: "1rem", background: "#FFEBEE", color: "#C62828", borderRadius: "6px", marginTop: "1rem" }}>
               Fix the highlighted fields before continuing.
            </div>
          )}
        </div>

        {/* Price Summary */}
        <div style={{ position: "sticky", top: "2rem" }}>
          <div style={{ padding: "1.5rem", border: "1px solid #E8E8E8", borderRadius: "8px", background: "#F9F9F9" }}>
            <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Order Summary</h3>

            <div style={{ marginBottom: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", color: "#666666" }}>
                <span>Service ({bookingDetails.service?.name}):</span>
                <span>{formatPhp(bookingDetails.service?.base_price || 0)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", color: "#666666" }}>
                <span>
                  Distance Charge ({estimatedDistance}km ×{" "}
                  {formatPhp(bookingDetails.truck?.price_per_km || 0)}
                  /km):
                </span>
                <span>{formatPhp(estimatedDistance * (bookingDetails.truck?.price_per_km || 0))}</span>
              </div>
            </div>

            <div style={{ borderTop: "1px solid #E8E8E8", paddingTop: "1rem", marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong style={{ color: "#1A1A1A" }}>Total:</strong>
                <strong style={{ color: "#FF9800", fontSize: "1.5rem" }}>{formatPhp(parseFloat(calculateTotal()))}</strong>
              </div>
            </div>

            <div style={{ display: "grid", gap: "0.75rem" }}>
              <button
                onClick={handleProceedToPayment}
                style={{
                  padding: "0.75rem",
                  background: "#FF9800",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Proceed to Payment →
              </button>
              <button
                onClick={handleCancel}
                style={{
                  padding: "0.75rem",
                  background: "#F5F5F5",
                  color: "#1A1A1A",
                  border: "1px solid #E8E8E8",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Cancel Booking
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
