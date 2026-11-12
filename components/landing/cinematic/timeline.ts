/**
 * Scroll choreography for the landing "theater". Pure functions only, so the
 * pacing is unit-tested and the same stage can be rendered at a fixed progress
 * (reduced motion, static frames) or driven by scroll.
 */

export type Range = readonly [number, number];

export type ChapterId = "ask" | "work" | "calendar" | "device" | "tools";

export type Chapter = { id: ChapterId; n: string; title: string; body: string; range: Range };

const COPY: Record<ChapterId, { title: string; body: string }> = {
  ask: {
    title: "You say it once.",
    body: "Type it or say it, the way you’d tell a great assistant. No forms, no fields.",
  },
  work: {
    title: "Aria takes action.",
    body: "It finds the right client, books the showing and sets the reminder, then shows you exactly what changed.",
  },
  calendar: {
    title: "Your day updates itself.",
    body: "The showing lands on Aria’s calendar, beside the events Aria reads from your Google Calendar. The reminder joins your follow-ups.",
  },
  device: {
    title: "And it travels with you.",
    body: "The same day, rebuilt for your phone. Confirm, call or open a draft between showings.",
  },
  tools: {
    title: "Around the tools you already use.",
    body: "Aria works alongside your CRM, inbox and calendar. It doesn’t replace them, and nothing goes out without your OK.",
  },
};

const MOBILE_DEVICE_COPY = {
  title: "And it’s waiting at your desk.",
  body: "Everything you did on your phone is already on Aria’s desktop calendar.",
};

/** Desktop: one stage, five chapters across ~600vh of scroll. */
export const DESKTOP_RANGES: Record<ChapterId, Range> = {
  ask: [0, 0.16],
  work: [0.16, 0.34],
  calendar: [0.34, 0.6],
  device: [0.6, 0.8],
  tools: [0.8, 1],
};

/** Mobile: phone-first. Scene four reverses (phone → desk). Shorter scroll. */
export const MOBILE_RANGES: Record<ChapterId, Range> = {
  ask: [0, 0.18],
  work: [0.18, 0.38],
  calendar: [0.38, 0.58],
  device: [0.58, 0.78],
  tools: [0.78, 1],
};

const ORDER: ChapterId[] = ["ask", "work", "calendar", "device", "tools"];

export function chapters(variant: "desktop" | "mobile"): Chapter[] {
  const ranges = variant === "desktop" ? DESKTOP_RANGES : MOBILE_RANGES;
  return ORDER.map((id, i) => {
    const copy = variant === "mobile" && id === "device" ? MOBILE_DEVICE_COPY : COPY[id];
    return { id, n: String(i + 1).padStart(2, "0"), ...copy, range: ranges[id] };
  });
}

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** 0 before the range, 1 after it, linear inside. */
export function progressIn(p: number, [a, b]: Range): number {
  if (b <= a) return p >= b ? 1 : 0;
  return clamp01((p - a) / (b - a));
}

/** Smooth ease-in-out (cubic) for hand-mapped values. */
export function ease(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** Linear interpolation between a and b by t (0–1, clamped). */
export function mix(a: number, b: number, t: number): number {
  return a + (b - a) * clamp01(t);
}

/** Eased interpolation of p across [range] from a to b. */
export function tween(p: number, range: Range, a: number, b: number): number {
  return mix(a, b, ease(progressIn(p, range)));
}

/** Index of the chapter that owns progress p (last chapter owns p = 1). */
export function chapterIndexAt(p: number, list: Chapter[]): number {
  for (let i = list.length - 1; i >= 0; i--) if (p >= list[i].range[0]) return i;
  return 0;
}

/** Characters of `text` revealed at progress p while typing across `range`. */
export function typedLength(p: number, text: string, range: Range): number {
  return Math.round(progressIn(p, range) * text.length);
}

/** Visibility of a chapter's caption: fades in over the first 18% of its range and out over the last 12%. */
export function captionOpacity(p: number, range: Range, isLast = false, isFirst = false): number {
  const [a, b] = range;
  const len = b - a;
  const fadeIn = isFirst ? 1 : progressIn(p, [a, a + len * 0.18]);
  const fadeOut = isLast ? 1 : 1 - progressIn(p, [b - len * 0.12, b]);
  return Math.min(fadeIn, fadeOut);
}

/**
 * Scroll position that shows a chapter: the section's top plus the chapter's
 * start (nudged slightly inside, so its caption is fully visible) times the
 * scrollable distance of the pinned section.
 */
export function chapterScrollTop(sectionTop: number, sectionHeight: number, viewportHeight: number, range: Range): number {
  const scrollable = Math.max(0, sectionHeight - viewportHeight);
  const inside = range[0] + (range[1] - range[0]) * 0.3;
  return Math.round(sectionTop + scrollable * inside);
}

/** A fixed progress that shows each chapter in its finished state (reduced-motion frames). */
export function settledProgress(range: Range): number {
  return range[1] - (range[1] - range[0]) * 0.04;
}

export type Rect = { x: number; y: number; w: number; h: number };
export type Stop = { at: number; rect: Rect };

/**
 * Where a flying element is at progress p: eased, piecewise between stops
 * (sorted by `at`). Two stops with the same rect make a hold.
 */
export function rectAt(p: number, stops: Stop[]): Rect {
  if (p <= stops[0].at) return stops[0].rect;
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i], b = stops[i + 1];
    if (p <= b.at) {
      const t = ease(progressIn(p, [a.at, b.at]));
      return { x: mix(a.rect.x, b.rect.x, t), y: mix(a.rect.y, b.rect.y, t), w: mix(a.rect.w, b.rect.w, t), h: mix(a.rect.h, b.rect.h, t) };
    }
  }
  return stops[stops.length - 1].rect;
}

/** Progress values that show each chapter's finished state, for reduced-motion frames. */
export const FRAME_POINTS: Record<"desktop" | "mobile", Record<ChapterId, number>> = {
  desktop: { ask: 0.125, work: 0.335, calendar: 0.59, device: 0.795, tools: 1 },
  mobile: { ask: 0.15, work: 0.375, calendar: 0.57, device: 0.77, tools: 1 },
};

/* ───────────── environment dissolves ───────────── */

export type ZoneDir = "dawn" | "dusk";

/** Forest layer height as a multiple of the zone's height. */
export const ZONE_LAYER = 1.5;

/**
 * Each zone slides a forest layer (ZONE_LAYER × zone height, top at `top` × zone)
 * by `from → to` × zone height as progress runs 0 → 1. The layer's mask is a
 * linear ramp between `a` and `b` (fractions of the layer): dawn fades forest
 * out downward, dusk fades it in.
 */
export const ZONES: Record<ZoneDir, { top: number; a: number; b: number; from: number; to: number }> = {
  dawn: { top: 0, a: 0.4, b: 0.78, from: 0, to: -0.3 },
  dusk: { top: -0.5, a: 0.4, b: 0.75, from: 0.3, to: 0 },
};

/** Layer offset (fraction of zone height) at progress p. */
export function zoneShift(dir: ZoneDir, p: number): number {
  const z = ZONES[dir];
  return mix(z.from, z.to, p);
}

/** How much forest covers a point `y` (0 = zone top, 1 = zone bottom) at progress p. 1 = forest, 0 = ivory. */
export function zoneForestAt(dir: ZoneDir, y: number, p: number): number {
  const z = ZONES[dir];
  const f = (y - z.top - zoneShift(dir, p)) / ZONE_LAYER;
  const t = progressIn(f, [z.a, z.b]);
  return dir === "dawn" ? 1 - t : t;
}
