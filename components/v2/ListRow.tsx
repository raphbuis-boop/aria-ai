"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface ListRowProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Primary line */
  primary: React.ReactNode;
  /** Secondary line */
  secondary?: React.ReactNode;
  /** Leading element (avatar, icon) */
  leading?: React.ReactNode;
  /** Trailing element (badge, value, chevron) */
  trailing?: React.ReactNode;
  /** Show separator below row */
  divided?: boolean;
}

export function ListRow({
  primary,
  secondary,
  leading,
  trailing,
  divided = false,
  className,
  ...props
}: ListRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3",
        "transition-colors duration-[150ms]",
        props.onClick && "cursor-pointer hover:bg-[#1C1D21] active:bg-[#2A2B30]",
        divided && "border-b border-[#2A2B30]",
        className,
      )}
      {...props}
    >
      {leading && <span className="shrink-0">{leading}</span>}
      <span className="flex-1 min-w-0">
        <span className="block text-sm text-[#E5E4E2] truncate">{primary}</span>
        {secondary && (
          <span className="block text-xs text-[#9A9CA3] truncate mt-0.5">
            {secondary}
          </span>
        )}
      </span>
      {trailing && (
        <span className="shrink-0 text-[#9A9CA3] text-xs">{trailing}</span>
      )}
    </div>
  );
}
