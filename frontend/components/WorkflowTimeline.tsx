"use client";

import React from "react";

export type WorkflowTimelineStep = {
  id: string;
  label: string;
  completed: boolean;
  current: boolean;
  timestamp?: string;
};

type WorkflowTimelineProps = {
  steps: WorkflowTimelineStep[];
  /** Vertical list suits long post-payment trackers; horizontal for compact cards. */
  orientation?: "vertical" | "horizontal";
  title?: string;
  className?: string;
};

export default function WorkflowTimeline({
  steps,
  orientation = "vertical",
  title,
  className,
}: WorkflowTimelineProps) {
  const rootClass =
    orientation === "horizontal"
      ? `workflow-timeline workflow-timeline--horizontal${className ? ` ${className}` : ""}`
      : `workflow-timeline workflow-timeline--vertical${className ? ` ${className}` : ""}`;

  return (
    <div className={rootClass} role="list" aria-label={title || "Booking progress"}>
      {title ? <div className="workflow-timeline__title">{title}</div> : null}
      <div className="workflow-timeline__viewport">
        <ol className="workflow-timeline__list">
          {steps.map((step, index) => {
            const state = step.completed ? "completed" : step.current ? "current" : "pending";
            const connectorDone = step.completed;
            return (
              <li
                key={step.id}
                className={`workflow-timeline__step workflow-timeline__step--${state}`}
                role="listitem"
                aria-current={step.current ? "step" : undefined}
              >
                {index < steps.length - 1 ? (
                  <span
                    className={`workflow-timeline__connector${connectorDone ? " workflow-timeline__connector--done" : ""}`}
                    aria-hidden="true"
                  />
                ) : null}
                <span className={`workflow-timeline__marker workflow-timeline__marker--${state}`} aria-hidden="true">
                  {step.completed ? "✓" : step.current ? "●" : index + 1}
                </span>
                <span className="workflow-timeline__body">
                  <span className="workflow-timeline__label">{step.label}</span>
                  {step.current ? <span className="workflow-timeline__hint">Current</span> : null}
                  {step.timestamp ? <span className="workflow-timeline__time">{step.timestamp}</span> : null}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      <style>{`
        .workflow-timeline {
          margin: 0;
          width: 100%;
          max-width: 100%;
          min-width: 0;
          box-sizing: border-box;
        }
        .workflow-timeline__title {
          font-size: 0.8rem;
          font-weight: 700;
          color: #374151;
          margin-bottom: 0.65rem;
        }
        .workflow-timeline__viewport {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          box-sizing: border-box;
        }
        .workflow-timeline__list {
          list-style: none;
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        .workflow-timeline--vertical .workflow-timeline__list {
          display: grid;
          gap: 0;
        }
        .workflow-timeline--vertical .workflow-timeline__step {
          display: grid;
          grid-template-columns: 28px minmax(0, 1fr);
          column-gap: 0.75rem;
          position: relative;
          padding-bottom: 0.85rem;
          min-height: 2.5rem;
          min-width: 0;
        }
        .workflow-timeline--vertical .workflow-timeline__step:last-child {
          padding-bottom: 0;
        }
        .workflow-timeline--vertical .workflow-timeline__connector {
          position: absolute;
          left: 13px;
          top: 28px;
          bottom: 0;
          width: 2px;
          background: #E5E7EB;
        }
        .workflow-timeline--vertical .workflow-timeline__connector--done {
          background: #059669;
        }
        .workflow-timeline__marker {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 0.72rem;
          font-weight: 700;
          z-index: 1;
          position: relative;
          flex-shrink: 0;
        }
        .workflow-timeline__marker--completed {
          background: #059669;
          color: #fff;
        }
        .workflow-timeline__marker--current {
          background: #B45309;
          color: #fff;
          box-shadow: 0 0 0 3px rgba(180, 83, 9, 0.18);
        }
        .workflow-timeline__marker--pending {
          background: #F3F4F6;
          color: #9CA3AF;
          border: 1px solid #E5E7EB;
        }
        .workflow-timeline__body {
          display: grid;
          gap: 0.1rem;
          padding-top: 0.2rem;
          min-width: 0;
        }
        .workflow-timeline__label {
          font-size: 0.84rem;
          font-weight: 600;
          color: #374151;
          overflow-wrap: anywhere;
          word-break: break-word;
          line-height: 1.25;
        }
        .workflow-timeline__step--current .workflow-timeline__label {
          color: #92400E;
        }
        .workflow-timeline__step--completed .workflow-timeline__label {
          color: #065F46;
        }
        .workflow-timeline__step--pending .workflow-timeline__label {
          color: #9CA3AF;
          font-weight: 500;
        }
        .workflow-timeline__hint {
          font-size: 0.7rem;
          color: #B45309;
          font-weight: 600;
        }
        .workflow-timeline__time {
          font-size: 0.72rem;
          color: #9CA3AF;
        }

        /* Compact / many stages: wrap on wider cards, scroll on narrow */
        .workflow-timeline--horizontal .workflow-timeline__viewport {
          overflow-x: auto;
          overflow-y: hidden;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-x: contain;
          scrollbar-width: thin;
          padding-bottom: 0.25rem;
        }
        .workflow-timeline--horizontal .workflow-timeline__list {
          display: flex;
          flex-wrap: wrap;
          align-items: flex-start;
          justify-content: flex-start;
          column-gap: 0;
          row-gap: 1rem;
          width: 100%;
          min-width: 0;
        }
        .workflow-timeline--horizontal .workflow-timeline__step {
          flex: 1 1 5.75rem;
          max-width: 7.25rem;
          min-width: 5.5rem;
          text-align: center;
          position: relative;
          padding: 0 0.4rem 0.15rem;
          box-sizing: border-box;
        }
        .workflow-timeline--horizontal .workflow-timeline__connector {
          display: none;
        }
        .workflow-timeline--horizontal .workflow-timeline__marker {
          margin: 0 auto 0.35rem;
        }
        .workflow-timeline--horizontal .workflow-timeline__body {
          padding-top: 0;
          justify-items: center;
        }
        .workflow-timeline--horizontal .workflow-timeline__label {
          font-size: 0.68rem;
          line-height: 1.2;
          text-align: center;
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 3;
          overflow: hidden;
          max-width: 100%;
        }
        .workflow-timeline--horizontal .workflow-timeline__hint {
          display: block;
          margin-top: 0.15rem;
        }
        .workflow-timeline--horizontal .workflow-timeline__time {
          display: none;
        }

        /* Narrow screens: single-row horizontal scroll, equal step widths */
        @media (max-width: 640px) {
          .workflow-timeline--horizontal .workflow-timeline__list {
            flex-wrap: nowrap;
            width: max-content;
            min-width: 100%;
            padding-right: 0.25rem;
          }
          .workflow-timeline--horizontal .workflow-timeline__step {
            flex: 0 0 5.75rem;
            width: 5.75rem;
            max-width: 5.75rem;
            min-width: 5.75rem;
          }
          .workflow-timeline--horizontal .workflow-timeline__connector {
            display: block;
            position: absolute;
            top: 14px;
            left: calc(50% + 16px);
            width: calc(5.75rem - 32px);
            right: auto;
            height: 2px;
            background: #E5E7EB;
            z-index: 0;
          }
          .workflow-timeline--horizontal .workflow-timeline__connector--done {
            background: #059669;
          }
        }
      `}</style>
    </div>
  );
}
