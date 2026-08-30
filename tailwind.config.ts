import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Instrument Serif — DO NOT repoint. Live on the landing page
        // (HeroFloatingCards, Testimonial, TestimonialSection).
        serif: ["var(--font-instrument-serif)", "Georgia", "serif"],
        // Aria V2 — warm editorial direction. "heading"/"display" are opt-in
        // names (not "sans") so they never bleed into existing screens,
        // which render body text via DM Sans's own class.
        heading: ["var(--font-fraunces)", "Georgia", "serif"],
        display: ["var(--font-work-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      fontSize: {
        // Aria V2 type scale — see design system notes.
        caption: ["12px", { lineHeight: "16px", letterSpacing: "0.01em", fontWeight: "500" }],
        body: ["14px", { lineHeight: "21px" }],
        "body-lg": ["15px", { lineHeight: "22px" }],
        title: ["17px", { lineHeight: "24px", fontWeight: "600" }],
        section: ["13px", { lineHeight: "16px", letterSpacing: "0.06em", fontWeight: "600" }],
        display: ["32px", { lineHeight: "38px" }],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 8px)",
      },
      colors: {
        // ── Aria V2 — shadcn semantic tokens (see globals.css) ──
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        hot: "var(--hot)",
        warm: "var(--warm)",
        violet: "var(--violet)",

        // ── Legacy tokens (kept for backward compat — do not remove) ──
        "bg-primary":  "#080910",
        "bg-card":     "#0d0f16",
        "bg-elevated": "#121520",
        "bg-deep":     "#060709",
        "bg-hover":    "#161921",
        "border-subtle": "#181b24",
        "border-card":   "#1e2230",
        "border-strong": "#2a2e40",
        "text-primary":   "#e8eaf2",
        "text-secondary": "#9498b0",
        "text-muted":     "#6b7090",
        "text-dim":       "#424560",
        "accent-blue":       "#3a65f0",
        "accent-blue-soft":  "#2a4fbf",
        "accent-blue-bright":"#6b8fff",
        "accent-amber":  "#c47e1a",
        "accent-green":  "#1a9b5e",
        "accent-purple": "#6a44c0",
        "accent-red":    "#c43838",

        // ── Obsidian Chrome ───────────────────────────────────────────
        // Solid values for bg-oc-*, text-oc-*, border-oc-* utilities.
        // CSS-var variants (surfaces, borders with opacity) live in globals.css.
        "oc-onyx":      "#0A0A0A",
        "oc-slate":     "#536878",
        "oc-alabaster": "#E5E4E2",
        "oc-text-1":    "var(--oc-text-1)",
        "oc-text-2":    "var(--oc-text-2)",
        "oc-text-3":    "var(--oc-text-3)",
        "oc-blue":      "var(--oc-blue)",
        "oc-amber":     "var(--oc-amber)",
        "oc-green":     "var(--oc-green)",
        "oc-red":       "var(--oc-red)",
      },
    },
  },
  plugins: [animate],
};
export default config;
