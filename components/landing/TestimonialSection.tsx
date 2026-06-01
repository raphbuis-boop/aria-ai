"use client";

import { motion } from "framer-motion";

const ease = [0.22, 1, 0.36, 1] as const;

export function TestimonialSection() {
  return (
    <section
      style={{ background: "#0B1220" }}
      className="px-6 py-36"
    >
      <div className="mx-auto flex max-w-[760px] flex-col items-center text-center">
        <motion.span
          aria-hidden
          initial={{ scale: 0, rotate: -15 }}
          whileInView={{ scale: 1, rotate: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease }}
          className="font-serif leading-none select-none"
          style={{ fontSize: "100px", color: "rgba(58,101,240,0.22)", lineHeight: 1 }}
        >
          &ldquo;
        </motion.span>

        <motion.blockquote
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.15, ease }}
          className="-mt-4 font-bold leading-[1.25] text-white"
          style={{
            fontSize: "clamp(1.4rem, 3.5vw, 2rem)",
            letterSpacing: "-0.025em",
          }}
        >
          I&apos;ve been a real estate agent for 25 years. Aria is the first piece of technology
          that actually understands how I work — not how someone in Silicon Valley thinks I should
          work.
        </motion.blockquote>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.35 }}
          className="mt-8 flex items-center gap-3"
        >
          <div className="h-px w-8" style={{ background: "rgba(255,255,255,0.18)" }} />
          <p className="text-[14px]" style={{ color: "rgba(255,255,255,0.4)" }}>
            Melissa W. · NJ Real Estate Agent · 25+ years
          </p>
        </motion.div>
      </div>
    </section>
  );
}

export default TestimonialSection;
