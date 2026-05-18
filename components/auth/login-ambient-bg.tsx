"use client";

import { motion } from "framer-motion";

/**
 * Layered vignette + soft blue key light + waveform trace.
 * pointer-events-none; keep interactive UI in a higher z-index layer.
 */
export function LoginAmbientBackground() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#020202]"
      aria-hidden
    >
      {/* Key light — slowed breathing */}
      <motion.div
        className="absolute left-1/2 top-[6%] h-[72vh] w-[165vw] max-w-[1400px] -translate-x-1/2"
        style={{
          background:
            "radial-gradient(ellipse 55% 50% at 50% 38%, rgba(59,130,246,0.16) 0%, rgba(37,99,235,0.06) 38%, transparent 70%)",
        }}
        animate={{ opacity: [0.82, 1, 0.82] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Cool rim */}
      <div
        className="absolute inset-0 opacity-80"
        style={{
          background:
            "radial-gradient(ellipse 120% 80% at 50% 110%, rgba(15,23,42,0.45) 0%, transparent 50%)",
        }}
      />
      {/* Edge vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.88) 100%)",
        }}
      />
      {/* Faint waveform / scan line ambience */}
      <svg
        className="absolute bottom-0 left-0 right-0 h-28 w-full opacity-[0.06]"
        viewBox="0 0 1440 120"
        fill="none"
        preserveAspectRatio="none"
      >
        <motion.path
          d="M0 80 Q180 40 360 70 T720 65 T1080 75 T1440 60 L1440 120 L0 120 Z"
          fill="url(#wf)"
          animate={{ opacity: [0.4, 0.75, 0.4] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        />
        <defs>
          <linearGradient id="wf" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(59,130,246)" stopOpacity={0.5} />
            <stop offset="100%" stopColor="rgb(0,0,0)" stopOpacity={0} />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
