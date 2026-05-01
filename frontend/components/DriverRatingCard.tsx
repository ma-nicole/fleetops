import { useState } from "react";
import { apiFetch } from "@/lib/api";

type DriverRatingCardProps = {
  driverId: number;
  driverName: string;
  tripId: number;
};

export default function DriverRatingCard({ driverId, driverName, tripId }: DriverRatingCardProps) {
  const [rating, setRating] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [averageRating, setAverageRating] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  async function submitRating() {
    if (rating === 0) {
      alert("Please select a rating");
      return;
    }

    setLoading(true);
    try {
      await apiFetch("/ratings", {
        method: "POST",
        body: JSON.stringify({
          trip_id: tripId,
          driver_id: driverId,
          rating_value: rating,
        }),
      });

      // Fetch updated average rating
      const response = await apiFetch<{ average_rating: number }>(`/ratings/${driverId}`);
      setAverageRating(response.average_rating);
      setSubmitted(true);
      setRating(0);
    } catch (error) {
      alert(`Failed to submit rating: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAverageRating() {
    try {
      const response = await apiFetch<{ average_rating: number }>(`/ratings/${driverId}`);
      setAverageRating(response.average_rating);
    } catch (error) {
      console.error("Failed to fetch rating:", error);
    }
  }

  return (
    <div style={{ padding: "1rem", border: "1px solid #e5e7eb", borderRadius: "8px", background: "#f9fafb" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h3 style={{ margin: 0 }}> {driverName}</h3>
        {averageRating !== null && (
          <div style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#f59e0b" }}>
            ★ {averageRating.toFixed(1)} / 5.0
          </div>
        )}
      </div>

      {!submitted ? (
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "2rem",
                opacity: rating >= star ? 1 : 0.3,
                transition: "opacity 0.2s",
              }}
            >
              ★
            </button>
          ))}
          <button
            className="button"
            onClick={submitRating}
            disabled={loading || rating === 0}
            style={{ marginLeft: "1rem", padding: "0.5rem 1rem", opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "Submitting..." : "Submit"}
          </button>
        </div>
      ) : (
        <div style={{ color: "#15803d", fontSize: "0.95rem", padding: "0.5rem 0" }}>
          ✓ Thank you for rating {driverName}!
        </div>
      )}

      {averageRating === null && !submitted && (
        <button
          onClick={fetchAverageRating}
          style={{
            background: "none",
            border: "none",
            color: "#0369a1",
            cursor: "pointer",
            textDecoration: "underline",
            fontSize: "0.9rem",
          }}
        >
          View rating history
        </button>
      )}
    </div>
  );
}
