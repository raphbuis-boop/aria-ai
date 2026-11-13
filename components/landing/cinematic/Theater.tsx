"use client";

import { useMotionValue } from "motion/react";
import { cn } from "@/lib/utils";
import { DesktopStage, DesktopTheater, STAGE_H, STAGE_W } from "./DesktopTheater";
import { MobileStage, MobileTheater, M_H, M_W } from "./MobileTheater";
import { usePrefersReducedMotion } from "./hooks";
import { ScaledStage, SrNarrative } from "./theater-chrome";
import { ForestAtmosphere } from "./atmosphere";
import { FRAME_POINTS, chapters } from "./timeline";

function Frame({ variant, at }: { variant: "desktop" | "mobile"; at: number }) {
  const p = useMotionValue(at);
  return variant === "desktop" ? <DesktopStage p={p} /> : <MobileStage p={p} />;
}

/** Reduced motion: the same stages, frozen at each chapter's finished state, as a plain sequence. */
function StaticStory({ variant }: { variant: "desktop" | "mobile" }) {
  const list = chapters(variant);
  const darkFrom = variant === "desktop" ? 2 : 3;
  return (
    <section id={variant === "desktop" ? "demo" : "demo-mobile"} aria-label="How Aria works" className="relative">
      <SrNarrative />
      <ol>
        {list.map((c, i) => {
          const dark = i >= darkFrom;
          return (
            <li key={c.id} data-env={dark ? "forest" : "ivory"} className={cn("relative px-5 py-16 lg:px-14 lg:py-24", dark ? "bg-sidebar" : "bg-background")}>
              {dark ? <ForestAtmosphere glow="none" /> : null}
              <div className="relative mx-auto grid max-w-[1400px] items-center gap-8 lg:grid-cols-[minmax(280px,28%)_1fr] lg:gap-12">
                <div>
                  <p className={cn("font-mono text-[11px] font-semibold uppercase tracking-[0.22em]", dark ? "text-sidebar-muted" : "text-muted-foreground")}>
                    {c.n} <span className="font-normal">/ 05</span>
                  </p>
                  <h3 className={cn("mt-3 font-heading text-[clamp(1.9rem,3.4vw,3.2rem)] font-normal leading-[1.04] tracking-[-0.03em]", dark ? "text-sidebar-foreground" : "text-foreground")}>
                    {c.title}
                  </h3>
                  <p className={cn("mt-3 max-w-[34ch] font-display text-[15px] leading-relaxed lg:text-[17px]", dark ? "text-sidebar-muted" : "text-muted-foreground")}>{c.body}</p>
                </div>
                <div aria-hidden className={variant === "desktop" ? "aspect-[3/2]" : "mx-auto aspect-[9/14] w-full max-w-[400px]"}>
                  <ScaledStage w={variant === "desktop" ? STAGE_W : M_W} h={variant === "desktop" ? STAGE_H : M_H} className="h-full w-full">
                    <Frame variant={variant} at={FRAME_POINTS[variant][c.id]} />
                  </ScaledStage>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/**
 * The centerpiece. Desktop (lg+) and phone get separately designed theaters;
 * reduced motion gets the same story as still frames. Both variants render and
 * CSS picks one, so there's no hydration flash or layout jump.
 */
export function Theater() {
  const reduce = usePrefersReducedMotion();
  return (
    <>
      <div className="hidden lg:block">{reduce ? <StaticStory variant="desktop" /> : <DesktopTheater />}</div>
      <div className="lg:hidden">{reduce ? <StaticStory variant="mobile" /> : <MobileTheater />}</div>
    </>
  );
}
