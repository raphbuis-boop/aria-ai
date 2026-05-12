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
        "bg-primary": "#000000",
        "bg-card": "#111111",
        "bg-deep": "#0a0a0a",
        "border-card": "#222222",
        "accent-blue": "#3B82F6",
        "accent-blue-bright": "#60A5FA",
        "accent-blue-glow": "#2563EB",
        "accent-amber": "#F59E0B",
        "accent-purple": "#8B5CF6",
        "accent-green": "#10B981",
        "text-primary": "#FFFFFF",
        "text-secondary": "#E5E7EB",
        "text-muted": "#9CA3AF",
        "text-dim": "#6B7280",
      },
    },
  },
  // tailwindcss-animate provides the data-[state=open]:animate-in / fade-in /
  // zoom-in utility classes used by shadcn Dialog/Sheet/Tooltip primitives.
  plugins: [animate],
};
export default config;
