"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";

type BookingForRating = {
  bookingId: number;
  truck: any;
  service: any;
  pickupLocation: string;
  dropoffLocation: string;
  cargoWeight: string;
  totalCost: number;
};

export default function RatingPage() {
  useRoleGuard(["customer"]);
  const router = useRouter();

  const [booking, setBooking] = useState<BookingForRating | null>(null);
  const [stars, setStars] = useState(0);
  const [hoverStars, setHoverStars] = useState(0);
  const [driverQuality, setDriverQuality] = useState(0);
  const [vehicleCondition, setVehicleCondition] = useState(0);
  const [timeliness, setTimeliness] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const data = window.localStorage.getItem("completedBooking");
      if (data) {
        setBooking(JSON.parse(data));
      }
    }
  }, []);

  const handleSubmit = () => {
    if (stars === 0) {
      alert("Please provide an overall rating");
      return;
    }

    setIsSubmitting(true);

    // Simulate rating submission
    setTimeout(() => {
      if (typeof window !== "undefined") {
        const ratingData = {
          bookingId: booking?.bookingId,
          overallRating: stars,
          driverQuality,
          vehicleCondition,
          timeliness,
          feedback,
          submittedAt: new Date().toISOString(),
        };

        const existingRatings = window.localStorage.getItem("ratings");
        const ratings = existingRatings ? JSON.parse(existingRatings) : [];
        ratings.push(ratingData);
        window.localStorage.setItem("ratings", JSON.stringify(ratings));
      }

      setIsSubmitting(false);
      setSubmitted(true);
    }, 1500);
  };

  if (!booking) {
    return <div style={{ padding: "2rem", textAlign: "center" }}>Loading...</div>;
  }

  if (submitted) {
    return (
      <div style={{ padding: "2rem", maxWidth: "600px", margin: "0 auto" }}>
        <div style={{ padding: "2rem", background: "rgba(76, 175, 80, 0.15)", border: "2px solid #4CAF50", borderRadius: "8px", marginBottom: "2rem", textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🙏</div>
          <h1 style={{ color: "#4CAF50", margin: "0 0 0.5rem 0" }}>Thank You!</h1>
          <p style={{ color: "#666666", margin: "0" }}>
            Your feedback helps us improve our service
          </p>
        </div>

        <div style={{ padding: "1.5rem", border: "1px solid #E8E8E8", borderRadius: "8px", background: "#F9F9F9", marginBottom: "2rem" }}>
          <h3 style={{ color: "#1A1A1A", marginBottom: "1rem" }}>Your Rating</h3>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ fontSize: "2.5rem" }}>⭐</div>
            <div>
              <p style={{ color: "#FF9800", fontWeight: 700, fontSize: "1.5rem", margin: "0" }}>
                {stars}.0 / 5.0
              </p>
              <p style={{ color: "#666666", margin: "0.25rem 0 0 0" }}>
                Overall rating submitted
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: "1rem" }}>
          <Link
            href="/dashboard"
            style={{
              padding: "0.75rem",
              background: "#FF9800",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: 600,
              textDecoration: "none",
              textAlign: "center",
            }}
          >
            Back to Dashboard
          </Link>
          <Link
            href="/booking/trucks"
            style={{
              padding: "0.75rem",
              background: "#F5F5F5",
              color: "#1A1A1A",
              border: "1px solid #E8E8E8",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: 600,
              textDecoration: "none",
              textAlign: "center",
            }}
          >
            Book Again
          </Link>
        </div>
      </div>
    );
  }

  const StarRating = ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: number;
    onChange: (v: number) => void;
  }) => (
    <div style={{ marginBottom: "1.5rem" }}>
      <p style={{ color: "#1A1A1A", fontWeight: 600, marginBottom: "0.5rem" }}>
        {label}
      </p>
      <div style={{ display: "flex", gap: "0.5rem", fontSize: "1.5rem" }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => onChange(star)}
            onMouseEnter={() => {}}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              opacity: star <= value ? 1 : 0.3,
              transform: star <= value ? "scale(1.15)" : "scale(1)",
              transition: "all 0.2s",
            }}
          >
            ⭐
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ padding: "2rem", maxWidth: "700px", margin: "0 auto" }}>
      <div style={{ marginBottom: "2rem" }}>
        <Link href="/dashboard" style={{ color: "#FF9800", textDecoration: "none", fontWeight: 600 }}>
          ← Back to Dashboard
        </Link>
      </div>

      <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem" }}>⭐ Rate Your Experience</h1>
      <p style={{ color: "#666666", marginBottom: "2rem" }}>
        Help us improve by rating your recent booking
      </p>

      {/* Booking Summary */}
      <div style={{ padding: "1.5rem", border: "1px solid #E8E8E8", borderRadius: "8px", background: "#F9F9F9", marginBottom: "2rem" }}>
        <h3 style={{ color: "#1A1A1A", marginBottom: "1rem", fontSize: "0.95rem" }}>
          Booking #{booking.bookingId}
        </h3>
        <div style={{ display: "grid", gap: "0.5rem", fontSize: "0.9rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#666666" }}>From:</span>
            <span style={{ color: "#1A1A1A", fontWeight: 600 }}>
              {booking.pickupLocation}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#666666" }}>To:</span>
            <span style={{ color: "#1A1A1A", fontWeight: 600 }}>
              {booking.dropoffLocation}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#666666" }}>Service:</span>
            <span style={{ color: "#1A1A1A", fontWeight: 600 }}>
              {booking.service.name}
            </span>
          </div>
        </div>
      </div>

      {/* Rating Form */}
      <form style={{ display: "grid", gap: "1.5rem" }}>
        {/* Overall Rating */}
        <div>
          <p style={{ color: "#1A1A1A", fontWeight: 600, marginBottom: "0.75rem", fontSize: "1rem" }}>
            Overall Experience *
          </p>
          <div style={{ display: "flex", gap: "0.75rem", fontSize: "2.5rem" }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setStars(star)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  opacity: star <= stars ? 1 : 0.3,
                  transform: star <= stars ? "scale(1.2)" : "scale(1)",
                  transition: "all 0.2s",
                  fontSize: "2.5rem",
                }}
              >
                ⭐
              </button>
            ))}
          </div>
          <p style={{ color: "#999", fontSize: "0.85rem", margin: "0.5rem 0 0 0" }}>
            {stars === 0 ? "Click a star to rate" : `${stars} out of 5 stars`}
          </p>
        </div>

        {/* Category Ratings */}
        <div style={{ padding: "1rem", background: "#F5F5F5", borderRadius: "6px" }}>
          <p style={{ color: "#1A1A1A", fontWeight: 600, marginBottom: "1rem" }}>
            Category Ratings (Optional)
          </p>

          <StarRating
            label="👨‍✈️ Driver Quality"
            value={driverQuality}
            onChange={setDriverQuality}
          />
          <StarRating
            label="🚚 Vehicle Condition"
            value={vehicleCondition}
            onChange={setVehicleCondition}
          />
          <StarRating
            label="⏰ Delivery Timeliness"
            value={timeliness}
            onChange={setTimeliness}
          />
        </div>

        {/* Feedback Text */}
        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem", color: "#1A1A1A" }}>
            Additional Feedback (Optional)
          </label>
          <textarea
            placeholder="Tell us what went well or what could be improved..."
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            style={{
              width: "100%",
              padding: "0.75rem",
              border: "1px solid #E8E8E8",
              borderRadius: "6px",
              boxSizing: "border-box",
              minHeight: "120px",
              fontFamily: "inherit",
              fontSize: "0.95rem",
            }}
          />
          <p style={{ color: "#999", fontSize: "0.85rem", margin: "0.5rem 0 0 0" }}>
            Max 500 characters
          </p>
        </div>

        {/* Submit Button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || stars === 0}
          style={{
            padding: "0.75rem",
            background: isSubmitting || stars === 0 ? "#CCC" : "#FF9800",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: isSubmitting || stars === 0 ? "not-allowed" : "pointer",
            fontWeight: 600,
            fontSize: "1rem",
          }}
        >
          {isSubmitting ? "Submitting Rating..." : "Submit Rating"}
        </button>
      </form>

      {/* Info Message */}
      <div style={{ padding: "1rem", background: "#E3F2FD", borderRadius: "6px", marginTop: "2rem" }}>
        <p style={{ color: "#1565C0", margin: "0", fontSize: "0.9rem" }}>
          💡 Your feedback is important. All ratings are reviewed to help us maintain high service quality.
        </p>
      </div>
    </div>
  );
}
