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
      style={{ opacity: active ? 1 : 0.35 }}
    >
      <span
        className="absolute left-0 top-1 h-[calc(100%-0.5rem)] w-[3px] origin-top rounded-full bg-[#0b0b0f] transition-transform duration-500"
        style={{ transform: `scaleY(${active ? 1 : 0})` }}
        aria-hidden
      />
      <span className="text-[13px] text-[#6b6b72]">{step.num}</span>
      <h3 className="mt-2 font-serif text-[32px] italic leading-tight text-[#0b0b0f]">
        {step.title}
      </h3>
      <p className="mt-3 max-w-[360px] text-[16px] leading-relaxed text-[#6b6b72]">{step.body}</p>
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
    <section className="bg-[#fafaf7]">
      <div className="mx-auto max-w-6xl px-6 pt-28 text-center">
        <h2 className="text-balance font-serif text-[40px] leading-tight text-[#0b0b0f] md:text-[64px]">
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

            {/* Right: laptop frame */}
            <div
              className="rounded-2xl p-4"
              style={{
                background: "#F2F0EB",
                boxShadow: "0 24px 60px rgba(0,0,0,0.08)",
              }}
            >
              <div className="mb-3 flex items-center gap-2 px-1">
                <span className="h-3 w-3 rounded-full bg-[#E8623E]" />
                <span className="h-3 w-3 rounded-full bg-[#E8A23E]" />
                <span className="h-3 w-3 rounded-full bg-[#3EA877]" />
                <span className="mx-auto rounded-full bg-white px-4 py-1 text-[12px] text-[#6b6b72]">
                  aria.app / today
                </span>
              </div>
              <div
                className="relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-white"
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
