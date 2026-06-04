/**
 * Aria v2 Design Tokens
 *
 * Single source of truth for all visual values. These are consumed by
 * components/ui primitives and will be extended into Tailwind config in Phase 2.
 * All motion tokens are defined here but applied to components in Phase 2.
 */

// ─── Surfaces ─────────────────────────────────────────────────────────────────

export const surface = {
  base: "#0A0A0A",
  surface: "#141416",
  raised: "#1C1D21",
  border: "#2A2B30",
} as const;

// ─── Text ──────────────────────────────────────────────────────────────────────

export const text = {
  primary: "#E5E4E2",
  secondary: "#9A9CA3",
  muted: "#5E6068",
} as const;

// ─── Accent ───────────────────────────────────────────────────────────────────

export const accent = {
  primary: "#4F5BFF",
  muted: "#536878",
} as const;

// ─── Semantic ─────────────────────────────────────────────────────────────────

export const semantic = {
  risk: "#FF4D4D",
  warning: "#F5A623",
  success: "#2ECC71",
} as const;

// ─── Type Scale ───────────────────────────────────────────────────────────────

export const typeScale = {
  /** 11px — timestamps, legal */
  xs: "0.6875rem",
  /** 12px — labels, badges */
  sm: "0.75rem",
  /** 14px — body, default */
  base: "0.875rem",
  /** 16px — sub-headings */
  md: "1rem",
  /** 20px — section titles */
  lg: "1.25rem",
  /** 24px — page headers */
  xl: "1.5rem",
  /** 30px — hero */
  "2xl": "1.875rem",
} as const;

// ─── Radius ───────────────────────────────────────────────────────────────────

/** Card-heavy / rounded profile */
export const radius = {
  sm: "6px",
  md: "10px",
  lg: "14px",
  xl: "18px",
  full: "9999px",
} as const;

// ─── Spacing ──────────────────────────────────────────────────────────────────

/** 4px base grid */
export const spacing = {
  "0": "0px",
  "1": "4px",
  "2": "8px",
  "3": "12px",
  "4": "16px",
  "5": "20px",
  "6": "24px",
  "8": "32px",
  "10": "40px",
  "12": "48px",
  "16": "64px",
} as const;

// ─── Motion ───────────────────────────────────────────────────────────────────
// Defined now; applied to Framer Motion / CSS transitions in Phase 2.

export const motion = {
  duration: {
    /** Micro-interactions: badge pop, icon tap */
    instant: "80ms",
    /** Button press, toggle */
    fast: "150ms",
    /** Sheet open/close, card expand */
    moderate: "250ms",
    /** Page transitions */
    slow: "380ms",
  },
  easing: {
    /** Standard ease-out for entrances */
    out: "cubic-bezier(0.0, 0.0, 0.2, 1)",
    /** Snappy for taps */
    snap: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    /** Linear for continuous */
    linear: "linear",
  },
} as const;

// ─── Convenience re-export ─────────────────────────────────────────────────────

const tokens = { surface, text, accent, semantic, typeScale, radius, spacing, motion };
export default tokens;
