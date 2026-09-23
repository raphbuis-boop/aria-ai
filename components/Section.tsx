import Link from "next/link";
import { cn, initials } from "@/lib/utils";

/** Labeled page section with an optional "See all →" style link. */
export function Section({
  label,
  count,
  action,
  className,
  children,
}: {
  label: string;
  count?: number;
  action?: { href: string; label: string };
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("mb-10", className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-section uppercase text-muted-foreground">
          {label}
          {count ? (
            <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold tracking-normal text-primary-foreground">
              {count}
            </span>
          ) : null}
        </h2>
        {action ? (
          <Link href={action.href} className="font-display text-caption font-semibold text-primary">
            {action.label}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border px-6 py-7 text-center">
      <p className="font-display text-body text-muted-foreground">{children}</p>
    </div>
  );
}

export function Avatar({ name, className }: { name: string | null | undefined; className?: string }) {
  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary font-display text-caption font-semibold text-foreground",
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

/** Small pill. `tone` picks the color; defaults to neutral. */
export function Pill({
  tone = "neutral",
  className,
  children,
}: {
  tone?: "neutral" | "primary" | "hot" | "warm";
  className?: string;
  children: React.ReactNode;
}) {
  const tones = {
    neutral: "bg-secondary text-muted-foreground",
    primary: "bg-primary/10 text-primary",
    hot: "bg-hot/10 text-hot",
    warm: "bg-warm/15 text-warm",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 font-display text-[11px] font-semibold",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
