"use client";

import type { MlsListingPayload } from "@/lib/simplyrets";
import { fmtMoney } from "@/lib/utils";
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
        `Send SMS to ${ids.length} client${ids.length === 1 ? "" : "s"} now?`,
      )
    ) {
      return;
    }
    setWorking("send");
    try {
      let ok = 0;
      for (const m of ids) {
        const dr = await fetch("/api/ai/draft-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId: m.clientId,
            clientName: m.name ?? "there",
            propertyContext: `${listing.address} in ${listing.city} at ${fmtMoney(listing.price)}`,
            scenario: "MLS listing match",
            skipInsert: true,
          }),
        });
        const { draft } = (await dr.json()) as { draft?: string };
        const body = (draft ?? "").trim();
        if (!body) continue;
        const send = await fetch("/api/sms/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId: m.clientId,
            to: m.phone,
            body,
          }),
        });
        if (send.ok) ok += 1;
      }
      toast.toast(`Sent ${ok} message${ok === 1 ? "" : "s"}`, "success");
      onClose();
    } catch {
      toast.toast("Send failed", "warn");
    } finally {
      setWorking(null);
    }
  }

  if (!open || !listing) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/65 backdrop-blur-[2px]">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className="relative z-10 mb-6 max-h-[85vh] w-full max-w-lg overflow-hidden rounded-t-[22px] border border-border-card bg-bg-card shadow-xl">
        <div className="border-b border-border-card px-4 py-3">
          <p className="text-[15px] font-semibold text-text-primary">
            Match to clients
          </p>
          <p className="mt-0.5 truncate text-[12px] text-text-dim">
            {listing.address} · {fmtMoney(listing.price)}
          </p>
        </div>
        <div className="max-h-[50vh] overflow-y-auto px-4 py-3">
          {loading ? (
            <p className="py-6 text-center text-[13px] text-text-dim">
              Finding matches…
            </p>
          ) : matches.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-text-dim">
              No clients matched this listing (score ≥ 40).
            </p>
          ) : (
            <>
              <p className="mb-3 text-[12px] text-text-muted">
                This property matches {matches.length} of your clients:
              </p>
              <ul className="space-y-2">
                {matches.map((m) => (
                  <li key={m.clientId}>
                    <label className="flex cursor-pointer items-start gap-3 rounded-[12px] border border-border-card bg-bg-deep px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={selected.has(m.clientId)}
                        onChange={() => toggle(m.clientId)}
                        className="mt-1 rounded border-border-card"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="text-[13px] font-medium text-text-primary">
                            {m.name ?? "Client"}
                          </span>
                          <span className="text-[12px] font-bold text-accent-blue">
                            {m.score}% match
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-text-dim">
                          {m.reasons.join(" · ")}
                        </p>
                        {!m.phone?.trim() ? (
                          <p className="mt-1 text-[10px] text-accent-amber">
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
        <div className="flex flex-col gap-2 border-t border-border-card bg-bg-deep/80 px-4 py-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={working !== null || matches.length === 0}
              onClick={() => void draftSelected()}
              className="flex-1 rounded-[10px] bg-accent-blue px-3 py-2.5 text-[12px] font-semibold text-white disabled:opacity-50"
            >
              {working === "draft" ? "Drafting…" : "Draft AI text"}
            </button>
            <button
              type="button"
              disabled={working !== null || matches.length === 0}
              onClick={() => void sendAll()}
              className="flex-1 rounded-[10px] border border-border-card bg-bg-card px-3 py-2.5 text-[12px] font-semibold text-text-primary disabled:opacity-50"
            >
              {working === "send" ? "Sending…" : "Send all (SMS)"}
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-[10px] py-2 text-[12px] text-text-dim"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
