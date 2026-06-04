"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "accent" | "success" | "warning" | "risk" | "muted";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClass: Record<BadgeVariant, string> = {
  default: "bg-[#1C1D21] text-[#9A9CA3] border border-[#2A2B30]",
  accent: "bg-[#4F5BFF]/15 text-[#4F5BFF]",
  success: "bg-[#2ECC71]/12 text-[#2ECC71]",
  warning: "bg-[#F5A623]/12 text-[#F5A623]",
  risk: "bg-[#FF4D4D]/12 text-[#FF4D4D]",
  muted: "bg-[#536878]/15 text-[#9A9CA3]",
};

export function Badge({
  variant = "default",
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5",
        "rounded-full text-[0.6875rem] font-medium leading-none",
        variantClass[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

/** Alias — same as Badge, slightly larger pill shape */
export const Pill = Badge;
