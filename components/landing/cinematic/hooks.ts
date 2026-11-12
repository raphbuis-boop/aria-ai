"use client";

import { useEffect, useState, useSyncExternalStore, type RefObject } from "react";

const REDUCE = "(prefers-reduced-motion: reduce)";

function subscribe(cb: () => void) {
  const mq = window.matchMedia(REDUCE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/** Hydration-safe reduced-motion preference: false on the server, the real value after hydration. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(REDUCE).matches, () => false);
}

/**
 * Scale that fits a fixed logical canvas (w × h) inside the measured box of
 * `ref`, capped at `max`. Returns null until measured, so the stage can stay
 * hidden instead of flashing at the wrong size.
 */
export function useFitScale(ref: RefObject<HTMLElement | null>, w: number, h: number, max = 1.4): number | null {
  const [scale, setScale] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      setScale(Math.min(max, r.width / w, r.height / h));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, w, h, max]);
  return scale;
}
