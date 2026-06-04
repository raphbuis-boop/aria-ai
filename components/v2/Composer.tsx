"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  /** Right-side action button label */
  submitLabel?: string;
  className?: string;
  /** Max rows before scroll */
  maxRows?: number;
}

export function Composer({
  value,
  onChange,
  onSubmit,
  placeholder = "Message…",
  disabled,
  loading,
  submitLabel = "Send",
  className,
  maxRows = 6,
}: ComposerProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  React.useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const lineHeight = 20;
    const maxHeight = lineHeight * maxRows + 24;
    ta.style.height = `${Math.min(ta.scrollHeight, maxHeight)}px`;
  }, [value, maxRows]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled && !loading) {
        onSubmit(value.trim());
      }
    }
  }

  return (
    <div
      className={cn(
        "flex items-end gap-2 px-3 py-2",
        "bg-[#1C1D21] border border-[#2A2B30] rounded-[14px]",
        className,
      )}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || loading}
        rows={1}
        className={cn(
          "flex-1 bg-transparent resize-none outline-none",
          "text-sm text-[#E5E4E2] placeholder:text-[#5E6068]",
          "disabled:opacity-40",
          "py-1 leading-5",
        )}
        style={{ fontSize: "16px" }} // prevent iOS zoom on focus
      />
      <button
        type="button"
        disabled={!value.trim() || disabled || loading}
        onClick={() => {
          if (value.trim() && !disabled && !loading) onSubmit(value.trim());
        }}
        className={cn(
          "shrink-0 h-8 px-3 rounded-[10px] text-xs font-semibold",
          "bg-[#4F5BFF] text-white",
          "disabled:opacity-30 disabled:cursor-not-allowed",
          "transition-opacity duration-[150ms]",
        )}
      >
        {loading ? (
          <span className="size-3 rounded-full border-2 border-white border-t-transparent animate-spin inline-block" />
        ) : (
          submitLabel
        )}
      </button>
    </div>
  );
}
