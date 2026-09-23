/**
 * Regional note — New Jersey only (no out-of-state rollout messaging).
 */
export function MarketsComingSoonNote({
  className = "",
  variant = "default",
}: {
  className?: string;
  variant?: "default" | "badge";
}) {
  if (variant === "badge") {
    return (
      <span
        className={`inline-flex items-center rounded-full border border-border bg-secondary px-2.5 py-1 text-[10px] font-medium text-muted-foreground ${className}`}
      >
        New Jersey listings
      </span>
    );
  }
  return (
    <p className={`text-[11px] text-muted-foreground ${className}`}>
      New Jersey listings.
    </p>
  );
}
