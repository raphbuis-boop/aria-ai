"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface ActionRowProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Left-side icon or element */
  icon?: React.ReactNode;
  /** Main label */
  label: string;
  /** Sub-label below main label */
  description?: string;
  /** Right-side trailing content (badge, chevron, value) */
  trailing?: React.ReactNode;
  /** Render as a pressable row */
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  disabled?: boolean;
}

export function ActionRow({
  icon,
  label,
  description,
  trailing,
  onClick,
  disabled,
  className,
  ...props
}: ActionRowProps) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick && !disabled ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick(e as unknown as React.MouseEventHandler<HTMLDivElement> extends (e: infer E) => void ? E : never);
              }
            }
          : undefined
      }
      onClick={!disabled ? onClick : undefined}
      className={cn(
        "flex items-center gap-3 px-4 py-3",
        "transition-colors duration-[150ms]",
        onClick && !disabled && "cursor-pointer hover:bg-[#1C1D21] active:bg-[#2A2B30]",
        disabled && "opacity-40 cursor-not-allowed",
        className,
      )}
      {...props}
    >
      {icon && (
        <span className="shrink-0 size-5 flex items-center justify-center text-[#9A9CA3]">
          {icon}
        </span>
      )}
      <span className="flex-1 min-w-0">
        <span className="block text-sm text-[#E5E4E2] font-medium truncate">
          {label}
        </span>
        {description && (
          <span className="block text-xs text-[#5E6068] truncate mt-0.5">
            {description}
          </span>
        )}
      </span>
      {trailing && (
        <span className="shrink-0 text-[#9A9CA3]">{trailing}</span>
      )}
    </div>
  );
}
