"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { DealStage } from "@/lib/types";

const STAGES: { key: DealStage; label: string }[] = [
  { key: "inquiry", label: "Inquiry" },
  { key: "showing", label: "Showing" },
  { key: "offer", label: "Offer" },
  { key: "under_contract", label: "Under Contract" },
  { key: "closed", label: "Closed" },
];

interface StageStepperProps {
  current: DealStage;
  /** If true, show the Lost state */
  lost?: boolean;
  className?: string;
}

export function StageStepper({ current, lost, className }: StageStepperProps) {
  const currentIdx = STAGES.findIndex((s) => s.key === current);

  if (lost) {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        <span className="text-xs text-[#FF4D4D] font-medium">Lost</span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {STAGES.map((stage, idx) => {
        const isComplete = idx < currentIdx;
        const isActive = idx === currentIdx;

        return (
          <React.Fragment key={stage.key}>
            <div className="flex flex-col items-center gap-0.5">
              <div
                className={cn(
                  "size-2 rounded-full transition-colors duration-[150ms]",
                  isComplete && "bg-[#4F5BFF]",
                  isActive && "bg-[#E5E4E2]",
                  !isComplete && !isActive && "bg-[#2A2B30]",
                )}
              />
              <span
                className={cn(
                  "text-[0.6rem] leading-none",
                  isActive && "text-[#E5E4E2] font-medium",
                  !isActive && "text-[#5E6068]",
                )}
              >
                {stage.label}
              </span>
            </div>
            {idx < STAGES.length - 1 && (
              <div
                className={cn(
                  "h-px flex-1 mb-3 transition-colors duration-[150ms]",
                  isComplete ? "bg-[#4F5BFF]" : "bg-[#2A2B30]",
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
