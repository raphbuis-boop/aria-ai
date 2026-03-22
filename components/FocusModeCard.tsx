"use client";

export function FocusModeToggle({
  on,
  onToggle,
}: {
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="rounded-[8px] border border-border-card bg-bg-primary px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-text-dim"
    >
      Focus mode: {on ? "On" : "Off"}
    </button>
  );
}
