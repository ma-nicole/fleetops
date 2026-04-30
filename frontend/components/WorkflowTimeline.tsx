"use client";

import React from "react";

interface TimelineStep {
  id: string;
  label: string;
  completed: boolean;
  current: boolean;
  timestamp?: string;
}

interface WorkflowTimelineProps {
  steps: TimelineStep[];
}

export default function WorkflowTimeline({ steps }: WorkflowTimelineProps) {
  return (
    <div className="workflow-timeline">
      <style>{`
        .workflow-timeline {
          display: flex;
          align-items: center;
          gap: 0;
          margin: 2rem 0;
        }
        
        .timeline-step {
          flex: 1;
          text-align: center;
          position: relative;
        }
        
        .timeline-circle {
          width: 40px;
          height: 40px;
          margin: 0 auto 0.5rem;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 14px;
          transition: all 0.3s;
        }
        
        .timeline-circle.completed {
          background: #10B981;
          color: white;
        }
        
        .timeline-circle.current {
          background: #3B82F6;
          color: white;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
        }
        
        .timeline-circle.pending {
          background: #E5E7EB;
          color: #9CA3AF;
        }
        
        .timeline-label {
          font-size: 13px;
          font-weight: 500;
          color: #374151;
          margin-top: 0.25rem;
        }
        
        .timeline-timestamp {
          font-size: 11px;
          color: #9CA3AF;
          margin-top: 0.25rem;
        }
        
        .timeline-connector {
          position: absolute;
          top: 20px;
          left: calc(50% + 20px);
          right: calc(-50% - 20px);
          height: 2px;
          background: #E5E7EB;
          z-index: 0;
        }
        
        .timeline-connector.completed {
          background: #10B981;
        }
        
        .timeline-step:last-child .timeline-connector {
          display: none;
        }
      `}</style>

      {steps.map((step, index) => (
        <div key={step.id} className="timeline-step">
          <div className="timeline-connector" style={{
            background: step.completed ? "#10B981" : step.current ? "#3B82F6" : "#E5E7EB",
          }} />
          <div className={`timeline-circle ${step.completed ? "completed" : step.current ? "current" : "pending"}`}>
            {step.completed ? "✓" : index + 1}
          </div>
          <div className="timeline-label">{step.label}</div>
          {step.timestamp && <div className="timeline-timestamp">{step.timestamp}</div>}
        </div>
      ))}
    </div>
  );
}
