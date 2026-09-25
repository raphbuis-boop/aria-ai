"use client";

import type { MlsListingPayload } from "@/lib/simplyrets";
import { fmtMoney } from "@/lib/utils";
import { smsUrl } from "@/lib/messaging-links";
import { useToast } from "@/components/ToastProvider";
import { useEffect, useState } from "react";

export type MatchHit = {
  clientId: string;
  name: string | null;
  phone: string | null;
  score: number;
  reasons: string[];
};

export function MatchClientsModal({
  open,
  onClose,
  listing,
}: {
  open: boolean;
  onClose: () => void;
  listing: MlsListingPayload | null;
}) {
  const toast = useToast();
  const [matches, setMatches] = useState<MatchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [working, setWorking] = useState<"draft" | "send" | null>(null);

  useEffect(() => {
    if (!open || !listing) {
      setMatches([]);
      setSelected(new Set());
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch("/api/mls/match-clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listing }),
        });
        const data = (await res.json()) as { matches?: MatchHit[] };
        if (!cancelled) {
          const m = data.matches ?? [];
          setMatches(m);
          setSelected(new Set(m.map((x) => x.clientId)));
        }
      } catch {
        if (!cancelled) toast.toast("Could not load matches", "warn");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, listing]); // eslint-disable-line react-hooks/exhaustive-deps -- toast only in error path

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function draftSelected() {
    if (!listing) return;
    const ids = matches.filter((m) => selected.has(m.clientId));
    if (!ids.length) {
      toast.toast("Select at least one client", "warn");
      return;
    }
    setWorking("draft");
    try {
      let n = 0;
      for (const m of ids) {
        const res = await fetch("/api/ai/draft-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId: m.clientId,
            clientName: m.name ?? "there",
            propertyContext: `${listing.address} in ${listing.city} at ${fmtMoney(listing.price)}`,
            scenario: "MLS listing match",
            skipInsert: false,
          }),
        });
        if (res.ok) n += 1;
      }
      toast.toast(`${n} draft${n === 1 ? "" : "s"} in Inbox`, "success");
      onClose();
    } catch {
      toast.toast("Draft failed", "warn");
    } finally {
      setWorking(null);
    }
  }

  // sms: deep links hand off to the native Messages app one recipient at a
  // time — there's no server-side "blast" anymore. So this opens Messages
  // for the first selected client and queues the rest as real pending
  // drafts (visible in Inbox) instead of silently dropping them.
  async function sendAll() {
    if (!listing) return;
    const ids = matches.filter(
      (m) => selected.has(m.clientId) && m.phone?.trim(),
    );
    if (!ids.length) {
      toast.toast("Select clients with phone numbers", "warn");
      return;
    }
    if (
      !window.confirm(
        `Text ${ids.length} client${ids.length === 1 ? "" : "s"} about this listing?`,
      )
    ) {
      return;
    }
    setWorking("send");
    try {
      const [first, ...rest] = ids;
      const propertyContext = `${listing.address} in ${listing.city} at ${fmtMoney(listing.price)}`;

      const firstDraft = await fetch("/api/ai/draft-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: first.clientId,
          clientName: first.name ?? "there",
          propertyContext,
          scenario: "MLS listing match",
          skipInsert: true,
        }),
      });
      const { draft: firstText } = (await firstDraft.json()) as { draft?: string };
      const body = (firstText ?? "").trim();

      if (body) {
        void fetch("/api/activities/log-send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId: first.clientId, body, channel: "sms" }),
        });
        window.location.href = smsUrl(first.phone!, body);
      }

      let queued = 0;
      for (const m of rest) {
        const res = await fetch("/api/ai/draft-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId: m.clientId,
            clientName: m.name ?? "there",
            propertyContext,
            scenario: "MLS listing match",
            skipInsert: false,
          }),
        });
        if (res.ok) queued += 1;
      }

      toast.toast(
        queued > 0
          ? `Opening text to ${first.name ?? "client"} — ${queued} more drafted to Inbox`
          : `Opening text to ${first.name ?? "client"}`,
        "success",
      );
      onClose();
    } catch {
      toast.toast("Send failed", "warn");
    } finally {
      setWorking(null);
    }
  }

  if (!open || !listing) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-scrim backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label="Match to clients">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className="relative z-10 mb-6 max-h-[85vh] w-full max-w-lg overflow-hidden rounded-t-[22px] border border-border bg-card shadow-xl">
        <div className="border-b border-border px-4 py-3">
          <p className="text-[15px] font-semibold text-foreground">
            Match to clients
          </p>
          <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
            {listing.address} · {fmtMoney(listing.price)}
          </p>
        </div>
        <div className="max-h-[50vh] overflow-y-auto px-4 py-3">
          {loading ? (
            <p className="py-6 text-center text-[13px] text-muted-foreground">
              Finding matches…
            </p>
          ) : matches.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-muted-foreground">
              No clients matched this listing (score ≥ 40).
            </p>
          ) : (
            <>
              <p className="mb-3 text-[12px] text-muted-foreground">
                This property matches {matches.length} of your clients:
              </p>
              <ul className="space-y-2">
                {matches.map((m) => (
                  <li key={m.clientId}>
                    <label className="flex cursor-pointer items-start gap-3 rounded-[12px] border border-border bg-secondary px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={selected.has(m.clientId)}
                        onChange={() => toggle(m.clientId)}
                        className="mt-1 rounded border-border"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="text-[13px] font-medium text-foreground">
                            {m.name ?? "Client"}
                          </span>
                          <span className="text-[12px] font-bold text-primary">
                            {m.score}% match
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {m.reasons.join(" · ")}
                        </p>
                        {!m.phone?.trim() ? (
                          <p className="mt-1 text-[10px] text-warm">
                            No phone — can&apos;t SMS
                          </p>
                        ) : null}
                      </div>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div className="flex flex-col gap-2 border-t border-border bg-secondary/80 px-4 py-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={working !== null || matches.length === 0}
              onClick={() => void draftSelected()}
              className="flex-1 rounded-[10px] bg-primary px-3 py-2.5 text-[12px] font-semibold text-primary-foreground disabled:opacity-50"
            >
              {working === "draft" ? "Drafting…" : "Draft AI text"}
            </button>
            <button
              type="button"
              disabled={working !== null || matches.length === 0}
              onClick={() => void sendAll()}
              className="flex-1 rounded-[10px] border border-border bg-card px-3 py-2.5 text-[12px] font-semibold text-foreground disabled:opacity-50"
            >
              {working === "send" ? "Opening…" : "Text (SMS)"}
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-[10px] py-2 text-[12px] text-muted-foreground"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
