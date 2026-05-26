"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { Bell, ArrowRight } from "lucide-react";
import type { TodayItem } from "@/lib/today-items";
import { DraftSheet } from "@/components/DraftSheet";

type Briefing = {
  showingsToday: number;
  closingsThisWeek: number;
  newMatches: number;
};

type Props = {
  items: TodayItem[];
  briefing: Briefing;
  userName: string;
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function triggerHaptic() {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(10);
    }
  } catch {
    // never let haptic failure break the tap
  }
}

const URGENCY_DOT: Record<number, { color: string; glow?: string }> = {
  1: { color: "#EF4444", glow: "0 0 8px rgba(239,68,68,0.6)" },
  2: { color: "#F59E0B" },
  3: { color: "#A78BFA" },
  4: { color: "#3B82F6" },
  5: { color: "#10B981" },
};

/**
 * Derives the right-side timing pill content + color for each urgency rank.
 * Pulls from item.context and item.reason where appropriate.
 */
function timingPill(item: TodayItem): { text: string; color: string; weight?: number; upper?: boolean } | null {
  switch (item.urgencyRank) {
    case 1: {
      // Extract "today" / "tomorrow" / "in N days" from the reason string
      const match = item.reason.match(/is (today|tomorrow|in \d+ days)/i);
      const text = match ? match[1].toUpperCase() : "";
      return text ? { text, color: "#EF4444", weight: 500, upper: true } : null;
    }
    case 2:
      return item.clientTown ? { text: item.clientTown, color: "#6B7280" } : null;
    case 3: {
      // Anniversary: pull "N year(s) ago" from reason
      const match = item.reason.match(/(\d+) year/i);
      return match ? { text: `${match[1]} yr`, color: "#6B7280" } : null;
    }
    case 4:
      return null;
    case 5:
      return { text: "New match", color: "#10B981", weight: 500 };
    default:
      return null;
  }
}

export function TodayClient({ items, briefing, userName }: Props) {
  const router = useRouter();
  const [greeting, setGreeting] = useState("Good morning");
  const [activeDraftItem, setActiveDraftItem] = useState<TodayItem | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loadingDrafts, setLoadingDrafts] = useState<Record<string, boolean>>({});

  // Hydration-safe greeting
  useEffect(() => {
    setGreeting(getGreeting());
  }, []);

  // Pre-fetch all text-action drafts in parallel on mount
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
  }, []); // run once on mount — items are stable (server-rendered)

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
      className="min-h-screen pb-[130px]"
      style={{
        background: `
          radial-gradient(ellipse 80% 50% at 50% -20%, rgba(59,130,246,0.10), transparent),
          radial-gradient(ellipse 60% 50% at 80% 80%, rgba(167,139,250,0.06), transparent),
          #000000
        `,
        color: "#ffffff",
      }}
    >
      <div className="px-5 pt-6">

        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-5">
          <div className="min-w-0 flex-1">
            <p className="text-[13px]" style={{ color: "#9CA3AF" }}>
              {greeting}, {userName}
            </p>
            <p className="mt-1 text-[18px] font-medium" style={{ color: "#6B7280" }}>
              {n === 0 ? (
                "All caught up today."
              ) : (
                <>
                  <span
                    style={{
                      background: "linear-gradient(135deg, #3B82F6, #06B6D4)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                      fontWeight: 700,
                    }}
                  >
                    {n} {n === 1 ? "follow-up" : "follow-ups"}
                  </span>
                  {" "}
                  <span style={{ color: "#6B7280", fontWeight: 500 }}>today</span>
                </>
              )}
            </p>
          </div>
          <Bell size={22} style={{ color: "#6B7280", flexShrink: 0, marginTop: 4 }} />
        </div>

        {/* ── Briefing strip ── */}
        <div
          className="grid grid-cols-3 mb-7"
          style={{ gap: 8 }}
        >
          {/* Showings today */}
          <div
            className="flex flex-col items-center justify-center"
            style={{
              background: "rgba(20,20,22,0.5)",
              border: "0.5px solid rgba(255,255,255,0.06)",
              borderRadius: 12,
              padding: "10px 8px",
            }}
          >
            <p className="text-[18px] font-bold" style={{ color: "#ffffff" }}>
              {briefing.showingsToday}
            </p>
            <p
              className="text-[10px] uppercase text-center mt-0.5"
              style={{ color: "#6B7280", letterSpacing: "0.06em" }}
            >
              Showings today
            </p>
          </div>

          {/* Closings this week */}
          <div
            className="flex flex-col items-center justify-center"
            style={{
              background: "rgba(20,20,22,0.5)",
              border: "0.5px solid rgba(255,255,255,0.06)",
              borderRadius: 12,
              padding: "10px 8px",
            }}
          >
            <p
              className="text-[18px] font-bold"
              style={{ color: briefing.closingsThisWeek > 0 ? "#EF4444" : "#ffffff" }}
            >
              {briefing.closingsThisWeek}
            </p>
            <p
              className="text-[10px] uppercase text-center mt-0.5"
              style={{ color: "#6B7280", letterSpacing: "0.06em" }}
            >
              Closings this wk
            </p>
          </div>

          {/* New MLS matches */}
          <div
            className="flex flex-col items-center justify-center"
            style={{
              background: "rgba(20,20,22,0.5)",
              border: "0.5px solid rgba(255,255,255,0.06)",
              borderRadius: 12,
              padding: "10px 8px",
            }}
          >
            <p
              className="text-[18px] font-bold"
              style={{ color: briefing.newMatches > 0 ? "#10B981" : "#ffffff" }}
            >
              {briefing.newMatches}
            </p>
            <p
              className="text-[10px] uppercase text-center mt-0.5"
              style={{ color: "#6B7280", letterSpacing: "0.06em" }}
            >
              New MLS
            </p>
          </div>
        </div>

        {/* ── Empty state ── */}
        {n === 0 && (
          <div className="mt-4">
            <p className="text-[14px]" style={{ color: "#6B7280" }}>
              No follow-ups, no signatures pending. Enjoy the quiet.
            </p>
            <Link
              href="/clients/new"
              className="mt-6 inline-block text-[16px] font-semibold"
              style={{ color: "#3B82F6" }}
            >
              Add a new client →
            </Link>
          </div>
        )}

        {/* ── Section label ── */}
        {n > 0 && (
          <p
            className="text-[11px] font-semibold uppercase mb-1"
            style={{ color: "#6B7280", letterSpacing: "0.08em" }}
          >
            People to reach out to
          </p>
        )}

        {/* ── Item list ── */}
        {n > 0 && (
          <div>
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
                    padding: "18px 4px",
                    borderBottom: "0.5px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {/* Header row: dot + name + timing pill */}
                  <div className="flex items-center gap-[10px]">
                    <span
                      className="shrink-0 rounded-full"
                      style={{
                        width: 6,
                        height: 6,
                        background: dot.color,
                        boxShadow: dot.glow ?? "none",
                      }}
                    />
                    <span
                      className="text-[17px] font-semibold leading-tight"
                      style={{ color: "#ffffff", letterSpacing: "-0.02em" }}
                    >
                      {item.clientName}
                    </span>
                    {pill && (
                      <span
                        className="ml-auto shrink-0 text-[11px]"
                        style={{
                          color: pill.color,
                          fontWeight: pill.weight ?? 400,
                          letterSpacing: pill.upper ? "0.06em" : undefined,
                          textTransform: pill.upper ? "uppercase" : undefined,
                        }}
                      >
                        {pill.text}
                      </span>
                    )}
                  </div>

                  {/* Reason line */}
                  <p
                    className="text-[13px] leading-snug mt-1.5"
                    style={{ color: "#9CA3AF", marginLeft: 14, marginBottom: 8 }}
                  >
                    {item.reason}
                  </p>

                  {/* AI draft preview — text items only */}
                  {isTextItem && (
                    <div style={{ marginLeft: 14, marginBottom: 12 }}>
                      {isDraftLoading ? (
                        <div className="space-y-1.5">
                          <div
                            className="h-3 rounded animate-pulse"
                            style={{ background: "#1F2937", width: "86%" }}
                          />
                          <div
                            className="h-3 rounded animate-pulse"
                            style={{ background: "#1F2937", width: "68%" }}
                          />
                        </div>
                      ) : draftPreview ? (
                        <>
                          <p
                            className="text-[10px] font-semibold uppercase mb-1"
                            style={{ color: "#A78BFA", letterSpacing: "0.08em" }}
                          >
                            Aria suggests
                          </p>
                          <p
                            className="text-[13px] italic line-clamp-2"
                            style={{ color: "#D1D5DB", lineHeight: 1.45 }}
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
                      className="text-[14px] font-semibold active:scale-[0.97] transition-transform duration-100"
                      style={{
                        background: "#3B82F6",
                        color: "#ffffff",
                        padding: "10px 12px",
                        borderRadius: 8,
                        width: "calc(100% - 14px)",
                        marginLeft: 14,
                        textAlign: "center",
                        display: "block",
                      }}
                    >
                      {item.actionLabel}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAction(item)}
                      className="text-[14px] font-medium active:scale-[0.97] transition-transform duration-100 flex items-center justify-between"
                      style={{
                        background: "transparent",
                        color: "#ffffff",
                        padding: "9px 12px",
                        borderRadius: 8,
                        border: "0.5px solid rgba(255,255,255,0.15)",
                        width: "calc(100% - 14px)",
                        marginLeft: 14,
                      }}
                    >
                      <span>{item.actionLabel}</span>
                      <ArrowRight size={14} style={{ color: "#6B7280", flexShrink: 0 }} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <DraftSheet
        item={activeDraftItem}
        prefetchedDraft={activeDraftItem ? drafts[activeDraftItem.id] : undefined}
        onClose={() => setActiveDraftItem(null)}
        onSent={(itemId) => {
          setActiveDraftItem(null);
          // Remove from local draft cache so it won't reappear
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
