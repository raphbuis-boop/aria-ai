"use client";

import { useRef, useEffect, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

function LiveDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
    </span>
  );
}

function useCountUp(target: number, duration: number, active: boolean) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    const start = performance.now();
    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(parseFloat((eased * target).toFixed(1)));
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [active, target, duration]);
  return value;
}

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.11 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
};

const panelVariants = {
  hidden: { opacity: 0, y: 36, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.8, delay: 0.35, ease: [0.22, 1, 0.36, 1] },
  },
};

function cardVariants(i: number) {
  return {
    hidden: { opacity: 0, y: 14 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.55, delay: 0.65 + i * 0.12, ease: [0.22, 1, 0.36, 1] },
    },
  };
}

export default function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [countActive, setCountActive] = useState(false);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  const textY = useTransform(scrollYProgress, [0, 1], [0, -70]);
  const panelY = useTransform(scrollYProgress, [0, 1], [0, -40]);

  useEffect(() => {
    const t = setTimeout(() => setCountActive(true), 1200);
    return () => clearTimeout(t);
  }, []);

  const revenue = useCountUp(3.2, 1800, countActive);

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen flex items-center overflow-hidden"
      style={{ background: "#08080A" }}
    >
      {/* Ambient amber glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(232,168,50,0.07) 0%, transparent 70%)",
        }}
      />

      <div className="max-w-6xl mx-auto px-6 w-full pt-28 pb-24">
        <div className="grid lg:grid-cols-2 gap-16 items-center">

          {/* Left — text */}
          <motion.div
            style={{ y: textY }}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Eyebrow */}
            <motion.div variants={itemVariants} className="flex items-center gap-2 mb-6">
              <span
                className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-full"
                style={{
                  background: "rgba(232,168,50,0.1)",
                  color: "#E8A832",
                  border: "0.5px solid rgba(232,168,50,0.2)",
                }}
              >
                <LiveDot />
                AI Revenue Operating System
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={itemVariants}
              className="font-semibold leading-[1.05] mb-6"
              style={{
                fontSize: "clamp(2.6rem, 5.5vw, 4rem)",
                letterSpacing: "-0.04em",
                color: "#F2F0EB",
              }}
            >
              Every relationship
              <br />
              <span
                style={{
                  background: "linear-gradient(135deg, #E8A832 0%, #F0C060 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                is revenue.
              </span>
            </motion.h1>

            {/* Subhead */}
            <motion.p
              variants={itemVariants}
              className="text-[17px] leading-relaxed mb-10 max-w-md"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              Aria surfaces the deals, clients, and moments your business is
              leaving money on the table — automatically.
            </motion.p>

            {/* CTAs */}
            <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-3">
              <a
                href="#waitlist"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById("waitlist")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="text-[14px] font-semibold px-6 py-3 rounded-full transition-opacity hover:opacity-85"
                style={{ background: "#E8A832", color: "#0A0A0A" }}
              >
                Book a Demo
              </a>
              <a
                href="#features"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="text-[14px] font-medium px-6 py-3 rounded-full transition-all hover:border-white/25"
                style={{
                  color: "rgba(255,255,255,0.55)",
                  border: "0.5px solid rgba(255,255,255,0.13)",
                }}
              >
                See Aria in Action ↓
              </a>
            </motion.div>
          </motion.div>

          {/* Right — command-center panel */}
          <motion.div style={{ y: panelY }} variants={panelVariants} initial="hidden" animate="visible">
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: "linear-gradient(160deg, #0F0F16 0%, #0C0C13 100%)",
                border: "0.5px solid rgba(255,255,255,0.07)",
                boxShadow:
                  "0 0 0 0.5px rgba(232,168,50,0.08), 0 40px 120px -20px rgba(0,0,0,0.8)",
              }}
            >
              {/* Panel header */}
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}
              >
                <div className="flex items-center gap-2">
                  <LiveDot />
                  <span
                    className="text-[13px] font-semibold"
                    style={{ color: "#F2F0EB", letterSpacing: "-0.01em" }}
                  >
                    Revenue Intelligence
                  </span>
                </div>
                <span
                  className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(52,211,153,0.12)", color: "#34D399" }}
                >
                  7 signals active
                </span>
              </div>

              {/* Cards grid */}
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">

                {/* Sarah Kim — opportunity */}
                <motion.div
                  variants={cardVariants(0)}
                  initial="hidden"
                  animate="visible"
                  className="rounded-xl p-3.5"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "0.5px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-[12.5px] font-semibold" style={{ color: "#F2F0EB" }}>
                        Sarah Kim
                      </p>
                      <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                        Ready to list · $1.4M
                      </p>
                    </div>
                    <span
                      className="text-[10.5px] font-medium px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(232,168,50,0.12)", color: "#E8A832" }}
                    >
                      Opportunity
                    </span>
                  </div>
                  <div
                    className="h-1 rounded-full overflow-hidden"
                    style={{ background: "rgba(255,255,255,0.06)" }}
                  >
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: "linear-gradient(90deg, #E8A832, #F0C060)" }}
                      initial={{ width: 0 }}
                      animate={{ width: "84%" }}
                      transition={{ duration: 1.2, delay: 0.9, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                  <p className="text-[10.5px] mt-1.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                    84% close probability
                  </p>
                </motion.div>

                {/* 24 Sycamore — act now */}
                <motion.div
                  variants={cardVariants(1)}
                  initial="hidden"
                  animate="visible"
                  className="rounded-xl p-3.5"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "0.5px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-[12.5px] font-semibold" style={{ color: "#F2F0EB" }}>
                        24 Sycamore Rdg
                      </p>
                      <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                        Match for 3 buyers · $775K
                      </p>
                    </div>
                    <span
                      className="text-[10.5px] font-medium px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(52,211,153,0.1)", color: "#34D399" }}
                    >
                      Act in 2h
                    </span>
                  </div>
                  <div
                    className="h-1 rounded-full overflow-hidden"
                    style={{ background: "rgba(255,255,255,0.06)" }}
                  >
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: "linear-gradient(90deg, #34D399, #6EE7B7)" }}
                      initial={{ width: 0 }}
                      animate={{ width: "62%" }}
                      transition={{ duration: 1.2, delay: 1.02, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                  <p className="text-[10.5px] mt-1.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                    New to market 4h ago
                  </p>
                </motion.div>

                {/* Marcus Johnson — risk */}
                <motion.div
                  variants={cardVariants(2)}
                  initial="hidden"
                  animate="visible"
                  className="rounded-xl p-3.5 sm:col-span-2"
                  style={{
                    background: "rgba(239,68,68,0.04)",
                    border: "0.5px solid rgba(239,68,68,0.12)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[12.5px] font-semibold" style={{ color: "#F2F0EB" }}>
                        Marcus Johnson
                      </p>
                      <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                        9 days silent · $840K buyer
                      </p>
                    </div>
                    <span
                      className="text-[10.5px] font-medium px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(239,68,68,0.12)", color: "#F87171" }}
                    >
                      High Risk
                    </span>
                  </div>
                </motion.div>
              </div>

              {/* Panel footer — revenue count-up */}
              <div
                className="px-4 py-3 flex items-center justify-between"
                style={{ borderTop: "0.5px solid rgba(255,255,255,0.06)" }}
              >
                <span className="text-[12px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                  Pipeline revenue
                </span>
                <span
                  className="text-[15px] font-semibold tabular-nums"
                  style={{ color: "#E8A832", letterSpacing: "-0.02em" }}
                >
                  ${revenue.toFixed(1)}M ↑ this month
                </span>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
