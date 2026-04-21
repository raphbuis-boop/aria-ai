"use client";

import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";

/**
 * Section wrapper with a subtle heading, optional summary, right-side action
 * slot, and a collapse/expand chevron. Used on the client detail page so
 * agents can focus on the section they care about.
 */
export function CollapsibleSection({
  title,
  summary,
  right,
  defaultOpen = true,
  className = "",
  children,
}: {
  title: string;
  summary?: string | null;
  right?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={`mb-5 ${className}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="group flex min-w-0 flex-1 items-center gap-1.5 text-left"
          aria-expanded={open}
        >
          <ChevronDown
            size={12}
            className={`text-[#555570] transition-transform ${open ? "" : "-rotate-90"}`}
            strokeWidth={2.5}
          />
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#444460] group-hover:text-[#888898]">
            {title}
          </span>
          {summary ? (
            <span className="truncate text-[10px] text-[#555570]">
              · {summary}
            </span>
          ) : null}
        </button>
        {right ? <div className="flex-shrink-0">{right}</div> : null}
      </div>
      {open ? <div>{children}</div> : null}
    </section>
  );
}

export default CollapsibleSection;
