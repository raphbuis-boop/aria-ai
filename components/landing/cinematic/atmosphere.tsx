"use client";

/**
 * The two environments of the landing and the dissolves between them.
 *
 * ForestAtmosphere is the approved theater look (deep forest with a soft sage
 * glow behind the product) plus a slow ambient haze. Every forest section
 * uses it, so the forest reads as one continuous space.
 *
 * EnvZone is a scroll-driven dissolve. A forest layer 1.5× the zone's height,
 * with a soft baked mask edge, slides with scroll (transform only), so the
 * boundary drifts like haze lifting or gathering. The geometry lives in
 * timeline.ts (zoneShift / zoneForestAt) and is tested so the zone's edges
 * always match the sections beside it.
 */

import { useRef } from "react";
import { motion, useMotionValueEvent, useScroll, useTransform } from "motion/react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "./hooks";
import { ZONES, ZONE_LAYER, progressIn, zoneShift, type ZoneDir } from "./timeline";

type Glow = "center" | "top" | "bottom" | "none";

const GLOW: Record<Exclude<Glow, "none">, string> = {
  center: "left-1/2 top-[55%] -translate-x-1/2 -translate-y-1/2",
  top: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2",
  bottom: "left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2",
};

/** Height of the edge feather that returns haze and glow to the plain forest base. */
const FEATHER = "h-[min(32vh,300px)]";

/**
 * Deep forest + sage glow + slow haze (one warm taupe drift). Decorative; fills its positioned parent.
 * `feather` fades haze and glow to the plain base at edges shared with another
 * forest area, so neighbouring forest sections always meet on identical color.
 */
export function ForestAtmosphere({
  glow = "center",
  grain = true,
  feather,
  className,
}: {
  glow?: Glow;
  grain?: boolean;
  feather?: "top" | "bottom" | "both";
  className?: string;
}) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden bg-sidebar", className)}>
      {/* haze: soft, pre-blurred gradients drifting very slowly (transform only; off for reduced motion) */}
      <div
        className="absolute -left-[20%] -top-[30%] size-[80vmax] rounded-full will-change-transform motion-safe:animate-[haze-a_64s_ease-in-out_infinite_alternate]"
        style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--sidebar-raised) 85%, transparent), transparent 62%)" }}
      />
      <div
        className="absolute -bottom-[35%] -right-[25%] size-[75vmax] rounded-full will-change-transform motion-safe:animate-[haze-b_78s_ease-in-out_infinite_alternate]"
        style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--taupe) 8%, transparent), transparent 60%)" }}
      />
      <div
        className="absolute left-[30%] top-[20%] hidden size-[55vmax] rounded-full will-change-transform motion-safe:animate-[haze-c_96s_ease-in-out_infinite_alternate] sm:block"
        style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--sidebar-foreground) 4%, transparent), transparent 58%)" }}
      />
      {/* the sage glow around the product (approved theater recipe, recoloured) */}
      {glow !== "none" ? (
        <div
          className={cn("absolute size-[90vmax] rounded-full", GLOW[glow])}
          style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--glow) 18%, transparent), transparent 60%)" }}
        />
      ) : null}
      {feather === "top" || feather === "both" ? <div className={cn("absolute inset-x-0 top-0 bg-gradient-to-b from-sidebar to-transparent", FEATHER)} /> : null}
      {feather === "bottom" || feather === "both" ? <div className={cn("absolute inset-x-0 bottom-0 bg-gradient-to-t from-sidebar to-transparent", FEATHER)} /> : null}
      {grain ? <Grain /> : null}
    </div>
  );
}

/** The sage light that rises out of the dusk and continues into the finale (same size on both sides of the seam). */
export const FINALE_GLOW = "size-[min(1100px,140vw)]";
export const FINALE_GLOW_BG = "radial-gradient(circle, color-mix(in srgb, var(--glow) 24%, transparent), transparent 60%)";

/**
 * A dissolve between environments. `dawn` = forest above → ivory below,
 * `dusk` = ivory above → forest below. Progress runs while the zone scrolls in
 * (top enters the viewport → bottom reaches the viewport bottom).
 */
export function EnvZone({ dir, className }: { dir: ZoneDir; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = usePrefersReducedMotion();
  const z = ZONES[dir];
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start end", "end end"] });
  // translateY in % of the layer's own height (the layer is ZONE_LAYER × the zone)
  const y = useTransform(p, (v) => `${(zoneShift(dir, reduce ? 1 : v) / ZONE_LAYER) * 100}%`);
  const lift = useTransform(p, (v) => `${(reduce ? 1 : v) * (dir === "dawn" ? -14 : 10)}%`);
  const orb = useTransform(p, (v) => (dir === "dusk" ? progressIn(reduce ? 1 : v, [0.2, 1]) : 0));
  useMotionValueEvent(p, "change", (v) => {
    if (ref.current) ref.current.dataset.p = String(reduce ? 1 : v);
  });

  const mask =
    dir === "dawn"
      ? `linear-gradient(to bottom, black ${z.a * 100}%, transparent ${z.b * 100}%)`
      : `linear-gradient(to bottom, transparent ${z.a * 100}%, black ${z.b * 100}%)`;

  return (
    <div
      ref={ref}
      aria-hidden
      data-env="zone"
      data-dir={dir}
      data-p={reduce ? "1" : "0"}
      className={cn("relative overflow-clip bg-background", className)}
    >
      <motion.div
        className="absolute inset-x-0"
        style={{ top: `${z.top * 100}%`, height: `${ZONE_LAYER * 100}%`, y, maskImage: mask, WebkitMaskImage: mask }}
      >
        <ForestAtmosphere glow="none" feather={dir === "dawn" ? "top" : "bottom"} />
        {/* a lighter wisp that moves a little faster than the boundary: haze lifting (dawn) or settling (dusk) */}
        <motion.div
          className="absolute inset-x-[-10%] h-1/2 will-change-transform"
          style={{
            y: lift,
            top: dir === "dawn" ? "30%" : "35%",
            background: "radial-gradient(60% 50% at 50% 50%, color-mix(in srgb, var(--sidebar-muted) 10%, transparent), transparent 70%)",
          }}
        />
      </motion.div>
      {dir === "dusk" ? (
        <div
          className="absolute inset-0"
          style={{ maskImage: "linear-gradient(to bottom, transparent 35%, black 80%)", WebkitMaskImage: "linear-gradient(to bottom, transparent 35%, black 80%)" }}
        >
          <motion.div
            className={cn("absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rounded-full", FINALE_GLOW)}
            style={{ opacity: orb, background: FINALE_GLOW_BG }}
          />
        </div>
      ) : null}
    </div>
  );
}

export function Grain({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-multiply", className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      }}
    />
  );
}
