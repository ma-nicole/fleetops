"use client";

import { useRoleGuard } from "@/lib/useRoleGuard";
import Link from "next/link";
import { useState } from "react";

type Review = {
  id: string;
  customer: string;
  rating: number;
  comment: string;
  date: string;
  status: string;
  bookingId: string;
};

export default function CustomerReviewsPage() {
  useRoleGuard(["manager", "admin"]);

  const [reviews] = useState<Review[]>([
    {
      id: "REV-001",
      customer: "ABC Retail Corp",
      rating: 5,
      comment: "Excellent service! Delivery was on time and items were handled carefully.",
      date: "May 10, 2024",
      status: "published",
      bookingId: "BK-2024-0001",
    },
    {
      id: "REV-002",
      customer: "DEF Logistics",
      rating: 4,
      comment: "Good service overall. Driver was professional and communication was clear.",
      date: "May 10, 2024",
      status: "published",
      bookingId: "BK-2024-0002",
    },
    {
      id: "REV-003",
      customer: "GHI Trading",
      rating: 5,
      comment: "Outstanding! This is my third booking and service keeps getting better.",
      date: "May 09, 2024",
      status: "published",
      bookingId: "BK-2024-0003",
    },
    {
      id: "REV-004",
      customer: "JKL Manufacturing",
      rating: 4,
      comment: "Reliable and professional. Will definitely book again for future deliveries.",
      date: "May 08, 2024",
      status: "published",
      bookingId: "BK-2024-0100",
    },
    {
      id: "REV-005",
      customer: "MNO Suppliers",
      rating: 3,
      comment: "Delivery was slightly delayed but overall acceptable service.",
      date: "May 07, 2024",
      status: "published",
      bookingId: "BK-2024-0101",
    },
  ]);

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} style={{ color: i < rating ? "#FFB800" : "#D1D5DB", fontSize: "1.2rem" }}>
        ★
      </span>
    ));
  };

  const averageRating = (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1);

  return (
    <main style={{ padding: "2rem", background: "#FAFAFA", minHeight: "100vh" }}>
      <div className="container" style={{ maxWidth: "1000px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
            <Link href="/manager/dashboard" style={{ color: "#0EA5E9", textDecoration: "none" }}>
              ← Dashboard
            </Link>
          </div>
          <h1 style={{ margin: "0 0 0.5rem", fontSize: "2rem", fontWeight: 900, color: "#1A1A1A" }}>
            Customer Reviews
          </h1>
          <p style={{ margin: 0, color: "#666" }}>Track and manage customer feedback</p>
        </div>

        {/* Rating Summary */}
        <div style={{ background: "white", padding: "2rem", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", marginBottom: "2rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "2rem", alignItems: "center" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "3rem", fontWeight: 900, color: "#FF9800", marginBottom: "0.5rem" }}>{averageRating}</div>
              <div style={{ display: "flex", gap: "0.25rem", marginBottom: "0.5rem", justifyContent: "center" }}>
                {renderStars(Math.round(parseFloat(averageRating)))}
              </div>
              <div style={{ color: "#666", fontSize: "0.9rem" }}>Based on {reviews.length} reviews</div>
            </div>
            <div>
              <div style={{ marginBottom: "0.75rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.5rem" }}>
                  <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>★★★★★</span>
                  <div style={{ background: "#E8E8E8", borderRadius: "4px", height: "8px", flex: 1 }}>
                    <div style={{ background: "#FFB800", height: "100%", borderRadius: "4px", width: "60%" }} />
                  </div>
                  <span style={{ fontSize: "0.85rem", color: "#666" }}>60%</span>
                </div>
              </div>
              <div style={{ marginBottom: "0.75rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.5rem" }}>
                  <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>★★★★☆</span>
                  <div style={{ background: "#E8E8E8", borderRadius: "4px", height: "8px", flex: 1 }}>
                    <div style={{ background: "#FFB800", height: "100%", borderRadius: "4px", width: "40%" }} />
                  </div>
                  <span style={{ fontSize: "0.85rem", color: "#666" }}>40%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Reviews List */}
        <div style={{ display: "grid", gap: "1.5rem" }}>
          {reviews.map((review) => (
            <div key={review.id} style={{ background: "white", padding: "1.5rem", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", borderLeft: "4px solid #FF9800" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "0.75rem" }}>
                <div>
                  <div style={{ fontSize: "1rem", fontWeight: 700, color: "#1A1A1A", marginBottom: "0.25rem" }}>{review.customer}</div>
                  <div style={{ fontSize: "0.8rem", color: "#666" }}>Booking: {review.bookingId}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ display: "flex", gap: "0.1rem", justifyContent: "flex-end", marginBottom: "0.25rem" }}>
                    {renderStars(review.rating)}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#666" }}>{review.date}</div>
                </div>
              </div>
              <p style={{ margin: "0.75rem 0 0", color: "#666", lineHeight: 1.6 }}>{review.comment}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
