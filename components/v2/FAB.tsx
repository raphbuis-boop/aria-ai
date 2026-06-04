"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface FABProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  label: string;
  size?: "sm" | "md" | "lg";
}

const sizeClass = {
  sm: "size-10",
  md: "size-12",
  lg: "size-14",
};

export function FAB({ icon, label, size = "md", className, ...props }: FABProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "flex items-center justify-center rounded-full",
        "bg-[#4F5BFF] text-white",
        "shadow-lg shadow-[#4F5BFF]/30",
        "transition-transform duration-[150ms] active:scale-95",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F5BFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A]",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        sizeClass[size],
        className,
      )}
      {...props}
    >
      {icon}
    </button>
  );
}
