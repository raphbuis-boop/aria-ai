"use client";

import { motion, type MotionValue } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Aria's pearl, built from layered gradients: a soft sage halo, an ivory body
 * shaded toward sage, a slow iridescent sheen and a specular highlight. `energy` (0–1, static or a motion
 * value) brightens the halo while Aria is listening or working.
 */
export function AriaOrb({
  size,
  energy = 0.4,
  className,
  breathe = true,
}: {
  /** px, or "fill" to take the parent's size. */
  size: number | "fill";
  energy?: number | MotionValue<number>;
  className?: string;
  breathe?: boolean;
}) {
  return (
    <div aria-hidden className={cn("relative shrink-0", className)} style={size === "fill" ? { width: "100%", height: "100%" } : { width: size, height: size }}>
      {/* halo: soft sage light */}
      <motion.div
        className="absolute -inset-[60%] rounded-full"
        style={{
          opacity: energy,
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--glow) 46%, transparent) 0%, color-mix(in srgb, var(--glow) 15%, transparent) 38%, transparent 68%)",
        }}
      />
      {/* pearl body: warm ivory core, sage shading toward the rim */}
      <div
        className={cn("absolute inset-0 overflow-hidden rounded-full", breathe && "motion-safe:animate-[orb-breathe_6s_ease-in-out_infinite]")}
        style={{
          background:
            "radial-gradient(circle at 36% 30%, var(--orb-light) 0%, var(--orb) 34%, color-mix(in srgb, var(--orb) 58%, var(--orb-deep)) 68%, var(--orb-deep) 96%)",
          boxShadow:
            "inset 0 0 0 0.5px color-mix(in srgb, var(--orb-deep) 50%, transparent), 0 18px 50px -12px color-mix(in srgb, var(--glow) 60%, transparent)",
        }}
      >
        {/* slow pearl iridescence: a warm taupe and a cool sage sheen drifting across the surface */}
        <div
          className="absolute -inset-1/4 motion-safe:animate-[spin_16s_linear_infinite]"
          style={{
            background:
              "conic-gradient(from 90deg, transparent 0deg, color-mix(in srgb, var(--paper) 60%, transparent) 50deg, transparent 120deg, color-mix(in srgb, var(--taupe) 75%, transparent) 190deg, transparent 240deg, color-mix(in srgb, var(--sage-light) 80%, transparent) 290deg, transparent 340deg)",
            mixBlendMode: "soft-light",
          }}
        />
        {/* form shadow: the side away from the light falls into deeper sage */}
        <div className="absolute inset-0 rounded-full" style={{ background: "radial-gradient(circle at 30% 24%, transparent 42%, color-mix(in srgb, var(--orb-deep) 45%, transparent) 78%, color-mix(in srgb, var(--forest, var(--orb-deep)) 55%, transparent) 100%)" }} />
        {/* reflected light from below + soft specular */}
        <div className="absolute inset-0 rounded-full" style={{ background: "radial-gradient(circle at 56% 116%, color-mix(in srgb, var(--sage-light) 75%, transparent), transparent 46%)" }} />
        <div className="absolute inset-0 rounded-full" style={{ background: "radial-gradient(ellipse 36% 22% at 38% 22%, color-mix(in srgb, var(--paper) 92%, transparent), transparent 100%)" }} />
      </div>
    </div>
  );
}
