"use client";

import { ChevronDown, Flame } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type MatchSummary = {
  client_id: string;
  client_name: string;
  score: number;
};

/**
 * Tappable badge showing the highest-scoring client match for a property.
 *
 * - 0 matches: nothing rendered.
 * - 1 match:  "92% · Mike Rodriguez"
 * - 2+ matches: "92% · Mike Rodriguez +2 others" — tap opens a dropdown with
 *   the full list sorted by score.
 */
export function MatchScoreBadge({ matches }: { matches: MatchSummary[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  if (!matches.length) return null;
  const sorted = [...matches].sort((a, b) => b.score - a.score);
  const top = sorted[0];
  const others = sorted.length - 1;
  const peers = sorted.slice(1).filter((m) => top.score - m.score <= 5);

  const label =
    others === 0
      ? `${top.score}% · ${top.client_name}`
      : peers.length > 0
        ? `${top.score}% · ${top.client_name.split(" ")[0]} +${others} other${others === 1 ? "" : "s"}`
        : `${top.score}% · ${top.client_name}`;

  const tone =
    top.score >= 85
      ? "bg-green-500/15 text-green-400 border-green-500/30"
      : top.score >= 70
        ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
        : "bg-accent-blue/15 text-accent-blue border-accent-blue/30";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-semibold ${tone}`}
      >
        <Flame size={11} />
        <span>{label}</span>
        {others > 0 ? <ChevronDown size={11} /> : null}
      </button>
      {open && others > 0 ? (
        <div className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-[10px] border border-border-card bg-bg-card shadow-lg">
          {sorted.map((m) => (
            <div
              key={m.client_id}
              className="flex items-center justify-between gap-2 border-b border-border-card px-3 py-1.5 text-[12px] last:border-0"
            >
              <span className="truncate text-text-primary">{m.client_name}</span>
              <span className="font-semibold text-text-secondary">
                {m.score}%
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
