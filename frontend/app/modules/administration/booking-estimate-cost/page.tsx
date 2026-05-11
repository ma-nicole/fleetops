import { redirect } from "next/navigation";

export default function LegacyBookingPricingRedirect() {
  redirect("/modules/administration/booking-pricing");
}
