"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { ArrowRight, Mail, Upload, UserPlus, Mic, ChevronRight, Lock, TrendingUp, MessageSquare, Building2, Bell, X } from "lucide-react";
import type { TodayItem } from "@/lib/today-items";
import { DraftSheet } from "@/components/DraftSheet";

// ── Types ─────────────────────────────────────────────────────────────────────

type Briefing = {
  showingsToday: number;
  closingsThisWeek: number;
  newMatches: number;
};

type ShowingRow = {
  id: string;
  address: string | null;
  showing_date: string | null;
  status: string | null;
  clients: { name: string } | null;
};

type KPI = {
  activeClients: number;
  warmLeads: number;
  pipelineCount: number;
  pendingDeals: number;
};

type Props = {
  items: TodayItem[];
  briefing: Briefing;
  showingsToday: ShowingRow[];
  userName: string;
  hasAnyClients: boolean;
  kpi: KPI;
};

async function dismissItem(itemId: string): Promise<void> {
  await fetch("/api/opportunities/dismiss", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itemId, hours: 24 }),
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function getDateLabel(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatShowingTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function triggerHaptic() {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(10);
  } catch { /* never break on haptic failure */ }
}

// ── Design tokens (page-level — do not move to globals.css) ──────────────────
// Lighter glass surfaces than global oc-card defaults so the dashboard
// reads airy against the Obsidian Chrome backdrop.

const BG_CARD   = "rgba(22, 30, 44, 0.64)";    // glass card panel
const BG_CARD2  = "rgba(12, 18, 30, 0.82)";    // icon bg / inner surface
const BORDER    = "rgba(83, 104, 120, 0.34)";  // blue-slate border
const HIGHLIGHT = "inset 0 1px 0 rgba(229, 228, 226, 0.09)"; // glass top-edge
const BLUR      = "blur(24px) saturate(240%)";
const BLUE      = "#3B82F6";
const TEXT_1    = "#E8E6E4";  // alabaster warm-white
const TEXT_2    = "#B0C4CF";  // slate midtone
const TEXT_3    = "#7A96A8";  // muted blue-slate

// ── Urgency config ────────────────────────────────────────────────────────────

const URGENCY_DOT: Record<number, { color: string; glow?: string }> = {
  1: { color: "#EF4444", glow: "0 0 6px rgba(239,68,68,0.40)" },  // closing — red
  2: { color: "#F59E0B" },                                          // hot lead — amber
  3: { color: "#60A5FA" },                                          // anniversary — light blue
  4: { color: "rgba(83,104,120,0.80)" },                            // BBA — slate
  5: { color: "#10B981" },                                          // MLS match — green
};

function timingPill(item: TodayItem): { text: string; color: string; weight?: number; upper?: boolean } | null {
  switch (item.urgencyRank) {
    case 1: {
      const match = item.reason.match(/is (today|tomorrow|in \d+ days)/i);
      const text = match ? match[1].toUpperCase() : "";
      return text ? { text, color: "#EF4444", weight: 600, upper: true } : null;
    }
    case 2:
      return item.clientTown ? { text: item.clientTown, color: TEXT_3 } : null;
    case 3: {
      const match = item.reason.match(/(\d+) year/i);
      return match ? { text: `${match[1]} yr`, color: TEXT_3 } : null;
    }
    case 4:
      return null;
    case 5:
      return { text: "New match", color: "#10B981", weight: 500 };
    default:
      return null;
  }
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em]"
      style={{ color: TEXT_3 }}
    >
      {children}
    </p>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: BG_CARD,
        backdropFilter: BLUR,
        WebkitBackdropFilter: BLUR,
        border: `0.5px solid ${BORDER}`,
        borderRadius: 14,
        boxShadow: HIGHLIGHT,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({
  value,
  label,
  accent,
  placeholder,
}: {
  value: number | string;
  label: string;
  accent?: string;
  placeholder?: boolean;
}) {
  return (
    <div
      style={{
        background: placeholder ? "rgba(12, 18, 30, 0.46)" : BG_CARD,
        backdropFilter: BLUR,
        WebkitBackdropFilter: BLUR,
        border: `0.5px solid ${placeholder ? "rgba(83,104,120,0.12)" : BORDER}`,
        borderRadius: 12,
        padding: "16px 14px 14px",
        minWidth: 0,
        boxShadow: placeholder ? "none" : HIGHLIGHT,
      }}
    >
      {placeholder ? (
        <div className="flex items-center gap-2 mb-2">
          <Lock size={13} style={{ color: TEXT_3, opacity: 0.5 }} />
          <span className="text-[13px] font-medium" style={{ color: TEXT_3, opacity: 0.5 }}>—</span>
        </div>
      ) : (
        <p
          className="text-[28px] font-bold leading-none tabular-nums mb-2"
          style={{
            color: accent ?? TEXT_1,
            letterSpacing: "-0.03em",
          }}
        >
          {value}
        </p>
      )}
      <p
        className="text-[10px] uppercase leading-tight"
        style={{ color: TEXT_3, letterSpacing: "0.08em", opacity: placeholder ? 0.5 : 1 }}
      >
        {label}
      </p>
    </div>
  );
}

// ── Voice entry ───────────────────────────────────────────────────────────────

function VoiceEntry({ onClick, subtitle }: { onClick: () => void; subtitle?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 transition-opacity active:opacity-60"
      style={{
        background: BG_CARD,
        border: `0.5px solid rgba(59,130,246,0.20)`,
        borderRadius: 12,
        padding: "14px 16px",
      }}
    >
      <div
        className="flex items-center justify-center rounded-full shrink-0"
        style={{
          width: 34,
          height: 34,
          background: "rgba(59,130,246,0.10)",
          border: "0.5px solid rgba(59,130,246,0.22)",
        }}
      >
        <Mic size={15} color={BLUE} />
      </div>
      <div className="flex-1 text-left min-w-0">
        <p className="text-[13px] font-semibold" style={{ color: TEXT_1 }}>
          Ask Aria
        </p>
        <p className="text-[11px]" style={{ color: TEXT_3 }}>
          {subtitle ?? "Voice assistant · tap to speak"}
        </p>
      </div>
      <ChevronRight size={14} style={{ color: TEXT_3, flexShrink: 0 }} />
    </button>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// STATE 1 — NEW AGENT (0 clients)
// ═════════════════════════════════════════════════════════════════════════════

const SETUP_STEPS = [
  {
    Icon: Upload,
    title: "Import clients",
    desc: "Upload a CSV — Aria maps columns and imports your book instantly.",
    badge: "Fastest",
    href: "/settings/import",
    external: false,
  },
  {
    Icon: UserPlus,
    title: "Add first client",
    desc: "Add one client manually and Aria starts finding opportunities.",
    badge: "Quickest start",
    href: "/clients?new=1",
    external: false,
  },
] as const;

const FEATURES = [
  { Icon: TrendingUp,    label: "Revenue Opportunities", desc: "Daily pipeline ranked by urgency" },
  { Icon: MessageSquare, label: "AI Drafts",             desc: "Ready-to-send texts in your voice" },
  { Icon: Building2,     label: "MLS Matches",           desc: "New listings matched to each client" },
  { Icon: Bell,          label: "Follow-up Nudges",      desc: "Know exactly who to call and when" },
] as const;

function NewAgentState({
  userName,
  onVoice,
}: {
  userName: string;
  onVoice: () => void;
}) {
  const [greeting, setGreeting] = useState("Good morning");
  const [dateLabel, setDateLabel] = useState("");

  useEffect(() => {
    setGreeting(getGreeting());
    setDateLabel(getDateLabel());
  }, []);

  return (
    <div className="min-h-screen pb-[120px]" style={{ color: TEXT_1 }}>
      <div className="px-5">

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div style={{ paddingTop: "calc(env(safe-area-inset-top) + 24px)", paddingBottom: 24 }}>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em]" style={{ color: TEXT_3 }}>
            {dateLabel}
          </p>
          <h1 className="text-[30px] font-bold leading-tight" style={{ color: TEXT_1, letterSpacing: "-0.03em" }}>
            {greeting}, {userName}.
          </h1>
          <p className="mt-2 text-[15px]" style={{ color: TEXT_2, lineHeight: 1.5 }}>
            Let&apos;s get Aria working for you.
          </p>
        </div>

        {/* ── 1. SETUP MISSION HERO ────────────────────────────────────────── */}
        <div
          style={{
            background: "rgba(24, 34, 52, 0.72)",
            backdropFilter: BLUR,
            WebkitBackdropFilter: BLUR,
            border: `0.5px solid rgba(83, 104, 120, 0.42)`,
            borderRadius: 20,
            boxShadow: "inset 0 1px 0 rgba(229, 228, 226, 0.10)",
            padding: "22px 18px 18px",
            marginBottom: 10,
          }}
        >
          {/* Label + count + percent */}
          <div className="flex items-start justify-between mb-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: TEXT_3 }}>
              Setup mission
            </p>
            <span
              className="text-[11px] font-semibold tabular-nums"
              style={{
                color: TEXT_3,
                background: "rgba(83,104,120,0.14)",
                border: `0.5px solid ${BORDER}`,
                borderRadius: 6,
                padding: "2px 8px",
              }}
            >
              0%
            </span>
          </div>

          <p
            className="text-[26px] font-bold leading-tight mb-4"
            style={{ color: TEXT_1, letterSpacing: "-0.025em" }}
          >
            0 of 3 steps complete
          </p>

          {/* Progress — 3 segments */}
          <div className="flex gap-1.5 mb-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{ flex: 1, height: 3, borderRadius: 99, background: "rgba(83,104,120,0.22)" }}
              />
            ))}
          </div>

          <p className="text-[13px] mb-5" style={{ color: TEXT_2, lineHeight: 1.55 }}>
            Connect your inbox and Aria starts finding revenue opportunities from your existing client conversations.
          </p>

          {/* Primary CTA — Connect Gmail */}
          <a
            href="/api/auth/google/connect"
            className="flex items-center justify-center gap-2 transition-opacity active:opacity-70"
            style={{
              background: BLUE,
              color: "#fff",
              borderRadius: 12,
              padding: "13px 16px",
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            <Mail size={16} />
            Connect Gmail
            <ArrowRight size={14} style={{ opacity: 0.75 }} />
          </a>
        </div>

        {/* ── 2. SECONDARY SETUP CARDS ─────────────────────────────────────── */}
        <div className="flex flex-col gap-2 mb-8">
          {SETUP_STEPS.map(({ Icon, title, desc, badge, href, external }) => {
            const inner = (
              <div className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center rounded-[9px] shrink-0"
                  style={{ width: 34, height: 34, background: BG_CARD2, border: `0.5px solid ${BORDER}` }}
                >
                  <Icon size={15} style={{ color: TEXT_2 }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold" style={{ color: TEXT_1 }}>
                    {title}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: TEXT_3, lineHeight: 1.4 }}>
                    {desc}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: TEXT_3,
                      border: `0.5px solid ${BORDER}`,
                      borderRadius: 5,
                      padding: "2px 6px",
                      letterSpacing: "0.03em",
                    }}
                  >
                    {badge}
                  </span>
                  <ChevronRight size={13} style={{ color: TEXT_3 }} />
                </div>
              </div>
            );
            const cardSt: React.CSSProperties = {
              display: "block",
              padding: "13px 14px",
              background: BG_CARD,
              backdropFilter: BLUR,
              WebkitBackdropFilter: BLUR,
              border: `0.5px solid ${BORDER}`,
              borderRadius: 14,
              boxShadow: HIGHLIGHT,
            };
            return external ? (
              <a key={title} href={href} className="transition-opacity active:opacity-60" style={cardSt}>
                {inner}
              </a>
            ) : (
              <Link key={title} href={href} className="transition-opacity active:opacity-60" style={cardSt}>
                {inner}
              </Link>
            );
          })}
        </div>

        {/* ── 3. WHAT ARIA UNLOCKS — 2×2 feature grid ─────────────────────── */}
        <div className="mb-8">
          <SectionLabel>What Aria unlocks</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            {FEATURES.map(({ Icon, label, desc }) => (
              <div
                key={label}
                style={{
                  background: BG_CARD,
                  backdropFilter: BLUR,
                  WebkitBackdropFilter: BLUR,
                  border: `0.5px solid ${BORDER}`,
                  borderRadius: 14,
                  boxShadow: HIGHLIGHT,
                  padding: "15px 13px 13px",
                }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: "rgba(59,130,246,0.13)",
                    border: "0.5px solid rgba(59,130,246,0.24)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 10,
                  }}
                >
                  <Icon size={14} style={{ color: BLUE }} />
                </div>
                <p className="text-[12px] font-semibold leading-tight mb-1" style={{ color: TEXT_1 }}>
                  {label}
                </p>
                <p className="text-[11px]" style={{ color: TEXT_3, lineHeight: 1.4 }}>
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ── 4. ASK ARIA ──────────────────────────────────────────────────── */}
        <VoiceEntry onClick={onVoice} subtitle="Ask what to do first" />

      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// STATE 2 — ACTIVE AGENT (clients exist)
// ═════════════════════════════════════════════════════════════════════════════

function ActiveAgentState({
  items,
  briefing,
  showingsToday,
  userName,
  kpi,
  onVoice,
  activeDraftItem,
  setActiveDraftItem,
  drafts,
  loadingDrafts,
  handleAction,
  handleDismiss,
}: {
  items: TodayItem[];
  briefing: Briefing;
  showingsToday: ShowingRow[];
  userName: string;
  kpi: KPI;
  onVoice: () => void;
  activeDraftItem: TodayItem | null;
  setActiveDraftItem: (item: TodayItem | null) => void;
  drafts: Record<string, string>;
  loadingDrafts: Record<string, boolean>;
  handleAction: (item: TodayItem) => void;
  handleDismiss: (item: TodayItem) => void;
}) {
  const [greeting, setGreeting] = useState("Good morning");
  const [dateLabel, setDateLabel] = useState("");

  useEffect(() => {
    setGreeting(getGreeting());
    setDateLabel(getDateLabel());
  }, []);

  const n = items.length;

  // Briefing chips — only shown if count > 0
  const chips = [
    briefing.showingsToday > 0 && {
      key: "s",
      label: `${briefing.showingsToday} showing${briefing.showingsToday > 1 ? "s" : ""} today`,
    },
    briefing.closingsThisWeek > 0 && {
      key: "c",
      label: `${briefing.closingsThisWeek} closing${briefing.closingsThisWeek > 1 ? "s" : ""} this week`,
      alert: true,
    },
    briefing.newMatches > 0 && {
      key: "m",
      label: `${briefing.newMatches} new match${briefing.newMatches > 1 ? "es" : ""}`,
    },
  ].filter(Boolean) as { key: string; label: string; alert?: boolean }[];

  return (
    <div className="min-h-screen pb-[120px]" style={{ color: TEXT_1 }}>
      <div className="px-5">

        {/* ── 1. MORNING BRIEFING ──────────────────────────────────────────── */}
        <div style={{ paddingTop: "calc(env(safe-area-inset-top) + 24px)", paddingBottom: 28 }}>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em]" style={{ color: TEXT_3 }}>
            {dateLabel}
          </p>
          <h1 className="text-[30px] font-bold leading-tight" style={{ color: TEXT_1, letterSpacing: "-0.03em" }}>
            {greeting}, {userName}.
          </h1>
          <p className="mt-2 text-[15px]" style={{ color: TEXT_2, lineHeight: 1.5 }}>
            {n === 0
              ? "No actions needed. You\u2019re on top of it."
              : `${n} ${n === 1 ? "opportunity" : "opportunities"} need${n === 1 ? "s" : ""} attention.`}
          </p>

          {/* Briefing chips */}
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {chips.map(({ key, label, alert }) => (
                <span
                  key={key}
                  className="text-[11px] font-medium"
                  style={{
                    color: alert ? "#EF4444" : TEXT_3,
                    background: alert ? "rgba(239,68,68,0.08)" : "rgba(83,104,120,0.14)",
                    border: `0.5px solid ${alert ? "rgba(239,68,68,0.20)" : BORDER}`,
                    borderRadius: 99,
                    padding: "4px 10px",
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── 2. REVENUE OPPORTUNITIES ─────────────────────────────────────── */}
        <div className="mb-8">
          <SectionLabel>Revenue Opportunities</SectionLabel>

          {n === 0 ? (
            <Card style={{ padding: "22px 16px", textAlign: "center" }}>
              <p className="text-[14px] font-semibold" style={{ color: TEXT_2 }}>
                You&apos;re all caught up
              </p>
              <p className="mt-1 text-[12px]" style={{ color: TEXT_3 }}>
                No follow-ups, closings, or matches right now
              </p>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {items.map((item) => {
                const dot = URGENCY_DOT[item.urgencyRank] ?? URGENCY_DOT[5];
                const pill = timingPill(item);
                const isTextItem = item.actionType === "text";
                const isDraftLoading = isTextItem && loadingDrafts[item.id] !== false;
                const draftPreview = isTextItem ? (drafts[item.id] ?? "") : "";
                const cardBg = item.urgencyRank === 1 ? "rgba(239,68,68,0.07)" : BG_CARD;
                const cardBorder = item.urgencyRank === 1
                  ? "0.5px solid rgba(239,68,68,0.18)"
                  : `0.5px solid ${BORDER}`;

                return (
                  <div
                    key={item.id}
                    style={{
                      background: cardBg,
                      backdropFilter: BLUR,
                      WebkitBackdropFilter: BLUR,
                      border: cardBorder,
                      borderRadius: 14,
                      boxShadow: HIGHLIGHT,
                      padding: "12px 14px",
                    }}
                  >
                    {/* Row 1: dot · client name · pill · dismiss */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className="shrink-0 rounded-full"
                        style={{
                          width: 6,
                          height: 6,
                          background: dot.color,
                          boxShadow: dot.glow ?? "none",
                          flexShrink: 0,
                        }}
                      />
                      <span
                        className="text-[14px] font-bold flex-1 leading-none truncate"
                        style={{ color: TEXT_1, letterSpacing: "-0.02em" }}
                      >
                        {item.clientName}
                      </span>
                      {pill && (
                        <span
                          className="shrink-0 text-[10px]"
                          style={{
                            color: pill.color,
                            fontWeight: pill.weight ?? 500,
                            letterSpacing: pill.upper ? "0.09em" : undefined,
                            textTransform: pill.upper ? "uppercase" : undefined,
                          }}
                        >
                          {pill.text}
                        </span>
                      )}
                      {/* Dismiss — snooze 24h */}
                      <button
                        type="button"
                        aria-label="Snooze for 24 hours"
                        onClick={(e) => { e.stopPropagation(); handleDismiss(item); }}
                        className="flex items-center justify-center transition-opacity active:opacity-40 shrink-0"
                        style={{ width: 22, height: 22, marginLeft: 2 }}
                      >
                        <X size={12} style={{ color: TEXT_3 }} />
                      </button>
                    </div>

                    {/* Row 2: reason + context */}
                    <p
                      className="text-[12px]"
                      style={{ color: TEXT_2, lineHeight: 1.4, paddingLeft: 14 }}
                    >
                      {item.reason}
                      {item.context ? (
                        <span style={{ color: TEXT_3 }}> · {item.context}</span>
                      ) : null}
                    </p>

                    {/* AI draft preview */}
                    {isTextItem && (
                      <div style={{ paddingLeft: 14, marginTop: 8, marginBottom: 10 }}>
                        {isDraftLoading ? (
                          <div className="space-y-1.5">
                            <div className="h-2 rounded animate-pulse" style={{ background: "rgba(83,104,120,0.18)", width: "80%" }} />
                            <div className="h-2 rounded animate-pulse" style={{ background: "rgba(83,104,120,0.18)", width: "55%" }} />
                          </div>
                        ) : draftPreview ? (
                          <>
                            <p className="text-[9px] font-bold uppercase mb-1" style={{ color: BLUE, letterSpacing: "0.10em" }}>
                              Aria suggests
                            </p>
                            <p className="text-[11px] italic line-clamp-2" style={{ color: TEXT_2, lineHeight: 1.45 }}>
                              &ldquo;{draftPreview}&rdquo;
                            </p>
                          </>
                        ) : null}
                      </div>
                    )}
                    {!isTextItem && <div style={{ marginBottom: 10 }} />}

                    {/* CTA */}
                    {isTextItem ? (
                      <button
                        type="button"
                        onClick={() => handleAction(item)}
                        className="w-full text-[12px] font-semibold text-center transition-opacity active:opacity-70"
                        style={{
                          background: BLUE,
                          color: "#ffffff",
                          padding: "9px 12px",
                          borderRadius: 9,
                          display: "block",
                        }}
                      >
                        {item.actionLabel}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAction(item)}
                        className="w-full text-[12px] font-medium flex items-center justify-between transition-opacity active:opacity-70"
                        style={{
                          background: "transparent",
                          color: TEXT_1,
                          padding: "8px 12px",
                          borderRadius: 9,
                          border: `0.5px solid ${BORDER}`,
                        }}
                      >
                        <span>{item.actionLabel}</span>
                        <ArrowRight size={12} style={{ color: TEXT_3, flexShrink: 0 }} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── 3. TODAY'S SCHEDULE ──────────────────────────────────────────── */}
        <div className="mb-8">
          <SectionLabel>Today&apos;s Schedule</SectionLabel>

          {showingsToday.length === 0 ? (
            <Card style={{ padding: "16px" }}>
              <p className="text-[13px]" style={{ color: TEXT_3 }}>
                No showings scheduled today
              </p>
            </Card>
          ) : (
            <Card>
              {showingsToday.map((s, i) => (
                <Link
                  key={s.id}
                  href="/showings"
                  className="flex items-center gap-3 transition-opacity active:opacity-60"
                  style={{
                    padding: "13px 16px",
                    borderBottom: i < showingsToday.length - 1 ? `0.5px solid ${BORDER}` : "none",
                  }}
                >
                  {/* Time */}
                  <p
                    className="text-[12px] font-bold tabular-nums shrink-0"
                    style={{ color: BLUE, width: 52 }}
                  >
                    {formatShowingTime(s.showing_date)}
                  </p>
                  {/* Divider */}
                  <div style={{ width: 0.5, alignSelf: "stretch", background: BORDER, flexShrink: 0 }} />
                  {/* Client + address */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold truncate" style={{ color: TEXT_1 }}>
                      {s.clients?.name ?? "Client"}
                    </p>
                    <p className="text-[11px] truncate mt-0.5" style={{ color: TEXT_3 }}>
                      {s.address ?? "Address TBD"}
                    </p>
                  </div>
                  <ChevronRight size={13} style={{ color: TEXT_3, flexShrink: 0 }} />
                </Link>
              ))}
            </Card>
          )}

          {/* Closing callout */}
          {briefing.closingsThisWeek > 0 && (
            <Link
              href="/transactions"
              className="mt-2 flex items-center justify-between transition-opacity active:opacity-70"
              style={{
                background: "rgba(239,68,68,0.07)",
                backdropFilter: BLUR,
                WebkitBackdropFilter: BLUR,
                border: "0.5px solid rgba(239,68,68,0.20)",
                borderRadius: 10,
                padding: "11px 14px",
              }}
            >
              <p className="text-[12px] font-semibold" style={{ color: "#EF4444" }}>
                {briefing.closingsThisWeek} closing{briefing.closingsThisWeek > 1 ? "s" : ""} this week
              </p>
              <ChevronRight size={12} style={{ color: "rgba(239,68,68,0.55)", flexShrink: 0 }} />
            </Link>
          )}
        </div>

        {/* ── 4. PIPELINE KPIs ─────────────────────────────────────────────── */}
        <div className="mb-8">
          <SectionLabel>Pipeline</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            <KpiCard value={kpi.activeClients} label="Active Clients" accent={kpi.activeClients > 0 ? TEXT_1 : undefined} />
            <KpiCard value={kpi.warmLeads}    label="Warm Leads"    accent={kpi.warmLeads > 0    ? "#F59E0B" : undefined} />
            <KpiCard value={kpi.pipelineCount} label="In Pipeline"  accent={kpi.pipelineCount > 0 ? BLUE     : undefined} />
            <KpiCard value={kpi.pendingDeals}  label="Pending Deals" accent={kpi.pendingDeals > 0 ? "#10B981" : undefined} />
          </div>
        </div>

        {/* ── 5. ASK ARIA ──────────────────────────────────────────────────── */}
        <VoiceEntry onClick={onVoice} />

      </div>

      {/* Draft sheet */}
      <DraftSheet
        item={activeDraftItem}
        prefetchedDraft={activeDraftItem ? drafts[activeDraftItem.id] : undefined}
        onClose={() => setActiveDraftItem(null)}
        onSent={() => {
          setActiveDraftItem(null);
        }}
      />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ROOT — TodayClient (routes to one of the two states)
// ═════════════════════════════════════════════════════════════════════════════

export function TodayClient({
  items,
  briefing,
  showingsToday,
  userName,
  hasAnyClients,
  kpi,
}: Props) {
  const router = useRouter();
  const [activeDraftItem, setActiveDraftItem] = useState<TodayItem | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loadingDrafts, setLoadingDrafts] = useState<Record<string, boolean>>({});
  // Local dismiss set: optimistic removals within this session
  const [localDismissed, setLocalDismissed] = useState<Set<string>>(new Set());

  const visibleItems = items.filter((i) => !localDismissed.has(i.id));

  // Pre-fetch AI drafts for all text-action items in parallel on mount
  useEffect(() => {
    const textItems = items.filter((i) => i.actionType === "text");
    if (textItems.length === 0) return;

    const initialLoading: Record<string, boolean> = {};
    textItems.forEach((i) => { initialLoading[i.id] = true; });
    setLoadingDrafts(initialLoading);

    Promise.all(
      textItems.map((item) =>
        fetch("/api/ai/draft-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientName: item.clientName,
            scenario: item.reason,
            context: item.context ?? "",
            clientId: item.clientId,
            skipInsert: true,
          }),
        })
          .then((r) => r.json())
          .then((data: { draft?: string }) => ({ id: item.id, draft: data.draft ?? "" }))
          .catch(() => ({ id: item.id, draft: "" }))
      )
    ).then((results) => {
      const draftMap: Record<string, string> = {};
      const loadingMap: Record<string, boolean> = {};
      results.forEach(({ id, draft }) => {
        draftMap[id] = draft;
        loadingMap[id] = false;
      });
      setDrafts(draftMap);
      setLoadingDrafts(loadingMap);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // stable on mount — server-rendered items

  const handleAction = useCallback(
    (item: TodayItem) => {
      triggerHaptic();
      if (item.actionType === "navigate" && item.navigateTo) {
        router.push(item.navigateTo);
      } else {
        setActiveDraftItem(item);
      }
    },
    [router],
  );

  const handleDismiss = useCallback((item: TodayItem) => {
    triggerHaptic();
    // Optimistic removal
    setLocalDismissed((prev) => new Set([...prev, item.id]));
    // Persist snooze (fire-and-forget)
    void dismissItem(item.id);
  }, []);

  const handleVoice = useCallback(() => {
    triggerHaptic();
    router.push("/voice");
  }, [router]);

  if (!hasAnyClients) {
    return <NewAgentState userName={userName} onVoice={handleVoice} />;
  }

  return (
    <ActiveAgentState
      items={visibleItems}
      briefing={briefing}
      showingsToday={showingsToday}
      userName={userName}
      kpi={kpi}
      onVoice={handleVoice}
      activeDraftItem={activeDraftItem}
      setActiveDraftItem={setActiveDraftItem}
      drafts={drafts}
      loadingDrafts={loadingDrafts}
      handleAction={handleAction}
      handleDismiss={handleDismiss}
    />
  );
}
