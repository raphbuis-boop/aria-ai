"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function CTASection() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [position, setPosition] = useState<number | null>(null);

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
    <section style={{ background: "#FAFAF7" }}>
      <div className="max-w-xl mx-auto px-6 py-24">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        >
          <div
            className="rounded-3xl px-8 py-10 text-center"
            style={{
              background: "#FCD9D0",
            }}
          >
            <h2
              className="text-[1.8rem] md:text-[2.2rem] font-medium mb-3"
              style={{ color: "#0B0B0F", letterSpacing: "-0.03em", lineHeight: 1.1 }}
            >
              Get early access.
            </h2>
            <p
              className="text-[15px] leading-relaxed mb-8 max-w-sm mx-auto"
              style={{ color: "#6B3025" }}
            >
              We&apos;re onboarding a small group of NJ agents this month. No
              credit card, no setup fees.
            </p>

            <AnimatePresence mode="wait">
              {status === "success" ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="flex flex-col items-center gap-1"
                >
                  <span
                    className="text-4xl font-semibold"
                    style={{ color: "#0B0B0F", letterSpacing: "-0.03em" }}
                  >
                    #{position}
                  </span>
                  <span className="text-[14px]" style={{ color: "#6B3025" }}>
                    on the list. We&apos;ll reach out soon.
                  </span>
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  onSubmit={handleSubmit}
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex gap-2 flex-wrap justify-center"
                >
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Your email address"
                    required
                    className="flex-1 min-w-[200px] text-[14px] px-5 py-3 rounded-full outline-none transition-all"
                    style={{
                      background: "rgba(255,255,255,0.82)",
                      border: "0.5px solid transparent",
                      color: "#0B0B0F",
                    }}
                    onFocus={(e) =>
                      (e.currentTarget.style.background = "rgba(255,255,255,0.95)")
                    }
                    onBlur={(e) =>
                      (e.currentTarget.style.background = "rgba(255,255,255,0.82)")
                    }
                  />
                  <button
                    type="submit"
                    disabled={status === "loading"}
                    className="text-[14px] font-medium px-6 py-3 rounded-full whitespace-nowrap transition-opacity"
                    style={{
                      background: "#0B0B0F",
                      color: "#fff",
                      opacity: status === "loading" ? 0.7 : 1,
                    }}
                  >
                    {status === "loading" ? "Joining…" : "Join the list"}
                  </button>
                </motion.form>
              )}
            </AnimatePresence>

            {status === "error" && (
              <p className="text-[12.5px] mt-3" style={{ color: "#7A2010" }}>
                Something went wrong. Please try again.
              </p>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
