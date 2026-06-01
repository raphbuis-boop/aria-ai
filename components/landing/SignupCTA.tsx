"use client";

import { useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2 } from "lucide-react";

const ease = [0.22, 1, 0.36, 1] as const;

type Status = "idle" | "loading" | "success" | "error";

export function SignupCTA() {
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
      className="scroll-mt-24 px-6 py-36"
      style={{ background: "#FFFFFF" }}
    >
      <div className="mx-auto flex max-w-[600px] flex-col items-center text-center">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease }}
          className="mb-5 text-[11px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: "#3a65f0" }}
        >
          Early access
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease }}
          className="font-bold"
          style={{
            fontSize: "clamp(2rem, 5vw, 3.25rem)",
            letterSpacing: "-0.035em",
            lineHeight: 1.1,
            color: "#0B1220",
          }}
        >
          Ready for a better Monday?
        </motion.h2>

        <p
          className="mt-5 max-w-[420px] text-[16px] leading-relaxed"
          style={{ color: "rgba(11,18,32,0.5)" }}
        >
          Join the early access list. We&apos;re onboarding 10 NJ agents per week.
        </p>

        <div className="mt-10 w-full max-w-[460px]">
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
                <span className="text-[15px]" style={{ color: "#0B1220" }}>
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
                  background: "#FFFFFF",
                  border: "1px solid rgba(11,18,32,0.12)",
                  boxShadow: "0 2px 8px rgba(11,18,32,0.06)",
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
                  className="h-full flex-1 bg-transparent text-[15px] outline-none"
                  style={{ color: "#0B1220" }}
                />
                <motion.button
                  type="submit"
                  disabled={status === "loading"}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-semibold text-white disabled:opacity-70"
                  style={{ background: "#3a65f0" }}
                >
                  {status === "loading" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {status === "loading" ? "Joining…" : "Get early access"}
                </motion.button>
              </motion.form>
            )}
          </AnimatePresence>

          {status === "error" && (
            <p className="mt-3 text-[12px] text-red-500">{error}</p>
          )}
        </div>

        <p className="mt-5 text-[12px]" style={{ color: "rgba(11,18,32,0.3)" }}>
          NJ agents only · No credit card · We&apos;ll reach out within 48 hours
        </p>
      </div>
    </section>
  );
}

export default SignupCTA;
