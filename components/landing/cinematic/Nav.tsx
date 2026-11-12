"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { AriaOrb } from "./AriaOrb";
import { scrollToDemo, scrollToId } from "./Hero";
import { zoneForestAt, type ZoneDir } from "./timeline";

/** Forest amount (0–1) behind the nav's center line, read from the [data-env] regions. */
function forestUnderNav(y: number): number {
  const regions = document.querySelectorAll<HTMLElement>("[data-env]");
  let found: HTMLElement | null = null;
  for (const el of regions) {
    const r = el.getBoundingClientRect();
    if (r.height > 0 && r.top <= y && r.bottom > y) found = el; // later (nested) matches win
  }
  if (!found) return 0;
  const env = found.dataset.env;
  if (env === "forest") return 1;
  if (env === "theater") return Number(found.dataset.forest ?? 0);
  if (env === "zone") {
    const r = found.getBoundingClientRect();
    return zoneForestAt(found.dataset.dir as ZoneDir, (y - r.top) / r.height, Number(found.dataset.p ?? 0));
  }
  return 0;
}

export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only z-[70] rounded-full bg-primary px-4 py-2 font-display text-[14px] font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
    >
      Skip to content
    </a>
  );
}

const link = "rounded-full px-3 py-1.5 outline-none transition-colors duration-200 hover:text-foreground group-data-[theme=forest]/nav:hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-ring";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [dark, setDark] = useState(true);
  useEffect(() => {
    let raf = 0;
    const measure = () => {
      raf = 0;
      setScrolled(window.scrollY > 24);
      setDark(forestUnderNav(36) > 0.5);
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(measure); };
    measure();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3 sm:px-4">
      <nav
        aria-label="Main"
        data-theme={dark ? "forest" : "ivory"}
        className={cn(
          "group/nav flex w-full max-w-[1200px] items-center justify-between rounded-full border py-2 pl-4 pr-2 transition-[background-color,border-color,box-shadow,color] duration-500 motion-reduce:transition-none",
          !scrolled
            ? "border-transparent bg-transparent"
            : dark
              ? "border-sidebar-foreground/10 bg-sidebar/70 shadow-pop backdrop-blur-xl backdrop-saturate-150"
              : "border-border bg-background/80 shadow-float backdrop-blur-xl backdrop-saturate-150",
        )}
      >
        <a href="#top" onClick={(e) => { e.preventDefault(); scrollToId("top"); }} className="flex items-center gap-2.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <AriaOrb size={26} energy={0.4} breathe={false} />
          <span className={cn("font-heading text-[21px] tracking-[-0.02em] transition-colors duration-500", dark ? "text-sidebar-foreground" : "text-foreground")}>Aria</span>
        </a>
        <div className={cn("hidden items-center gap-1 font-display text-[14px] font-medium transition-colors duration-500 md:flex", dark ? "text-sidebar-muted" : "text-muted-foreground")}>
          <a href="#how" onClick={(e) => { e.preventDefault(); scrollToDemo(); }} className={link}>How it works</a>
          <a href="#capabilities" onClick={(e) => { e.preventDefault(); scrollToId("capabilities"); }} className={link}>What it does</a>
          <a href="/login" className={link}>Sign in</a>
        </div>
        <div className="flex items-center gap-1">
          <a href="/login" className={cn(link, "font-display text-[14px] font-medium md:hidden", dark ? "text-sidebar-muted" : "text-muted-foreground")}>Sign in</a>
          <a
            href="#early-access"
            onClick={(e) => { e.preventDefault(); scrollToId("early-access"); }}
            className={cn(
              "rounded-full px-4 py-2.5 font-display text-[13.5px] font-semibold outline-none transition-[transform,background-color,color] duration-500 hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              dark ? "bg-sidebar-accent text-sidebar-accent-foreground" : "bg-primary text-primary-foreground",
            )}
          >
            Get early access
          </a>
        </div>
      </nav>
    </header>
  );
}
