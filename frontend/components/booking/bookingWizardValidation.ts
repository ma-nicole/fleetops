import { BOOKING_TIME_SLOTS } from "@/lib/bookingSlots";
import { isValidBookingWeightTons, bookingWeightValidationMessage } from "@/components/BookingCargoWeightField";
import { validateBookingDocumentFile } from "@/components/BookingDocumentUploadFields";
import { CARGO_TYPE_CATEGORIES } from "@/lib/cargoTypeCategories";
import { validateCustomerSiteAddress } from "@/lib/formValidation";
import { MIN_BOOKING_SITES } from "@/lib/customerSites";
import type { BookingWizardStep, FormErrors } from "./wizardTypes";

const CARGO_CATEGORY_VALUES = new Set(CARGO_TYPE_CATEGORIES.map((c) => c.value));

type ValidationContext = {
  sitesCount: number;
  pickupId: string;
  dropoffId: string;
  pickup: string;
  dropoff: string;
  weight: string;
  cargoDescription: string;
  cargoTypeCategory: string;
  date: string;
  today: string;
  pickedSlot: string;
  slotsLoading: boolean;
  slotAvailability: Record<string, boolean>;
  slotAvailableTrucks: Record<string, number>;
  requiredTrucksFromApi: number;
  cargoDeclaration: File | null;
  termsSignature: File | null;
  termsAccepted: boolean;
  termsScrolled: boolean;
};

function validateRouteFields(ctx: ValidationContext): FormErrors {
  const errors: FormErrors = {};
  if (ctx.sitesCount < MIN_BOOKING_SITES) {
    errors.sites_min = `You need at least ${MIN_BOOKING_SITES} saved site addresses on your account before you can book.`;
  }
  if (!ctx.pickupId) {
    errors.pickup_location = "Select a pickup address from your saved sites.";
  } else if (!ctx.pickup || ctx.pickup.length < 3) {
    errors.pickup_location = "Invalid pickup selection.";
  } else {
    const pu = validateCustomerSiteAddress(ctx.pickup);
    if (pu) errors.pickup_location = `${pu} Update this site under Customer dashboard → Sites.`;
  }
  if (!ctx.dropoffId) {
    errors.dropoff_location = "Select a dropoff address from your saved sites.";
  } else if (!ctx.dropoff || ctx.dropoff.length < 3) {
    errors.dropoff_location = "Invalid dropoff selection.";
  } else {
    const dr = validateCustomerSiteAddress(ctx.dropoff);
    if (dr) errors.dropoff_location = `${dr} Update this site under Customer dashboard → Sites.`;
  }
  if (ctx.pickupId && ctx.dropoffId && ctx.pickupId === ctx.dropoffId) {
    errors.dropoff_location = "Pickup and dropoff must be different sites.";
  }
  if (
    ctx.pickup.trim().length >= 3 &&
    ctx.dropoff.trim().length >= 3 &&
    ctx.pickup.trim().toLowerCase() === ctx.dropoff.trim().toLowerCase()
  ) {
    errors.dropoff_location = "Pickup and dropoff must be different.";
  }
  return errors;
}

function validateShipmentFields(ctx: ValidationContext): FormErrors {
  const errors: FormErrors = {};
  const wTons = parseFloat(ctx.weight);
  if (!isValidBookingWeightTons(wTons)) {
    errors.cargo_weight_tons = bookingWeightValidationMessage();
  }
  const desc = (ctx.cargoDescription || "").replace(/\s+/g, " ").trim();
  if (!desc) {
    errors.cargo_description = "Cargo description is required.";
  } else if (desc.length < 3) {
    errors.cargo_description = "Cargo description must be at least 3 characters.";
  }
  const category = (ctx.cargoTypeCategory || "").trim();
  if (!category) {
    errors.cargo_type_category = "Select a cargo type / category (use Other / mixed if unsure).";
  } else if (!CARGO_CATEGORY_VALUES.has(category as (typeof CARGO_TYPE_CATEGORIES)[number]["value"])) {
    errors.cargo_type_category = "Select a valid cargo type / category.";
  }
  return errors;
}

function validateScheduleFields(ctx: ValidationContext): FormErrors {
  const errors: FormErrors = {};
  if (!ctx.date) {
    errors.scheduled_date = "Schedule date required";
  } else {
    const selectedDate = new Date(ctx.date);
    if (selectedDate < new Date(ctx.today)) {
      errors.scheduled_date = "Cannot book past dates";
    } else if (
      !ctx.slotsLoading &&
      BOOKING_TIME_SLOTS.length > 0 &&
      BOOKING_TIME_SLOTS.every((s) => ctx.slotAvailability[s] === false)
    ) {
      errors.scheduled_date =
        "This date has no open pickup windows — not enough free trucks, drivers, and helpers for overlapping route times.";
    }
  }
  if (ctx.date && !ctx.slotsLoading) {
    if (!ctx.pickedSlot) {
      errors.scheduled_time_slot = "Choose a pickup time window.";
    } else if (ctx.slotAvailability[ctx.pickedSlot] === false) {
      errors.scheduled_time_slot =
        "That time is not available — trucks, drivers, or helpers are fully booked for this window.";
    } else if ((ctx.slotAvailableTrucks[ctx.pickedSlot] ?? 0) < ctx.requiredTrucksFromApi) {
      errors.scheduled_time_slot =
        "Not enough free trucks, drivers, and helpers for this schedule. Please choose another date/time.";
    }
  }
  return errors;
}

function validateDocumentFields(ctx: ValidationContext): FormErrors {
  const errors: FormErrors = {};
  const declErr = validateBookingDocumentFile(ctx.cargoDeclaration);
  if (declErr) errors.cargo_declaration = declErr;
  if (!ctx.termsScrolled) {
    errors.terms_read = "Scroll through the full Terms & Agreement before signing.";
  }
  if (!ctx.termsSignature) {
    errors.terms_signature = "Draw your electronic signature to continue.";
  }
  if (!ctx.termsAccepted) {
    errors.terms_accepted = "You must accept the Terms & Agreement.";
  }
  return errors;
}

export function validateWizardStep(step: BookingWizardStep, ctx: ValidationContext): FormErrors {
  if (step === "route") return validateRouteFields(ctx);
  if (step === "shipment") return validateShipmentFields(ctx);
  if (step === "schedule") return validateScheduleFields(ctx);
  if (step === "documents") return validateDocumentFields(ctx);
  return {
    ...validateRouteFields(ctx),
    ...validateShipmentFields(ctx),
    ...validateScheduleFields(ctx),
    ...validateDocumentFields(ctx),
  };
}

export function isWizardStepComplete(step: BookingWizardStep, ctx: ValidationContext): boolean {
  return Object.keys(validateWizardStep(step, ctx)).length === 0;
}
