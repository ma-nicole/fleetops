/** Canonical fleet pickup windows — must match backend `BOOKING_TIME_SLOTS`. */

export const BOOKING_TIME_SLOTS = ["08:00", "11:30", "14:00", "17:30"] as const;

export type BookingTimeSlot = (typeof BOOKING_TIME_SLOTS)[number];
