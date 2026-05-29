"use client";

import { motion } from "framer-motion";

// TODO: Replace with real quote — Raph collecting from agent tester
const testimonial = {
  quote:
    "[Placeholder — real quote coming. She's been testing Aria for two weeks and loved it — getting the exact words from her this week.]",
  name: "Mom (NJ agent, 25+ years)",
  initials: "MW",
};

export default function Testimonial() {
  return (
    <section
      style={{
        background: "#fff",
        borderTop: "0.5px solid #EEEBE5",
        borderBottom: "0.5px solid #EEEBE5",
      }}
    >
      <div className="max-w-2xl mx-auto px-6 py-24 text-center">
        <motion.blockquote
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Decorative quote mark */}
          <div
            className="text-[5.5rem] font-serif leading-none mb-4 select-none"
            style={{ color: "#FCD9D0", lineHeight: 0.9 }}
            aria-hidden
          >
            &ldquo;
          </div>

          <p
            className="text-[1.2rem] md:text-[1.4rem] font-medium leading-snug mb-10"
            style={{ color: "#0B0B0F", letterSpacing: "-0.015em" }}
          >
            {testimonial.quote}
          </p>

          <footer className="flex items-center justify-center gap-4">
            {/* Avatar with initials */}
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center text-[13px] font-semibold flex-shrink-0"
              style={{ background: "#FCD9D0", color: "#8B3A25" }}
            >
              {testimonial.initials}
            </div>
            <div
              className="text-left pl-4"
              style={{ borderLeft: "0.5px solid #EEEBE5" }}
            >
              <cite
                className="not-italic text-[13.5px] font-semibold block"
                style={{ color: "#0B0B0F" }}
              >
                {testimonial.name}
              </cite>
            </div>
          </footer>
        </motion.blockquote>
      </div>
    </section>
  );
}
