"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-16 px-6 text-center",
        className,
      )}
    >
      {icon && (
        <span className="text-[#5E6068] mb-1 size-10 flex items-center justify-center">
          {icon}
        </span>
      )}
      <p className="text-sm font-medium text-[#E5E4E2]">{title}</p>
      {description && (
        <p className="text-xs text-[#5E6068] max-w-xs">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
