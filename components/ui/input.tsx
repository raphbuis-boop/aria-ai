"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full rounded-[8px] border border-border-card bg-bg-deep px-4 py-3 text-[16px] text-text-primary placeholder:text-text-dim outline-none transition-colors",
          "focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
