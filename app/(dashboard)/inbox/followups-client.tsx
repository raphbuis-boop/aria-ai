"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { CheckCircle2 } from "lucide-react";
import type { TodayItem } from "@/lib/today-items";
import { DraftSheet } from "@/components/DraftSheet";
import { Card } from "@/components/ui/card";
import { Toaster, toast } from "@/components/ui/sonner";
import { smartTemplateDraft, isGenericAiFallback } from "@/lib/draft-templates";

type Props = {
  items: TodayItem[];
};

const HEAT_DOT_COLOR: Record<"hot" | "warm", { fill: string; ring: string }> = {
  hot: { fill: "var(--hot)", ring: "color-mix(in srgb, var(--hot) 15%, transparent)" },
  warm: { fill: "var(--warm)", ring: "color-mix(in srgb, var(--warm) 15%, transparent)" },
};

const EASE = [0.25, 0.46, 0.45, 0.94] as const;

function triggerHaptic() {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(10);
  } catch {
    /* never break */
  }
}

async function dismissItem(itemId: string): Promise<void> {
  await fetch("/api/opportunities/dismiss", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itemId, hours: 24 }),
  });
}


function HeatDot({ heat }: { heat: TodayItem["leadHeat"] }) {
  if (heat === "cold") return null;
  const c = HEAT_DOT_COLOR[heat];
  return (
    <span
      className="size-2 shrink-0 rounded-full"
      style={{ background: c.fill, boxShadow: `0 0 0 3px ${c.ring}` }}
      aria-hidden="true"
    />
  );
}

function FollowUpRow({
  item,
  draft,
  onOpen,
}: {
  item: TodayItem;
  draft: string | undefined;
  onOpen: () => void;
}) {
  return (
    <button type="button" onClick={onOpen} className="w-full text-left px-5 py-5 hover:bg-accent/50 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-display text-body-lg font-semibold text-foreground truncate">{item.clientName}</p>
            <HeatDot heat={item.leadHeat} />
          </div>
          <p className="font-display text-caption text-muted-foreground mt-0.5">{item.reason}</p>
        </div>
      </div>

      {/* Draft preview — or, for leads in an Aria thread, a pointer to it */}
      <div className="mt-3 rounded-xl bg-secondary px-4 py-3">
        {item.actionType === "navigate" ? (
          <p className="font-display text-caption text-muted-foreground">
            In an Aria text thread — open it to reply from Aria&apos;s number.
          </p>
        ) : draft === undefined ? (
          <div className="space-y-1.5">
            <div className="h-3 rounded bg-border/70 animate-pulse" style={{ width: "85%" }} />
            <div className="h-3 rounded bg-border/70 animate-pulse" style={{ width: "60%" }} />
          </div>
        ) : (
          <p className="font-display text-caption text-muted-foreground line-clamp-2 italic">&ldquo;{draft}&rdquo;</p>
        )}
      </div>
    </button>
  );
}

export function FollowUpsClient({ items: initialItems }: Props) {
  const [items, setItems] = useState(initialItems);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [activeDraftItem, setActiveDraftItem] = useState<TodayItem | null>(null);

  const router = useRouter();

  // Prefetch a draft for every item on mount — AI first, clean template fallback.
  useEffect(() => {
    const textItems = initialItems.filter((i) => i.actionType === "text");
    if (textItems.length === 0) return;

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
            // Full per-client context so the AI writes a genuinely personal draft,
            // not the same bland line for everyone (matches DraftSheet's payload).
            urgencyRank: item.urgencyRank,
            clientTown: item.clientTown,
            clientBudgetMax: item.clientBudgetMax,
            propertyAddress: item.propertyAddress,
            clientStatus: item.clientStatus,
            leadScore: item.leadScore,
            activitySignal: item.activitySignal,
            commissionEst: item.commissionEst,
          }),
        })
          .then((r) => r.json())
          .then((data: { draft?: string }) => {
            const aiDraft = data.draft?.trim() ?? "";
            // Prefer real Claude output; fall back to a tailored template only
            // when the API itself had nothing to say (down, no key, or its
            // own generic line) — never overwrite a genuine model response.
            const draft = aiDraft && !isGenericAiFallback(aiDraft) ? aiDraft : smartTemplateDraft(item);
            return { id: item.id, draft };
          })
          .catch(() => ({ id: item.id, draft: smartTemplateDraft(item) })),
      ),
    ).then((results) => {
      const draftMap: Record<string, string> = {};
      results.forEach(({ id, draft }) => {
        draftMap[id] = draft;
      });
      setDrafts(draftMap);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // stable on mount — server-rendered items

  const handleOpen = useCallback(
    (item: TodayItem) => {
      triggerHaptic();
      if (item.actionType === "navigate" && item.navigateTo) router.push(item.navigateTo);
      else setActiveDraftItem(item);
    },
    [router],
  );

  const handleSent = useCallback((itemId: string) => {
    setActiveDraftItem(null);
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    toast.success("Message sent");
  }, []);

  const handleSkip = useCallback((itemId: string) => {
    triggerHaptic();
    setActiveDraftItem(null);
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    toast("Skipped for today");
    void dismissItem(itemId);
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-[100dvh] bg-background text-foreground">
        <div className="mx-auto max-w-2xl px-5 pt-10 pb-32 sm:px-8">
          {/* Header */}
          <header className="mb-8">
            <h1 className="font-heading text-[34px] leading-tight text-foreground mb-2">Follow-ups</h1>
            {items.length > 0 ? (
              <p className="font-display text-body-lg text-muted-foreground">
                <span className="text-foreground font-semibold">{items.length}</span>{" "}
                {items.length === 1 ? "client needs" : "clients need"} a check-in, most valuable first.
              </p>
            ) : (
              <p className="font-display text-body-lg text-muted-foreground">Nothing on the table right now.</p>
            )}
          </header>

          {items.length === 0 ? (
            <div className="flex flex-col items-center text-center rounded-2xl border border-dashed border-border px-6 py-16">
              <CheckCircle2 className="size-8 text-primary mb-4" />
              <p className="font-heading text-[19px] text-foreground mb-1">You&apos;re all caught up</p>
              <p className="font-display text-body text-muted-foreground">
                Every follow-up worth sending has been sent. Nice work.
              </p>
            </div>
          ) : (
            <Card className="divide-y divide-border overflow-hidden">
              <AnimatePresence initial={false}>
                {items.map((item, i) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.26, delay: Math.min(i, 6) * 0.04, ease: EASE }}
                  >
                    <FollowUpRow item={item} draft={drafts[item.id]} onOpen={() => handleOpen(item)} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </Card>
          )}
        </div>

        <DraftSheet
          item={activeDraftItem}
          prefetchedDraft={activeDraftItem ? drafts[activeDraftItem.id] : undefined}
          onClose={() => setActiveDraftItem(null)}
          onSent={handleSent}
          onSkip={handleSkip}
        />
        <Toaster />
      </div>
    </MotionConfig>
  );
}
