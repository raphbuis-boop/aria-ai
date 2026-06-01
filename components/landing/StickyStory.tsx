"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import {
  motion,
  useScroll,
  useTransform,
  useMotionValueEvent,
  type MotionValue,
} from "framer-motion";

const steps = [
  {
    num: "01",
    title: "Walk in already caught up",
    body: "Aria reads your Gmail overnight. Every thread, every reply, every follow-up that slipped while you were off the clock — surfaced before your first coffee.",
  },
  {
    num: "02",
    title: "Drafts in your real voice",
    body: "Aria learns from how you actually write. Your replies don't sound like ChatGPT — they sound like you. Same warmth, same shorthand, same closing.",
  },
  {
    num: "03",
    title: "Send in one tap",
    body: "Approve in three seconds. Aria sends through your Gmail, your iMessage, or your WhatsApp — from your real number. The client never knows AI was in the room.",
  },
];

const images = [
  { src: "/landing/today.png", label: "Aria Today screen" },
  { src: "/landing/inbox.png", label: "Aria inbox with AI suggested reply" },
  { src: "/landing/pipeline.png", label: "Aria client pipeline view" },
];

const urlLabels = ["aria.app / today", "aria.app / inbox", "aria.app / pipeline"];

function Step({
  step,
  active,
}: {
  step: (typeof steps)[number];
  index: number;
  active: boolean;
}) {
  return (
    <div
      className="relative pl-6 transition-opacity duration-500"
      style={{ opacity: active ? 1 : 0.3 }}
    >
      <span
        className="absolute left-0 top-1 h-[calc(100%-0.5rem)] w-[2px] origin-top rounded-full transition-all duration-500"
        style={{
          background: active ? "#3a65f0" : "rgba(11,18,32,0.12)",
          transform: `scaleY(${active ? 1 : 0.3})`,
        }}
        aria-hidden
      />
      <span
        className="text-[12px] font-mono font-semibold"
        style={{ color: active ? "#3a65f0" : "rgba(11,18,32,0.3)" }}
      >
        {step.num}
      </span>
      <h3
        className="mt-2 font-bold leading-tight transition-all duration-500"
        style={{
          fontSize: active ? "30px" : "26px",
          color: active ? "#0B1220" : "rgba(11,18,32,0.4)",
          letterSpacing: "-0.025em",
        }}
      >
        {step.title}
      </h3>
      <p
        className="mt-3 max-w-[360px] text-[15px] leading-relaxed"
        style={{ color: "rgba(11,18,32,0.5)" }}
      >
        {step.body}
      </p>
    </div>
  );
}

function CrossfadeImage({
  img,
  range,
  output,
  progress,
}: {
  img: (typeof images)[number];
  range: number[];
  output: number[];
  progress: MotionValue<number>;
}) {
  const opacity = useTransform(progress, range, output);
  return (
    <motion.div
      style={{ opacity, willChange: "opacity" }}
      className="absolute inset-0"
    >
      <Image
        src={img.src}
        alt={img.label}
        fill
        className="object-cover object-top"
        sizes="(max-width: 1024px) 90vw, 55vw"
      />
    </motion.div>
  );
}

export function StickyStory() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const next = v < 0.34 ? 0 : v < 0.67 ? 1 : 2;
    setActive((prev) => (prev === next ? prev : next));
  });

  return (
    <section id="how-it-works" style={{ background: "#FFFFFF" }}>
      {/* Section header */}
      <div className="mx-auto max-w-6xl px-6 pt-28 text-center">
        <p
          className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: "#3a65f0" }}
        >
          How it works
        </p>
        <h2
          className="text-balance font-bold"
          style={{
            fontSize: "clamp(2.2rem, 5vw, 3.75rem)",
            letterSpacing: "-0.035em",
            lineHeight: 1.1,
            color: "#0B1220",
          }}
        >
          Aria reads between the lines.
        </h2>
      </div>

      <div ref={sectionRef} className="relative mx-auto h-[300vh] max-w-6xl px-6">
        <div className="sticky top-0 flex h-screen items-center">
          <div className="grid w-full items-center gap-12 lg:grid-cols-[40%_60%]">
            {/* Left: steps */}
            <div className="flex flex-col gap-14">
              {steps.map((step, i) => (
                <Step key={step.num} step={step} index={i} active={active === i} />
              ))}
            </div>

            {/* Right: browser frame — dark mockup on white feels premium */}
            <div
              className="rounded-[18px] p-[10px]"
              style={{
                background: "#131E35",
                border: "1px solid rgba(11,18,32,0.1)",
                boxShadow: "0 24px 60px rgba(11,18,32,0.14), 0 0 0 1px rgba(255,255,255,0.06)",
              }}
            >
              {/* Chrome bar */}
              <div className="mb-2.5 flex items-center gap-2 px-1">
                <span className="h-3 w-3 rounded-full" style={{ background: "#1E2D4A" }} />
                <span className="h-3 w-3 rounded-full" style={{ background: "#1E2D4A" }} />
                <span className="h-3 w-3 rounded-full" style={{ background: "#1E2D4A" }} />
                <div
                  className="mx-auto flex items-center gap-1.5 rounded-full px-3 py-1 transition-all duration-500"
                  style={{ background: "#0D1828" }}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[#3a65f0]" />
                  <span className="text-[11px] transition-all duration-500" style={{ color: "rgba(255,255,255,0.3)" }}>
                    {urlLabels[active]}
                  </span>
                </div>
              </div>
              <div
                className="relative aspect-[16/10] w-full overflow-hidden rounded-xl"
                style={{ willChange: "transform, opacity" }}
              >
                <CrossfadeImage
                  img={images[0]}
                  range={[0, 0.25, 0.4]}
                  output={[1, 1, 0]}
                  progress={scrollYProgress}
                />
                <CrossfadeImage
                  img={images[1]}
                  range={[0.3, 0.5, 0.65]}
                  output={[0, 1, 0]}
                  progress={scrollYProgress}
                />
                <CrossfadeImage
                  img={images[2]}
                  range={[0.6, 0.75, 1]}
                  output={[0, 1, 1]}
                  progress={scrollYProgress}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default StickyStory;
