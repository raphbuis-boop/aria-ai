"use client";

import { useEffect, useRef, useState } from "react";

const FEATURES = [
  {
    num: "01",
    headline: "Know who's ready to move",
    body: "Aria watches every signal — last contact, days silent, price drops, engagement patterns — and surfaces the clients most likely to transact this week. No CRM hunting. No gut guessing.",
    visual: <ClientReadinessVisual />,
  },
  {
    num: "02",
    headline: "Every relationship tracked automatically",
    body: "Texts, calls, emails, showings, offers — Aria logs and timestamps everything. Your entire client history, structured and searchable, without you lifting a finger.",
    visual: <ActivityTimelineVisual />,
  },
  {
    num: "03",
    headline: "Know exactly what to do next",
    body: "Every morning, Aria generates a prioritized action list: who to follow up with, which deals need attention, what's closing soon. One view. Zero noise.",
    visual: <ActionListVisual />,
  },
] as const;

function ClientReadinessVisual() {
  const clients = [
    { name: "Sarah Kim", tag: "Ready", score: 94, color: "#34D399", tagBg: "rgba(52,211,153,0.12)", days: "2d silent", deal: "$980K buyer" },
    { name: "Marcus Johnson", tag: "At risk", score: 41, color: "#F87171", tagBg: "rgba(248,113,113,0.12)", days: "9d silent", deal: "$1.1M buyer" },
    { name: "Linda Park", tag: "Warm", score: 76, color: "#60A5FA", tagBg: "rgba(96,165,250,0.12)", days: "4d silent", deal: "$750K buyer" },
    { name: "James Carter", tag: "Ready", score: 88, color: "#34D399", tagBg: "rgba(52,211,153,0.12)", days: "1d silent", deal: "$1.4M listing" },
    { name: "Priya Mehta", tag: "Warm", score: 71, color: "#60A5FA", tagBg: "rgba(96,165,250,0.12)", days: "5d silent", deal: "$620K buyer" },
  ];

  return (
    <div className="w-full rounded-2xl overflow-hidden" style={{ background: "#131E35", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <span className="text-sm font-medium text-white/70">Client Readiness</span>
        <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: "rgba(58,101,240,0.15)", color: "#6b8fff" }}>Live</span>
      </div>
      <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        {clients.map((c) => (
          <div key={c.name} className="flex items-center gap-4 px-5 py-3.5">
            <div className="flex-shrink-0 relative w-9 h-9">
              <svg viewBox="0 0 36 36" className="w-9 h-9 -rotate-90">
                <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="2.5" />
                <circle cx="18" cy="18" r="14" fill="none" stroke={c.color} strokeWidth="2.5" strokeDasharray={`${(c.score / 100) * 87.96} 87.96`} strokeLinecap="round" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-semibold" style={{ color: c.color }}>{c.score}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{c.name}</p>
              <p className="text-xs text-white/35 mt-0.5">{c.deal}</p>
            </div>
            <span className="text-xs text-white/30 flex-shrink-0">{c.days}</span>
            <span className="text-xs font-medium px-2.5 py-0.5 rounded-full flex-shrink-0" style={{ background: c.tagBg, color: c.color }}>{c.tag}</span>
          </div>
        ))}
      </div>
      <div className="px-5 py-3 flex items-center gap-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-xs text-white/30">Aria updated 2 min ago</span>
      </div>
    </div>
  );
}

function ActivityTimelineVisual() {
  const events = [
    { time: "Today, 9:41 AM", icon: "✉", label: "Email reply logged", name: "Sarah Kim", color: "#6b8fff", bg: "rgba(107,143,255,0.1)" },
    { time: "Yesterday, 4:15 PM", icon: "🏡", label: "Showing completed", name: "Marcus Johnson", color: "#60A5FA", bg: "rgba(96,165,250,0.1)" },
    { time: "Yesterday, 11:02 AM", icon: "💬", label: "SMS sent", name: "Linda Park", color: "#34D399", bg: "rgba(52,211,153,0.1)" },
    { time: "May 28, 3:30 PM", icon: "📋", label: "Offer submitted", name: "James Carter", color: "#F87171", bg: "rgba(248,113,113,0.1)" },
    { time: "May 27, 10:00 AM", icon: "📞", label: "Call logged — 8 min", name: "Priya Mehta", color: "#C084FC", bg: "rgba(192,132,252,0.1)" },
  ];

  return (
    <div className="w-full rounded-2xl overflow-hidden" style={{ background: "#131E35", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <span className="text-sm font-medium text-white/70">Activity Timeline</span>
        <span className="text-xs text-white/30">All clients</span>
      </div>
      <div className="relative px-5 py-2">
        <div className="absolute left-[30px] top-4 bottom-4 w-px" style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.08), transparent)" }} />
        <div className="flex flex-col gap-0">
          {events.map((e, i) => (
            <div key={i} className="flex items-start gap-4 py-3 relative">
              <div className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] z-10" style={{ background: e.bg, border: `1px solid ${e.color}33` }}>
                {e.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white/80">{e.label}</p>
                <p className="text-xs mt-0.5" style={{ color: e.color }}>{e.name}</p>
              </div>
              <span className="text-xs text-white/25 flex-shrink-0 pt-0.5">{e.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ActionListVisual() {
  const actions = [
    { priority: "Now", label: "Follow up with Marcus Johnson", sub: "9 days since last contact", color: "#F87171", bg: "rgba(248,113,113,0.1)", done: false },
    { priority: "Today", label: "Send comps to Sarah Kim", sub: "She asked during showing", color: "#FBBF24", bg: "rgba(251,191,36,0.1)", done: false },
    { priority: "Today", label: "Schedule offer review — James Carter", sub: "Closing deadline May 31", color: "#FBBF24", bg: "rgba(251,191,36,0.1)", done: false },
    { priority: "This week", label: "Check in with Linda Park", sub: "Price reduced on 24 Sycamore", color: "#60A5FA", bg: "rgba(96,165,250,0.1)", done: false },
    { priority: "Done", label: "Morning briefing reviewed", sub: "8:02 AM", color: "#34D399", bg: "rgba(52,211,153,0.1)", done: true },
  ];

  return (
    <div className="w-full rounded-2xl overflow-hidden" style={{ background: "#131E35", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div>
          <p className="text-sm font-medium text-white/70">Today&apos;s Focus</p>
          <p className="text-xs text-white/30 mt-0.5">Sunday, May 31</p>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: "rgba(248,113,113,0.12)", color: "#F87171" }}>3 urgent</span>
      </div>
      <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        {actions.map((a, i) => (
          <div key={i} className={`flex items-start gap-3.5 px-5 py-3.5 ${a.done ? "opacity-40" : ""}`}>
            <div className="flex-shrink-0 mt-0.5 w-4 h-4 rounded flex items-center justify-center" style={{ border: a.done ? "none" : "1px solid rgba(255,255,255,0.15)", background: a.done ? "rgba(52,211,153,0.2)" : "transparent" }}>
              {a.done && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm ${a.done ? "line-through text-white/30" : "text-white/85"}`}>{a.label}</p>
              <p className="text-xs text-white/30 mt-0.5">{a.sub}</p>
            </div>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5" style={{ background: a.bg, color: a.color }}>{a.priority}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FeatureSections() {
  const [activeIndex, setActiveIndex] = useState(0);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (!sectionRef.current) return;
      const { top, height } = sectionRef.current.getBoundingClientRect();
      const windowH = window.innerHeight;
      const progress = Math.max(0, Math.min(1, (-top) / (height - windowH)));
      const idx = Math.min(FEATURES.length - 1, Math.floor(progress * FEATURES.length));
      setActiveIndex(idx);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative"
      style={{
        height: `${FEATURES.length * 100}vh`,
        background: "#0B1220",
      }}
    >
      <div className="sticky top-0 h-screen flex items-stretch overflow-hidden">
        <div className="w-full max-w-6xl mx-auto px-6 md:px-12 flex items-center gap-16 lg:gap-24">
          {/* LEFT — sticky feature list */}
          <div className="w-full lg:w-[400px] flex-shrink-0 flex flex-col gap-0">
            {FEATURES.map((f, i) => {
              const isActive = i === activeIndex;
              return (
                <div
                  key={f.num}
                  className="py-6 transition-all duration-500 cursor-default"
                  style={{
                    borderLeft: isActive
                      ? "2px solid rgba(58,101,240,0.9)"
                      : "2px solid rgba(255,255,255,0.07)",
                    paddingLeft: "24px",
                    opacity: isActive ? 1 : 0.28,
                  }}
                >
                  <div className="flex items-baseline gap-3 mb-1">
                    <span
                      className="text-xs font-mono font-semibold"
                      style={{ color: isActive ? "#6b8fff" : "rgba(255,255,255,0.3)" }}
                    >
                      {f.num}
                    </span>
                    <h3
                      className="font-semibold transition-all duration-500"
                      style={{
                        fontSize: isActive ? "22px" : "18px",
                        color: isActive ? "#FFFFFF" : "rgba(255,255,255,0.5)",
                        lineHeight: 1.25,
                        letterSpacing: "-0.02em",
                      }}
                    >
                      {f.headline}
                    </h3>
                  </div>
                  {isActive && (
                    <p
                      className="text-sm leading-relaxed mt-3 transition-all duration-500"
                      style={{ color: "rgba(255,255,255,0.45)", maxWidth: "340px" }}
                    >
                      {f.body}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* RIGHT — product visual */}
          <div className="hidden lg:flex flex-1 items-center justify-center">
            <div className="w-full max-w-md transition-all duration-500">
              {FEATURES[activeIndex].visual}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
