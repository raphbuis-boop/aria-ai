"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { ArrowRight, Mic } from "lucide-react";
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
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function triggerHaptic() {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(10);
  } catch { /* never let haptic failure break the tap */ }
}

// ── Urgency config ────────────────────────────────────────────────────────────

const URGENCY_DOT: Record<number, { color: string; glow?: string }> = {
  1: { color: "#EF4444", glow: "0 0 6px rgba(239,68,68,0.5)" },
  2: { color: "#F59E0B" },
  3: { color: "#A78BFA" },
  4: { color: "#3B82F6" },
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
      return item.clientTown ? { text: item.clientTown, color: "#4B5563" } : null;
    case 3: {
      const match = item.reason.match(/(\d+) year/i);
      return match ? { text: `${match[1]} yr`, color: "#4B5563" } : null;
    }
    case 4:
      return null;
    case 5:
      return { text: "New match", color: "#10B981", weight: 500 };
    default:
      return null;
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em]"
      style={{ color: "rgba(255,255,255,0.25)" }}
    >
      {children}
    </p>
  );
}

function KpiCard({ value, label, accent }: { value: number; label: string; accent?: string }) {
  return (
    <div
      className="flex flex-col justify-between"
      style={{
        background: "#0c0c10",
        border: "0.5px solid rgba(255,255,255,0.07)",
        borderRadius: 12,
        padding: "14px 14px 12px",
        minWidth: 0,
      }}
    >
      <p
        className="text-[26px] font-bold leading-none tabular-nums"
        style={{ color: accent ?? "#ffffff", letterSpacing: "-0.03em" }}
      >
        {value}
      </p>
      <p
        className="mt-2 text-[10px] uppercase leading-tight"
        style={{ color: "rgba(255,255,255,0.30)", letterSpacing: "0.08em" }}
      >
        {label}
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TodayClient({
  items,
  briefing,
  showingsToday,
  userName,
  hasAnyClients,
  kpi,
}: Props) {
  const router = useRouter();
  const [greeting, setGreeting] = useState("Good morning");
  const [dateLabel, setDateLabel] = useState("");
  const [activeDraftItem, setActiveDraftItem] = useState<TodayItem | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loadingDrafts, setLoadingDrafts] = useState<Record<string, boolean>>({});

  // Hydration-safe time-of-day values
  useEffect(() => {
    setGreeting(getGreeting());
    setDateLabel(getDateLabel());
  }, []);

  // Pre-fetch all text-action AI drafts in parallel on mount
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

  const n = items.length;

  return (
    <div
      className="min-h-screen pb-[120px]"
      style={{ background: "#050508", color: "#ffffff" }}
    >
      <div className="px-5">

        {/* ── 1. MORNING BRIEFING ────────────────────────────────────────── */}
        <div
          style={{
            paddingTop: "calc(env(safe-area-inset-top) + 20px)",
            paddingBottom: 28,
            borderBottom: "0.5px solid rgba(255,255,255,0.06)",
            marginBottom: 28,
          }}
        >
          {/* Date */}
          <p
            className="mb-1 text-[11px] font-medium uppercase tracking-[0.12em]"
            style={{ color: "rgba(255,255,255,0.25)" }}
          >
            {dateLabel}
          </p>

          {/* Greeting */}
          <h1
            className="text-[28px] font-bold leading-tight"
            style={{ color: "#ffffff", letterSpacing: "-0.03em" }}
          >
            {greeting}, {userName}.
          </h1>

          {/* Pipeline summary */}
          <p
            className="mt-2 text-[14px]"
            style={{ color: "rgba(255,255,255,0.40)", lineHeight: 1.5 }}
          >
            {n === 0
              ? hasAnyClients
                ? "No actions needed. You're on top of it."
                : "Add your first client to get started."
              : `${n} ${n === 1 ? "opportunity" : "opportunities"} need${n === 1 ? "s" : ""} attention`}
          </p>
        </div>

        {/* ── 2. REVENUE OPPORTUNITIES ───────────────────────────────────── */}
        {n > 0 && (
          <div className="mb-8">
            <SectionLabel>Revenue Opportunities</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {items.map((item) => {
                const dot = URGENCY_DOT[item.urgencyRank] ?? URGENCY_DOT[5];
                const pill = timingPill(item);
                const isTextItem = item.actionType === "text";
                const isDraftLoading = isTextItem && loadingDrafts[item.id] !== false;
                const draftPreview = isTextItem ? (drafts[item.id] ?? "") : "";

                return (
                  <div
                    key={item.id}
                    style={{
                      background: "#0c0c10",
                      border: "0.5px solid rgba(255,255,255,0.07)",
                      borderRadius: 14,
                      padding: "16px",
                    }}
                  >
                    {/* Header row: dot + name + timing pill */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className="shrink-0 rounded-full"
                        style={{
                          width: 5,
                          height: 5,
                          background: dot.color,
                          boxShadow: dot.glow ?? "none",
                        }}
                      />
                      <span
                        className="text-[15px] font-semibold flex-1 leading-tight"
                        style={{ color: "#ffffff", letterSpacing: "-0.01em" }}
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
                      style={{ color: "rgba(255,255,255,0.40)", lineHeight: 1.45, paddingLeft: 13 }}
                    >
                      {item.reason}
                    </p>

                    {/* AI draft preview */}
                    {isTextItem && (
                      <div style={{ paddingLeft: 13, marginBottom: 12 }}>
                        {isDraftLoading ? (
                          <div className="space-y-1.5">
                            <div
                              className="h-2.5 rounded"
                              style={{ background: "rgba(255,255,255,0.06)", width: "82%", animation: "pulse 1.5s ease-in-out infinite" }}
                            />
                            <div
                              className="h-2.5 rounded"
                              style={{ background: "rgba(255,255,255,0.06)", width: "62%", animation: "pulse 1.5s ease-in-out infinite 0.2s" }}
                            />
                          </div>
                        ) : draftPreview ? (
                          <>
                            <p
                              className="text-[9px] font-semibold uppercase mb-1.5"
                              style={{ color: "#3B82F6", letterSpacing: "0.10em" }}
                            >
                              Aria suggests
                            </p>
                            <p
                              className="text-[12px] italic line-clamp-2"
                              style={{ color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}
                            >
                              &ldquo;{draftPreview}&rdquo;
                            </p>
                          </>
                        ) : null}
                      </div>
                    )}

                    {/* Action button */}
                    {isTextItem ? (
                      <button
                        type="button"
                        onClick={() => handleAction(item)}
                        className="w-full text-[13px] font-semibold text-center transition-opacity active:opacity-80"
                        style={{
                          background: "#3B82F6",
                          color: "#ffffff",
                          padding: "11px 12px",
                          borderRadius: 8,
                          display: "block",
                        }}
                      >
                        {item.actionLabel}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAction(item)}
                        className="w-full text-[13px] font-medium flex items-center justify-between transition-opacity active:opacity-80"
                        style={{
                          background: "transparent",
                          color: "rgba(255,255,255,0.75)",
                          padding: "10px 12px",
                          borderRadius: 8,
                          border: "0.5px solid rgba(255,255,255,0.12)",
                        }}
                      >
                        <span>{item.actionLabel}</span>
                        <ArrowRight size={13} style={{ color: "rgba(255,255,255,0.30)", flexShrink: 0 }} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Empty state ── */}
        {n === 0 && hasAnyClients && (
          <div
            className="mb-8 flex flex-col items-center py-10"
            style={{
              background: "#0c0c10",
              border: "0.5px solid rgba(255,255,255,0.06)",
              borderRadius: 14,
            }}
          >
            <p className="text-[15px] font-semibold" style={{ color: "rgba(255,255,255,0.60)" }}>
              You&apos;re all caught up
            </p>
            <p className="mt-1 text-[12px]" style={{ color: "rgba(255,255,255,0.25)" }}>
              No follow-ups, closings, or matches right now
            </p>
          </div>
        )}

        {n === 0 && !hasAnyClients && (
          <div className="mb-8">
            <Link
              href="/clients?new=1"
              className="flex items-center justify-between transition-opacity active:opacity-70"
              style={{
                background: "#0c0c10",
                border: "0.5px solid rgba(255,255,255,0.07)",
                borderRadius: 14,
                padding: "18px 16px",
              }}
            >
              <div>
                <p className="text-[14px] font-semibold" style={{ color: "#ffffff" }}>Add your first client</p>
                <p className="mt-0.5 text-[12px]" style={{ color: "rgba(255,255,255,0.30)" }}>
                  Aria starts working the moment you have clients
                </p>
              </div>
              <ArrowRight size={15} style={{ color: "rgba(255,255,255,0.25)", flexShrink: 0 }} />
            </Link>
          </div>
        )}

        {/* ── 3. TODAY'S SCHEDULE ────────────────────────────────────────── */}
        <div className="mb-8">
          <SectionLabel>Today&apos;s Schedule</SectionLabel>
          {showingsToday.length === 0 ? (
            <div
              style={{
                background: "#0c0c10",
                border: "0.5px solid rgba(255,255,255,0.07)",
                borderRadius: 12,
                padding: "16px",
              }}
            >
              <p className="text-[13px]" style={{ color: "rgba(255,255,255,0.25)" }}>
                No showings scheduled today
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {showingsToday.map((s, i) => {
                const isFirst = i === 0;
                const isLast = i === showingsToday.length - 1;
                return (
                  <Link
                    key={s.id}
                    href="/showings"
                    className="flex items-center gap-4 transition-opacity active:opacity-70"
                    style={{
                      background: "#0c0c10",
                      border: "0.5px solid rgba(255,255,255,0.07)",
                      borderTopLeftRadius: isFirst ? 12 : 4,
                      borderTopRightRadius: isFirst ? 12 : 4,
                      borderBottomLeftRadius: isLast ? 12 : 4,
                      borderBottomRightRadius: isLast ? 12 : 4,
                      padding: "13px 16px",
                    }}
                  >
                    {/* Time */}
                    <div style={{ width: 52, flexShrink: 0 }}>
                      <p className="text-[12px] font-semibold tabular-nums" style={{ color: "#3B82F6" }}>
                        {formatShowingTime(s.showing_date)}
                      </p>
                    </div>
                    {/* Divider */}
                    <div style={{ width: 0.5, alignSelf: "stretch", background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />
                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium truncate" style={{ color: "#ffffff" }}>
                        {s.clients?.name ?? "Client"}
                      </p>
                      <p className="text-[11px] truncate mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                        {s.address ?? "Address TBD"}
                      </p>
                    </div>
                    <ArrowRight size={13} style={{ color: "rgba(255,255,255,0.20)", flexShrink: 0 }} />
                  </Link>
                );
              })}
            </div>
          )}
          {/* Closings this week callout */}
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
              <ArrowRight size={12} style={{ color: "rgba(239,68,68,0.6)", flexShrink: 0 }} />
            </Link>
          )}
        </div>

        {/* ── 4. KPI CARDS ───────────────────────────────────────────────── */}
        {hasAnyClients && (
          <div className="mb-8">
            <SectionLabel>Pipeline</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              <KpiCard value={kpi.activeClients} label="Active Clients" />
              <KpiCard
                value={kpi.warmLeads}
                label="Warm Leads"
                accent={kpi.warmLeads > 0 ? "#F59E0B" : undefined}
              />
              <KpiCard
                value={kpi.pipelineCount}
                label="In Pipeline"
                accent={kpi.pipelineCount > 0 ? "#3B82F6" : undefined}
              />
              <KpiCard
                value={kpi.pendingDeals}
                label="Pending Deals"
                accent={kpi.pendingDeals > 0 ? "#10B981" : undefined}
              />
            </div>
          </div>
        )}

        {/* ── 5. VOICE ENTRY ─────────────────────────────────────────────── */}
        <div className="mb-4">
          <button
            type="button"
            onClick={() => { triggerHaptic(); router.push("/voice"); }}
            className="w-full flex items-center gap-3 transition-opacity active:opacity-70"
            style={{
              background: "#0c0c10",
              border: "0.5px solid rgba(58,101,240,0.20)",
              borderRadius: 12,
              padding: "14px 16px",
            }}
          >
            <div
              className="flex items-center justify-center rounded-full shrink-0"
              style={{
                width: 32,
                height: 32,
                background: "rgba(58,101,240,0.10)",
                border: "0.5px solid rgba(58,101,240,0.25)",
              }}
            >
              <Mic size={14} color="#3B82F6" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-[13px] font-medium" style={{ color: "rgba(255,255,255,0.75)" }}>
                Ask Aria
              </p>
              <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.25)" }}>
                Voice assistant
              </p>
            </div>
            <ArrowRight size={13} style={{ color: "rgba(255,255,255,0.20)", flexShrink: 0 }} />
          </button>
        </div>

      </div>

      {/* ── Draft sheet modal ─────────────────────────────────────────────── */}
      <DraftSheet
        item={activeDraftItem}
        prefetchedDraft={activeDraftItem ? drafts[activeDraftItem.id] : undefined}
        onClose={() => setActiveDraftItem(null)}
        onSent={(itemId) => {
          setActiveDraftItem(null);
          setDrafts((prev) => {
            const next = { ...prev };
            delete next[itemId];
            return next;
          });
        }}
      />
    </div>
  );
}
