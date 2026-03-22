"use client";

export function PulseIndicator({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <span
      className="inline-block h-2 w-2 rounded-full bg-accent-blue animate-aria-pulse"
      aria-hidden
    />
  );
}
