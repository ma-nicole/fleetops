"use client";

import { RoleAnalyticsGrid, type AnalyticsCategoryTab } from "@/components/admin/RoleAnalyticsGrid";
import type { CustomerRoleAnalyticsPayload } from "@/lib/analyticsApi";

const FEATURE_LABELS: Record<string, Record<string, string>> = {
  account_management: {
    account_activity_logs: "Account Activity Logs",
    login_history: "Login History",
    profile_records: "Profile Records",
    booking_activity_forecast: "Booking Activity Forecasting",
    payment_success_trend: "Payment Success Trend",
  },
  service_selection: {
    service_selection_history: "Service Selection History",
    truck_preference_records: "Truck Preference Records",
    service_recommendation: "Service Recommendation",
    budget_projection: "Budget Projection",
  },
  booking_management: {
    booking_records: "Booking Records",
    booking_history: "Booking History",
    order_details: "Order Details",
    booking_completion_forecast: "Booking Completion Forecasting",
    cancellation_risk: "Cancellation Risk Prediction",
  },
  shipment_tracking: {
    payment_records: "Payment Records",
    transaction_history: "Transaction History",
    receipts: "Receipts",
    delay_likelihood: "Delay Likelihood Prediction",
    eta_projection: "ETA Projection",
  },
};

const CATEGORY_TABS: AnalyticsCategoryTab[] = [
  {
    id: "account-management",
    label: "Account Management",
    include: [
      { pillar: "account_management", features: ["account_activity_logs", "login_history", "profile_records"] },
    ],
  },
  {
    id: "service-selection",
    label: "Service Selection",
    include: [{ pillar: "service_selection", features: ["service_selection_history", "truck_preference_records"] }],
  },
  {
    id: "booking-management",
    label: "Booking Management",
    include: [{ pillar: "booking_management", features: ["booking_records", "booking_history", "order_details"] }],
  },
  {
    id: "shipment-tracking",
    label: "Shipment Tracking",
    include: [{ pillar: "shipment_tracking", features: ["payment_records", "transaction_history", "receipts"] }],
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
