"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { fmtPhone, relTime } from "@/lib/utils";

type Card = { id: string; phone: string; firstLine: string | null; receivedAt: string };

/**
 * "New number messaged you — add as client?" Someone who isn't a client
 * messaged her WhatsApp Business number. Aria kept only the number and the
 * first line, for 24 hours; nothing else from them is saved unless she adds them.
 */
export function WhatsAppUnknownCards() {
  const router = useRouter();
  const [cards, setCards] = useState<Card[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/whatsapp/unknown", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { cards: [] }))
      .then((d: { cards?: Card[] }) => setCards(d.cards ?? []))
      .catch(() => {});
  }, []);

  async function add(card: Card) {
    setBusy(card.id);
    try {
      const res = await fetch(`/api/whatsapp/unknown/${card.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: names[card.id] ?? "" }),
      });
      const json = (await res.json().catch(() => ({}))) as { clientId?: string; created?: boolean; error?: string };
      if (!res.ok || !json.clientId) throw new Error(json.error ?? "Couldn't add the client");
      setCards((prev) => prev.filter((c) => c.id !== card.id));
      toast.success(json.created ? "Added — their WhatsApp messages now show on their profile" : "Already a client");
      router.push(`/clients/${json.clientId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't add the client");
    } finally {
      setBusy(null);
    }
  }

  function dismiss(card: Card) {
    setCards((prev) => prev.filter((c) => c.id !== card.id));
    void fetch(`/api/whatsapp/unknown/${card.id}`, { method: "DELETE" });
  }

  if (!cards.length) return null;

  return (
    <section className="mb-8 space-y-2.5" aria-label="New numbers on WhatsApp">
      {cards.map((card) => (
        <div key={card.id} className="rounded-2xl border border-border bg-card px-4 py-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MessageCircle className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-body font-semibold text-foreground">New number messaged you — add as client?</p>
              <p className="font-display text-caption text-muted-foreground">
                {fmtPhone(card.phone)} · WhatsApp · {relTime(card.receivedAt)}
              </p>
              {card.firstLine ? <p className="mt-1.5 line-clamp-2 font-display text-body text-foreground">&ldquo;{card.firstLine}&rdquo;</p> : null}
            </div>
            <button type="button" onClick={() => dismiss(card)} aria-label="Dismiss" className="-mr-1 rounded-full p-1.5 text-muted-foreground hover:bg-secondary">
              <X className="size-4" />
            </button>
          </div>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void add(card);
            }}
          >
            <input
              value={names[card.id] ?? ""}
              onChange={(e) => setNames((n) => ({ ...n, [card.id]: e.target.value }))}
              placeholder="Their name (optional)"
              aria-label="Their name"
              className="min-w-0 flex-1 rounded-xl border border-input bg-secondary px-3 py-2 font-display text-body text-foreground outline-none placeholder:text-muted-foreground focus:border-ring"
            />
            <Button type="submit" disabled={busy === card.id} className="h-10 shrink-0 rounded-xl px-4 font-semibold">
              {busy === card.id ? "Adding…" : "Add"}
            </Button>
          </form>
          <p className="mt-2 font-display text-[11px] text-muted-foreground">Not saved unless you add them. Gone in 24 hours.</p>
        </div>
      ))}
    </section>
  );
}
