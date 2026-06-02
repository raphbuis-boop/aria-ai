"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { ArrowRight, Mail, Upload, UserPlus, Mic, ChevronRight, Lock } from "lucide-react";
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

// ── Design tokens ─────────────────────────────────────────────────────────────

const BG_CARD   = "#0e0e12";
const BG_CARD2  = "#111116";
const BORDER    = "rgba(255,255,255,0.07)";
const BLUE      = "#3B82F6";
const TEXT_1    = "#ffffff";
const TEXT_2    = "rgba(255,255,255,0.50)";
const TEXT_3    = "rgba(255,255,255,0.25)";

// ── Urgency config ────────────────────────────────────────────────────────────

const URGENCY_DOT: Record<number, { color: string; glow?: string }> = {
  1: { color: "#EF4444", glow: "0 0 6px rgba(239,68,68,0.50)" },
  2: { color: "#F59E0B" },
  3: { color: "#A78BFA" },
  4: { color: BLUE },
  5: { color: "#10B981" },
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
        border: `0.5px solid ${BORDER}`,
        borderRadius: 14,
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
        background: placeholder ? "rgba(14,14,18,0.50)" : BG_CARD,
        border: `0.5px solid ${placeholder ? "rgba(255,255,255,0.04)" : BORDER}`,
        borderRadius: 12,
        padding: "16px 14px 14px",
        minWidth: 0,
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
    Icon: Mail,
    title: "Connect Gmail",
    desc: "Aria reads your thread history and surfaces follow-ups automatically.",
    badge: "Recommended",
    primary: true,
    href: "/api/auth/google/connect",
    external: true,
  },
  {
    Icon: Upload,
    title: "Import clients",
    desc: "Upload a CSV — Aria maps the columns and imports your entire book instantly.",
    badge: "Fastest",
    primary: false,
    href: "/settings/import",
    external: false,
  },
  {
    Icon: UserPlus,
    title: "Add first client",
    desc: "Add one client manually and Aria begins finding opportunities right away.",
    badge: "Quickest start",
    primary: false,
    href: "/clients?new=1",
    external: false,
  },
] as const;

const UNLOCKS = [
  { label: "Follow-up nudges",     desc: "Know exactly who to call and when." },
  { label: "MLS matches",          desc: "New listings matched to each client, automatically." },
  { label: "AI drafts",            desc: "Ready-to-send texts written in your voice." },
  { label: "Revenue opportunities",desc: "Your pipeline surfaced every morning." },
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
        <div style={{ paddingTop: "calc(env(safe-area-inset-top) + 22px)", paddingBottom: 28 }}>
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
        <div className="oc-card mb-3" style={{ padding: "18px 16px 16px" }}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.13em] mb-1" style={{ color: TEXT_3 }}>
                Setup mission
              </p>
              <p className="text-[22px] font-bold" style={{ color: TEXT_1, letterSpacing: "-0.02em" }}>
                0 of 3 complete
              </p>
            </div>
            <span
              className="text-[11px] font-semibold tabular-nums"
              style={{
                color: TEXT_3,
                background: "rgba(255,255,255,0.05)",
                border: `0.5px solid ${BORDER}`,
                borderRadius: 6,
                padding: "3px 8px",
                marginTop: 2,
              }}
            >
              0%
            </span>
          </div>

          {/* Progress — 3 segments, all inactive */}
          <div className="flex gap-1.5 mb-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{ flex: 1, height: 3, borderRadius: 99, background: "rgba(255,255,255,0.09)" }}
              />
            ))}
          </div>

          <p className="text-[12px]" style={{ color: TEXT_3, lineHeight: 1.55 }}>
            Connect your data sources so Aria can start finding revenue opportunities.
          </p>
        </div>

        {/* ── 2. SETUP ACTION CARDS ────────────────────────────────────────── */}
        <div className="flex flex-col gap-2 mb-8">
          {SETUP_STEPS.map(({ Icon, title, desc, badge, primary, href, external }) => {
            const cardStyle: React.CSSProperties = {
              display: "block",
              padding: "14px 14px 13px",
              background: primary ? "rgba(59,130,246,0.06)" : BG_CARD,
              border: `0.5px solid ${primary ? "rgba(59,130,246,0.18)" : BORDER}`,
              borderRadius: 14,
            };
            const inner = (
              <>
                {/* Top row: icon + title + badge */}
                <div className="flex items-center gap-2.5 mb-2">
                  <div
                    className="flex items-center justify-center rounded-[9px] shrink-0"
                    style={{
                      width: 34,
                      height: 34,
                      background: primary ? "rgba(59,130,246,0.13)" : BG_CARD2,
                      border: `0.5px solid ${primary ? "rgba(59,130,246,0.26)" : BORDER}`,
                    }}
                  >
                    <Icon size={15} style={{ color: primary ? BLUE : TEXT_2 }} />
                  </div>
                  <p className="flex-1 text-[14px] font-semibold" style={{ color: TEXT_1 }}>
                    {title}
                  </p>
                  <span
                    className="shrink-0 text-[10px] font-semibold"
                    style={{
                      color: primary ? BLUE : TEXT_3,
                      border: `0.5px solid ${primary ? "rgba(59,130,246,0.28)" : "rgba(255,255,255,0.10)"}`,
                      borderRadius: 5,
                      padding: "2px 7px",
                      letterSpacing: "0.03em",
                    }}
                  >
                    {badge}
                  </span>
                </div>
                {/* Bottom row: desc + chevron */}
                <div className="flex items-end justify-between gap-3">
                  <p className="text-[12px]" style={{ color: TEXT_3, lineHeight: 1.45 }}>
                    {desc}
                  </p>
                  <ChevronRight size={14} style={{ color: TEXT_3, flexShrink: 0, marginBottom: 1 }} />
                </div>
              </>
            );

            return external ? (
              <a key={title} href={href} className="transition-opacity active:opacity-60" style={cardStyle}>
                {inner}
              </a>
            ) : (
              <Link key={title} href={href} className="transition-opacity active:opacity-60" style={cardStyle}>
                {inner}
              </Link>
            );
          })}
        </div>

        {/* ── 3. WHAT ARIA UNLOCKS ─────────────────────────────────────────── */}
        <div className="mb-8">
          <SectionLabel>What Aria unlocks</SectionLabel>
          <Card style={{ padding: "4px 0" }}>
            {UNLOCKS.map(({ label, desc }, i) => (
              <div
                key={label}
                className="flex items-start gap-3"
                style={{
                  padding: "13px 16px",
                  borderBottom: i < UNLOCKS.length - 1 ? `0.5px solid ${BORDER}` : "none",
                }}
              >
                <div
                  className="shrink-0 rounded-full"
                  style={{ width: 5, height: 5, background: BLUE, opacity: 0.55, marginTop: 6, flexShrink: 0 }}
                />
                <div>
                  <p className="text-[13px] font-semibold" style={{ color: TEXT_1 }}>
                    {label}
                  </p>
                  <p className="text-[12px] mt-0.5" style={{ color: TEXT_3, lineHeight: 1.45 }}>
                    {desc}
                  </p>
                </div>
              </div>
            ))}
          </Card>
        </div>

        {/* ── 4. PIPELINE (locked) ─────────────────────────────────────────── */}
        <div className="mb-8">
          <SectionLabel>Pipeline</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            <KpiCard value="—" label="Active Clients" placeholder />
            <KpiCard value="—" label="Warm Leads" placeholder />
            <KpiCard value="—" label="In Pipeline" placeholder />
            <KpiCard value="—" label="Pending Deals" placeholder />
          </div>
          <p className="mt-2.5 text-center text-[11px]" style={{ color: TEXT_3, opacity: 0.55 }}>
            Unlocks once you add clients
          </p>
        </div>

        {/* ── 5. VOICE ENTRY ───────────────────────────────────────────────── */}
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
}) {
  const [greeting, setGreeting] = useState("Good morning");
  const [dateLabel, setDateLabel] = useState("");

  useEffect(() => {
    setGreeting(getGreeting());
    setDateLabel(getDateLabel());
  }, []);

  const n = items.length;

  return (
    <div
      className="min-h-screen pb-[120px]"
      style={{ color: TEXT_1 }}
    >
      <div className="px-5">

        {/* ── 1. MORNING BRIEFING ────────────────────────────────────────── */}
        <div
          style={{
            paddingTop: "calc(env(safe-area-inset-top) + 22px)",
            paddingBottom: 28,
            borderBottom: `0.5px solid ${BORDER}`,
            marginBottom: 28,
          }}
        >
          <p
            className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em]"
            style={{ color: TEXT_3 }}
          >
            {dateLabel}
          </p>
          <h1
            className="text-[30px] font-bold leading-tight"
            style={{ color: TEXT_1, letterSpacing: "-0.03em" }}
          >
            {greeting}, {userName}.
          </h1>
          <p className="mt-2 text-[15px]" style={{ color: TEXT_2, lineHeight: 1.5 }}>
            {n === 0
              ? "No actions needed. You're on top of it."
              : `${n} ${n === 1 ? "opportunity" : "opportunities"} need${n === 1 ? "s" : ""} attention.`}
          </p>
        </div>

        {/* ── 2. REVENUE OPPORTUNITIES ───────────────────────────────────── */}
        <div className="mb-8">
          <SectionLabel>Revenue Opportunities</SectionLabel>

          {n === 0 ? (
            <Card style={{ padding: "24px 16px", textAlign: "center" }}>
              <p className="text-[14px] font-semibold" style={{ color: TEXT_2 }}>
                You&apos;re all caught up
              </p>
              <p className="mt-1 text-[12px]" style={{ color: TEXT_3 }}>
                No follow-ups, closings, or matches right now
              </p>
            </Card>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {items.map((item) => {
                const dot = URGENCY_DOT[item.urgencyRank] ?? URGENCY_DOT[5];
                const pill = timingPill(item);
                const isTextItem = item.actionType === "text";
                const isDraftLoading = isTextItem && loadingDrafts[item.id] !== false;
                const draftPreview = isTextItem ? (drafts[item.id] ?? "") : "";

                return (
                  <Card key={item.id} style={{ padding: "16px" }}>
                    {/* Header: dot + name + timing pill */}
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
                        className="text-[15px] font-semibold flex-1 leading-tight"
                        style={{ color: TEXT_1, letterSpacing: "-0.01em" }}
                      >
                        {item.clientName}
                      </span>
                      {pill && (
                        <span
                          className="shrink-0 text-[10px]"
                          style={{
                            color: pill.color,
                            fontWeight: pill.weight ?? 400,
                            letterSpacing: pill.upper ? "0.08em" : undefined,
                            textTransform: pill.upper ? "uppercase" : undefined,
                          }}
                        >
                          {pill.text}
                        </span>
                      )}
                    </div>

                    {/* Reason */}
                    <p
                      className="text-[13px] mb-3"
                      style={{ color: TEXT_2, lineHeight: 1.45, paddingLeft: 14 }}
                    >
                      {item.reason}
                    </p>

                    {/* AI draft preview */}
                    {isTextItem && (
                      <div style={{ paddingLeft: 14, marginBottom: 12 }}>
                        {isDraftLoading ? (
                          <div className="space-y-1.5">
                            <div className="h-2.5 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.06)", width: "80%" }} />
                            <div className="h-2.5 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.06)", width: "58%" }} />
                          </div>
                        ) : draftPreview ? (
                          <>
                            <p className="text-[9px] font-semibold uppercase mb-1.5" style={{ color: BLUE, letterSpacing: "0.10em" }}>
                              Aria suggests
                            </p>
                            <p className="text-[12px] italic line-clamp-2" style={{ color: TEXT_2, lineHeight: 1.5 }}>
                              &ldquo;{draftPreview}&rdquo;
                            </p>
                          </>
                        ) : null}
                      </div>
                    )}

                    {/* CTA */}
                    {isTextItem ? (
                      <button
                        type="button"
                        onClick={() => handleAction(item)}
                        className="w-full text-[13px] font-semibold text-center transition-opacity active:opacity-70"
                        style={{
                          background: BLUE,
                          color: "#ffffff",
                          padding: "11px 12px",
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
                        className="w-full text-[13px] font-medium flex items-center justify-between transition-opacity active:opacity-70"
                        style={{
                          background: "transparent",
                          color: TEXT_1,
                          padding: "10px 12px",
                          borderRadius: 9,
                          border: `0.5px solid rgba(255,255,255,0.13)`,
                        }}
                      >
                        <span>{item.actionLabel}</span>
                        <ArrowRight size={13} style={{ color: TEXT_3, flexShrink: 0 }} />
                      </button>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* ── 3. TODAY'S SCHEDULE ────────────────────────────────────────── */}
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
                  className="flex items-center gap-4 transition-opacity active:opacity-60"
                  style={{
                    padding: "14px 16px",
                    borderBottom: i < showingsToday.length - 1 ? `0.5px solid ${BORDER}` : "none",
                  }}
                >
                  <div style={{ width: 56, flexShrink: 0 }}>
                    <p className="text-[12px] font-semibold tabular-nums" style={{ color: BLUE }}>
                      {formatShowingTime(s.showing_date)}
                    </p>
                  </div>
                  <div style={{ width: 0.5, alignSelf: "stretch", background: BORDER, flexShrink: 0 }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate" style={{ color: TEXT_1 }}>
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

          {briefing.closingsThisWeek > 0 && (
            <Link
              href="/transactions"
              className="mt-2 flex items-center justify-between transition-opacity active:opacity-70"
              style={{
                background: "rgba(239,68,68,0.06)",
                border: "0.5px solid rgba(239,68,68,0.20)",
                borderRadius: 10,
                padding: "11px 14px",
              }}
            >
              <p className="text-[12px] font-medium" style={{ color: "#EF4444" }}>
                {briefing.closingsThisWeek} closing{briefing.closingsThisWeek > 1 ? "s" : ""} this week
              </p>
              <ChevronRight size={12} style={{ color: "rgba(239,68,68,0.6)", flexShrink: 0 }} />
            </Link>
          )}
        </div>

        {/* ── 4. PIPELINE KPIs ───────────────────────────────────────────── */}
        <div className="mb-8">
          <SectionLabel>Pipeline</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            <KpiCard value={kpi.activeClients} label="Active Clients" />
            <KpiCard value={kpi.warmLeads} label="Warm Leads" accent={kpi.warmLeads > 0 ? "#F59E0B" : undefined} />
            <KpiCard value={kpi.pipelineCount} label="In Pipeline" accent={kpi.pipelineCount > 0 ? BLUE : undefined} />
            <KpiCard value={kpi.pendingDeals} label="Pending Deals" accent={kpi.pendingDeals > 0 ? "#10B981" : undefined} />
          </div>
        </div>

        {/* ── 5. VOICE ENTRY ─────────────────────────────────────────────── */}
        <VoiceEntry onClick={onVoice} />

      </div>

      {/* ── Draft sheet ──────────────────────────────────────────────────── */}
      <DraftSheet
        item={activeDraftItem}
        prefetchedDraft={activeDraftItem ? drafts[activeDraftItem.id] : undefined}
        onClose={() => setActiveDraftItem(null)}
        onSent={() => {
          setActiveDraftItem(null);
          // no state setter here — parent owns drafts
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

  const handleVoice = useCallback(() => {
    triggerHaptic();
    router.push("/voice");
  }, [router]);

  if (!hasAnyClients) {
    return <NewAgentState userName={userName} onVoice={handleVoice} />;
  }

  return (
    <ActiveAgentState
      items={items}
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
    />
  );
}
