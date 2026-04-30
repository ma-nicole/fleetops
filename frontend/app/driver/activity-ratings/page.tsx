"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Link from "next/link";
import { useState } from "react";

type Rating = {
  date: string;
  tripId: string;
  safety: number;
  onTime: number;
  professionalism: number;
  customerService: number;
  comments: string;
};

export default function ActivityRatingsPage() {
  useRoleGuard(["driver"]);

  const [ratings] = useState<Rating[]>([
    {
      date: "April 28, 2024",
      tripId: "TRIP-001",
      safety: 5,
      onTime: 4,
      professionalism: 5,
      customerService: 4,
      comments: "Excellent driver, very professional",
    },
    {
      date: "April 27, 2024",
      tripId: "TRIP-004",
      safety: 5,
      onTime: 5,
      professionalism: 5,
      customerService: 5,
      comments: "Outstanding service, highly recommended",
    },
    {
      date: "April 26, 2024",
      tripId: "TRIP-003",
      safety: 4,
      onTime: 3,
      professionalism: 4,
      customerService: 4,
      comments: "Good delivery, slight delay due to traffic",
    },
    {
      date: "April 25, 2024",
      tripId: "TRIP-002",
      safety: 5,
      onTime: 5,
      professionalism: 5,
      customerService: 5,
      comments: "Perfect trip, very satisfied",
    },
  ]);

  const [stats] = useState({
    avgSafety: 4.75,
    avgOnTime: 4.25,
    avgProfessionalism: 4.75,
    avgCustomerService: 4.5,
    overallRating: 4.68,
    totalRatings: 24,
  });

  const StarRating = ({ rating }: { rating: number }) => (
    <div style={{ display: "flex", gap: "0.25rem" }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          style={{
            fontSize: "1.2rem",
            opacity: star <= rating ? 1 : 0.3,
          }}
        >
          ⭐
        </span>
      ))}
    </div>
  );

  return (
    <div style={{ padding: "2rem", display: "grid", gap: "2rem" }}>
      <div>
        <Link href="/driver/dashboard" style={{ color: "#FF9800", textDecoration: "none", fontWeight: "600" }}>
          ← Back to Dashboard
        </Link>
        <h1 style={{ color: "#1A1A1A", marginBottom: "0.5rem", marginTop: "1rem" }}>Activity Report & Ratings</h1>
        <p style={{ color: "#666666", margin: "0" }}>Your performance ratings and customer feedback</p>
      </div>

      {/* Overall Rating Summary */}
      <div style={{ padding: "2rem", border: "2px solid #9C27B0", borderRadius: "8px", background: "rgba(156, 39, 176, 0.05)" }}>
        <h2 style={{ color: "#9C27B0", marginBottom: "1.5rem" }}>Overall Performance</h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1.5rem", marginBottom: "2rem" }}>
          <div>
            <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>OVERALL RATING</p>
            <p style={{ color: "#9C27B0", fontSize: "2.5rem", fontWeight: "700", margin: "0.5rem 0 0 0" }}>
              {stats.overallRating}
            </p>
            <StarRating rating={Math.round(stats.overallRating)} />
          </div>

          <div>
            <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>TOTAL RATINGS</p>
            <p style={{ color: "#1A1A1A", fontSize: "2rem", fontWeight: "700", margin: "0.5rem 0 0 0" }}>
              {stats.totalRatings}
            </p>
            <p style={{ color: "#666666", fontSize: "0.85rem", margin: "0.5rem 0 0 0" }}>customer reviews</p>
          </div>

          <div>
            <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>LAST 30 DAYS</p>
            <p style={{ color: "#4CAF50", fontSize: "1.5rem", fontWeight: "700", margin: "0.5rem 0 0 0" }}>
              +2.1%
            </p>
            <p style={{ color: "#4CAF50", fontSize: "0.85rem", margin: "0.5rem 0 0 0" }}>improvement</p>
          </div>

          <div>
            <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>INCIDENTS</p>
            <p style={{ color: "#1A1A1A", fontSize: "2rem", fontWeight: "700", margin: "0.5rem 0 0 0" }}>
              0
            </p>
            <p style={{ color: "#4CAF50", fontSize: "0.85rem", margin: "0.5rem 0 0 0" }}>this month</p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
          <div>
            <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>SAFETY</p>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.5rem" }}>
              <p style={{ color: "#2196F3", fontSize: "1.5rem", fontWeight: "700", margin: "0" }}>
                {stats.avgSafety}
              </p>
              <StarRating rating={Math.round(stats.avgSafety)} />
            </div>
          </div>

          <div>
            <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>ON-TIME</p>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.5rem" }}>
              <p style={{ color: "#FF9800", fontSize: "1.5rem", fontWeight: "700", margin: "0" }}>
                {stats.avgOnTime}
              </p>
              <StarRating rating={Math.round(stats.avgOnTime)} />
            </div>
          </div>

          <div>
            <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>PROFESSIONALISM</p>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.5rem" }}>
              <p style={{ color: "#4CAF50", fontSize: "1.5rem", fontWeight: "700", margin: "0" }}>
                {stats.avgProfessionalism}
              </p>
              <StarRating rating={Math.round(stats.avgProfessionalism)} />
            </div>
          </div>

          <div>
            <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>CUSTOMER SERVICE</p>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.5rem" }}>
              <p style={{ color: "#9C27B0", fontSize: "1.5rem", fontWeight: "700", margin: "0" }}>
                {stats.avgCustomerService}
              </p>
              <StarRating rating={Math.round(stats.avgCustomerService)} />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Ratings */}
      <div>
        <h2 style={{ color: "#1A1A1A", marginBottom: "1.5rem" }}>Recent Ratings</h2>
        <div style={{ display: "grid", gap: "1rem" }}>
          {ratings.map((rating, idx) => (
            <div
              key={idx}
              style={{
                padding: "1.5rem",
                border: "1px solid #E8E8E8",
                borderRadius: "8px",
                background: "#F9F9F9",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "1rem" }}>
                <div>
                  <h3 style={{ color: "#1A1A1A", margin: "0" }}>{rating.tripId}</h3>
                  <p style={{ color: "#999", fontSize: "0.85rem", margin: "0.25rem 0 0 0" }}>
                    {rating.date}
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ color: "#9C27B0", fontSize: "1.2rem", fontWeight: "700", margin: "0" }}>
                    {((rating.safety + rating.onTime + rating.professionalism + rating.customerService) / 4).toFixed(2)} ⭐
                  </p>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "1rem", paddingBottom: "1rem", borderBottom: "1px solid #E8E8E8" }}>
                <div>
                  <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>SAFETY</p>
                  <StarRating rating={rating.safety} />
                </div>
                <div>
                  <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>ON-TIME</p>
                  <StarRating rating={rating.onTime} />
                </div>
                <div>
                  <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>PROFESSIONALISM</p>
                  <StarRating rating={rating.professionalism} />
                </div>
                <div>
                  <p style={{ color: "#999", fontSize: "0.75rem", fontWeight: "600", margin: "0" }}>CUSTOMER SERVICE</p>
                  <StarRating rating={rating.customerService} />
                </div>
              </div>

              <p style={{ color: "#666666", fontSize: "0.9rem", margin: "0", fontStyle: "italic" }}>
                "{rating.comments}"
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
