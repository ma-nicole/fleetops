"use client";

import { useState } from "react";
import { CustomerDataFlowService } from "@/lib/customerDataFlowService";

export default function FeedbackPage() {
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(5);
  const [saved, setSaved] = useState("");
  const booking = CustomerDataFlowService.getCurrentBooking();
  const payment = CustomerDataFlowService.getPayments()[0];

  const submit = () => {
    const item = CustomerDataFlowService.saveFeedback(message || "Great service", rating);
    if (item) setSaved(item.id);
  };

  return (
    <main style={{ padding: "2rem", minHeight: "100vh", background: "#FAFAFA" }}>
      <div style={{ maxWidth: "900px", margin: "0 auto", display: "grid", gap: "1rem" }}>
        <h1 style={{ margin: 0 }}>Email Feedback / Receipt</h1>
        <section style={{ background: "white", border: "1px solid #E8E8E8", borderRadius: "10px", padding: "1rem", display: "grid", gap: "0.5rem" }}>
          <p style={{ margin: 0 }}><strong>Receipt:</strong> {payment ? `${payment.id} (${payment.status})` : "No payment record"}</p>
          <p style={{ margin: 0 }}><strong>Booking:</strong> {booking?.id || "-"}</p>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Write feedback..." style={{ minHeight: "90px", padding: "0.7rem", border: "1px solid #D1D5DB", borderRadius: "6px", fontFamily: "inherit" }} />
          <select value={rating} onChange={(e) => setRating(parseInt(e.target.value, 10))} style={{ maxWidth: "160px", padding: "0.7rem", border: "1px solid #D1D5DB", borderRadius: "6px" }}>
            <option value={5}>5 Stars</option><option value={4}>4 Stars</option><option value={3}>3 Stars</option><option value={2}>2 Stars</option><option value={1}>1 Star</option>
          </select>
          <button onClick={submit} style={{ width: "fit-content", border: "none", borderRadius: "6px", background: "#10B981", color: "white", fontWeight: 600, padding: "0.65rem 1rem", cursor: "pointer" }}>
            Save Feedback & Receipt
          </button>
          {saved && <p style={{ margin: 0, color: "#059669" }}>Feedback saved ({saved}) and stored in Feedback Data.</p>}
        </section>
      </div>
    </main>
  );
}

