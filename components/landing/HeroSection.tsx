"use client";

import { useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] },
  },
};

export default function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [position, setPosition] = useState<number | null>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  const phoneY = useTransform(scrollYProgress, [0, 1], [0, -50]);
  const phoneOpacity = useTransform(scrollYProgress, [0, 0.85], [1, 0.5]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || status === "loading") return;
    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      setPosition(data.position ?? null);
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section
      ref={sectionRef}
      className="relative pt-32 pb-0 overflow-hidden"
      style={{ background: "#FAFAF7" }}
    >
      {/* Soft pink radial glow behind phone */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2"
        style={{
          width: 900,
          height: 700,
          background:
            "radial-gradient(ellipse at 50% 15%, rgba(252,217,208,0.75) 0%, rgba(252,217,208,0.2) 42%, transparent 70%)",
        }}
      />

      <div className="relative max-w-3xl mx-auto px-6 text-center">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Eyebrow pill */}
          <motion.div variants={itemVariants} className="mb-7">
            <span
              className="inline-block text-[11px] font-semibold tracking-[0.14em] uppercase px-3.5 py-1.5 rounded-full"
              style={{ background: "#FCD9D0", color: "#8B3A25" }}
            >
              Built for NJ real estate agents
            </span>
          </motion.div>

          {/* H1 */}
          <motion.h1
            variants={itemVariants}
            className="font-medium leading-[1.04] mb-5"
            style={{
              fontSize: "clamp(2.4rem, 6vw, 3.75rem)",
              letterSpacing: "-0.035em",
              color: "#0B0B0F",
            }}
          >
            Aria writes your client emails{" "}
            <em className="not-italic" style={{ color: "#B85C43" }}>
              in your voice.
            </em>
          </motion.h1>

          {/* Subhead */}
          <motion.p
            variants={itemVariants}
            className="text-[17px] leading-relaxed max-w-[520px] mx-auto mb-10"
            style={{ color: "#4A4A52" }}
          >
            You&apos;re juggling 20 clients. Aria reads your Gmail, drafts
            replies in your voice, and flags who&apos;s about to go cold —
            before you even open your laptop.
          </motion.p>

          {/* Waitlist form */}
          <motion.div variants={itemVariants} id="waitlist">
            {status === "success" ? (
              <div
                className="inline-flex flex-col items-center gap-1.5 px-8 py-5 rounded-2xl"
                style={{
                  background: "#fff",
                  border: "0.5px solid #EEEBE5",
                  boxShadow: "0 4px 24px rgba(11,11,15,0.06)",
                }}
              >
                <span
                  className="text-3xl font-semibold"
                  style={{ color: "#0B0B0F", letterSpacing: "-0.02em" }}
                >
                  #{position}
                </span>
                <span className="text-[13.5px]" style={{ color: "#4A4A52" }}>
                  on the early access list. We&apos;ll be in touch.
                </span>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="flex gap-2 max-w-[400px] mx-auto flex-wrap justify-center"
              >
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="flex-1 min-w-[180px] text-[14px] px-5 py-3 rounded-full outline-none transition-all"
                  style={{
                    background: "#fff",
                    border: "0.5px solid #E8E4DF",
                    color: "#0B0B0F",
                  }}
                  onFocus={(e) =>
                    (e.currentTarget.style.border = "0.5px solid #FCD9D0")
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.border = "0.5px solid #E8E4DF")
                  }
                />
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="text-[14px] font-medium px-5 py-3 rounded-full whitespace-nowrap transition-opacity"
                  style={{
                    background: "#0B0B0F",
                    color: "#fff",
                    opacity: status === "loading" ? 0.7 : 1,
                  }}
                >
                  {status === "loading" ? "Joining…" : "Get early access"}
                </button>
              </form>
            )}

            {status === "error" && (
              <p className="text-[12.5px] mt-2" style={{ color: "#B85C43" }}>
                Something went wrong. Please try again.
              </p>
            )}

            <p className="text-[12px] mt-3" style={{ color: "#9A9AA2" }}>
              No credit card. No setup fees. NJ agents only for now.
            </p>
          </motion.div>
        </motion.div>

        {/* Phone mockup with parallax on scroll */}
        <motion.div
          style={{ y: phoneY, opacity: phoneOpacity }}
          className="mt-16 mx-auto"
        >
          <div
            className="mx-auto"
            style={{
              width: 272,
              background: "#fff",
              borderRadius: 44,
              padding: "10px 10px 0",
              boxShadow:
                "0 48px 120px -24px rgba(11,11,15,0.2), 0 0 0 0.5px rgba(11,11,15,0.07)",
            }}
          >
            <div
              style={{
                borderRadius: "34px 34px 0 0",
                overflow: "hidden",
                background: "#F0EDE8",
                minHeight: 520,
              }}
            >
              {/* TODO: swap /today-screen-placeholder.png for real Aria Today screenshot */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/today-screen-placeholder.png"
                alt="Aria Today screen"
                width={252}
                height={546}
                style={{ width: "100%", display: "block" }}
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  const fb = e.currentTarget
                    .nextElementSibling as HTMLElement | null;
                  if (fb) fb.style.display = "flex";
                }}
              />
              {/* Fallback shown when screenshot file is missing */}
              <div
                aria-hidden
                style={{
                  display: "none",
                  height: 546,
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#F0EDE8",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: "#E8E4DF",
                  }}
                />
                <span style={{ fontSize: 12, color: "#9A9AA2" }}>
                  App screenshot
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
