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
    // TODO: replace with Haptics.impact({ style: ImpactStyle.Light }) once
    // @capacitor/haptics is installed and Capacitor bridge is available
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(10);
    }
  } catch {
    // Never let haptic failure break the tap
  }
}

export function TodayClient({ items, overflowCount, userName }: Props) {
  const router = useRouter();
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [greeting, setGreeting] = useState("Good morning");
  const [activeDraftItem, setActiveDraftItem] = useState<TodayItem | null>(null);

  // Load skipped items from localStorage on mount (client-only)
  useEffect(() => {
    setSkipped(loadSkipped());
    setGreeting(getGreeting());
  }, []);

  const visibleItems = items.filter((item) => !skipped.has(item.id));

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
    <div className="min-h-screen pb-28" style={{ background: "#000000", color: "#ffffff" }}>
      <div className="px-5 pt-8">

        {/* ── Header ── */}
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-[14px]" style={{ color: "#9CA3AF" }}>
              {greeting}, {userName}
            </p>
            <h1 className="mt-1 text-[36px] font-bold leading-[1.1] tracking-[-0.02em]">
              {visibleItems.length === 0 ? (
                "All caught up today."
              ) : visibleItems.length === 1 ? (
                <><span style={{ color: "#FACC15" }}>1</span> person to follow up with today</>
              ) : (
                <><span style={{ color: "#FACC15" }}>{visibleItems.length}</span> people to follow up with today</>
              )}
            </h1>
          </div>
          <Bell size={24} style={{ color: "#6B7280", flexShrink: 0, marginTop: 4 }} />
        </div>

        {/* ── Empty state ── */}
        {visibleItems.length === 0 && (
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
        {visibleItems.length > 0 && (
          <div className="mt-8 space-y-[10px]">
            {visibleItems.map((item, index) => (
              <div
                key={item.id}
                className="rounded-[12px] p-6 transition-opacity duration-200"
                style={{
                  background: "#111111",
                  border: "1px solid #222222",
                }}
              >
                {/* Number + name row */}
                <div className="flex items-start gap-4">
                  <span
                    className="mt-0.5 shrink-0 text-[24px] font-bold tabular-nums leading-none"
                    style={{ color: "#6B7280" }}
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[22px] font-bold leading-tight" style={{ color: "#ffffff" }}>
                        {item.clientName}
                      </p>
                      {item.urgencyRank === 1 && (
                        <span
                          className="shrink-0 rounded-[4px] px-[6px] py-[2px] text-[11px] font-semibold uppercase tracking-wide"
                          style={{ color: "#FCA5A5", background: "#7F1D1D" }}
                        >
                          Urgent
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-[16px] leading-snug" style={{ color: "#9CA3AF" }}>
                      {item.reason}
                    </p>
                    {item.context && (
                      <p className="mt-1 text-[14px]" style={{ color: "#6B7280" }}>
                        {item.context}
                      </p>
                    )}
                  </div>
                </div>

                {/* Action button */}
                <div className="mt-5">
                  <button
                    type="button"
                    onClick={() => handleAction(item)}
                    className="w-full rounded-[12px] py-[17px] text-[17px] font-semibold"
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
            ))}

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
  );
}
