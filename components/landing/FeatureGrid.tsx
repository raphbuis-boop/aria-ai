"use client";

import { motion } from "framer-motion";

const ease = [0.22, 1, 0.36, 1] as const;

const features = [
  {
    eyebrow: "Mirror my voice",
    ai: true,
    title: "Drafts that sound like you",
    body: "Aria reads how you've written to clients before. Then it writes future replies in the same voice — same humor, same warmth, same brevity.",
  },
  {
    eyebrow: "Gmail integration",
    ai: false,
    title: "Your inbox, finally caught up",
    body: "Every email read. Every reply suggested. Every thread tracked. Connect Gmail in one tap.",
  },
  {
    eyebrow: "Pipeline intelligence",
    ai: true,
    title: "Know who's going cold before they ghost",
    body: "Aria tracks every signal — days silent, last contact, listing changes — and flags the relationships at risk.",
  },
  {
    eyebrow: "Morning briefings",
    ai: false,
    title: "Walk in already caught up",
    body: "Every morning, Aria summarizes who needs attention, what changed, and your top 3 moves for the day.",
  },
  {
    eyebrow: "Voice commands",
    ai: true,
    title: "Hands-free in the car",
    body: "\u2018Aria, text Mike I\u2019m running 10 minutes late.\u2019 Just say it. Done.",
  },
  {
    eyebrow: "NJ MLS built in",
    ai: false,
    title: "Listings, matches, comps — without leaving Aria",
    body: "Aria pulls live NJ MLS data so you\u2019re not bouncing between tabs.",
  },
];

export function FeatureGrid() {
  return (
    <section id="features" className="px-6 py-28" style={{ background: "#F4F7FD" }}>
      <div className="mx-auto max-w-5xl">
        <p
          className="mb-4 text-center text-[11px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: "#3a65f0" }}
        >
          Built for agents
        </p>

        <h2
          className="mx-auto max-w-3xl text-balance text-center font-bold"
          style={{
            fontSize: "clamp(2rem, 4.5vw, 3.25rem)",
            letterSpacing: "-0.035em",
            lineHeight: 1.1,
            color: "#0B1220",
          }}
        >
          Built for how you actually work.
        </h2>

        <div className="mt-14 grid gap-4 md:grid-cols-2">
          {features.map((f, i) => (
            <motion.div
              key={f.eyebrow}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.65, delay: i * 0.07, ease }}
              className="rounded-[16px] bg-white p-7"
              style={{ border: "1px solid rgba(11,18,32,0.07)", boxShadow: "0 2px 8px rgba(11,18,32,0.04)" }}
            >
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.12em]"
                style={{ color: f.ai ? "#3a65f0" : "rgba(11,18,32,0.35)" }}
              >
                {f.eyebrow}
                {f.ai && (
                  <span
                    className="ml-2 rounded px-1.5 py-0.5 text-[10px]"
                    style={{ background: "rgba(58,101,240,0.08)", color: "#3a65f0" }}
                  >
                    AI
                  </span>
                )}
              </p>
              <h3
                className="mt-3 font-semibold leading-tight"
                style={{ fontSize: "20px", letterSpacing: "-0.02em", color: "#0B1220" }}
              >
                {f.title}
              </h3>
              <p
                className="mt-3 text-[14px] leading-relaxed"
                style={{ color: "rgba(11,18,32,0.5)" }}
              >
                {f.body}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default FeatureGrid;
