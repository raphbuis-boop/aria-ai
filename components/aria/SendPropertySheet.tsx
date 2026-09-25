"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { fmtMoney } from "@/lib/utils";

export type SendableProperty = {
  id: string;
  address: string | null;
  town: string | null;
  price: number | null;
  beds: number | null;
  baths: number | null;
};

export type SendTarget = { id: string; name: string };

function defaultMessage(firstName: string, p: SendableProperty): string {
  const facts = [
    p.price != null ? fmtMoney(p.price) : null,
    p.beds != null ? `${p.beds} bd` : null,
    p.baths != null ? `${p.baths} ba` : null,
  ].filter(Boolean);
  const where = [p.address, p.town].filter(Boolean).join(", ");
  return `Hi ${firstName}, this one made me think of you: ${where}${facts.length ? ` (${facts.join(" · ")})` : ""}. Want to take a look?`;
}

/**
 * Texts a home to a client from Aria's Twilio number (same thread Aria uses)
 * via the existing /api/clients/[id]/aria "send" action, which also marks the
 * home as sent on the client's matches.
 */
export function SendPropertySheet({
  property,
  target,
  onClose,
}: {
  property: SendableProperty | null;
  target: SendTarget | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const open = Boolean(property && target);

  useEffect(() => {
    if (property && target) setText(defaultMessage(target.name.split(" ")[0] || "there", property));
  }, [property, target]);

  if (!open || !property || !target) return null;

  async function send() {
    setBusy(true);
    try {
      const res = await fetch(`/api/clients/${target!.id}/aria`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", body: text, propertyId: property!.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Couldn't send");
      toast.success(`Sent to ${target!.name.split(" ")[0]}`);
      onClose();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-scrim sm:items-center" role="dialog" aria-modal="true" aria-label="Send home">
      <button type="button" aria-label="Close" tabIndex={-1}
        className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-t-[28px] border border-border bg-card px-5 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-5 sm:rounded-[28px]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-heading text-[22px] text-foreground">Send to {target.name.split(" ")[0]}</p>
            <p className="truncate font-display text-caption text-muted-foreground">{property.address}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 text-muted-foreground hover:bg-secondary">
            <X className="size-4" />
          </button>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          maxLength={1000}
          aria-label="Message"
          className="w-full resize-none rounded-xl border border-input bg-background p-4 font-display text-body text-foreground outline-none"
        />
        <p className="mt-2 font-display text-caption text-muted-foreground">
          Texted from Aria&apos;s number, in the same thread as Aria&apos;s messages.
        </p>
        <Button onClick={send} disabled={busy || !text.trim()} className="mt-4 h-12 w-full rounded-xl text-body-lg font-semibold">
          {busy ? "Sending…" : "Send text"}
        </Button>
      </div>
    </div>
  );
}
