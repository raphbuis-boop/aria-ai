"use client";

import { useRef, useState, type ReactNode, type RefObject } from "react";
import { ForestAtmosphere, Grain } from "./atmosphere";

export { Grain };
import { motion, useMotionValueEvent, useTransform, type MotionValue } from "motion/react";
import { cn } from "@/lib/utils";
import { DEMO } from "./demo-data";
import { smoothScrollTo } from "./SmoothScroll";
import { captionOpacity, chapterIndexAt, chapterScrollTop, progressIn, type Chapter } from "./timeline";
import { useFitScale } from "./hooks";

/** A fixed logical canvas (w × h) scaled to fit its box, centered. Hidden until measured. */
export function ScaledStage({ w, h, max, className, children }: { w: number; h: number; max?: number; className?: string; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const scale = useFitScale(box, w, h, max);
  return (
    <div ref={box} className={cn("relative flex items-center justify-center", className)}>
      <div style={{ width: w * (scale ?? 1), height: h * (scale ?? 1), opacity: scale ? 1 : 0 }} className="relative">
        <div className="absolute left-0 top-0 origin-top-left" style={{ width: w, height: h, transform: `scale(${scale ?? 1})` }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/** Ivory → deep forest as the story moves into the product, with a faint sage glow and grain. */
export function Backdrop({ p, dark }: { p: MotionValue<number>; dark: readonly [number, number] }) {
  const ref = useRef<HTMLDivElement>(null);
  const opacity = useTransform(p, (v) => progressIn(v, dark));
  // Tell the nav how much forest is behind it (read from the enclosing [data-env]).
  useMotionValueEvent(opacity, "change", (v) => {
    const host = ref.current?.closest<HTMLElement>("[data-env]");
    if (host) host.dataset.forest = v.toFixed(3);
  });
  return (
    <div ref={ref} aria-hidden className="absolute inset-0 overflow-hidden bg-background">
      {/* faint ivory-phase glow; fades in from the top so the dawn above meets pure ivory (no edge) */}
      <div
        className="absolute inset-0"
        style={{ maskImage: "linear-gradient(to bottom, transparent, black 28%)", WebkitMaskImage: "linear-gradient(to bottom, transparent, black 28%)" }}
      >
        <div className="absolute left-1/2 top-[55%] size-[110vmax] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--glow) 14%, transparent), transparent 55%)" }} />
      </div>
      <motion.div className="absolute inset-0" style={{ opacity }}>
        <ForestAtmosphere glow="center" grain={false} feather="bottom" />
      </motion.div>
      <Grain />
    </div>
  );
}

function Caption({ c, i, total, p, light, size }: { c: Chapter; i: number; total: number; p: MotionValue<number>; light: boolean; size: "lg" | "sm" }) {
  const opacity = useTransform(p, (v) => captionOpacity(v, c.range, i === total - 1, i === 0));
  const y = useTransform(opacity, (o) => (1 - o) * 18);
  return (
    <div className={cn("absolute inset-x-0", size === "lg" ? "top-1/2 -translate-y-1/2" : "top-0")}>
    <motion.div style={{ opacity, y }}>
      <p className={cn("font-mono text-[11px] font-semibold uppercase tracking-[0.22em]", light ? "text-sidebar-muted" : "text-muted-foreground")}>
        {c.n} <span className="font-normal">/ 0{total}</span>
      </p>
      <h3
        className={cn(
          "font-heading font-normal tracking-[-0.03em]",
          size === "lg" ? "mt-4 text-[clamp(2.4rem,3.6vw,3.6rem)] leading-[1.02]" : "mt-2.5 text-[27px] leading-[1.05]",
          light ? "text-sidebar-foreground" : "text-foreground",
        )}
      >
        {c.title}
      </h3>
      <p className={cn("max-w-[34ch] font-display leading-relaxed", size === "lg" ? "mt-4 text-[17px]" : "mt-2 text-[13.5px]", light ? "text-sidebar-muted" : "text-muted-foreground")}>
        {c.body}
      </p>
    </motion.div>
    </div>
  );
}

/** Stacked chapter captions; each fades in and out with its range. Chapters from `lightFrom` on sit on the dark backdrop. */
export function Captions({ list, p, lightFrom, size }: { list: Chapter[]; p: MotionValue<number>; lightFrom: number; size: "lg" | "sm" }) {
  return (
    <div className="relative h-full w-full">
      {list.map((c, i) => (
        <Caption key={c.id} c={c} i={i} total={list.length} p={p} light={i >= lightFrom} size={size} />
      ))}
    </div>
  );
}

/**
 * Chapter rail: a progress hairline and one button per chapter. Buttons jump
 * the scroll to that chapter, so the story is fully keyboard-navigable.
 */
export function ChapterRail({
  list,
  p,
  section,
  skipTo,
  compact = false,
}: {
  list: Chapter[];
  p: MotionValue<number>;
  section: RefObject<HTMLElement | null>;
  skipTo: string;
  compact?: boolean;
}) {
  const [active, setActive] = useState(0);
  useMotionValueEvent(p, "change", (v) => {
    const i = chapterIndexAt(v, list);
    if (i !== active) setActive(i);
  });
  const fill = useTransform(p, (v) => v);

  const go = (i: number) => {
    const el = section.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    smoothScrollTo(chapterScrollTop(top, el.offsetHeight, window.innerHeight, list[i].range));
  };
  const skip = () => {
    const el = document.getElementById(skipTo);
    if (!el) return;
    smoothScrollTo(el);
    el.focus({ preventScroll: true });
  };

  return (
    <nav aria-label="Demo chapters" className="pointer-events-auto rounded-full border border-border bg-background/85 p-1.5 shadow-float backdrop-blur-xl">
      <div className="relative flex items-center gap-1">
        <motion.span aria-hidden className="absolute inset-x-3 -bottom-0.5 h-px origin-left bg-primary" style={{ scaleX: fill }} />
        {list.map((c, i) => (
          <button
            key={c.id}
            type="button"
            onClick={() => go(i)}
            aria-current={i === active ? "step" : undefined}
            aria-label={`Chapter ${c.n}: ${c.title}`}
            className={cn(
              "relative rounded-full font-mono text-[11px] font-semibold tracking-[0.12em] outline-none transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-ring",
              compact ? "h-8 w-8" : "h-8 px-3",
              i === active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {c.n}
          </button>
        ))}
        <button
          type="button"
          onClick={skip}
          className="ml-1 h-8 rounded-full px-3 font-display text-[12px] font-semibold text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          Skip demo
        </button>
      </div>
      <p className="sr-only" aria-live="polite">{`Chapter ${list[active].n}: ${list[active].title}`}</p>
    </nav>
  );
}

/** The demo as text, for screen readers (the animated stage is aria-hidden). */
export function SrNarrative() {
  return (
    <div className="sr-only">
      <h2>Demo: one question to Aria</h2>
      <ol>
        <li>The agent writes to Aria: “{DEMO.ask}”</li>
        <li>
          Aria checks today’s priorities, ranks the hottest leads and finds who has gone quiet, then replies: “{DEMO.reply}” Found in Aria:{" "}
          {DEMO.found.map((c) => `${c.status}: ${c.summary}.`).join(" ")}
        </li>
        <li>Priya’s showing at 11:00 AM is on the agent’s Showings list, and the Monday follow-up waits in Follow-ups.</li>
        <li>The same day on Aria’s mobile Today screen: Priya’s showing at 11:00 AM and Elena Ruiz’s at 1:00 PM.</li>
        <li>Aria alongside the agent’s tools: Gmail, Messages and Google Contacts are connected; Follow Up Boss, kvCORE, Salesforce and LionDesk come in through CSV import; Google Calendar, Outlook and WhatsApp are coming soon.</li>
      </ol>
    </div>
  );
}
