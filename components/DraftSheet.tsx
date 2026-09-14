"use client";

import { Drawer } from "vaul";
import { useCallback, useEffect, useLayoutEffect, useState, useRef } from "react";
import type { TodayItem } from "@/lib/today-items";
import { smsUrl, whatsAppUrl } from "@/lib/messaging-links";

export type DraftSheetProps = {
  item: TodayItem | null;
  prefetchedDraft?: string;
  onClose: () => void;
  onSent: (itemId: string) => void;
  /** Optional — when passed, shows a "Skip for today" link alongside Cancel. */
  onSkip?: (itemId: string) => void;
};

function formatPhone(raw: string | null): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits[0] === "1") {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw;
}

function triggerHaptic() {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(10);
    }
  } catch {
    // never let haptic failure surface
  }
}

export function DraftSheet({ item, prefetchedDraft, onClose, onSent, onSkip }: DraftSheetProps) {
  const [draftText, setDraftText] = useState("");
  const [loading, setLoading] = useState(false);
  const [draftFailed, setDraftFailed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isOpen = item !== null;
  const hasPhone = !!item?.clientPhone;
  const canSend = hasPhone && draftText.trim().length > 0 && !loading;

  // Capacitor's WKWebView user agent does not include "Safari", so Vaul's
  // Safari-only body lock misses it. Own the lock for this sheet, including
  // restoration, so focusing the editor cannot scroll the page underneath.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const body = document.body;
    const { scrollX, scrollY } = window;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
    };
    Object.assign(body.style, {
      position: "fixed", top: `${-scrollY}px`, left: `${-scrollX}px`, right: "0", width: "100%",
    });
    return () => {
      textareaRef.current?.blur();
      Object.assign(body.style, previous);
      window.scrollTo({ left: scrollX, top: scrollY, behavior: "instant" });
      opener?.focus({ preventScroll: true });
    };
  }, [isOpen]);

  // Populate draft when item changes — use prefetched draft if available, otherwise fetch
  // Extracted so the "Try again" button can re-run the exact same fetch.
  const fetchDraft = useCallback(() => {
    if (!item) return () => {};
    let cancelled = false;
    setLoading(true);
    setDraftFailed(false);
    setDraftText("");

    fetch("/api/ai/draft-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientName: item.clientName,
        scenario: item.reason,
        context: item.context ?? "",
        clientId: item.clientId,
        skipInsert: true,
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
        if (cancelled) return;
        const d = data.draft ?? "";
        setDraftText(d);
        if (!d) setDraftFailed(true);
      })
      .catch(() => {
        if (!cancelled) setDraftFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]); // intentionally keyed on item.id — re-populate only when a different item opens

  useEffect(() => {
    if (!item) {
      setDraftText("");
      setIsEditing(false);
      setDraftFailed(false);
      return;
    }

    setIsEditing(false);

    // Use prefetched draft if ready (non-undefined means the prefetch ran)
    if (prefetchedDraft !== undefined) {
      setDraftText(prefetchedDraft);
      setDraftFailed(!prefetchedDraft);
      setLoading(false);
      return;
    }

    // Fall back to fetching (e.g. user tapped before prefetch completed)
    return fetchDraft();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  // Focus textarea when edit mode turns on
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus({ preventScroll: true });
    }
  }, [isEditing]);

  async function logAndOpen(channel: "sms" | "whatsapp") {
    if (!item || !canSend) return;
    triggerHaptic();

    // Log the activity first (fire-and-forget — don't block native app open)
    void fetch("/api/activities/log-send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: item.clientId, body: draftText, channel }),
    });

    const phone = item.clientPhone ?? "";
    const url = channel === "sms" ? smsUrl(phone, draftText) : whatsAppUrl(phone, draftText);
    window.location.href = url;

    // Mark as sent in the Today list after a brief delay
    setTimeout(() => {
      onSent(item.id);
      onClose();
    }, 600);
  }

  function handleEditToggle() {
    triggerHaptic();
    if (isEditing) textareaRef.current?.blur();
    setIsEditing((v) => !v);
  }

  return (
    <Drawer.Root open={isOpen} noBodyStyles disablePreventScroll={false} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-[2px]" />
        <Drawer.Content
          onCloseAutoFocus={(event) => event.preventDefault()}
          className="fixed bottom-0 left-0 right-0 z-50 flex flex-col outline-none bg-card border border-border border-b-0 rounded-t-[28px]"
          style={{ maxHeight: "88vh" }}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="h-1 w-10 rounded-full bg-border" />
          </div>

          <div className="flex flex-col px-6 pb-10 overflow-y-auto flex-1">
            {/* Header */}
            <div className="mt-4 mb-5">
              <h2 className="font-heading text-[22px] leading-tight text-foreground">
                {item?.actionLabel ?? ""}
              </h2>
              <p className={`mt-1 font-display text-body ${item?.clientPhone ? "text-muted-foreground" : "text-destructive"}`}>
                {item?.clientPhone
                  ? formatPhone(item.clientPhone)
                  : "No phone number on file"}
              </p>
            </div>

            {/* Voice indicator */}
            <p className="mb-2 font-display text-caption text-muted-foreground">Written in your voice</p>

            {/* Draft textarea */}
            {loading ? (
              <div className="space-y-2 mb-5">
                <div className="h-4 rounded animate-pulse bg-secondary" style={{ width: "92%" }} />
                <div className="h-4 rounded animate-pulse bg-secondary" style={{ width: "78%" }} />
                <div className="h-4 rounded animate-pulse bg-secondary" style={{ width: "85%" }} />
                <p className="font-display text-caption text-muted-foreground pt-1">Drafting in your voice…</p>
              </div>
            ) : draftFailed && draftText.trim().length === 0 ? (
              <div className="mb-5 rounded-2xl border border-dashed border-border px-6 py-8 text-center">
                <p className="font-display text-body font-medium text-foreground mb-1">
                  Couldn&apos;t draft that message
                </p>
                <p className="font-display text-caption text-muted-foreground mb-4">
                  Check your connection and try again — or write it yourself below.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    fetchDraft();
                  }}
                  className="rounded-full px-5 h-10 font-display text-body font-semibold bg-primary text-primary-foreground active:scale-[0.97] transition-transform"
                >
                  Try again
                </button>
              </div>
            ) : (
              <textarea
                ref={textareaRef}
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                readOnly={!isEditing}
                rows={5}
                className="w-full rounded-xl p-4 font-display text-body-lg leading-relaxed resize-none outline-none mb-5 bg-secondary border border-transparent focus:border-input text-foreground"
                style={{ minHeight: "160px" }}
              />
            )}

            {/* No phone — actionable, not a dead end */}
            {!hasPhone && item && (
              <p className="mb-3 font-display text-caption text-center text-muted-foreground">
                <a
                  href={`/clients/${item.clientId}`}
                  className="font-semibold text-primary"
                >
                  Add a phone number to text them →
                </a>
              </p>
            )}

            {/* Send + WhatsApp buttons */}
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => logAndOpen("sms")}
                disabled={!canSend}
                className="flex-1 rounded-xl py-[17px] font-display text-body-lg font-semibold bg-primary text-primary-foreground disabled:opacity-40 active:scale-[0.97] transition-transform duration-100"
                style={{ minHeight: "56px" }}
              >
                SMS
              </button>
              <button
                type="button"
                onClick={() => logAndOpen("whatsapp")}
                disabled={!canSend}
                className="flex-1 rounded-xl py-[15px] font-display text-body-lg font-semibold border disabled:opacity-40 active:scale-[0.97] transition-transform duration-100"
                style={{ minHeight: "56px", borderColor: "#25D366", color: "#25D366", background: "transparent" }}
              >
                WhatsApp
              </button>
            </div>

            {/* Edit toggle */}
            <button
              type="button"
              onClick={handleEditToggle}
              disabled={loading}
              className="w-full rounded-xl py-[15px] font-display text-body-lg font-semibold mb-3 bg-secondary text-foreground disabled:opacity-40"
            >
              {isEditing ? "Done editing" : "Edit"}
            </button>

            {/* Skip / Cancel */}
            <div className="flex items-center justify-center gap-5 pt-1">
              {onSkip && item && (
                <button
                  type="button"
                  onClick={() => onSkip(item.id)}
                  className="font-display text-caption text-muted-foreground hover:text-foreground transition-colors"
                >
                  Skip for today
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="font-display text-caption text-muted-foreground/60 hover:text-muted-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
