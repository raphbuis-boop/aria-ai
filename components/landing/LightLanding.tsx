"use client";

/**
 * LightLanding — Aria marketing landing page.
 * Light & premium: ivory/green brand, Lenis smooth scroll, framer-motion
 * scroll reveals + micro-interactions, honest copy, product mockups.
 * Waitlist wiring preserved: POST /api/waitlist { email }.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Lenis from "lenis";
import {
  Sun,
  TrendingUp,
  ClipboardCheck,
  Mail,
  PenLine,
  Building2,
  Mic,
  ArrowRight,
  Check,
  Sparkles,
} from "lucide-react";

/* ---------- tokens ---------- */
const GREEN = "#1F5C46";
const GREEN_DARK = "#17442F";
const INK = "#2B2419";
const MUTED = "#6f6656";
const IVORY = "#FAF6EE";
const EASE = [0.22, 1, 0.36, 1] as const;

/* ---------- copy ---------- */
const C = {
  eyebrow: "AI Revenue Operating System for NJ Real Estate Agents",
  heroA: "Every relationship",
  heroB: "is revenue.",
  heroSub:
    "Aria watches every signal across your pipeline — emails, activity, the deals gone quiet — and tells you exactly who to contact, what to say, and when to move. Close more without working more.",
  ctaPrimary: "Get early access",
  ctaSecondary: "See how it works",
  trust: "Built for New Jersey agents",
  values: [
    {
      Icon: Sun,
      kicker: "Daily priorities",
      title: "Exactly what to do next — every morning",
      body: "Open Aria to a ranked morning brief: who's hot, who's slipping, and the one move that matters most today.",
    },
    {
      Icon: TrendingUp,
      kicker: "Pipeline intelligence",
      title: "Know who's ready to move — before they slip",
      body: "Aria scores every relationship on real behavior — opens, replies, listing views, silence — so nobody falls through the cracks.",
    },
    {
      Icon: ClipboardCheck,
      kicker: "Automatic logging",
      title: "Every relationship tracked, hands-free",
      body: "Calls, texts, emails, showings — logged automatically. No more end-of-day data entry that never happens.",
    },
  ],
  steps: [
    {
      tag: "aria.app / today",
      title: "Aria sees what you'd miss",
      body: "Every morning, a briefing of your highest-leverage moves — pulled from real activity across your whole book of business.",
    },
    {
      tag: "aria.app / inbox",
      title: "Draft, approve, send — in your voice",
      body: "Aria reads the thread, understands the context, and writes the reply the way you would. Approve in three seconds. Sent from your real number.",
    },
    {
      tag: "aria.app / pipeline",
      title: "Watch every deal move forward",
      body: "A living pipeline that updates itself. See every deal's stage, momentum, and next action without touching a spreadsheet.",
    },
  ],
  features: [
    {
      Icon: Mail,
      kicker: "Gmail integration",
      title: "Your inbox, always caught up",
      body: "Connect Gmail in one tap. Aria reads every thread, flags what needs a reply, and keeps a full history of every client conversation.",
    },
    {
      Icon: PenLine,
      kicker: "AI follow-ups",
      title: "Your follow-up, written before you ask",
      body: "Context-aware drafts in your voice, ready to approve. Sent as a real text from your real number — not a robot blast.",
    },
    {
      Icon: Building2,
      kicker: "MLS intelligence",
      title: "Listings, matches, comps — in one place",
      body: "Aria pulls live NJ MLS data so you're not bouncing between tabs when a client asks about a new listing.",
    },
    {
      Icon: Mic,
      kicker: "Hands-free voice",
      title: "Run your day from the car",
      body: "Ask Aria who to call, log a showing, or draft a text out loud. Everything captured while your hands stay on the wheel.",
    },
  ],
  ctaTitle: "Get early access.",
  ctaSub: "Join the early access list. We're onboarding 10 NJ agents per week.",
  footerTag: "Aria",
  footerLine: "The AI revenue operating system for real estate.",
};

/* ---------- reveal helper ---------- */
function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-70px" }}
      transition={{ duration: 0.6, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/* ---------- buttons ---------- */
function PrimaryButton({
  children,
  onClick,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 26 }}
      className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full px-6 py-3 text-[15px] font-semibold text-white"
      style={{
        background: `linear-gradient(160deg, #2b8060 0%, ${GREEN} 60%)`,
        boxShadow: "0 8px 24px -6px rgba(31,92,70,0.5), inset 0 1px 0 rgba(255,255,255,0.18)",
      }}
    >
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
      <span
        aria-hidden
        className="absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)" }}
      />
    </motion.button>
  );
}

function GhostButton({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 26 }}
      className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-[15px] font-semibold"
      style={{ color: INK, background: "rgba(255,255,255,0.7)", border: "1px solid rgba(43,36,25,0.12)" }}
    >
      {children}
    </motion.button>
  );
}

/* ---------- orb ---------- */
function Orb({ size = 84 }: { size?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className="relative rounded-full"
      style={{
        width: size,
        height: size,
        background: "radial-gradient(circle at 38% 35%, #6f9bff, #4f7bff 50%, #2a4acc)",
      }}
      animate={
        reduce
          ? undefined
          : {
              scale: [1, 1.05, 1],
              boxShadow: [
                "0 0 0 10px rgba(79,123,255,0.06), 0 0 0 22px rgba(79,123,255,0.03), 0 18px 50px rgba(79,123,255,0.35)",
                "0 0 0 14px rgba(79,123,255,0.08), 0 0 0 30px rgba(79,123,255,0.04), 0 22px 64px rgba(79,123,255,0.45)",
                "0 0 0 10px rgba(79,123,255,0.06), 0 0 0 22px rgba(79,123,255,0.03), 0 18px 50px rgba(79,123,255,0.35)",
              ],
            }
      }
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[7px] h-1/3 w-1/2 -translate-x-1/2 rounded-full"
        style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.65), transparent)" }}
      />
    </motion.div>
  );
}

/* ---------- mock UI panels ---------- */
function ChipRow() {
  const chips = ["Live NJ MLS", "Gmail-native", "Writes in your voice", "Hands-free"];
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {chips.map((c) => (
        <span
          key={c}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium"
          style={{ background: "rgba(31,92,70,0.06)", color: GREEN_DARK, border: "1px solid rgba(31,92,70,0.14)" }}
        >
          <Check className="size-3.5" strokeWidth={2.6} /> {c}
        </span>
      ))}
    </div>
  );
}

function TodayMock() {
  return (
    <div className="w-full rounded-[22px] bg-white p-4" style={{ border: "1px solid rgba(43,36,25,0.08)", boxShadow: "0 1px 2px rgba(43,36,25,0.05), 0 30px 60px -24px rgba(43,36,25,0.30)" }}>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: MUTED }}>Morning Brief</div>
          <div className="font-heading text-[19px] font-semibold" style={{ color: INK }}>Today&apos;s Focus</div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: "rgba(184,75,51,0.10)", color: "#B84B33" }}>
          <span className="size-1.5 rounded-full" style={{ background: "#B84B33" }} /> 3 hot
        </div>
      </div>
      {[
        { n: "Rabbi Wald", s: "Viewed 2 listings · no reply in 4d", t: "Text now", hot: true },
        { n: "The Kesslers", s: "Pre-approval expires Friday", t: "Call", hot: true },
        { n: "Dana Mizrahi", s: "Open house follow-up due", t: "Draft", hot: false },
      ].map((r) => (
        <div key={r.n} className="mb-2 flex items-center gap-3 rounded-2xl p-3" style={{ background: "#FBF8F1", border: "1px solid rgba(43,36,25,0.06)" }}>
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-white" style={{ background: r.hot ? "#B84B33" : GREEN }}>
            {r.n.slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-semibold" style={{ color: INK }}>{r.n}</div>
            <div className="truncate text-[12px]" style={{ color: MUTED }}>{r.s}</div>
          </div>
          <span className="shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold text-white" style={{ background: GREEN }}>{r.t}</span>
        </div>
      ))}
    </div>
  );
}

function InboxMock() {
  return (
    <div className="w-full rounded-[22px] bg-white p-4" style={{ border: "1px solid rgba(43,36,25,0.08)", boxShadow: "0 1px 2px rgba(43,36,25,0.05), 0 30px 60px -24px rgba(43,36,25,0.30)" }}>
      <div className="mb-3 flex items-center gap-2">
        <Mail className="size-4" style={{ color: GREEN }} />
        <div className="text-[13px] font-semibold" style={{ color: INK }}>Reply to Rabbi Wald</div>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold" style={{ background: "rgba(31,92,70,0.10)", color: GREEN_DARK }}><Sparkles className="size-3" /> AI draft</span>
      </div>
      <div className="rounded-2xl p-3 text-[13.5px] leading-relaxed" style={{ background: "#FBF8F1", border: "1px solid rgba(43,36,25,0.06)", color: INK }}>
        Hi Rabbi Wald — saw you were looking at the two colonials on Summit Ave. The one at 42 Summit just dropped $15k and it checks the boxes we talked about. Want me to set up a showing this weekend?
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="rounded-full px-4 py-2 text-[13px] font-semibold text-white" style={{ background: GREEN }}>Approve &amp; send</span>
        <span className="rounded-full px-4 py-2 text-[13px] font-semibold" style={{ color: INK, border: "1px solid rgba(43,36,25,0.12)" }}>Edit</span>
        <span className="ml-auto text-[11.5px]" style={{ color: MUTED }}>from your number</span>
      </div>
    </div>
  );
}

function PipelineMock() {
  const rows = [
    { n: "The Kesslers", st: "Offer", pct: 82, c: GREEN },
    { n: "Dana Mizrahi", st: "Showing", pct: 54, c: "#C89B3C" },
    { n: "Rabbi Wald", st: "Nurture", pct: 33, c: "#7c7362" },
  ];
  return (
    <div className="w-full rounded-[22px] bg-white p-4" style={{ border: "1px solid rgba(43,36,25,0.08)", boxShadow: "0 1px 2px rgba(43,36,25,0.05), 0 30px 60px -24px rgba(43,36,25,0.30)" }}>
      <div className="mb-3 text-[13px] font-semibold" style={{ color: INK }}>Active pipeline</div>
      {rows.map((r) => (
        <div key={r.n} className="mb-3">
          <div className="mb-1 flex items-center justify-between text-[13px]">
            <span className="font-semibold" style={{ color: INK }}>{r.n}</span>
            <span style={{ color: MUTED }}>{r.st}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "#EFE8DA" }}>
            <div className="h-full rounded-full" style={{ width: `${r.pct}%`, background: r.c }} />
          </div>
        </div>
      ))}
    </div>
  );
}

const MOCKS = [TodayMock, InboxMock, PipelineMock];

/* ---------- page ---------- */
export default function LightLanding() {
  const lenisRef = useRef<Lenis | null>(null);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    lenisRef.current = lenis;
    let raf = 0;
    const loop = (t: number) => {
      lenis.raf(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    if (lenisRef.current) lenisRef.current.scrollTo(el, { offset: -20 });
    else el.scrollIntoView({ behavior: "smooth" });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || status === "loading") return;
    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error("failed");
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden" style={{ background: IVORY, color: INK }}>
      {/* grain */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[45]"
        style={{
          opacity: 0.035,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* nav */}
      <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-3">
        <nav
          className="flex w-full max-w-5xl items-center justify-between rounded-full px-4 py-2.5"
          style={{
            background: "rgba(250,246,238,0.72)",
            backdropFilter: "blur(18px) saturate(180%)",
            WebkitBackdropFilter: "blur(18px) saturate(180%)",
            border: "1px solid rgba(43,36,25,0.08)",
            boxShadow: "0 6px 24px -12px rgba(43,36,25,0.25)",
          }}
        >
          <div className="flex items-center gap-2.5">
            <div className="relative size-8 rounded-full" style={{ background: "radial-gradient(circle at 38% 35%, #6f9bff, #4f7bff 50%, #2a4acc)" }}>
              <span aria-hidden className="absolute left-1/2 top-1 h-1/3 w-1/2 -translate-x-1/2 rounded-full" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.6), transparent)" }} />
            </div>
            <span className="font-heading text-[19px] font-semibold" style={{ color: INK }}>Aria</span>
          </div>
          <div className="hidden items-center gap-7 text-[14px] font-medium sm:flex" style={{ color: MUTED }}>
            <button onClick={() => scrollTo("how")} className="transition-opacity hover:opacity-70">How it works</button>
            <button onClick={() => scrollTo("features")} className="transition-colors hover:opacity-70">Features</button>
            <a href="/login" className="transition-colors hover:opacity-70">Sign in</a>
          </div>
          <button
            onClick={() => scrollTo("signup")}
            className="rounded-full px-4 py-2 text-[13.5px] font-semibold text-white"
            style={{ background: GREEN }}
          >
            Get early access
          </button>
        </nav>
      </header>

      {/* hero */}
      <section className="relative flex flex-col items-center px-6 pb-16 pt-32 text-center sm:pt-40">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[70%]"
          style={{ background: "radial-gradient(ellipse 60% 50% at 50% -8%, rgba(31,92,70,0.14), transparent 68%)" }}
        />
        <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="mb-7 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.12em]"
            style={{ background: "rgba(31,92,70,0.07)", color: GREEN_DARK, border: "1px solid rgba(31,92,70,0.16)" }}
          >
            <Sparkles className="size-3.5" /> {C.eyebrow}
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.06, ease: EASE }}
            className="font-heading font-semibold"
            style={{ fontSize: "clamp(2.9rem, 8vw, 5.6rem)", lineHeight: 1.03, letterSpacing: "-0.035em", color: INK }}
          >
            {C.heroA}
            <br />
            <span style={{ color: GREEN }}>{C.heroB}</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.16, ease: EASE }}
            className="mt-6 max-w-[540px] text-[17px] leading-relaxed"
            style={{ color: MUTED }}
          >
            {C.heroSub}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.26, ease: EASE }}
            className="mt-9 flex flex-wrap items-center justify-center gap-3"
          >
            <PrimaryButton onClick={() => scrollTo("signup")}>
              {C.ctaPrimary} <ArrowRight className="size-4" />
            </PrimaryButton>
            <GhostButton onClick={() => scrollTo("how")}>{C.ctaSecondary}</GhostButton>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="mt-8"
          >
            <ChipRow />
          </motion.div>

          {/* hero product visual */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.35, ease: EASE }}
            className="mt-14 w-full max-w-md"
          >
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            >
              <TodayMock />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* trust */}
      <section className="px-6 py-6 text-center">
        <p className="text-[12px] font-semibold uppercase tracking-[0.18em]" style={{ color: MUTED }}>{C.trust}</p>
      </section>

      {/* values */}
      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <Reveal className="mx-auto mb-14 max-w-2xl text-center">
          <h2 className="font-heading font-semibold" style={{ fontSize: "clamp(2rem, 4.5vw, 3.1rem)", lineHeight: 1.08, letterSpacing: "-0.03em", color: INK }}>
            Your book of business, finally working for you
          </h2>
        </Reveal>
        <div className="grid gap-5 md:grid-cols-3">
          {C.values.map((v, i) => (
            <Reveal key={v.kicker} delay={i * 0.08}>
              <motion.div
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
                className="h-full rounded-[20px] bg-white p-6"
                style={{ border: "1px solid rgba(43,36,25,0.08)", boxShadow: "0 1px 2px rgba(43,36,25,0.04), 0 18px 40px -26px rgba(43,36,25,0.35)" }}
              >
                <div className="mb-4 flex size-11 items-center justify-center rounded-2xl" style={{ background: "rgba(31,92,70,0.09)", color: GREEN }}>
                  <v.Icon className="size-5" strokeWidth={2} />
                </div>
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: GREEN }}>{v.kicker}</div>
                <h3 className="font-heading text-[20px] font-semibold leading-snug" style={{ color: INK }}>{v.title}</h3>
                <p className="mt-2.5 text-[14.5px] leading-relaxed" style={{ color: MUTED }}>{v.body}</p>
              </motion.div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* how it works — alternating story */}
      <section id="how" className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <Reveal className="mx-auto mb-16 max-w-2xl text-center">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: GREEN }}>How it works</div>
          <h2 className="font-heading font-semibold" style={{ fontSize: "clamp(2rem, 4.5vw, 3.1rem)", lineHeight: 1.08, letterSpacing: "-0.03em", color: INK }}>
            Three things Aria does every day
          </h2>
        </Reveal>

        <div className="flex flex-col gap-16 sm:gap-24">
          {C.steps.map((s, i) => {
            const Mock = MOCKS[i];
            const flip = i % 2 === 1;
            return (
              <div key={s.tag} className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
                <Reveal className={flip ? "lg:order-2" : ""}>
                  <div className="text-[12px] font-mono font-semibold" style={{ color: GREEN }}>{s.tag}</div>
                  <h3 className="mt-3 font-heading font-semibold" style={{ fontSize: "clamp(1.7rem, 3.5vw, 2.5rem)", lineHeight: 1.1, letterSpacing: "-0.02em", color: INK }}>{s.title}</h3>
                  <p className="mt-4 max-w-[420px] text-[16px] leading-relaxed" style={{ color: MUTED }}>{s.body}</p>
                </Reveal>
                <Reveal delay={0.1} className={flip ? "lg:order-1" : ""}>
                  <div className="rounded-[26px] p-4" style={{ background: "#F5EFE2", border: "1px solid rgba(43,36,25,0.06)" }}>
                    <Mock />
                  </div>
                </Reveal>
              </div>
            );
          })}
        </div>
      </section>

      {/* features bento */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <Reveal className="mx-auto mb-14 max-w-2xl text-center">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: GREEN }}>Everything in one place</div>
          <h2 className="font-heading font-semibold" style={{ fontSize: "clamp(2rem, 4.5vw, 3.1rem)", lineHeight: 1.08, letterSpacing: "-0.03em", color: INK }}>
            All your tools, replaced by one
          </h2>
        </Reveal>
        <div className="grid gap-5 sm:grid-cols-2">
          {C.features.map((f, i) => (
            <Reveal key={f.kicker} delay={(i % 2) * 0.08}>
              <motion.div
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
                className="flex h-full gap-4 rounded-[20px] bg-white p-6"
                style={{ border: "1px solid rgba(43,36,25,0.08)", boxShadow: "0 1px 2px rgba(43,36,25,0.04), 0 18px 40px -26px rgba(43,36,25,0.35)" }}
              >
                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl" style={{ background: "rgba(31,92,70,0.09)", color: GREEN }}>
                  <f.Icon className="size-5" strokeWidth={2} />
                </div>
                <div>
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: GREEN }}>{f.kicker}</div>
                  <h3 className="font-heading text-[19px] font-semibold leading-snug" style={{ color: INK }}>{f.title}</h3>
                  <p className="mt-2 text-[14.5px] leading-relaxed" style={{ color: MUTED }}>{f.body}</p>
                </div>
              </motion.div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* signup CTA */}
      <section id="signup" className="px-6 py-20 sm:py-28">
        <Reveal className="mx-auto max-w-3xl">
          <div
            className="relative overflow-hidden rounded-[32px] px-8 py-14 text-center sm:px-14"
            style={{ background: `linear-gradient(160deg, ${GREEN} 0%, ${GREEN_DARK} 100%)` }}
          >
            <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full" style={{ background: "radial-gradient(circle, rgba(111,155,255,0.35), transparent 70%)" }} />
            <div className="relative z-10 mx-auto flex flex-col items-center">
              <Orb size={72} />
              <h2 className="mt-8 font-heading font-semibold text-white" style={{ fontSize: "clamp(2rem, 5vw, 3.2rem)", lineHeight: 1.05, letterSpacing: "-0.03em" }}>
                {C.ctaTitle}
              </h2>
              <p className="mt-4 max-w-[440px] text-[16px] leading-relaxed" style={{ color: "rgba(255,255,255,0.72)" }}>
                {C.ctaSub}
              </p>

              {status === "success" ? (
                <div className="mt-8 flex items-center gap-2 rounded-full bg-white px-6 py-3 text-[15px] font-semibold" style={{ color: GREEN }}>
                  <Check className="size-5" strokeWidth={2.6} /> You&apos;re on the list — we&apos;ll be in touch.
                </div>
              ) : (
                <form onSubmit={submit} className="mt-8 flex w-full max-w-md flex-col gap-3 sm:flex-row">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                    className="w-full rounded-full px-5 py-3.5 text-[15px] outline-none"
                    style={{ background: "rgba(255,255,255,0.95)", color: INK }}
                  />
                  <button
                    type="submit"
                    disabled={status === "loading"}
                    className="shrink-0 rounded-full px-6 py-3.5 text-[15px] font-semibold disabled:opacity-70"
                    style={{ background: "#fff", color: GREEN }}
                  >
                    {status === "loading" ? "Joining…" : "Get early access"}
                  </button>
                </form>
              )}
              {status === "error" && (
                <p className="mt-3 text-[13px]" style={{ color: "rgba(255,255,255,0.85)" }}>Something went wrong — try again.</p>
              )}
            </div>
          </div>
        </Reveal>
      </section>

      {/* footer */}
      <footer className="mx-auto max-w-6xl px-6 py-12" style={{ borderTop: "1px solid rgba(43,36,25,0.08)" }}>
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div>
            <div className="font-heading text-[18px] font-semibold" style={{ color: INK }}>{C.footerTag}</div>
            <div className="text-[13px]" style={{ color: MUTED }}>{C.footerLine}</div>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13.5px]" style={{ color: MUTED }}>
            <a href="/privacy" className="hover:opacity-70">Privacy</a>
            <a href="/terms" className="hover:opacity-70">Terms</a>
            <a href="/fair-housing" className="hover:opacity-70">Fair Housing</a>
            <a href="/contact" className="hover:opacity-70">Contact</a>
            <a href="/login" className="hover:opacity-70">Sign in</a>
          </div>
        </div>
        <div className="mt-8 text-[12px]" style={{ color: MUTED }}>© {new Date().getFullYear()} Aria AI. All rights reserved.</div>
      </footer>
    </main>
  );
}
