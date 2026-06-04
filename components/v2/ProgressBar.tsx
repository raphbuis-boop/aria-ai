"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface ProgressBarProps {
  /** 0–100 */
  value: number;
  /** Track height in px */
  height?: number;
  variant?: "default" | "success" | "warning" | "risk";
  className?: string;
  "aria-label"?: string;
}

const fillClass = {
  default: "bg-[#4F5BFF]",
  success: "bg-[#2ECC71]",
  warning: "bg-[#F5A623]",
  risk: "bg-[#FF4D4D]",
};

export function ProgressBar({
  value,
  height = 4,
  variant = "default",
  className,
  "aria-label": ariaLabel,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
      className={cn("w-full rounded-full bg-[#2A2B30] overflow-hidden", className)}
      style={{ height }}
    >
      <div
        className={cn("h-full rounded-full transition-all duration-[250ms]", fillClass[variant])}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
