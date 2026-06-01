"use client";

import { motion } from "framer-motion";

const ease = [0.22, 1, 0.36, 1] as const;

const props = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12C2 6.48 6.48 2 12 2s10 4.48 10 10-4.48 10-10 10S2 17.52 2 12z" />
        <path d="M12 8v4l3 3" />
      </svg>
    ),
    eyebrow: "Pipeline intelligence",
    headline: "Know who's ready to move — before they slip",
    body: "Aria watches every signal: days silent, last contact, price drops, showing activity. It surfaces the clients most likely to transact this week, not buried in a spreadsheet.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <path d="M9 12h6M9 16h4" />
      </svg>
    ),
    eyebrow: "Automatic logging",
    headline: "Every relationship tracked without lifting a finger",
    body: "Texts, calls, emails, showings, offers — Aria logs and timestamps everything. Your full client history, structured and searchable, without manual entry.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
    eyebrow: "Daily priorities",
    headline: "Exactly what to do next — every single morning",
    body: "Who to follow up with, which deals need attention, what's closing soon. One prioritized list. Zero noise. Zero time wasted figuring out where to start.",
  },
];

export function ValueProps() {
  return (
    <section
      className="px-6 py-28"
      style={{ background: "#0B1220" }}
    >
      <div className="mx-auto max-w-5xl">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease }}
          className="mb-4 text-center text-[11px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: "#6b8fff" }}
        >
          What Aria does for you
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease }}
          className="mx-auto max-w-2xl text-balance text-center font-bold text-white"
          style={{
            fontSize: "clamp(1.9rem, 4vw, 3rem)",
            letterSpacing: "-0.035em",
            lineHeight: 1.1,
          }}
        >
          The CRM that works while you&apos;re working.
        </motion.h2>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {props.map((p, i) => (
            <motion.div
              key={p.eyebrow}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.65, delay: i * 0.1, ease }}
              className="flex flex-col gap-5 rounded-[18px] p-7"
              style={{
                background: "#131E35",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl"
                style={{
                  background: "rgba(58,101,240,0.12)",
                  color: "#6b8fff",
                }}
              >
                {p.icon}
              </div>

              <div>
                <p
                  className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em]"
                  style={{ color: "rgba(107,143,255,0.7)" }}
                >
                  {p.eyebrow}
                </p>
                <h3
                  className="font-semibold leading-snug text-white"
                  style={{ fontSize: "18px", letterSpacing: "-0.02em" }}
                >
                  {p.headline}
                </h3>
                <p
                  className="mt-3 text-[14px] leading-relaxed"
                  style={{ color: "rgba(255,255,255,0.45)" }}
                >
                  {p.body}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default ValueProps;
