"use client";

import { useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2 } from "lucide-react";

type Status = "idle" | "loading" | "success" | "error";

export default function FinalCta() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (status === "loading") return;

    setStatus("loading");
    setError("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Something went wrong, try again.");
        setStatus("error");
        return;
      }

      setStatus("success");
    } catch {
      setError("Something went wrong, try again.");
      setStatus("error");
    }
  }

  return (
    <section
      id="signup"
      className="relative flex flex-col items-center justify-center text-center px-6 scroll-mt-24"
      style={{
        background: "linear-gradient(160deg, #0D1525 0%, #080D18 100%)",
        paddingTop: "140px",
        paddingBottom: "160px",
      }}
    >
      {/* Subtle top separator */}
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(58,101,240,0.4), transparent)",
        }}
      />

      <p
        className="text-[11px] font-semibold uppercase tracking-[0.18em] mb-6"
        style={{ color: "#6b8fff" }}
      >
        NJ agents only · 10 agents onboarded per week
      </p>

      <h2
        className="font-bold mb-5 text-white"
        style={{
          fontSize: "clamp(2.2rem, 6vw, 4.25rem)",
          lineHeight: 1.08,
          letterSpacing: "-0.04em",
          maxWidth: 680,
        }}
      >
        Stop leaving commission
        <br />
        <span style={{ color: "rgba(255,255,255,0.35)" }}>on the table.</span>
      </h2>

      <p
        className="text-base leading-relaxed mb-10"
        style={{ color: "rgba(255,255,255,0.4)", maxWidth: 440 }}
      >
        Join the early access list and be among the first NJ agents
        running on an AI Revenue Operating System.
      </p>

      <div className="w-full max-w-[460px]">
        <AnimatePresence mode="wait">
          {status === "success" ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-center gap-2.5 rounded-full px-6 py-4"
              style={{
                background: "rgba(52,211,153,0.08)",
                border: "1px solid rgba(52,211,153,0.25)",
              }}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
                <Check className="h-3.5 w-3.5" />
              </span>
              <span className="text-[15px] text-white">
                You&apos;re on the list. We&apos;ll be in touch.
              </span>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              onSubmit={handleSubmit}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex h-14 w-full items-center rounded-full pl-5 pr-1.5"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (status === "error") setStatus("idle");
                }}
                placeholder="your@email.com"
                aria-label="Email address"
                className="h-full flex-1 bg-transparent text-[15px] outline-none placeholder:text-white/30"
                style={{ color: "rgba(255,255,255,0.85)" }}
              />
              <motion.button
                type="submit"
                disabled={status === "loading"}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-semibold text-[#0B1220] disabled:opacity-70"
                style={{ background: "#FFFFFF" }}
              >
                {status === "loading" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {status === "loading" ? "Joining…" : "Get early access"}
              </motion.button>
            </motion.form>
          )}
        </AnimatePresence>

        {status === "error" && (
          <p className="mt-3 text-[12px] text-red-400">{error}</p>
        )}
      </div>

      <p className="mt-6 text-[11px]" style={{ color: "rgba(255,255,255,0.2)" }}>
        No credit card required · We&apos;ll reach out within 48 hours
      </p>
    </section>
  );
}
