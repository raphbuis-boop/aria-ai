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
        serif: ["var(--font-instrument-serif)", "Georgia", "serif"],
      },
      colors: {
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
