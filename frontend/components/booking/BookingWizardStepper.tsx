"use client";

import { BOOKING_WIZARD_STEPS, type BookingWizardStep } from "./wizardTypes";

type Props = {
  currentStep: BookingWizardStep;
};

export default function BookingWizardStepper({ currentStep }: Props) {
  const currentIndex = BOOKING_WIZARD_STEPS.findIndex((s) => s.id === currentStep);

  return (
    <nav className="booking-wizard-stepper" aria-label="Booking progress">
      <ol className="booking-wizard-stepper__list">
        {BOOKING_WIZARD_STEPS.map((step, index) => {
          const isComplete = index < currentIndex;
          const isCurrent = step.id === currentStep;
          return (
            <li
              key={step.id}
              className={`booking-wizard-stepper__item${isCurrent ? " booking-wizard-stepper__item--current" : ""}${isComplete ? " booking-wizard-stepper__item--complete" : ""}`}
              aria-current={isCurrent ? "step" : undefined}
            >
              <span className="booking-wizard-stepper__marker" aria-hidden="true">
                {isComplete ? "✓" : index + 1}
              </span>
              <span className="booking-wizard-stepper__label">{step.label}</span>
              {index < BOOKING_WIZARD_STEPS.length - 1 ? (
                <span className="booking-wizard-stepper__connector" aria-hidden="true" />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
