"use client";

import { motion } from "framer-motion";
import Image from "next/image";

const ease = [0.22, 1, 0.36, 1] as const;

export function HeroSection() {
  return (
    <section
      id="top"
      className="relative flex min-h-[100svh] flex-col items-center justify-start overflow-hidden px-6 pt-36 pb-24"
      style={{
        background: "linear-gradient(160deg, #0D1525 0%, #0B1220 50%, #0A1028 100%)",
      }}
    >
      {/* Subtle top-center glow — restrained, not aggressive */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[50%]"
        style={{
          background:
            "radial-gradient(ellipse 55% 40% at 50% -5%, rgba(58,101,240,0.18), transparent)",
        }}
      />

      {/* Text block */}
      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center text-center">
        {/* Eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease }}
        >
          <span
            className="inline-block rounded-full px-3.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{
              border: "1px solid rgba(107,143,255,0.25)",
              color: "#6b8fff",
              background: "rgba(58,101,240,0.08)",
            }}
          >
            AI Revenue OS · New Jersey
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.08, ease }}
          className="mt-7 text-balance font-bold text-white"
          style={{
            fontSize: "clamp(2.8rem, 8.5vw, 5.8rem)",
            lineHeight: 1.04,
            letterSpacing: "-0.04em",
          }}
        >
          Every relationship
          <br />
          is revenue.
        </motion.h1>

        {/* Sub-copy */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.18, ease }}
          className="mt-6 max-w-[500px] text-pretty text-[17px] leading-relaxed"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          Aria reads your Gmail, drafts replies in your voice, and surfaces every
          client about to slip — so you never lose a deal to a missed follow-up.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.28, ease }}
          className="mt-9 flex flex-col items-center gap-3 sm:flex-row"
        >
          <a
            href="#signup"
            className="rounded-full bg-white px-7 py-3.5 text-[15px] font-semibold text-[#0B1220] transition-opacity hover:opacity-90 active:scale-[0.98]"
          >
            Get early access
          </a>
          <a
            href="mailto:hello@getariaai.com"
            className="rounded-full px-7 py-3.5 text-[15px] font-medium transition-colors hover:bg-white/5 active:scale-[0.98]"
            style={{
              border: "1px solid rgba(255,255,255,0.15)",
              color: "rgba(255,255,255,0.55)",
            }}
          >
            Talk to the team
          </a>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-4 text-[12px]"
          style={{ color: "rgba(255,255,255,0.25)" }}
        >
          Currently rolling out to NJ agents · No credit card
        </motion.p>
      </div>

      {/* Product mockup */}
      <motion.div
        initial={{ opacity: 0, y: 48 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.1, delay: 0.42, ease }}
        className="relative z-10 mx-auto mt-16 w-full max-w-[820px]"
      >
        {/* Browser frame */}
        <div
          className="relative rounded-[18px] p-[10px]"
          style={{
            background: "#131E35",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow:
              "0 48px 96px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.07)",
          }}
        >
          {/* Chrome bar */}
          <div className="mb-2.5 flex items-center gap-2 px-1">
            <span className="h-3 w-3 rounded-full" style={{ background: "#1E2D4A" }} />
            <span className="h-3 w-3 rounded-full" style={{ background: "#1E2D4A" }} />
            <span className="h-3 w-3 rounded-full" style={{ background: "#1E2D4A" }} />
            <div
              className="mx-auto flex items-center gap-1.5 rounded-full px-3 py-1"
              style={{ background: "#0D1828" }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#3a65f0]" />
              <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                aria.app / today
              </span>
            </div>
          </div>

          {/* Screenshot */}
          <div className="overflow-hidden rounded-[10px]" style={{ aspectRatio: "16/10" }}>
            <Image
              src="/landing/today.png"
              alt="Aria Today view — morning briefing and client priorities"
              width={1200}
              height={750}
              className="w-full object-cover object-top"
              priority
            />
          </div>
        </div>
      </motion.div>

      {/* Scroll hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.3 }}
        className="relative z-10 mt-14 flex flex-col items-center gap-2"
        style={{ color: "rgba(255,255,255,0.22)" }}
      >
        <span className="text-[10px] font-medium uppercase tracking-[0.18em]">
          Scroll to explore
        </span>
        <motion.svg
          viewBox="0 0 16 16"
          fill="none"
          className="h-4 w-4"
          animate={{ y: [0, 4, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <path
            d="M8 3v10M4 9l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </motion.svg>
      </motion.div>
    </section>
  );
}

export default HeroSection;
