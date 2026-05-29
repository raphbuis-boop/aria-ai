"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

const PHONE_H = 520;

const panels = [
  {
    eyebrow: "Step 01",
    headline: "Aria reads\nevery email.",
    body: "Every thread. Every reply. Every follow-up that fell through the cracks. Aria reads your Gmail overnight so you walk in knowing exactly what happened while you were off the clock.",
    screen: "/inbox-screen-placeholder.png",
    label: "Inbox view",
  },
  {
    eyebrow: "Step 02",
    headline: "Drafts the perfect reply\nin your voice.",
    body: "Not ChatGPT-generic. Aria learns from the way you actually write — your phrases, your warmth, your sign-offs. Every draft sounds like you on your best day.",
    screen: "/draft-screen-placeholder.png",
    label: "Draft view",
  },
  {
    eyebrow: "Step 03",
    headline: "Reminds you who's\nabout to slip.",
    body: "The client who's gone quiet. The offer expiring tomorrow. The follow-up you meant to send Monday. Aria surfaces all of it before a deal walks out the door.",
    screen: "/today-screen-placeholder.png",
    label: "Today briefing",
  },
] as const;

function ScreenSlot({ src, label }: { src: string; label: string }) {
  return (
    <div style={{ height: PHONE_H, background: "#F0EDE8", flexShrink: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={label}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        onError={(e) => {
          e.currentTarget.style.display = "none";
          const fb = e.currentTarget.nextElementSibling as HTMLElement | null;
          if (fb) fb.style.display = "flex";
        }}
      />
      {/* Fallback shown when screenshot file is missing */}
      <div
        aria-hidden
        style={{
          display: "none",
          height: PHONE_H,
          alignItems: "center",
          justifyContent: "center",
          background: "#F0EDE8",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#E8E4DF" }} />
        <span style={{ fontSize: 12, color: "#9A9AA2" }}>{label}</span>
      </div>
    </div>
  );
}

export default function StickyStory() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Slide the phone image strip
  const stripY = useTransform(
    scrollYProgress,
    [0, 1],
    [0, -(panels.length - 1) * PHONE_H]
  );

  useEffect(() => {
    return scrollYProgress.on("change", (v) => {
      setActiveIndex(Math.min(panels.length - 1, Math.floor(v * panels.length)));
    });
  }, [scrollYProgress]);

  return (
    <section style={{ background: "#FAFAF7", borderTop: "0.5px solid #EEEBE5" }}>
      {/* ── Mobile: plain stacked panels ── */}
      <div className="md:hidden px-6 py-16 space-y-20 max-w-md mx-auto">
        {panels.map((panel, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-5"
          >
            <div>
              <span
                className="text-[10.5px] font-bold tracking-[0.18em] uppercase block mb-3"
                style={{ color: "#B85C43" }}
              >
                {panel.eyebrow}
              </span>
              <h2
                className="text-[1.8rem] font-medium leading-tight mb-3"
                style={{ color: "#0B0B0F", letterSpacing: "-0.025em", whiteSpace: "pre-line" }}
              >
                {panel.headline}
              </h2>
              <p className="text-[15px] leading-relaxed" style={{ color: "#4A4A52" }}>
                {panel.body}
              </p>
            </div>
            <div
              className="mx-auto overflow-hidden"
              style={{
                width: 220,
                borderRadius: 36,
                boxShadow: "0 24px 64px -12px rgba(11,11,15,0.18), 0 0 0 0.5px rgba(11,11,15,0.06)",
              }}
            >
              <ScreenSlot src={panel.screen} label={panel.label} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Desktop: sticky two-column scroll story ── */}
      <div
        ref={containerRef}
        className="hidden md:block relative"
        style={{ height: `${panels.length * 100}vh` }}
      >
        <div
          className="sticky top-0 h-screen flex items-center overflow-hidden"
        >
          <div className="max-w-5xl mx-auto px-10 w-full grid grid-cols-2 gap-20 items-center">

            {/* Left: crossfading text */}
            <div className="relative" style={{ minHeight: 280 }}>
              {panels.map((panel, i) => (
                <div
                  key={i}
                  className="absolute inset-0 transition-all duration-700"
                  style={{
                    opacity: activeIndex === i ? 1 : 0,
                    transform: `translateY(${
                      activeIndex === i ? 0 : activeIndex > i ? -20 : 20
                    }px)`,
                    pointerEvents: activeIndex === i ? "auto" : "none",
                  }}
                >
                  <span
                    className="text-[10.5px] font-bold tracking-[0.18em] uppercase block mb-4"
                    style={{ color: "#B85C43" }}
                  >
                    {panel.eyebrow}
                  </span>
                  <h2
                    className="text-[2.4rem] font-medium leading-tight mb-5"
                    style={{
                      color: "#0B0B0F",
                      letterSpacing: "-0.03em",
                      whiteSpace: "pre-line",
                    }}
                  >
                    {panel.headline}
                  </h2>
                  <p
                    className="text-[16px] leading-relaxed"
                    style={{ color: "#4A4A52", maxWidth: 380 }}
                  >
                    {panel.body}
                  </p>

                  {/* Progress dots */}
                  <div className="flex gap-2 mt-10">
                    {panels.map((_, j) => (
                      <div
                        key={j}
                        className="h-[3px] rounded-full transition-all duration-500"
                        style={{
                          width: j === activeIndex ? 28 : 12,
                          background: j === activeIndex ? "#B85C43" : "#E8E4DF",
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Right: phone with sliding strip */}
            <div className="flex justify-end">
              <div
                style={{
                  width: 252,
                  background: "#fff",
                  borderRadius: 44,
                  padding: "10px 10px 0",
                  boxShadow:
                    "0 40px 100px -20px rgba(11,11,15,0.2), 0 0 0 0.5px rgba(11,11,15,0.07)",
                }}
              >
                <div
                  style={{
                    borderRadius: "34px 34px 0 0",
                    overflow: "hidden",
                    height: PHONE_H,
                    background: "#F0EDE8",
                  }}
                >
                  <motion.div style={{ y: stripY }}>
                    {panels.map((panel, i) => (
                      <ScreenSlot key={i} src={panel.screen} label={panel.label} />
                    ))}
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
