"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type SurfaceVariant = "base" | "surface" | "raised";

interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: SurfaceVariant;
  /** Apply card-lg radius (default: true) */
  rounded?: boolean;
  /** Apply 1px border using token border color (default: true) */
  bordered?: boolean;
  as?: React.ElementType;
}

const variantClass: Record<SurfaceVariant, string> = {
  base: "bg-[#0A0A0A]",
  surface: "bg-[#141416]",
  raised: "bg-[#1C1D21]",
};

export function Surface({
  variant = "surface",
  rounded = true,
  bordered = true,
  as: Tag = "div",
  className,
  children,
  ...props
}: SurfaceProps) {
  return (
    <Tag
      className={cn(
        variantClass[variant],
        rounded && "rounded-[14px]",
        bordered && "border border-[#2A2B30]",
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}

/** Convenience alias */
export const Card = Surface;
