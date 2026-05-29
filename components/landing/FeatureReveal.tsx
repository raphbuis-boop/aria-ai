"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

const features = [
  {
    number: "01",
    title: "Mirror My Voice",
    description:
      "Aria learns from the way you actually write — your tone, your phrasing, the way you close a message. So every draft it generates sounds like you, not a chatbot. Your clients will never know the difference.",
    tags: ["Learns from your emails", "Improves over time", "Never sounds robotic"],
    accent: "#FCD9D0",
  },
  {
    number: "02",
    title: "Pipeline that watches itself",
    description:
      "Hot leads, cold clients, deals about to slip — Aria tracks every thread and surfaces what matters. You stop falling through the cracks and start closing the gaps before anyone walks.",
    tags: ["Tracks 20+ clients silently", "Flags risk automatically", "No CRM data entry"],
    accent: "#E6F4EA",
  },
  {
    number: "03",
    title: "One tap to send",
    description:
      "Approve a draft and it goes out instantly — through Gmail or as an SMS from your phone. No copy-pasting, no switching tabs, no 'I meant to send that.' Just done.",
    tags: ["Works with Gmail", "SMS handoff to your phone", "Approve in under 3 seconds"],
    accent: "#EEE8FD",
  },
] as const;

function FeatureRow({
  feature,
  index,
}: {
  feature: (typeof features)[number];
  index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "center start"],
  });

  // Clip-wipe: visual panel wipes in from the side
  const clipPath = useTransform(
    scrollYProgress,
    [0, 0.6],
    ["inset(0 100% 0 0 round 24px)", "inset(0 0% 0 0 round 24px)"]
  );
  const textOpacity = useTransform(scrollYProgress, [0, 0.45], [0, 1]);
  const textY = useTransform(scrollYProgress, [0, 0.6], [28, 0]);

  const reverse = index % 2 !== 0;

  return (
    <div
      ref={ref}
      className={`flex flex-col ${
        reverse ? "md:flex-row-reverse" : "md:flex-row"
      } items-center gap-10 md:gap-20 py-16 md:py-24`}
      style={{ borderTop: "0.5px solid #EEEBE5" }}
    >
      {/* Text */}
      <motion.div
        style={{ opacity: textOpacity, y: textY }}
        className="flex-1 max-w-md w-full"
      >
        <span
          className="text-[10.5px] font-bold tracking-[0.18em] uppercase block mb-4"
          style={{ color: "#B85C43" }}
        >
          {feature.number}
        </span>
        <h3
          className="text-[1.9rem] md:text-[2.2rem] font-medium leading-tight mb-4"
          style={{ color: "#0B0B0F", letterSpacing: "-0.025em" }}
        >
          {feature.title}
        </h3>
        <p
          className="text-[15.5px] leading-relaxed mb-6"
          style={{ color: "#4A4A52" }}
        >
          {feature.description}
        </p>
        <div className="flex flex-wrap gap-2">
          {feature.tags.map((tag) => (
            <span
              key={tag}
              className="text-[11.5px] font-medium px-3 py-1.5 rounded-full"
              style={{ background: feature.accent, color: "#0B0B0F" }}
            >
              {tag}
            </span>
          ))}
        </div>
      </motion.div>

      {/* Visual — clip-wipe reveal */}
      <motion.div
        style={{ clipPath }}
        className="flex-1 max-w-sm w-full"
      >
        <div
          className="w-full flex items-center justify-center relative overflow-hidden"
          style={{
            height: 280,
            background: feature.accent,
            borderRadius: 24,
          }}
        >
          {/* Large ghost number */}
          <span
            className="absolute font-semibold select-none pointer-events-none"
            style={{
              fontSize: "clamp(6rem, 14vw, 10rem)",
              color: "rgba(11,11,15,0.055)",
              letterSpacing: "-0.06em",
              lineHeight: 1,
              bottom: -16,
              right: 16,
            }}
          >
            {feature.number}
          </span>
          <span
            className="relative text-[14px] font-medium text-center px-8"
            style={{ color: "rgba(11,11,15,0.35)" }}
          >
            {feature.title}
          </span>
        </div>
      </motion.div>
    </div>
  );
}

export default function FeatureReveal() {
  return (
    <section style={{ background: "#FAFAF7" }}>
      <div className="max-w-5xl mx-auto px-6">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="pt-20 pb-4 text-center"
        >
          <span
            className="text-[10.5px] font-bold tracking-[0.18em] uppercase block mb-4"
            style={{ color: "#B85C43" }}
          >
            How it works
          </span>
          <h2
            className="text-[2.5rem] md:text-[3rem] font-medium"
            style={{
              color: "#0B0B0F",
              letterSpacing: "-0.03em",
              lineHeight: 1.06,
            }}
          >
            Three things. Every day.
          </h2>
        </motion.div>

        {features.map((f, i) => (
          <FeatureRow key={f.number} feature={f} index={i} />
        ))}

        {/* Bottom spacer */}
        <div className="pb-4" />
      </div>
    </section>
  );
}
