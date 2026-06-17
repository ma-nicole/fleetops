"use client";

import { RoleAnalyticsGrid, type AnalyticsCategoryTab } from "@/components/admin/RoleAnalyticsGrid";
import type { CustomerRoleAnalyticsPayload } from "@/lib/analyticsApi";

const FEATURE_LABELS: Record<string, Record<string, string>> = {
  account_management: {
    account_activity: "Account Activity Records",
    payment_profile: "Payment Profile Reports",
    profile_summary: "Profile Summary",
    booking_activity_forecast: "Booking Activity Forecasting",
    payment_success_trend: "Payment Success Trend",
  },
  service_selection: {
    service_preferences: "Service Preference History",
    cost_estimate_history: "Cost Estimate History",
    route_interest: "Route Interest Records",
    service_recommendation: "Service Recommendation",
    budget_projection: "Budget Projection",
  },
  booking_management: {
    booking_status_overview: "Booking Status Overview",
    payment_history: "Payment History",
    cancellation_records: "Cancellation Records",
    booking_completion_forecast: "Booking Completion Forecasting",
    cancellation_risk: "Cancellation Risk Prediction",
  },
  shipment_tracking: {
    shipment_status_timeline: "Shipment Status Timeline",
    delivery_performance: "Delivery Performance",
    tracking_updates: "Tracking Updates",
    delay_likelihood: "Delay Likelihood Prediction",
    eta_projection: "ETA Projection",
  },
};

const CATEGORY_TABS: AnalyticsCategoryTab[] = [
  {
    id: "bookings",
    label: "Bookings",
    include: [
      { pillar: "account_management", features: ["account_activity", "booking_activity_forecast"] },
      { pillar: "service_selection" },
      {
        pillar: "booking_management",
        features: ["booking_status_overview", "cancellation_records", "booking_completion_forecast", "cancellation_risk"],
      },
    ],
  },
  {
    id: "shipments",
    label: "Shipments",
    include: [{ pillar: "shipment_tracking" }],
  },
  {
    id: "payments",
    label: "Payments",
    include: [
      { pillar: "account_management", features: ["payment_profile", "payment_success_trend"] },
      { pillar: "booking_management", features: ["payment_history"] },
    ],
  },
  {
    id: "receipts",
    label: "Receipts",
    include: [
      { pillar: "account_management", features: ["profile_summary"] },
      { pillar: "shipment_tracking", features: ["tracking_updates"] },
    ],
  },
];

export default function CustomerRoleAnalyticsTabs({ data }: { data: CustomerRoleAnalyticsPayload }) {
  return (
    <RoleAnalyticsGrid
      dashboardTitle="Customer Analytics"
      categoryTabs={CATEGORY_TABS}
      featureLabels={FEATURE_LABELS}
      data={data}
    />
  );
}
