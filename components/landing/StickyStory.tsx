"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useScroll, AnimatePresence } from "framer-motion";

// ─── Panel data ────────────────────────────────────────────────────────────────

const panels = [
  {
    step: "01",
    headline: "Know who's\nready to move.",
    body: "Aria monitors every client relationship and surfaces the ones about to make a decision — before they call another agent.",
    panel: <RelationshipPanel />,
  },
  {
    step: "02",
    headline: "New listing.\nInstant match.",
    body: "The moment a property hits the MLS, Aria checks it against every buyer in your pipeline and tells you exactly who to call first.",
    panel: <MatchPanel />,
  },
  {
    step: "03",
    headline: "See the risk\nbefore it's a loss.",
    body: "Aria tracks deal momentum and flags the gaps — so you can re-engage before a deal goes quiet and walks out the door.",
    panel: <PipelinePanel />,
  },
] as const;

// ─── Right-side panels ─────────────────────────────────────────────────────────

function PanelShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl overflow-hidden w-full"
      style={{
        background: "linear-gradient(160deg, #0F0F16 0%, #0C0C13 100%)",
        border: "0.5px solid rgba(255,255,255,0.07)",
        boxShadow:
          "0 0 0 0.5px rgba(232,168,50,0.06), 0 32px 80px -16px rgba(0,0,0,0.7)",
      }}
    >
      {children}
    </div>
  );
}

function PanelHeader({ title, badge, badgeColor }: { title: string; badge: string; badgeColor: string }) {
  return (
    <div
      className="flex items-center justify-between px-4 py-3"
      style={{ borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}
    >
      <span className="text-[13px] font-semibold" style={{ color: "#F2F0EB", letterSpacing: "-0.01em" }}>
        {title}
      </span>
      <span
        className="text-[11px] font-medium px-2 py-0.5 rounded-full"
        style={{ background: badgeColor + "20", color: badgeColor }}
      >
        {badge}
      </span>
    </div>
  );
}

function RelationshipPanel() {
  const clients = [
    { name: "Sarah Kim", note: "Toured 3 homes · active", days: 2, status: "active", pct: 92 },
    { name: "Marcus Johnson", note: "Last contact 9 days ago", days: 9, status: "risk", pct: 38 },
    { name: "Linda Torres", note: "Last contact 14 days ago", days: 14, status: "danger", pct: 12 },
  ];

  const statusColor = { active: "#34D399", risk: "#E8A832", danger: "#F87171" } as const;
  const statusLabel = { active: "Active", risk: "At risk", danger: "Fading" } as const;

  return (
    <PanelShell>
      <PanelHeader title="Relationship Radar" badge="Live" badgeColor="#34D399" />
      <div className="p-4 space-y-3">
        {clients.map((c, i) => (
          <motion.div
            key={c.name}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-xl p-3.5"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: `0.5px solid ${statusColor[c.status as keyof typeof statusColor]}22`,
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-[12.5px] font-semibold" style={{ color: "#F2F0EB" }}>{c.name}</p>
                <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>{c.note}</p>
              </div>
              <span
                className="text-[10.5px] font-medium px-2 py-0.5 rounded-full"
                style={{
                  background: statusColor[c.status as keyof typeof statusColor] + "18",
                  color: statusColor[c.status as keyof typeof statusColor],
                }}
              >
                {statusLabel[c.status as keyof typeof statusLabel]}
              </span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: statusColor[c.status as keyof typeof statusColor] }}
                initial={{ width: 0 }}
                animate={{ width: `${c.pct}%` }}
                transition={{ duration: 1.0, delay: 0.3 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </motion.div>
        ))}
      </div>
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ borderTop: "0.5px solid rgba(255,255,255,0.06)" }}
      >
        <span className="text-[12px]" style={{ color: "rgba(255,255,255,0.3)" }}>Aria suggestion</span>
        <span className="text-[12px] font-medium" style={{ color: "#E8A832" }}>
          Re-engage Marcus →
        </span>
      </div>
    </PanelShell>
  );
}

function MatchPanel() {
  const buyers = [
    { name: "Jennifer W.", detail: "$850K · wants Montclair", match: true },
    { name: "David R.", detail: "$800K · Essex County", match: true },
    { name: "Tom B.", detail: "$900K · 3BR+", match: true },
  ];

  return (
    <PanelShell>
      <PanelHeader title="Live Match Engine" badge="Just listed" badgeColor="#E8A832" />
      <div className="p-4">
        {/* Listing card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-xl p-3.5 mb-3"
          style={{
            background: "rgba(232,168,50,0.06)",
            border: "0.5px solid rgba(232,168,50,0.18)",
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[12.5px] font-semibold" style={{ color: "#F2F0EB" }}>
                42 Elm St, Montclair
              </p>
              <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                $819K · 4BR · 2,240 sqft
              </p>
            </div>
            <span
              className="text-[10.5px] font-medium px-2 py-0.5 rounded-full"
              style={{ background: "rgba(232,168,50,0.15)", color: "#E8A832" }}
            >
              New · 2h ago
            </span>
          </div>
        </motion.div>

        {/* Buyer matches */}
        <p className="text-[11px] mb-2.5 px-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
          3 buyers in your pipeline match
        </p>
        <div className="space-y-2">
          {buyers.map((b, i) => (
            <motion.div
              key={b.name}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.2 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center justify-between rounded-lg px-3 py-2"
              style={{ background: "rgba(52,211,153,0.05)", border: "0.5px solid rgba(52,211,153,0.1)" }}
            >
              <div>
                <p className="text-[12px] font-semibold" style={{ color: "#F2F0EB" }}>{b.name}</p>
                <p className="text-[10.5px]" style={{ color: "rgba(255,255,255,0.35)" }}>{b.detail}</p>
              </div>
              <span style={{ color: "#34D399", fontSize: 14 }}>✓</span>
            </motion.div>
          ))}
        </div>
      </div>
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ borderTop: "0.5px solid rgba(255,255,255,0.06)" }}
      >
        <span className="text-[12px]" style={{ color: "rgba(255,255,255,0.3)" }}>Aria drafted 3 messages</span>
        <span className="text-[12px] font-medium" style={{ color: "#E8A832" }}>
          Review &amp; send →
        </span>
      </div>
    </PanelShell>
  );
}

function PipelinePanel() {
  const deals = [
    { name: "Kim listing", stage: "Under contract", status: "healthy", days: 1 },
    { name: "Torres buyer", stage: "Offer submitted", status: "healthy", days: 3 },
    { name: "Park buyer", stage: "Touring phase", status: "stalled", days: 6 },
    { name: "Johnson listing", stage: "Pre-listing prep", status: "danger", days: 11 },
  ];

  const statusColor = { healthy: "#34D399", stalled: "#E8A832", danger: "#F87171" } as const;
  const statusLabel = { healthy: "On track", stalled: "Slowing", danger: "At risk" } as const;

  return (
    <PanelShell>
      <PanelHeader title="Deal Pulse" badge="4 active" badgeColor="#F2F0EB" />
      <div className="p-4 space-y-2.5">
        {deals.map((d, i) => (
          <motion.div
            key={d.name}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center justify-between rounded-xl px-3.5 py-2.5"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: `0.5px solid ${statusColor[d.status as keyof typeof statusColor]}20`,
            }}
          >
            <div>
              <p className="text-[12.5px] font-semibold" style={{ color: "#F2F0EB" }}>{d.name}</p>
              <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>{d.stage}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.25)" }}>
                {d.days}d
              </span>
              <span
                className="text-[10.5px] font-medium px-2 py-0.5 rounded-full"
                style={{
                  background: statusColor[d.status as keyof typeof statusColor] + "15",
                  color: statusColor[d.status as keyof typeof statusColor],
                }}
              >
                {statusLabel[d.status as keyof typeof statusLabel]}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ borderTop: "0.5px solid rgba(255,255,255,0.06)" }}
      >
        <span className="text-[12px]" style={{ color: "rgba(255,255,255,0.3)" }}>Johnson needs action</span>
        <span className="text-[12px] font-medium" style={{ color: "#F87171" }}>
          11 days silent →
        </span>
      </div>
    </PanelShell>
  );
}

// ─── Section component ─────────────────────────────────────────────────────────

export default function StickyStory() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  useEffect(() => {
    return scrollYProgress.on("change", (v) => {
      setActiveIndex(Math.min(panels.length - 1, Math.floor(v * panels.length)));
    });
  }, [scrollYProgress]);

  return (
    <section
      id="features"
      style={{
        background: "#08080A",
        borderTop: "0.5px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* ── Mobile: stacked ── */}
      <div className="md:hidden px-6 py-20 space-y-20 max-w-lg mx-auto">
        {panels.map((panel, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-6"
          >
            <div>
              <span
                className="text-[10.5px] font-bold tracking-[0.18em] uppercase block mb-3"
                style={{ color: "rgba(232,168,50,0.7)" }}
              >
                {panel.step}
              </span>
              <h2
                className="font-semibold leading-tight mb-4"
                style={{
                  fontSize: "clamp(1.7rem, 5vw, 2.2rem)",
                  color: "#F2F0EB",
                  letterSpacing: "-0.03em",
                  whiteSpace: "pre-line",
                }}
              >
                {panel.headline}
              </h2>
              <p className="text-[15px] leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
                {panel.body}
              </p>
            </div>
            <div>{panel.panel}</div>
          </motion.div>
        ))}
      </div>

      {/* ── Desktop: sticky two-column scroll story ── */}
      <div
        ref={containerRef}
        className="hidden md:block relative"
        style={{ height: `${panels.length * 100}vh` }}
      >
        <div className="sticky top-0 h-screen flex items-center overflow-hidden">
          <div className="max-w-5xl mx-auto px-10 w-full grid grid-cols-2 gap-20 items-center">

            {/* Left: crossfading text */}
            <div className="relative" style={{ minHeight: 300 }}>
              {panels.map((panel, i) => (
                <div
                  key={i}
                  className="absolute inset-0 transition-all duration-700"
                  style={{
                    opacity: activeIndex === i ? 1 : 0,
                    transform: `translateY(${activeIndex === i ? 0 : activeIndex > i ? -18 : 18}px)`,
                    pointerEvents: activeIndex === i ? "auto" : "none",
                  }}
                >
                  <span
                    className="text-[10.5px] font-bold tracking-[0.18em] uppercase block mb-4"
                    style={{ color: "rgba(232,168,50,0.7)" }}
                  >
                    {panel.step}
                  </span>
                  <h2
                    className="font-semibold leading-tight mb-5"
                    style={{
                      fontSize: "clamp(2rem, 3.2vw, 2.8rem)",
                      color: "#F2F0EB",
                      letterSpacing: "-0.035em",
                      whiteSpace: "pre-line",
                    }}
                  >
                    {panel.headline}
                  </h2>
                  <p
                    className="text-[16px] leading-relaxed"
                    style={{ color: "rgba(255,255,255,0.45)", maxWidth: 380 }}
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
                          background:
                            j === activeIndex
                              ? "#E8A832"
                              : "rgba(255,255,255,0.1)",
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Right: crossfading panel */}
            <div className="flex justify-end">
              <div className="w-full max-w-[360px]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeIndex}
                    initial={{ opacity: 0, y: 16, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -12, scale: 0.98 }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {panels[activeIndex].panel}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
