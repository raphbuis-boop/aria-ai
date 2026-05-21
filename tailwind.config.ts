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
      colors: {
        // Backgrounds — matte black, cool blue undertone
        "bg-primary":  "#080910",
        "bg-card":     "#0d0f16",
        "bg-elevated": "#121520",
        "bg-deep":     "#060709",
        "bg-hover":    "#161921",

        // Borders — architectural, barely-there
        "border-subtle": "#181b24",
        "border-card":   "#1e2230",
        "border-strong": "#2a2e40",

        // Text hierarchy
        "text-primary":   "#e8eaf2",
        "text-secondary": "#9498b0",
        "text-muted":     "#6b7090",
        "text-dim":       "#424560",

        // Accent — refined navy blue
        "accent-blue":       "#3a65f0",
        "accent-blue-soft":  "#2a4fbf",
        "accent-blue-bright":"#6b8fff",

        // Semantic — muted, professional
        "accent-amber":  "#c47e1a",
        "accent-green":  "#1a9b5e",
        "accent-purple": "#6a44c0",
        "accent-red":    "#c43838",
      },
    },
  },
  plugins: [animate],
};
export default config;
