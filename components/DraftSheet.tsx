"use client";

import { Drawer } from "vaul";
import { useEffect, useState, useRef } from "react";
import type { TodayItem } from "@/lib/today-items";

export type DraftSheetProps = {
  item: TodayItem | null;
  prefetchedDraft?: string;
  onClose: () => void;
  onSent: (itemId: string) => void;
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

export function DraftSheet({ item, prefetchedDraft, onClose, onSent }: DraftSheetProps) {
  const [draftText, setDraftText] = useState("");
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [sendState, setSendState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isOpen = item !== null;
  const hasPhone = !!item?.clientPhone;
  const isSending = sendState === "sending";
  const canSend = hasPhone && draftText.trim().length > 0 && !loading && !isSending;

  // Populate draft when item changes — use prefetched draft if available, otherwise fetch
  useEffect(() => {
    if (!item) {
      // Reset all state when sheet closes
      setDraftText("");
      setIsEditing(false);
      setSendState("idle");
      setErrorMsg("");
      return;
    }

    setIsEditing(false);
    setSendState("idle");
    setErrorMsg("");

    // Use prefetched draft if ready (non-undefined means the prefetch ran)
    if (prefetchedDraft !== undefined) {
      setDraftText(prefetchedDraft);
      setLoading(false);
      return;
    }

    // Fall back to fetching (e.g. user tapped before prefetch completed)
    let cancelled = false;
    setLoading(true);
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
      }),
    })
      .then((r) => r.json())
      .then((data: { draft?: string }) => {
        if (!cancelled) setDraftText(data.draft ?? "");
      })
      .catch(() => {
        if (!cancelled) setDraftText("");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]); // intentionally keyed on item.id — re-populate only when a different item opens

  // Focus textarea when edit mode turns on
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  async function handleSend() {
    if (!item || !canSend) return;
    triggerHaptic();
    setSendState("sending");
    setErrorMsg("");

    try {
      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: item.clientId,
          to: item.clientPhone,
          body: draftText,
        }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };

      if (!data.success) {
        setErrorMsg(data.error ?? "Could not send. Try again.");
        setSendState("error");
        return;
      }

      setSendState("sent");
      setTimeout(() => {
        onSent(item.id);
        onClose();
      }, 1000);
    } catch {
      setErrorMsg("Could not send. Try again.");
      setSendState("error");
    }
  }

  function handleEditToggle() {
    triggerHaptic();
    setIsEditing((v) => !v);
  }

  return (
    <Drawer.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Drawer.Portal>
        <Drawer.Overlay
          className="fixed inset-0 z-40"
          style={{ background: "rgba(0,0,0,0.6)" }}
        />
        <Drawer.Content
          className="fixed bottom-0 left-0 right-0 z-50 flex flex-col outline-none"
          style={{
            background: "#0a0a0a",
            borderRadius: "20px 20px 0 0",
            maxHeight: "88vh",
          }}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div
              className="h-1 w-10 rounded-full"
              style={{ background: "#3a3a3c" }}
            />
          </div>

          <div className="flex flex-col px-6 pb-10 overflow-y-auto flex-1">
            {/* Header */}
            <div className="mt-4 mb-5">
              <h2 className="text-[18px] font-bold leading-tight" style={{ color: "#ffffff" }}>
                {item?.actionLabel ?? ""}
              </h2>
              <p className="mt-1 text-[14px]" style={{ color: item?.clientPhone ? "#9CA3AF" : "#EF4444" }}>
                {item?.clientPhone
                  ? formatPhone(item.clientPhone)
                  : "No phone number on file"}
              </p>
            </div>

            {/* Voice indicator */}
            <p className="mb-2 text-[12px]" style={{ color: "#6B7280" }}>
              Written in your voice
            </p>

            {/* Draft textarea */}
            {loading ? (
              <div className="space-y-2 mb-5">
                <div className="h-4 rounded animate-pulse" style={{ background: "#1c1c1e", width: "92%" }} />
                <div className="h-4 rounded animate-pulse" style={{ background: "#1c1c1e", width: "78%" }} />
                <div className="h-4 rounded animate-pulse" style={{ background: "#1c1c1e", width: "85%" }} />
                <p className="text-[13px] pt-1" style={{ color: "#6B7280" }}>Drafting in your voice…</p>
              </div>
            ) : (
              <textarea
                ref={textareaRef}
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                readOnly={!isEditing}
                rows={5}
                className="w-full rounded-[12px] p-4 text-[17px] leading-relaxed resize-none outline-none mb-5"
                style={{
                  background: "#111111",
                  border: "1px solid #222222",
                  color: "#ffffff",
                  minHeight: "160px",
                  opacity: isEditing ? 1 : 0.9,
                }}
              />
            )}

            {/* Error message */}
            {sendState === "error" && errorMsg && (
              <p className="mb-3 text-[14px] text-center" style={{ color: "#EF4444" }}>
                {errorMsg}
              </p>
            )}

            {/* Send button */}
            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend || sendState === "sent"}
              className="w-full rounded-[12px] py-[17px] text-[17px] font-semibold text-white mb-3 disabled:opacity-50"
              style={{
                background: sendState === "sent" ? "#16a34a" : "#3B82F6",
                minHeight: "56px",
                transition: "background 0.2s",
              }}
            >
              {sendState === "sending"
                ? "Sending…"
                : sendState === "sent"
                  ? "Sent ✓"
                  : "Send"}
            </button>

            {/* Edit toggle */}
            <button
              type="button"
              onClick={handleEditToggle}
              disabled={loading}
              className="w-full rounded-[12px] py-[15px] text-[16px] font-semibold mb-3 disabled:opacity-40"
              style={{
                background: "#1c1c1e",
                color: "#aeaeb2",
              }}
            >
              {isEditing ? "Done editing" : "Edit"}
            </button>

            {/* Cancel */}
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={onClose}
                className="text-[14px]"
                style={{ color: "#6B7280" }}
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
