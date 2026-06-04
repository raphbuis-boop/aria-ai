"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Sheet({ open, onClose, title, children, className }: SheetProps) {
  // Lock body scroll while open
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative z-10 bg-[#141416] border border-[#2A2B30]",
          "rounded-t-[18px] max-h-[90dvh] overflow-y-auto",
          className,
        )}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full bg-[#2A2B30]" />
        </div>

        {title && (
          <div className="px-5 pb-3 border-b border-[#2A2B30]">
            <p className="text-sm font-semibold text-[#E5E4E2]">{title}</p>
          </div>
        )}

        <div className="pb-[env(safe-area-inset-bottom)]">{children}</div>
      </div>
    </div>
  );
}

/** Alias */
export const Modal = Sheet;
