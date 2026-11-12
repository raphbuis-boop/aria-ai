"use client";

import { useRef, type CSSProperties, type ReactNode } from "react";
import { ArrowRight, Play } from "lucide-react";
import { motion, useMotionValue, useScroll, useSpring, useTransform } from "motion/react";
import { cn } from "@/lib/utils";
import { AriaOrb } from "./AriaOrb";
import { usePrefersReducedMotion } from "./hooks";
import { smoothScrollTo } from "./SmoothScroll";
import { ForestAtmosphere } from "./atmosphere";

/** CSS-driven entrance (works before hydration; motion-safe only). */
const rise = (delay: number): CSSProperties => ({ animationDelay: `${delay}ms` });

function Line({ children, delay, className }: { children: ReactNode; delay: number; className?: string }) {
  return (
    <span className="block overflow-hidden pb-[0.08em]">
      <span className={cn("block motion-safe:animate-[line-rise_1.15s_cubic-bezier(0.16,1,0.3,1)_both]", className)} style={rise(delay)}>
        {children}
      </span>
    </span>
  );
}

export function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  smoothScrollTo(el);
}

/** The demo has a desktop and a phone version; jump to whichever is showing. */
export function scrollToDemo() {
  const el = document.getElementById("how");
  if (el) smoothScrollTo(el);
}

export function PrimaryCta({ children, onClick, href, className, tone = "ivory" }: { children: ReactNode; onClick?: () => void; href?: string; className?: string; tone?: "ivory" | "forest" }) {
  const cls = cn(
    "group relative inline-flex h-[52px] items-center gap-2.5 overflow-hidden rounded-full px-7 font-display text-[15px] font-semibold shadow-float outline-none",
    "transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-0.5 hover:shadow-pop active:translate-y-0 active:scale-[0.98]",
    "focus-visible:ring-2 focus-visible:ring-offset-2",
    tone === "forest"
      ? "bg-sidebar-accent text-sidebar-accent-foreground focus-visible:ring-sidebar-foreground focus-visible:ring-offset-sidebar"
      : "bg-primary text-primary-foreground focus-visible:ring-ring focus-visible:ring-offset-background",
    className,
  );
  const inner = (
    <>
      <span aria-hidden className="absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-paper/30 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-[420%]" />
      <span className="relative">{children}</span>
      <ArrowRight className="relative size-4 transition-transform duration-300 group-hover:translate-x-1" />
    </>
  );
  return href ? (
    <a href={href} onClick={onClick ? (e) => { e.preventDefault(); onClick(); } : undefined} className={cls}>{inner}</a>
  ) : (
    <button type="button" onClick={onClick} className={cls}>{inner}</button>
  );
}

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const orbY = useTransform(scrollYProgress, [0, 1], [0, 260]);
  const orbS = useTransform(scrollYProgress, [0, 1], [1, 0.6]);
  const textY = useTransform(scrollYProgress, [0, 1], [0, -90]);
  const textO = useTransform(scrollYProgress, [0, 0.75], [1, 0]);

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const px = useSpring(mx, { stiffness: 50, damping: 18 });
  const py = useSpring(my, { stiffness: 50, damping: 18 });

  const onPointerMove = (e: React.PointerEvent) => {
    if (reduce || e.pointerType !== "mouse") return;
    mx.set((e.clientX / window.innerWidth - 0.5) * 28);
    my.set((e.clientY / window.innerHeight - 0.5) * 20);
  };

  return (
    <section ref={ref} id="top" data-env="forest" aria-labelledby="hero-title" onPointerMove={onPointerMove} className="relative min-h-[100svh] overflow-clip bg-sidebar">
      {/* atmosphere: the approved forest (haze + grain); its sage glow travels with the orb below. Bottom feathers into the dawn. */}
      <ForestAtmosphere glow="none" feather="bottom" />

      {/* the orb, with two hairline orbits */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute right-[-18vw] top-[96px] sm:right-[-8vw] lg:right-[3vw] lg:top-[14vh]"
        style={reduce ? undefined : { y: orbY, scale: orbS }}
      >
        <motion.div style={reduce ? undefined : { x: px, y: py }} className="relative motion-safe:animate-[rise-in_1.6s_cubic-bezier(0.16,1,0.3,1)_both]">
          <div className="relative size-[min(68vw,300px)] sm:size-[min(48vw,420px)] lg:size-[min(36vw,540px)]">
            {/* soft sage atmospheric light, centred on the orb */}
            <div
              className="absolute left-1/2 top-1/2 size-[90vmax] -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--glow) 20%, transparent), transparent 60%)" }}
            />
            <div className="absolute -inset-[16%] rounded-full border border-sage-light/25" />
            <div className="absolute -inset-[34%] rounded-full border border-sage-light/15 motion-safe:animate-[spin_40s_linear_infinite]">
              <span className="absolute left-1/2 top-0 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-taupe-light" />
            </div>
            <AriaOrb size="fill" energy={0.7} />
          </div>
        </motion.div>
      </motion.div>

      <motion.div style={reduce ? undefined : { y: textY, opacity: textO }} className="relative mx-auto flex min-h-[100svh] max-w-[1440px] flex-col justify-end px-6 pb-[16vh] pt-[132px] sm:px-10 lg:justify-center lg:px-14 lg:pb-[12vh]">
        <div className="motion-safe:animate-[rise-in_0.9s_cubic-bezier(0.16,1,0.3,1)_both]" style={rise(60)}>
          <span className="inline-flex items-center gap-2.5 rounded-full border border-sidebar-foreground/15 bg-sidebar-raised/80 py-1 pl-1 pr-3.5 backdrop-blur">
            <span className="rounded-full bg-sidebar-accent px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-accent-foreground">Early access</span>
            <span className="font-display text-[13px] text-sidebar-muted">For New Jersey agents</span>
          </span>
        </div>

        <h1 id="hero-title" aria-label="Say it once. Aria handles the rest." className="relative mt-7 font-heading text-[clamp(3.2rem,9vw,9.25rem)] font-normal leading-[0.9] tracking-[-0.045em] text-background">
          {/* small screens: the headline crosses the pearl, so a soft forest haze keeps ivory type legible */}
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-x-[14%] -inset-y-[22%] -z-10 lg:hidden"
            style={{ background: "radial-gradient(closest-side, color-mix(in srgb, var(--sidebar) 80%, transparent) 55%, transparent)" }}
          />
          <Line delay={180}>Say it once.</Line>
          <Line delay={320} className="italic text-sidebar-accent">Aria handles</Line>
          <Line delay={440} className="italic text-sidebar-accent">the rest.</Line>
        </h1>

        <p className="mt-8 max-w-[44ch] font-display text-[17px] leading-relaxed text-sidebar-muted motion-safe:animate-[rise-in_1s_cubic-bezier(0.16,1,0.3,1)_both] lg:text-[19px]" style={rise(620)}>
          Aria is the AI assistant that works alongside your CRM. Tell it what you need, a showing, a reminder, a reply, and it does the busywork.{" "}
          <span className="text-background">You approve anything that goes out.</span>
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4 motion-safe:animate-[rise-in_1s_cubic-bezier(0.16,1,0.3,1)_both]" style={rise(760)}>
          <PrimaryCta tone="forest" href="#early-access" onClick={() => scrollToId("early-access")}>Get early access</PrimaryCta>
          <a
            href="#how"
            onClick={(e) => { e.preventDefault(); scrollToDemo(); }}
            className="group inline-flex h-[52px] items-center gap-3 rounded-full pr-2 font-display text-[15px] font-semibold text-background outline-none focus-visible:ring-2 focus-visible:ring-sidebar-foreground"
          >
            <span className="flex size-10 items-center justify-center rounded-full border border-sidebar-foreground/20 bg-sidebar-raised/60 transition-transform duration-300 group-hover:scale-110">
              <Play className="size-3.5 translate-x-px fill-current" />
            </span>
            See it work
          </a>
        </div>
      </motion.div>

      <div aria-hidden className="absolute inset-x-0 bottom-6 mx-auto flex max-w-[1440px] items-end justify-between px-6 sm:px-10 lg:px-14">
        <span className="hidden font-mono text-[10.5px] font-semibold uppercase tracking-[0.2em] text-sidebar-muted sm:block">Works alongside the CRM you already use</span>
        <span className="flex flex-col items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-sidebar-muted">
          Scroll
          <span className="h-10 w-px overflow-hidden bg-sidebar-foreground/15">
            <span className="block h-full w-full bg-sidebar-foreground/70 motion-safe:animate-[scroll-cue_2.4s_cubic-bezier(0.65,0,0.35,1)_infinite]" />
          </span>
        </span>
      </div>
    </section>
  );
}
