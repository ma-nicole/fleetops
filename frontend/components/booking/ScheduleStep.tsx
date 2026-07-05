import { BOOKING_TIME_SLOTS } from "@/lib/bookingSlots";
import LoadingMessage from "@/components/ui/LoadingMessage";
import type { FormErrors } from "./wizardTypes";

type Props = {
  hasEnoughSites: boolean;
  date: string;
  today: string;
  pickedSlot: string;
  slotsLoading: boolean;
  slotsFetchError: string | null;
  slotAvailability: Record<string, boolean>;
  requiredTrucks: number;
  selectedAvailableTrucks: number;
  errors: FormErrors;
  onDateChange: (value: string) => void;
  onPickedSlotChange: (slot: string) => void;
  onClearErrors: (keys: string[]) => void;
};

export default function ScheduleStep({
  hasEnoughSites,
  date,
  today,
  pickedSlot,
  slotsLoading,
  slotsFetchError,
  slotAvailability,
  requiredTrucks,
  selectedAvailableTrucks,
  errors,
  onDateChange,
  onPickedSlotChange,
  onClearErrors,
}: Props) {
  return (
    <div className="booking-wizard-step" style={{ display: "grid", gap: "1rem" }}>
      <div>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            fontSize: "0.9rem",
            color: "var(--text-secondary)",
            marginBottom: "0.5rem",
          }}
        >
          <span>Schedule date</span>
          <span className="field-help" title="Past dates are disabled. Pick the earliest realistic pickup date.">
            ?
          </span>
          {date && !errors.scheduled_date ? <span className="field-valid">OK</span> : null}
        </label>
        <input
          className="input"
          type="date"
          value={date}
          onChange={(e) => {
            onDateChange(e.target.value);
            onClearErrors(["scheduled_date", "scheduled_time_slot"]);
          }}
          min={today}
          disabled={!hasEnoughSites}
          style={errors.scheduled_date ? { borderColor: "#F44336" } : {}}
        />
        {errors.scheduled_date ? (
          <p style={{ color: "#F44336", fontSize: "0.8rem", margin: "0.25rem 0 0 0" }}>
            {errors.scheduled_date}
          </p>
        ) : null}
      </div>

      {slotsFetchError && hasEnoughSites && date ? (
        <p role="alert" style={{ margin: 0, color: "#b45309", fontSize: "0.85rem" }}>
          {slotsFetchError}
        </p>
      ) : null}

      <div>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            fontSize: "0.9rem",
            color: "var(--text-secondary)",
            marginBottom: "0.5rem",
          }}
        >
          <span>Pickup time window</span>
          <span
            className="field-help"
            title="Availability depends on how many trucks are still free when your haul overlaps earlier runs."
          >
            ?
          </span>
          {pickedSlot && !errors.scheduled_time_slot ? <span className="field-valid">OK</span> : null}
        </span>
        {!date ? (
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            Choose a schedule date to see which pickup windows are still open.
          </p>
        ) : slotsLoading ? (
          <LoadingMessage label="Checking open slots..." size="sm" />
        ) : (
          <div className="booking-slot-strip" role="radiogroup" aria-label="Pickup time slots">
            {BOOKING_TIME_SLOTS.map((slot) => {
              const taken = slotAvailability[slot] === false;
              const selected = pickedSlot === slot;
              return (
                <button
                  key={slot}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={!hasEnoughSites || taken}
                  onClick={() => {
                    onPickedSlotChange(slot);
                    onClearErrors(["scheduled_time_slot"]);
                  }}
                  className={`booking-slot-pill booking-slot-selectable${selected ? " booking-slot-pill--selected" : ""}${taken ? " booking-slot-pill--taken" : ""}`}
                >
                  {slot}
                  {taken ? " (fleet full)" : ""}
                </button>
              );
            })}
          </div>
        )}
        {errors.scheduled_time_slot ? (
          <p style={{ color: "#F44336", fontSize: "0.8rem", margin: "0.35rem 0 0 0" }}>
            {errors.scheduled_time_slot}
          </p>
        ) : null}
        {date && !slotsLoading ? (
          <div
            style={{
              marginTop: "0.55rem",
              padding: "0.65rem 0.75rem",
              borderRadius: "8px",
              border: "1px solid rgba(0,0,0,0.08)",
              background: "rgba(0,0,0,0.02)",
              fontSize: "0.82rem",
              color: "var(--text-secondary)",
            }}
          >
            <div>Required trucks: {requiredTrucks}</div>
            <div>
              Available trucks{pickedSlot ? ` (${pickedSlot})` : ""}: {selectedAvailableTrucks}
            </div>
            {pickedSlot && selectedAvailableTrucks < requiredTrucks ? (
              <div style={{ color: "#b91c1c", marginTop: "0.3rem", fontWeight: 600 }}>
                Not enough trucks available for this time slot.
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
