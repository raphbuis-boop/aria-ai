export default function FinalCta() {
  return (
    <section
      className="relative flex flex-col items-center justify-center text-center px-6"
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
        Built for New Jersey agents
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
        Your clients won&apos;t wait.
        <br />
        <span style={{ color: "rgba(255,255,255,0.35)" }}>Neither should you.</span>
      </h2>

      <p
        className="text-base leading-relaxed mb-10"
        style={{ color: "rgba(255,255,255,0.4)", maxWidth: 440 }}
      >
        Aria is the AI teammate every agent deserves — available now for agents in New Jersey.
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <a
          href="/setup"
          className="inline-flex items-center justify-center font-semibold text-[14px] rounded-full transition-opacity duration-200 hover:opacity-90 active:scale-[0.98]"
          style={{
            background: "#FFFFFF",
            color: "#0B1220",
            padding: "14px 32px",
            letterSpacing: "-0.01em",
          }}
        >
          Get early access
        </a>
        <a
          href="mailto:hello@getariaai.com"
          className="inline-flex items-center justify-center font-medium text-[14px] rounded-full transition-colors duration-200 hover:bg-white/5"
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            color: "rgba(255,255,255,0.5)",
            padding: "14px 28px",
            letterSpacing: "-0.01em",
          }}
        >
          Talk to the team
        </a>
      </div>

      <p className="mt-10 text-[11px]" style={{ color: "rgba(255,255,255,0.2)" }}>
        No credit card required · NJ agents only
      </p>
    </section>
  );
}
