/** FleetOpt standard logistics service agreement — replace with official legal text when available. */

export const FLEETOPT_TERMS_VERSION = "fleetopt-logistics-v1";

export type TermsSection = { title: string; paragraphs: string[] };

export const FLEETOPT_TERMS_SECTIONS: TermsSection[] = [
  {
    title: "1. Agreement Overview",
    paragraphs: [
      "This FleetOpt Logistics Service Agreement (\"Agreement\") governs the transportation, handling, and related logistics services arranged through the FleetOpt platform (\"FleetOpt\", \"we\", \"us\") for the customer (\"Customer\", \"you\").",
      "By electronically signing and accepting these terms during booking, you confirm that you are authorized to bind the shipper or consignee and that the information provided in your booking is accurate and complete.",
    ],
  },
  {
    title: "2. Scope of Services",
    paragraphs: [
      "FleetOpt coordinates fleet resources, drivers, helpers, and dispatch operations for pickup, transit, and delivery of cargo as described in your booking request.",
      "Services may include route planning, scheduling, proof-of-delivery capture, payment processing, and operational status updates. Specific inclusions depend on the service type and booking configuration selected at checkout.",
    ],
  },
  {
    title: "3. Customer Responsibilities",
    paragraphs: [
      "You must provide accurate pickup and delivery locations, cargo weight, description, and scheduling requirements.",
      "You are responsible for lawful packaging, labeling, and documentation of cargo, including any required permits, customs paperwork, or hazardous materials declarations.",
      "You must ensure site access for loading and unloading and provide authorized personnel at pickup and delivery points when required.",
    ],
  },
  {
    title: "4. Cargo Declaration",
    paragraphs: [
      "You agree to upload a complete and truthful Cargo Declaration Sheet for each booking. FleetOpt may review, approve, reject, or request revision of declarations before dispatch.",
      "Undeclared, misdeclared, or prohibited cargo may result in service cancellation, additional charges, or refusal of carriage to the extent permitted by law.",
    ],
  },
  {
    title: "5. Pricing, Payment, and Charges",
    paragraphs: [
      "Quoted totals are based on route distance, vehicle class, toll estimates, labor, and operational factors available at booking time. Final charges may reflect verified weight, route changes, tolls, waiting time, or other approved adjustments.",
      "Payment must be completed according to the payment method selected in the FleetOpt portal. Bookings may remain pending until payment is verified by FleetOpt or its payment partners.",
    ],
  },
  {
    title: "6. Scheduling, Delays, and Force Majeure",
    paragraphs: [
      "Pickup and delivery windows are estimates unless expressly guaranteed in writing. Delays may occur due to traffic, weather, regulatory checks, site constraints, or safety conditions.",
      "Neither party is liable for delays or failures caused by events beyond reasonable control, including natural disasters, civil unrest, government action, or infrastructure outages.",
    ],
  },
  {
    title: "7. Liability and Insurance",
    paragraphs: [
      "FleetOpt's liability for loss or damage to cargo is limited to the extent permitted by applicable law and any separate written cargo insurance or liability arrangement agreed in advance.",
      "Customer is encouraged to maintain adequate cargo insurance for high-value or sensitive shipments. Claims must be reported promptly with supporting documentation and proof of condition where available.",
    ],
  },
  {
    title: "8. Electronic Records and Signatures",
    paragraphs: [
      "You consent to electronic execution of this Agreement and acknowledge that your electronic signature, acceptance checkbox, and system audit metadata constitute a binding record of acceptance.",
      "FleetOpt may retain booking records, operational proofs, payment records, and signed agreement artifacts for compliance, dispute resolution, and service quality purposes.",
    ],
  },
  {
    title: "9. Cancellation and Refunds",
    paragraphs: [
      "Cancellation terms depend on booking status, dispatch readiness, and payment verification stage. FleetOpt may apply reasonable cancellation or restocking fees when resources have already been allocated.",
      "Refund eligibility is determined according to operational status, payment method, and applicable FleetOpt policies communicated at booking or payment time.",
    ],
  },
  {
    title: "10. Governing Terms",
    paragraphs: [
      "This Agreement constitutes the logistics service terms for bookings submitted through FleetOpt unless superseded by a signed master service agreement between the parties.",
      "FleetOpt may update this standard agreement version from time to time. The version displayed and accepted at the time of booking applies to that booking.",
    ],
  },
];

export function fleetoptTermsPlainText(): string {
  return FLEETOPT_TERMS_SECTIONS.map((s) => `${s.title}\n${s.paragraphs.join("\n\n")}`).join("\n\n");
}
