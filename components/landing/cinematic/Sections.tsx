"use client";

import { useRef, useState, type FormEvent } from "react";
import { Check, Plus } from "lucide-react";
import { motion, useScroll, useTransform, type MotionValue } from "motion/react";
import { cn } from "@/lib/utils";
import { AriaOrb } from "./AriaOrb";
import { usePrefersReducedMotion } from "./hooks";
import { FINALE_GLOW, FINALE_GLOW_BG, ForestAtmosphere } from "./atmosphere";

/* ───────────── Trust: scroll-lit statement + ledger ───────────── */

const STATEMENT = "Nothing goes out without you. Aria drafts, books and reminds, but every text and every email waits for your OK.";

function Word({ word, i, total, p }: { word: string; i: number; total: number; p: MotionValue<number> }) {
  const start = (i / total) * 0.8;
  const opacity = useTransform(p, [start, start + 0.2], [0.16, 1]);
  return (
    <motion.span style={{ opacity }} className="inline-block whitespace-pre">
      {word}{" "}
    </motion.span>
  );
}

const LEDGER = [
  { k: "Texts", v: "Drafts open in your own Messages app. You press send, from your number." },
  { k: "Email", v: "Gmail and Outlook replies send only after you approve the exact words." },
  { k: "Calendar", v: "Aria reads your Google Calendar. Showings you book with Aria live on Aria’s calendar." },
  { k: "Your CRM", v: "Imports read your CRM’s export. Duplicates merge without overwriting, and any import can be undone." },
];

export function Trust() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.55"] });
  const words = STATEMENT.split(" ");
  return (
    <section id="after-demo" tabIndex={-1} data-env="forest" aria-labelledby="trust-title" className="relative overflow-clip bg-sidebar px-6 pb-20 pt-28 outline-none sm:px-10 lg:px-14 lg:pb-24 lg:pt-36">
      <ForestAtmosphere glow="center" feather="both" />
      <div className="relative mx-auto max-w-[1280px]">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-sidebar-muted">You stay in charge</p>
        <div ref={ref}>
          <h2 id="trust-title" className="mt-8 max-w-[22ch] font-heading text-[clamp(2.3rem,5.6vw,5.4rem)] font-normal leading-[1.02] tracking-[-0.035em] text-sidebar-foreground">
            {reduce ? STATEMENT : words.map((w, i) => <Word key={i} word={w} i={i} total={words.length} p={scrollYProgress} />)}
          </h2>
        </div>
        <dl className="mt-16 grid gap-x-4 sm:grid-cols-2 lg:mt-24">
          {LEDGER.map((row) => (
            <div key={row.k} className="mt-3 grid grid-cols-[96px_1fr] gap-5 rounded-[20px] border border-sidebar-foreground/10 bg-sidebar-raised/35 px-5 py-5 shadow-[inset_0_1px_0_color-mix(in_srgb,var(--sidebar-foreground)_6%,transparent)] sm:grid-cols-[110px_1fr]">
              <dt className="pt-0.5 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-taupe-light">{row.k}</dt>
              <dd className="font-display text-[15.5px] leading-relaxed text-sidebar-foreground/85">{row.v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* ───────────── Capability index: an editorial list, not a grid ───────────── */

const CAPS = [
  {
    title: "Morning brief",
    tag: "Available",
    body: "Who’s hot, who’s going quiet and what’s due, ranked from your real activity and waiting on Today each morning.",
    say: "“What should I focus on today?”",
  },
  {
    title: "Follow-ups in your voice",
    tag: "Available",
    body: "Aria drafts texts and emails from the whole thread. Texts open in your Messages app; emails send only after you approve them.",
    say: "“Draft a check-in for the Harts.”",
  },
  {
    title: "Showings & reminders",
    tag: "Available",
    body: "Book a showing or set a reminder in one sentence, typed or spoken. It lands on Today and the Calendar, and you see exactly what changed.",
    say: "“Book Owen Thursday at 3 at 40 Grove St.”",
  },
  {
    title: "One inbox",
    tag: "Available",
    body: "Gmail and Outlook side by side, with the threads that need you surfaced and replies drafted for your approval.",
    say: "“Who’s waiting on a reply?”",
  },
  {
    title: "Bring your book",
    tag: "CSV / Excel import",
    body: "Import from Follow Up Boss, kvCORE, Salesforce, LionDesk, Outlook or a spreadsheet; Google Contacts connects directly. Duplicates merge without overwriting, and any import can be undone. Live CRM sync isn’t available yet.",
    say: "Your CRM stays your CRM.",
  },
  {
    title: "Ask Aria anything",
    tag: "WhatsApp rolling out",
    body: "Ask in plain words, on the web or by voice. Messaging Aria on WhatsApp is rolling out to early-access accounts.",
    say: "“Who haven’t I talked to in a while?”",
  },
];

export function CapabilityIndex() {
  const [open, setOpen] = useState(0);
  return (
    <section id="capabilities" data-env="ivory" aria-labelledby="caps-title" className="relative bg-background px-6 pb-20 pt-10 sm:px-10 lg:px-14 lg:pb-24 lg:pt-14">
      <div className="mx-auto max-w-[1280px]">
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-end">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">What Aria does</p>
            <h2 id="caps-title" className="mt-6 font-heading text-[clamp(2.4rem,5.4vw,5rem)] font-normal leading-[1] tracking-[-0.035em] text-foreground">
              Six things Aria does <span className="italic text-primary">today.</span>
            </h2>
          </div>
          <p className="max-w-[42ch] font-display text-[16px] leading-relaxed text-muted-foreground lg:justify-self-end">
            No roadmap promises. Each of these works in Aria now, and the labels say exactly how it connects.
          </p>
        </div>

        <ol className="mt-16 border-b border-border lg:mt-24">
          {CAPS.map((c, i) => {
            const isOpen = open === i;
            const id = `cap-${i}`;
            return (
              <li key={c.title} className="border-t border-border" onPointerEnter={(e) => e.pointerType === "mouse" && setOpen(i)}>
                <h3>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={id}
                    onClick={() => setOpen(i)}
                    onFocus={() => setOpen(i)}
                    className="group grid w-full grid-cols-[44px_1fr_auto] items-center gap-4 py-6 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[72px_1fr_auto_auto] lg:py-8"
                  >
                    <span className="font-heading text-[18px] italic text-muted-foreground sm:text-[22px]">{String(i + 1).padStart(2, "0")}</span>
                    <span
                      className={cn(
                        "font-heading text-[clamp(1.6rem,3.6vw,3.25rem)] font-normal leading-[1.05] tracking-[-0.025em] transition-[color,transform] duration-500 ease-out",
                        isOpen ? "translate-x-1 text-foreground" : "text-foreground/60 group-hover:text-foreground/85",
                      )}
                    >
                      {c.title}
                    </span>
                    <span className="hidden rounded-full border border-border px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:inline-block">{c.tag}</span>
                    <span className={cn("flex size-9 items-center justify-center rounded-full border border-border text-foreground transition-transform duration-500", isOpen && "rotate-45 bg-primary text-primary-foreground")}>
                      <Plus className="size-4" />
                    </span>
                  </button>
                </h3>
                <div
                  id={id}
                  role="region"
                  aria-label={c.title}
                  className={cn("grid transition-[grid-template-rows,opacity] duration-500 ease-out motion-reduce:transition-none", isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}
                >
                  <div className="overflow-hidden">
                    <div className="grid gap-4 pb-8 pl-[60px] sm:grid-cols-[1fr_auto] sm:pl-[88px]">
                      <p className="max-w-[56ch] font-display text-[16px] leading-relaxed text-muted-foreground">{c.body}</p>
                      <p className="self-end pr-2 font-heading text-[18px] italic text-primary sm:text-right">{c.say}</p>
                      <span className="w-fit rounded-full border border-border px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:hidden">{c.tag}</span>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

/* ───────────── Early access (existing waitlist API) ───────────── */

export function Waitlist() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!email || status === "loading") return;
    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      if (!res.ok) throw new Error("failed");
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section id="early-access" data-env="forest" aria-labelledby="ea-title" className="relative overflow-clip bg-sidebar px-6 pb-24 pt-10 text-center sm:px-10 lg:pb-32 lg:pt-12">
      <ForestAtmosphere glow="none" feather="both" />
      <div aria-hidden className={cn("absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full", FINALE_GLOW)} style={{ background: FINALE_GLOW_BG }} />
      <div>
        <div className="relative mx-auto flex max-w-[760px] flex-col items-center">
          <AriaOrb size={88} energy={0.85} />
          <h2 id="ea-title" className="mt-12 font-heading text-[clamp(2.8rem,7vw,6rem)] font-normal leading-[0.95] tracking-[-0.04em] text-sidebar-foreground">
            Get early <span className="italic text-sidebar-accent">access.</span>
          </h2>
          <p className="mt-6 max-w-[46ch] font-display text-[17px] leading-relaxed text-sidebar-muted">
            We&apos;re onboarding New Jersey agents in small batches. Keep your CRM; Aria works alongside it.
          </p>

          <div className="mt-10 w-full max-w-[520px]" aria-live="polite">
            {status === "success" ? (
              <p className="flex items-center justify-center gap-2 rounded-full bg-sidebar-accent px-6 py-4 font-display text-[15px] font-semibold text-sidebar-accent-foreground">
                <Check className="size-5" strokeWidth={2.6} /> You&apos;re on the list. We&apos;ll be in touch.
              </p>
            ) : (
              <form onSubmit={submit} className="flex flex-col gap-2 rounded-[28px] border border-sidebar-foreground/15 bg-sidebar-raised/70 p-2 backdrop-blur sm:flex-row sm:rounded-full">
                <label htmlFor="ea-email" className="sr-only">Email address</label>
                <input
                  id="ea-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@brokerage.com"
                  className="h-12 min-w-0 flex-1 rounded-full bg-transparent px-5 font-display text-[15px] text-sidebar-foreground outline-none placeholder:text-sidebar-muted focus-visible:ring-2 focus-visible:ring-sidebar-accent"
                />
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="h-12 shrink-0 rounded-full bg-sidebar-accent px-7 font-display text-[15px] font-semibold text-sidebar-accent-foreground outline-none transition-transform duration-200 hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-sidebar-foreground disabled:opacity-70"
                >
                  {status === "loading" ? "Joining…" : "Get early access"}
                </button>
              </form>
            )}
            {status === "error" ? <p className="mt-3 font-display text-[13.5px] text-sidebar-foreground/85">Something went wrong. Please try again.</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer data-env="forest" className="relative overflow-clip bg-sidebar px-6 pb-10 pt-6 sm:px-10 lg:px-14">
      <ForestAtmosphere glow="bottom" feather="top" />
      <div className="relative mx-auto flex max-w-[1280px] flex-col gap-8 border-t border-sidebar-foreground/10 pt-12 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <AriaOrb size={22} energy={0.3} breathe={false} />
            <span className="font-heading text-[20px] text-sidebar-foreground">Aria</span>
          </div>
          <p className="mt-2 font-display text-[13.5px] text-sidebar-muted">The AI assistant that works alongside your CRM.</p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 font-display text-[13.5px] text-sidebar-muted">
          {[["Privacy", "/privacy"], ["Terms", "/terms"], ["Fair Housing", "/fair-housing"], ["Accessibility", "/accessibility"], ["Contact", "/contact"], ["Sign in", "/login"]].map(([l, h]) => (
            <a key={h} href={h} className="rounded outline-none transition-colors hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-accent">{l}</a>
          ))}
        </nav>
      </div>
      <div className="relative mx-auto mt-10 flex max-w-[1280px] flex-col gap-2 border-t border-sidebar-foreground/10 pt-6 font-display text-[12px] text-sidebar-muted sm:flex-row sm:justify-between">
        <span>© {new Date().getFullYear()} Aria AI. All rights reserved.</span>
        <span>People, addresses and schedules in the demo are fictional.</span>
      </div>
    </footer>
  );
}
