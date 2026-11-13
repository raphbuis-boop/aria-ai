"use client";

import { useEffect } from "react";
import Lenis from "lenis";

let lenis: Lenis | null = null;

/** Scroll to a y position or element, smoothly when Lenis is running, instantly for reduced motion. */
export function smoothScrollTo(target: number | HTMLElement, offset = 0) {
  if (lenis) {
    lenis.scrollTo(target, { offset, duration: 1.6 });
    return;
  }
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const y = typeof target === "number" ? target : target.getBoundingClientRect().top + window.scrollY;
  window.scrollTo({ top: y + offset, behavior: reduce ? "auto" : "smooth" });
}

/**
 * Lenis smooth scrolling for the landing only. Wheel/trackpad is smoothed;
 * touch and keyboard scrolling stay native. Off for reduced motion.
 */
export function SmoothScroll() {
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    const start = () => {
      if (mq.matches || lenis) return;
      lenis = new Lenis({ duration: 1.15, easing: (t) => 1 - Math.pow(1 - t, 4), smoothWheel: true });
      const loop = (t: number) => {
        lenis?.raf(t);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      lenis?.destroy();
      lenis = null;
    };
    const onChange = () => (mq.matches ? stop() : start());
    start();
    mq.addEventListener("change", onChange);
    return () => {
      mq.removeEventListener("change", onChange);
      stop();
    };
  }, []);
  return null;
}
