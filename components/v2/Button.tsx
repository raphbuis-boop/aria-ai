"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "ghost" | "destructive";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
}

const variantClass: Record<ButtonVariant, string> = {
  primary:
    "bg-[#4F5BFF] text-[#E5E4E2] hover:bg-[#4350e6] active:bg-[#3a46cc]",
  ghost:
    "bg-transparent text-[#9A9CA3] hover:bg-[#1C1D21] hover:text-[#E5E4E2] active:bg-[#2A2B30]",
  destructive:
    "bg-transparent text-[#FF4D4D] hover:bg-[#FF4D4D]/10 active:bg-[#FF4D4D]/20",
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs rounded-[6px]",
  md: "h-10 px-4 text-sm rounded-[10px]",
  lg: "h-12 px-5 text-base rounded-[14px]",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      loading = false,
      fullWidth = false,
      disabled,
      className,
      children,
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-medium",
          "transition-colors duration-[150ms]",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F5BFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A]",
          variantClass[variant],
          sizeClass[size],
          fullWidth && "w-full",
          className,
        )}
        {...props}
      >
        {loading ? (
          <span className="size-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
        ) : null}
        {children}
      </button>
    );
  },
);
