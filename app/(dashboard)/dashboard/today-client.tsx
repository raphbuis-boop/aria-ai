"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { Bell } from "lucide-react";
import type { TodayItem } from "@/lib/today-items";
import { DraftSheet } from "@/components/DraftSheet";

type Props = {
  items: TodayItem[];
  overflowCount: number;
  userName: string;
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getTodayKey(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `aria_skipped_today_${yyyy}-${mm}-${dd}`;
}

function loadSkipped(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(getTodayKey());
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveSkipped(skipped: Set<string>) {
  try {
    localStorage.setItem(getTodayKey(), JSON.stringify([...skipped]));
  } catch {
    // localStorage unavailable — skip silently
  }
}

function triggerHaptic() {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(10);
    }
  } catch {
    // Never let haptic failure break the tap
  }
}

const URGENCY_ACCENT: Record<number, { color: string; glow: string }> = {
  1: { color: "#EF4444", glow: "rgba(239,68,68,0.4)" },
  2: { color: "#F59E0B", glow: "rgba(245,158,11,0.35)" },
  3: { color: "#A78BFA", glow: "rgba(167,139,250,0.35)" },
  4: { color: "#3B82F6", glow: "rgba(59,130,246,0.35)" },
  5: { color: "#10B981", glow: "rgba(16,185,129,0.35)" },
};

export function TodayClient({ items, overflowCount, userName }: Props) {
  const router = useRouter();
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [greeting, setGreeting] = useState("Good morning");
  const [activeDraftItem, setActiveDraftItem] = useState<TodayItem | null>(null);
  // Map of itemId → draft text (undefined = not yet fetched, "" = fetch failed)
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  // Map of itemId → whether the prefetch is still in-flight
  const [loadingDrafts, setLoadingDrafts] = useState<Record<string, boolean>>({});

  // Load skipped items from localStorage on mount (client-only)
  useEffect(() => {
    setSkipped(loadSkipped());
    setGreeting(getGreeting());
  }, []);

  // Pre-fetch all text-type drafts in parallel on mount
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

  const visibleItems = items.filter((item) => !skipped.has(item.id));
  const n = visibleItems.length;

  const handleSkip = useCallback((itemId: string) => {
    triggerHaptic();
    setSkipped((prev) => {
      const next = new Set(prev).add(itemId);
      saveSkipped(next);
      return next;
    });
  }, []);

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

  return (
    <>
      <style>{`
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
      `}</style>

      <div
        className="min-h-screen pb-28"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 50% -20%, rgba(59,130,246,0.08), transparent),
            radial-gradient(ellipse 60% 50% at 80% 80%, rgba(167,139,250,0.06), transparent),
            #000000
          `,
          color: "#ffffff",
        }}
      >
        <div className="px-5 pt-6">

          {/* ── Header ── */}
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[14px]" style={{ color: "#9CA3AF" }}>
                {greeting}, {userName}
              </p>
              {n === 0 ? (
                <h1 className="mt-1 text-[36px] font-bold leading-[1.1] tracking-[-0.02em]">
                  All caught up today.
                </h1>
              ) : (
                <h1 className="mt-1 leading-[1.05] tracking-[-0.02em]">
                  <span
                    className="block text-[56px] font-extrabold"
                    style={{
                      background: "linear-gradient(135deg, #FACC15, #F59E0B)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >
                    {n}
                  </span>
                  <span className="block text-[28px] font-semibold" style={{ color: "#ffffff" }}>
                    {n === 1 ? "person to follow up with today" : "people to follow up with today"}
                  </span>
                </h1>
              )}
            </div>
            <Bell size={24} style={{ color: "#6B7280", flexShrink: 0, marginTop: 6 }} />
          </div>

          {/* ── Empty state ── */}
          {n === 0 && (
            <div className="mt-6">
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

          {/* ── Item list ── */}
          {n > 0 && (
            <div className="mt-8 space-y-[10px]">
              {visibleItems.map((item, index) => {
                const accent = URGENCY_ACCENT[item.urgencyRank] ?? URGENCY_ACCENT[5];
                const isTextItem = item.actionType === "text";
                const isDraftLoading = isTextItem && loadingDrafts[item.id] !== false;
                const draftPreview = isTextItem ? (drafts[item.id] ?? "") : "";

                return (
                  <div
                    key={item.id}
                    style={{
                      animation: "cardIn 0.4s ease-out backwards",
                      animationDelay: `${index * 50}ms`,
                    }}
                  >
                    <div
                      className="rounded-[14px] p-5"
                      style={{
                        background: "rgba(20,20,22,0.6)",
                        backdropFilter: "blur(20px) saturate(180%)",
                        WebkitBackdropFilter: "blur(20px) saturate(180%)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        borderLeft: `3px solid ${accent.color}`,
                        boxShadow: `-8px 0 24px -8px ${accent.glow}`,
                      }}
                    >
                      {/* Number + name row */}
                      <div className="flex items-start gap-4">
                        <span
                          className="mt-0.5 shrink-0 text-[22px] font-bold tabular-nums leading-none"
                          style={{ color: "#4B5563" }}
                        >
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p
                            className="text-[22px] font-bold leading-tight"
                            style={{ color: "#ffffff", letterSpacing: "-0.02em" }}
                          >
                            {item.clientName}
                          </p>
                          <p className="mt-1.5 text-[15px] leading-snug" style={{ color: "#9CA3AF" }}>
                            {item.reason}
                          </p>
                          {item.context && (
                            <p className="mt-1 text-[13px]" style={{ color: "#6B7280" }}>
                              {item.context}
                            </p>
                          )}

                          {/* ── AI draft preview (text items only) ── */}
                          {isTextItem && (
                            <div className="mt-3">
                              <p
                                className="mb-1.5 text-[10px] font-semibold uppercase"
                                style={{ color: "#A78BFA", letterSpacing: "0.08em" }}
                              >
                                Aria suggests
                              </p>
                              {isDraftLoading ? (
                                <div className="space-y-1.5">
                                  <div className="h-3 rounded animate-pulse" style={{ background: "#1F2937", width: "88%" }} />
                                  <div className="h-3 rounded animate-pulse" style={{ background: "#1F2937", width: "72%" }} />
                                  <div className="h-3 rounded animate-pulse" style={{ background: "#1F2937", width: "80%" }} />
                                </div>
                              ) : draftPreview ? (
                                <p
                                  className="text-[14px] italic line-clamp-3"
                                  style={{ color: "#D1D5DB", lineHeight: 1.5 }}
                                >
                                  &ldquo;{draftPreview}&rdquo;
                                </p>
                              ) : null}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action button */}
                      <div className="mt-5">
                        <button
                          type="button"
                          onClick={() => handleAction(item)}
                          className="w-full rounded-[12px] py-[17px] text-[17px] font-semibold active:scale-[0.97] transition-transform duration-100"
                          style={{ background: "#FACC15", color: "#000000", minHeight: "56px" }}
                        >
                          {item.actionLabel}
                        </button>

                        {/* Skip link */}
                        <div className="pt-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleSkip(item.id)}
                            className="text-[14px]"
                            style={{ color: "#6B7280" }}
                          >
                            Skip for today
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Overflow indicator — includes both server-capped overflow and user-skipped items */}
              {(overflowCount + skipped.size) > 0 && (
                <div className="pt-2 text-center">
                  <Link
                    href="/people"
                    className="text-[16px]"
                    style={{ color: "#3B82F6" }}
                  >
                    + {overflowCount + skipped.size} more — see all →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        <DraftSheet
          item={activeDraftItem}
          prefetchedDraft={activeDraftItem ? drafts[activeDraftItem.id] : undefined}
          onClose={() => setActiveDraftItem(null)}
          onSent={(itemId) => {
            setActiveDraftItem(null);
            setSkipped((prev) => {
              const next = new Set(prev).add(itemId);
              saveSkipped(next);
              return next;
            });
          }}
        />
      </div>
    </>
  );
}
