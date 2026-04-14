/**
 * Subtle regional expansion note — NJ primary; NY & CT on roadmap.
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
        className={`inline-flex items-center rounded-full border border-border-card bg-bg-deep px-2.5 py-1 text-[10px] font-medium text-text-dim ${className}`}
      >
        <span className="text-accent-blue">NY & CT</span>
        <span className="ml-1">coming soon</span>
      </span>
    );
  }
  return (
    <p className={`text-[11px] text-text-dim ${className}`}>
      <span className="text-accent-blue">NY & CT</span> coming soon
    </p>
  );
}
