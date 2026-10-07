import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const token = (name: string) =>
  `color-mix(in srgb, var(${name}) calc(<alpha-value> * 100%), transparent)`;

const config: Config = {
  darkMode: "class",
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
      boxShadow: {
        // Warm-tinted elevation from the one --shadow-color token.
        card: "0 1px 2px rgb(var(--shadow-color) / 0.04), 0 20px 36px -24px rgb(var(--shadow-color) / 0.16)",
        float: "0 1px 2px rgb(var(--shadow-color) / 0.06), 0 18px 40px -14px rgb(var(--shadow-color) / 0.28)",
        sheet: "0 -8px 40px rgb(var(--shadow-color) / 0.18)",
        pop: "0 24px 48px -16px rgb(var(--shadow-color) / 0.25)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 8px)",
      },
      colors: {
        // Ivory design system — semantic tokens from globals.css (light + dark).
        // color-mix keeps opacity modifiers (bg-primary/10) working on var() colors.
        border: token("--border"),
        input: token("--input"),
        ring: token("--ring"),
        background: token("--background"),
        foreground: token("--foreground"),
        primary: { DEFAULT: token("--primary"), foreground: token("--primary-foreground") },
        secondary: { DEFAULT: token("--secondary"), foreground: token("--secondary-foreground") },
        destructive: { DEFAULT: token("--destructive"), foreground: token("--destructive-foreground") },
        muted: { DEFAULT: token("--muted"), foreground: token("--muted-foreground") },
        accent: { DEFAULT: token("--accent"), foreground: token("--accent-foreground") },
        popover: { DEFAULT: token("--popover"), foreground: token("--popover-foreground") },
        card: { DEFAULT: token("--card"), foreground: token("--card-foreground") },
        success: { DEFAULT: token("--success"), foreground: token("--success-foreground") },
        warning: { DEFAULT: token("--warning"), foreground: token("--warning-foreground") },
        danger: { DEFAULT: token("--danger"), foreground: token("--danger-foreground") },
        info: { DEFAULT: token("--info"), foreground: token("--info-foreground") },
        hot: { DEFAULT: token("--hot"), foreground: token("--hot-foreground") },
        warm: token("--warm"),
        violet: token("--violet"),
        paper: { DEFAULT: token("--paper"), foreground: token("--paper-foreground") },
        scrim: "var(--scrim)",
        "brand-whatsapp": token("--brand-whatsapp"),
      },
    },
  },
  plugins: [animate],
};
export default config;
